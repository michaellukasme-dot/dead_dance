-- sf_hardening.sql — Claudine review fixes. Run ONCE in Supabase SQL editor (AFTER sf_spine.sql + dd_band_plan.sql).
-- Also enable Supabase Auth → "Allow anonymous sign-ins" (the StageFill client signs in anonymously so
-- auth.uid() is a REAL, server-verified id — ownership can no longer be forged).
-- create-or-replace preserves existing grants; only new functions are granted below.

-- ── BLOCKER-1: identity is server-derived only. Ownership = auth.uid(). No client 'owner' fallback. ──
create or replace function public.sf_publish(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me   text := nullif(auth.uid()::text, '');
  v_slug text := nullif(p->>'slug','');
  v_id   uuid;
  v_row  jsonb;
begin
  if v_me is null then raise exception 'sign in required'; end if;
  if v_slug is null then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(p->>'name','event')), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then v_slug := 'event'; end if;
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);
  end if;

  -- reject up front if the slug exists and is owned by someone else (clean error, no silent no-op)
  if exists (select 1 from public.sf_event e where e.slug = v_slug and e.owner <> v_me) then
    raise exception 'slug already taken';
  end if;

  insert into public.sf_event(slug, owner, name, city, state, venue, cat, date_start, date_end, start_time,
                              lat, lng, corners, floor_url, status)
  values (v_slug, v_me, coalesce(p->>'name','Untitled event'), p->>'city', p->>'state', p->>'venue',
          coalesce(p->>'cat','live_music'), nullif(p->>'start','')::date, nullif(p->>'end','')::date, p->>'time',
          nullif(p->>'lat','')::float8, nullif(p->>'lng','')::float8, p->'corners', p->>'floor_url',
          coalesce(p->>'status','live'))
  on conflict (slug) do update set
     name=excluded.name, city=excluded.city, state=excluded.state, venue=excluded.venue, cat=excluded.cat,
     date_start=excluded.date_start, date_end=excluded.date_end, start_time=excluded.start_time,
     lat=excluded.lat, lng=excluded.lng, corners=excluded.corners, floor_url=excluded.floor_url,
     status=excluded.status, updated_at=now()
   where public.sf_event.owner = v_me
  returning id into v_id;

  if v_id is null then raise exception 'slug already taken'; end if;

  delete from public.sf_act where event_id = v_id;
  for v_row in select el from jsonb_array_elements(coalesce(p->'acts','[]'::jsonb)) el loop
    insert into public.sf_act(event_id, name, stage, "time", cat, lat, lng, xpct, ypct)
    values (v_id, v_row->>'name', v_row->>'stage', v_row->>'time', v_row->>'cat',
            nullif(v_row->>'lat','')::float8, nullif(v_row->>'lng','')::float8,
            nullif(v_row->>'xpct','')::float8, nullif(v_row->>'ypct','')::float8);
  end loop;

  delete from public.sf_ticket_type where event_id = v_id;
  for v_row in select el from jsonb_array_elements(coalesce(p->'ticket_types','[]'::jsonb)) el loop
    insert into public.sf_ticket_type(event_id, name, price_cents, currency, qty_total)
    values (v_id, coalesce(v_row->>'name','General'), coalesce(nullif(v_row->>'price_cents','')::int,0),
            coalesce(v_row->>'currency','usd'), nullif(v_row->>'qty_total','')::int);
  end loop;

  delete from public.sf_geofence where event_id = v_id;
  for v_row in select el from jsonb_array_elements(coalesce(p->'geofences','[]'::jsonb)) el loop
    insert into public.sf_geofence(event_id, kind, label, lat, lng, radius_m)
    values (v_id, coalesce(v_row->>'kind','stage'), v_row->>'label',
            nullif(v_row->>'lat','')::float8, nullif(v_row->>'lng','')::float8,
            coalesce(nullif(v_row->>'radius_m','')::int, 25));
  end loop;

  return v_slug;
end $$;

-- ── BLOCKER-1 + BLOCKER-2: public reads project SAFE columns only, and enforce the paywall server-side. ──
-- Servable to the public = live AND (subscribed OR still in the free window before the festival).
create or replace function public.sf_list(p_state text default null, p_city text default null, p_cat text default null)
returns table(slug text, name text, city text, state text, date_start date, date_end date,
              start_time text, cat text, venue text, lat float8, lng float8)
language sql stable security definer set search_path = public as $$
  select e.slug, e.name, e.city, e.state, e.date_start, e.date_end, e.start_time, e.cat, e.venue, e.lat, e.lng
  from public.sf_event e
  where e.status = 'live'
    and (e.subscribed or (e.date_start is not null and current_date < e.date_start - e.grace_days))
    and (p_state is null or e.state = p_state)
    and (p_city  is null or e.city  = p_city)
    and (p_cat   is null or e.cat   = p_cat)
  order by e.date_start asc nulls last, e.created_at desc;
$$;

