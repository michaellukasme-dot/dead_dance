-- sf_print_partner.sql — a LOCAL print partner in every chapter (Jay is just the Mid-Atlantic one).
-- DeadDance sells 100% of the tees; each chapter's orders route to that chapter's active partner.
-- Bands AND venues use the same store (kind = band|venue).
-- Run ONCE, AFTER sf_band_merch.sql. Re-runnable.
-- ROADMAP: at scale, add a national partner (Custom Ink / Vista Print) and give band/venue a
--          Local-vs-National print choice (store the choice on the order; route accordingly).
--          Local vs National may carry different price/margin — set per-route pricing at that point.

create table if not exists public.sf_print_partner (
  id         uuid primary key default gen_random_uuid(),
  chapter    text not null,
  name       text,
  city       text,
  contact    text,
  owner      text,                                  -- auth.uid() of the partner
  status     text not null default 'applied',       -- applied | active
  created_at timestamptz not null default now()
);
-- at most ONE active partner per chapter
create unique index if not exists sf_print_partner_active_uidx
  on public.sf_print_partner (chapter) where status = 'active';
alter table public.sf_print_partner enable row level security;   -- reads via RPC; deny-by-default

-- seed Jay as the active Mid-Atlantic partner (idempotent)
insert into public.sf_print_partner(chapter, name, city, status)
  select 'Mid-Atlantic', 'Jay Customz', 'Bethlehem, PA', 'active'
  where not exists (select 1 from public.sf_print_partner where chapter = 'Mid-Atlantic' and status = 'active');

-- who prints for a chapter (public — shown on the order page)
create or replace function public.sf_print_partner_for(p_chapter text)
returns text language sql stable security definer set search_path = public as $$
  select name from public.sf_print_partner where chapter = p_chapter and status = 'active' limit 1;
$$;
grant execute on function public.sf_print_partner_for(text) to anon, authenticated;

-- apply to be your chapter's partner (DeadDance reviews + promotes to active)
create or replace function public.sf_print_partner_apply(p_chapter text, p_name text, p_city text, p_contact text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_id uuid; v_active text;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  if coalesce(trim(p_chapter),'') = '' or coalesce(trim(p_name),'') = '' then return jsonb_build_object('error','need_fields'); end if;
  select name into v_active from public.sf_print_partner where chapter = p_chapter and status = 'active' limit 1;
  insert into public.sf_print_partner(chapter, name, city, contact, owner, status)
    values (p_chapter, p_name, p_city, p_contact, v_me, 'applied') returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'chapter_taken', v_active is not null, 'current', v_active);
end $$;
grant execute on function public.sf_print_partner_apply(text, text, text, text) to anon, authenticated;

-- ── route band-merch orders to the chapter partner ──
alter table public.sf_band_merch_order add column if not exists chapter  text;
alter table public.sf_band_merch_order add column if not exists partner  text;
alter table public.sf_band_merch_order add column if not exists size_mix jsonb;    -- {S,M,L,XL,2XL} counts
alter table public.sf_band_merch_order add column if not exists play_day text;      -- MusikFest set date → pickup timing (spreads Jay's print load)
alter table public.sf_band_merch_order add column if not exists kind text default 'band';  -- band | venue (same store)

create or replace function public.sf_band_merch_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tier text; v_unit int; v_doz int; v_shirts int; v_id uuid;
        v_chapter text; v_partner text; v_pcity text; v_sizes jsonb;
begin
  v_tier := lower(coalesce(p->>'tier',''));
  v_unit := case v_tier when 'less' then 1500 when 'more' then 2000 when 'most' then 2500 else 0 end;
  if v_unit = 0 then return jsonb_build_object('error','bad_tier'); end if;
  if coalesce(trim(p->>'band'),'') = '' then return jsonb_build_object('error','need_band'); end if;
  -- shirts come from the SIZE MIX (server-summed; client can't tamper the total)
  v_sizes := coalesce(p->'sizes', '{}'::jsonb);
  select coalesce(sum(value::int), 0) into v_shirts from jsonb_each_text(v_sizes) where value ~ '^[0-9]+$';
  v_shirts := least(6000, v_shirts);
  if v_shirts < 1 then return jsonb_build_object('error','need_sizes'); end if;
  v_doz := ceil(v_shirts / 12.0);
  v_chapter := nullif(trim(p->>'chapter'),'');
  select name, city into v_partner, v_pcity from public.sf_print_partner
    where chapter = v_chapter and status = 'active' limit 1;
  insert into public.sf_band_merch_order(band, contact, tier, dozens, shirts, unit_cents, total_cents, logo, note, chapter, partner, size_mix, play_day, kind)
    values (nullif(p->>'band',''), nullif(p->>'contact',''), v_tier, v_doz, v_shirts, v_unit, v_unit*v_shirts,
            nullif(p->>'logo',''), nullif(p->>'note',''), v_chapter, v_partner, v_sizes, nullif(p->>'play_day',''),
            case when p->>'kind' = 'venue' then 'venue' else 'band' end)
    returning id into v_id;
  return jsonb_build_object('ok', true, 'order', v_id, 'tier', v_tier, 'shirts', v_shirts,
    'unit_cents', v_unit, 'total_cents', v_unit*v_shirts, 'chapter', v_chapter,
    'partner', v_partner, 'partner_city', v_pcity);
end $$;
grant execute on function public.sf_band_merch_create(jsonb) to anon, authenticated;

-- a partner reads the orders for THEIR chapter (gated to the active partner owner)
create or replace function public.sf_print_partner_queue()
returns setof public.sf_band_merch_order language plpgsql stable security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_ch text;
begin
  if v_me is null then return; end if;
  select chapter into v_ch from public.sf_print_partner where owner = v_me and status = 'active' limit 1;
  if v_ch is null then return; end if;
  return query select * from public.sf_band_merch_order where chapter = v_ch order by created_at desc;
end $$;
grant execute on function public.sf_print_partner_queue() to anon, authenticated;
