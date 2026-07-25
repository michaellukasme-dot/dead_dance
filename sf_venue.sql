-- sf_venue.sql — turn EVERY venue into a ticket-sales shop. Run ONCE, AFTER sf_reserve.sql. Re-runnable.
--
-- Concept: a venue is just the general case of an event host — from a corner-guitarist café to MusikFest.
-- Every venue gets an externalized calendar/shop page (venue.html?v=<key>) it can link from its own site,
-- and a door mode (door.html) to check fans in and sell at the door. Freemium mirrors the band plan:
--   FREE if StageFill runs your ticketing (we take 15%); a subscription is the escape hatch if you refuse.

-- ── venue identity: a stable slug from name|city|state (events already carry these as text) ──
create or replace function public.sf_venue_key(p_name text, p_city text, p_state text)
returns text language sql immutable as $$
  select regexp_replace(lower(trim(coalesce(p_name,'')||'-'||coalesce(p_city,'')||'-'||coalesce(p_state,''))),
                        '[^a-z0-9]+', '-', 'g')
$$;

-- ── venue plan: the freemium record (ticketing on = free; else subscription by size) ──
create table if not exists public.sf_venue_plan (
  venue_key         text primary key,
  display_name      text,
  city              text,
  state             text,
  owner             text,                                 -- auth.uid()::text of whoever claimed it
  ticketing_enabled boolean not null default true,        -- FREE path: StageFill runs ticketing (15%)
  subscribed        boolean not null default false,       -- paid escape hatch (won't cede ticketing)
  tier              text    not null default 'cafe',      -- cafe($20) | club($99) | theater($299)
  sub_until         date,
  created_at        timestamptz not null default now()
);
alter table public.sf_venue_plan enable row level security;
do $$ begin
  perform 1 from pg_policies where schemaname='public' and tablename='sf_venue_plan' and policyname='sf_venue_plan_read';
  if not found then create policy sf_venue_plan_read on public.sf_venue_plan for select using (true); end if;
end $$;

-- ── ticket check-in fields on the order (QR entry + cash tender) ──
alter table public.sf_order add column if not exists tender        text default 'stripe';  -- stripe | cash | scan
alter table public.sf_order add column if not exists checkin_token text default replace(gen_random_uuid()::text,'-','');
alter table public.sf_order add column if not exists checked_in_at timestamptz;
create unique index if not exists sf_order_checkin_uidx on public.sf_order (checkin_token);

-- ── claim: a venue owner claims their room (first-claimer wins, mirrors the band plan) ──
create or replace function public.sf_venue_claim(p_name text, p_city text, p_state text,
                                                 p_tier text default 'cafe', p_ticketing boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_key text; v_owner text;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('error','no_name'); end if;
  v_key := public.sf_venue_key(p_name, p_city, p_state);
  select owner into v_owner from public.sf_venue_plan where venue_key = v_key;
  if v_owner is not null and v_owner <> v_me then return jsonb_build_object('error','claimed'); end if;  -- someone else owns it
  insert into public.sf_venue_plan(venue_key, display_name, city, state, owner, ticketing_enabled, tier)
    values (v_key, p_name, p_city, p_state, v_me, coalesce(p_ticketing,true),
            case when p_tier in ('cafe','club','theater') then p_tier else 'cafe' end)
    on conflict (venue_key) do update
      set display_name = excluded.display_name, city = excluded.city, state = excluded.state,
          ticketing_enabled = excluded.ticketing_enabled, tier = excluded.tier
      where public.sf_venue_plan.owner = v_me;
  return jsonb_build_object('ok', true, 'key', v_key);
end $$;
grant execute on function public.sf_venue_claim(text, text, text, text, boolean) to anon, authenticated;

-- ── public venue shop: the venue's live, sellable shows (owner also sees locked/preview) ──
create or replace function public.sf_venue_get(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  with evs as (
    select e.* from public.sf_event e
     where e.status = 'live'
       and public.sf_venue_key(e.venue, e.city, e.state) = p_key
       and ( e.subscribed
             or (e.date_start is not null and current_date < e.date_start - e.grace_days)
             or e.owner = auth.uid()::text )
  )
  select jsonb_build_object(
    'key',   p_key,
    'name',  coalesce((select display_name from public.sf_venue_plan where venue_key = p_key),
                      (select venue from evs order by date_start asc nulls last limit 1)),
    'city',  (select city  from evs limit 1),
    'state', (select state from evs limit 1),
    'lat',   (select lat from evs where lat is not null order by date_start asc nulls last limit 1),  -- venue location (from its shows)
    'lng',   (select lng from evs where lng is not null order by date_start asc nulls last limit 1),
    'is_owner', exists(select 1 from evs where owner = auth.uid()::text),   -- built shows here = venue owner (coach only shows to them)
    'plan',  (select jsonb_build_object('ticketing_enabled',ticketing_enabled,'subscribed',subscribed,'tier',tier)
                from public.sf_venue_plan where venue_key = p_key),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
        'slug', e.slug, 'name', e.name, 'cat', e.cat, 'venue', e.venue,
        'date_start', e.date_start, 'date_end', e.date_end, 'start_time', e.start_time,
        'ticket_types', coalesce((select jsonb_agg(jsonb_build_object(
            'id', t.id, 'name', t.name, 'price_cents', t.price_cents, 'currency', t.currency)
          ) from public.sf_ticket_type t where t.event_id = e.id and t.active), '[]'::jsonb)
      ) order by e.date_start asc nulls last, e.start_time asc) from evs e), '[]'::jsonb)
  )