create or replace function public.sf_get(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'slug', e.slug, 'name', e.name, 'city', e.city, 'state', e.state, 'venue', e.venue, 'cat', e.cat,
      'date_start', e.date_start, 'date_end', e.date_end, 'start_time', e.start_time,
      'lat', e.lat, 'lng', e.lng, 'corners', e.corners, 'floor_url', e.floor_url,
      'locked',   not (e.subscribed or (e.date_start is not null and current_date < e.date_start - e.grace_days)),
      'is_owner', (e.owner = auth.uid()::text)),
    'acts',         coalesce((select jsonb_agg(jsonb_build_object('name',a.name,'stage',a.stage,'time',a."time",'cat',a.cat,'lat',a.lat,'lng',a.lng) order by a."time") from public.sf_act a where a.event_id = e.id), '[]'::jsonb),
    'ticket_types', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'price_cents',t.price_cents,'currency',t.currency)) from public.sf_ticket_type t where t.event_id = e.id and t.active), '[]'::jsonb)
  )
  from public.sf_event e
  where e.slug = p_slug and e.status = 'live'
    and ( e.subscribed
          or (e.date_start is not null and current_date < e.date_start - e.grace_days)
          or e.owner = auth.uid()::text )     -- owner always sees their own (to build/preview) even when locked
  limit 1;
$$;

-- ── BLOCKER-2: null start date is LOCKED (can't compute a free window). ──
create or replace function public.sf_gate(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', e.slug, 'subscribed', e.subscribed, 'grace_days', e.grace_days, 'date_start', e.date_start,
    'lock_on',   case when e.date_start is null then null else (e.date_start - e.grace_days) end,
    'days_left', case when e.date_start is null then null else (e.date_start - e.grace_days) - current_date end,
    'locked',    (not e.subscribed) and (e.date_start is null or current_date >= (e.date_start - e.grace_days))
  )
  from public.sf_event e where e.slug = p_slug limit 1;
$$;

-- ── MEDIUM-1: pings only for a LIVE event and only for geofences that belong to it. ──
create or replace function public.sf_ping_batch(p_event uuid, p_pings jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_p jsonb; v_gf uuid;
begin
  if jsonb_typeof(p_pings) <> 'array' then return 0; end if;
  if not exists (select 1 from public.sf_event e where e.id = p_event and e.status = 'live') then return 0; end if;
  for v_p in select el from jsonb_array_elements(p_pings) el limit 300 loop
    v_gf := nullif(v_p->>'geofence_id','')::uuid;
    if v_gf is not null and not exists (select 1 from public.sf_geofence g where g.id = v_gf and g.event_id = p_event) then
      continue;   -- reject geofences that aren't this event's
    end if;
    insert into public.sf_ping(event_id, device, geofence_id, lat, lng, dwell_s)
    values (p_event, nullif(left(coalesce(v_p->>'device',''),64),''), v_gf,
            nullif(v_p->>'lat','')::float8, nullif(v_p->>'lng','')::float8,
            coalesce(nullif(v_p->>'dwell_s','')::int, 0));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ── HIGH-2: atomic ticket-sold increment (single statement, no read-modify-write race). ──
create or replace function public.sf_ticket_sold_inc(p_tt uuid, p_qty int)
returns void language sql security definer set search_path = public as $$
  update public.sf_ticket_type set qty_sold = qty_sold + greatest(0, p_qty) where id = p_tt;
$$;

-- ── HIGH-2: webhook idempotency — first delivery returns true, replays return false (skip). ──
create table if not exists public.sf_webhook_event ( id text primary key, seen_at timestamptz not null default now() );
alter table public.sf_webhook_event enable row level security;   -- service role only; no policies
create or replace function public.sf_webhook_seen(p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.sf_webhook_event(id) values (p_id) on conflict (id) do nothing;
  return found;   -- true = newly inserted (process it); false = duplicate (skip)
end $$;

-- ── HIGH-1: band freemium — claim-on-first-use ownership; only the owner can flip the switch. ──
alter table public.dd_band_plan add column if not exists owner text;
create or replace function public.dd_band_ticketing_set(p_band text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_owner text;
begin
  if v_me is null then raise exception 'sign in required'; end if;
  select owner into v_owner from public.dd_band_plan where band = p_band;
  if v_owner is not null and v_owner <> v_me then raise exception 'not your band'; end if;
  insert into public.dd_band_plan(band, ticketing_enabled, owner) values (p_band, p_on, v_me)
  on conflict (band) do update set ticketing_enabled = p_on,
       owner = coalesce(public.dd_band_plan.owner, v_me), updated_at = now();
  return true;
end $$;

-- ── grants for the NEW functions (service-role only for money/webhook internals) ──
revoke execute on function public.sf_ticket_sold_inc(uuid, int) from public;
grant  execute on function public.sf_ticket_sold_inc(uuid, int) to service_role;
revoke execute on function public.sf_webhook_seen(text)         from public;
grant  execute on function public.sf_webhook_seen(text)         to service_role;
