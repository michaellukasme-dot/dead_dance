-- dd_flywheel_backend / 01_fans_schema.sql
-- Server-side persistence for the Band→Fan flywheel: "Fans = Ticket Holders; Band = Grouped Users."
-- A free ticket makes the holder a FAN of that band; band + its ticket-holders = one group.
-- Mirrors the security doctrine of the setlist/festival loops: no direct table access for anon;
-- everything goes through SECURITY DEFINER RPCs. Reads are open (counts), the join is a public action
-- (anyone can become a fan) but de-duplicated per (band, fan, show-date) so it can't be spammed.
-- Safe to run more than once (idempotent).

-- ---------- table ----------
create table if not exists public.dd_fans (
  id          uuid primary key default gen_random_uuid(),
  band_slug   text not null,
  band_name   text,
  fan_id      text not null,                 -- anonymous, stable device id (client-generated)
  show_date   text not null default '',      -- '' = band-level; else the specific show date (yyyy-mm-dd)
  show        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (band_slug, fan_id, show_date)       -- one row per fan per band per show → idempotent grabs
);
create index if not exists dd_fans_band_idx on public.dd_fans (band_slug);
create index if not exists dd_fans_fan_idx  on public.dd_fans (fan_id);

-- ---------- RLS: lock the table; only the RPCs below may touch it ----------
alter table public.dd_fans enable row level security;
-- (no policies for anon/auth → direct select/insert/update/delete are denied; RPCs are SECURITY DEFINER)

-- ---------- WRITE: a fan grabs a free ticket → joins the band ----------
create or replace function public.dd_fan_join(p_band text, p_name text, p_show jsonb, p_fan text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_date text; v_fans int;
begin
  if p_band is null or btrim(p_band) = '' or p_fan is null or btrim(p_fan) = '' then
    return jsonb_build_object('error','need band + fan');
  end if;
  v_date := coalesce(p_show->>'date','');
  insert into public.dd_fans (band_slug, band_name, fan_id, show_date, show)
  values (lower(btrim(p_band)), p_name, p_fan, v_date, coalesce(p_show, '{}'::jsonb))
  on conflict (band_slug, fan_id, show_date) do nothing;
  select count(distinct fan_id) into v_fans from public.dd_fans where band_slug = lower(btrim(p_band));
  return jsonb_build_object('ok', true, 'band', lower(btrim(p_band)), 'fans', v_fans);
end $$;

-- ---------- READ: band-level fan count (the group size) ----------
create or replace function public.dd_band_fans(p_band text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'band', lower(btrim(p_band)),
    'fans', (select count(distinct fan_id) from public.dd_fans where band_slug = lower(btrim(p_band)))
  );
$$;

-- ---------- READ: a fan's bands (server-side "wallet" of who they follow) ----------
create or replace function public.dd_fan_bands(p_fan text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(distinct jsonb_build_object('band', band_slug, 'name', band_name)), '[]'::jsonb)
  from public.dd_fans where fan_id = p_fan;
$$;

-- ---------- grants: anon (the app's key) may call the RPCs only ----------
grant execute on function public.dd_fan_join(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.dd_band_fans(text)                    to anon, authenticated;
grant execute on function public.dd_fan_bands(text)                    to anon, authenticated;

-- Optional smoke test (uncomment to try in the SQL editor):
-- select public.dd_fan_join('rift','Rift','{"stage":"Plaza Tropical","date":"2026-08-05"}'::jsonb,'test-fan-1');
-- select public.dd_band_fans('rift');
-- select public.dd_fan_bands('test-fan-1');