$$;
grant execute on function public.sf_venue_get(text) to anon, authenticated;

-- ── door: cash sale — staff (event owner) issues a paid ticket on the spot, returns its check-in token ──
create or replace function public.sf_issue_ticket(p_event uuid, p_tt uuid, p_qty int, p_tender text default 'cash')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_owner text; v_tt public.sf_ticket_type;
        v_qty int; v_taken int; v_order uuid; v_token text;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  select owner into v_owner from public.sf_event where id = p_event;
  if v_owner is null or v_owner <> v_me then return jsonb_build_object('error','not_staff'); end if;   -- owner-only for MVP
  v_qty := greatest(1, least(20, coalesce(p_qty,1)));
  select * into v_tt from public.sf_ticket_type where id = p_tt and event_id = p_event for update;
  if not found or not v_tt.active then return jsonb_build_object('error','ticket_unavailable'); end if;
  if v_tt.qty_total is not null then                                        -- respect capacity even at the door
    v_taken := v_tt.qty_sold + coalesce((select sum(qty) from public.sf_order
      where ticket_type_id = p_tt and status='pending' and reserved_until is not null and reserved_until > now()),0);
    if v_taken + v_qty > v_tt.qty_total then return jsonb_build_object('error','sold_out'); end if;
  end if;
  insert into public.sf_order(event_id, ticket_type_id, buyer, qty, amount_cents, fee_cents, status, tender)
    values (p_event, p_tt, 'door', v_qty, v_tt.price_cents*v_qty, 0, 'paid',
            case when p_tender in ('cash','scan') then p_tender else 'cash' end)
    returning id, checkin_token into v_order, v_token;
  update public.sf_ticket_type set qty_sold = qty_sold + v_qty where id = p_tt;
  return jsonb_build_object('ok',true,'order_id',v_order,'token',v_token,'qty',v_qty,'name',v_tt.name);
end $$;
revoke execute on function public.sf_issue_ticket(uuid, uuid, int, text) from public;
grant  execute on function public.sf_issue_ticket(uuid, uuid, int, text) to anon, authenticated;

-- ── door: check a fan in by scanning their ticket QR (staff = event owner) ──
create or replace function public.sf_checkin(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); r record;
begin
  if v_me is null then return jsonb_build_object('status','no_session'); end if;
  select o.id, o.status, o.qty, o.checked_in_at, o.ticket_type_id, e.owner, e.name as ev_name,
         (select name from public.sf_ticket_type t where t.id = o.ticket_type_id) as tt_name
    into r
    from public.sf_order o join public.sf_event e on e.id = o.event_id
   where o.checkin_token = p_token;
  if not found then return jsonb_build_object('status','invalid'); end if;
  if r.owner is distinct from v_me then return jsonb_build_object('status','not_staff'); end if;
  if r.status <> 'paid' then return jsonb_build_object('status','unpaid'); end if;
  if r.checked_in_at is not null then
    return jsonb_build_object('status','used','at',r.checked_in_at,'name',r.tt_name,'qty',r.qty);
  end if;
  update public.sf_order set checked_in_at = now() where id = r.id;
  return jsonb_build_object('status','ok','name',r.tt_name,'qty',r.qty,'event',r.ev_name);
end $$;
revoke execute on function public.sf_checkin(text) from public;
grant  execute on function public.sf_checkin(text) to anon, authenticated;
