-- ============================================================================
-- dd_roster_setlist.sql — the band-owned ROSTER + SETLIST backend.
--
-- Clients that have been waiting on this (they degrade to []/null until it's run):
--   • dd_roster.js  (window.DDRoster):  dd_roster_list / dd_roster_add / dd_roster_remove
--   • dd_setlist.js (window.DDSetlist): dd_setlist_set / dd_setlist_get / dd_setlist_now
--
-- This is the band's PRESENTATION layer — who's playing (roster) and the set (setlist) that a
-- ticket inherits for display. It is NOT the secure ticket: the HMAC ticket security in
-- 19_ticket_security.sql + 20_ticket_rotating.sql is untouched and unaffected by this file.
--
-- House style: idempotent, create-or-replace, RLS ON (default-deny), all access via
-- SECURITY DEFINER RPCs, grants only on the RPCs. Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ROSTER — a band's members (musicians) + crew, each with an instrument/role.
-- ---------------------------------------------------------------------------
create table if not exists public.dd_roster (
  id           uuid primary key default gen_random_uuid(),
  band_slug    text not null,
  band_name    text,
  member_name  text,
  instrument   text,
  kind         text not null default 'play',   -- 'play' (musician) | 'crew'
  member_id    text,
  sort         int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists dd_roster_band_idx on public.dd_roster (band_slug, sort, created_at);
alter table public.dd_roster enable row level security;   -- default-deny; all reads/writes go through the definer RPCs

-- list a band's roster (ordered) → jsonb array of rows
drop function if exists public.dd_roster_list(text);
create or replace function public.dd_roster_list(p_band_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.sort, r.created_at), '[]'::jsonb)
    from public.dd_roster r
   where r.band_slug = btrim(lower(coalesce(p_band_slug, '')));
$$;

-- add a member → returns the new row (jsonb) or null on bad input
drop function if exists public.dd_roster_add(text, text, text, text, text, text, int);
create or replace function public.dd_roster_add(
  p_band_slug text, p_band_name text, p_member_name text,
  p_instrument text, p_kind text, p_member_id text, p_sort int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text; r public.dd_roster;
begin
  v_slug := btrim(lower(coalesce(p_band_slug, '')));
  if v_slug = '' or btrim(coalesce(p_member_name, '')) = '' then return null; end if;
  insert into public.dd_roster(band_slug, band_name, member_name, instrument, kind, member_id, sort)
  values (
    v_slug,
    nullif(btrim(coalesce(p_band_name, '')), ''),
    left(btrim(p_member_name), 80),
    nullif(left(btrim(coalesce(p_instrument, '')), 60), ''),
    (case when lower(coalesce(p_kind, 'play')) = 'crew' then 'crew' else 'play' end),
    nullif(btrim(coalesce(p_member_id, '')), ''),
    coalesce(p_sort, 0)
  ) returning * into r;
  return to_jsonb(r);
end $$;

-- remove a member by id (client passes the uuid as text)
drop function if exists public.dd_roster_remove(text);
create or replace function public.dd_roster_remove(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  begin v := btrim(coalesce(p_id, ''))::uuid; exception when others then return jsonb_build_object('ok', false, 'reason', 'bad_id'); end;
  delete from public.dd_roster where id = v;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- SETLIST — one row per band: the songs, plus optional live "drip" timing so
-- dd_setlist_now can compute (server-side, no client guessing) which song is up.
-- ---------------------------------------------------------------------------
create table if not exists public.dd_setlist (
  band_slug   text primary key,
  band_name   text,
  songs       jsonb not null default '[]'::jsonb,
  drip_start  timestamptz,
  drip_min    numeric,
  archived    boolean not null default false,   -- Phase 6 lock (kept for forward-compat; not enforced here)
  updated_at  timestamptz not null default now()
);
alter table public.dd_setlist enable row level security;   -- default-deny; access via the definer RPCs

-- set / replace a band's setlist (+ optional drip). Upsert by band. Returns the row.
drop function if exists public.dd_setlist_set(text, text, jsonb, timestamptz, numeric);
create or replace function public.dd_setlist_set(
  p_band_slug text, p_band_name text, p_songs jsonb, p_drip_start timestamptz, p_drip_min numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text; r public.dd_setlist;
begin
  v_slug := btrim(lower(coalesce(p_band_slug, '')));
  if v_slug = '' then return null; end if;
  insert into public.dd_setlist(band_slug, band_name, songs, drip_start, drip_min, updated_at)
  values (
    v_slug,
    nullif(btrim(coalesce(p_band_name, '')), ''),
    coalesce(p_songs, '[]'::jsonb),
    p_drip_start,
    p_drip_min,
    now()
  )
  on conflict (band_slug) do update
     set band_name  = coalesce(excluded.band_name, public.dd_setlist.band_name),
         songs      = excluded.songs,
         drip_start = excluded.drip_start,
         drip_min   = excluded.drip_min,
         updated_at = now()
   where public.dd_setlist.archived = false        -- an archived (locked) set never changes
  returning * into r;
  if r.band_slug is null then                       -- update skipped because archived → return the locked row
    select * into r from public.dd_setlist where band_slug = v_slug;
  end if;
  return to_jsonb(r);
end $$;

-- get a band's setlist row → jsonb array (client takes [0]); [] if none
drop function if exists public.dd_setlist_get(text);
create or replace function public.dd_setlist_get(p_band_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    from public.dd_setlist s
   where s.band_slug = btrim(lower(coalesce(p_band_slug, '')));
$$;

-- which song is up RIGHT NOW, computed from the drip (server-side truth). Returns the raw
-- current song element (a title string, or the band's song object) — or null if not running.
drop function if exists public.dd_setlist_now(text);
create or replace function public.dd_setlist_now(p_band_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.dd_setlist; n int; idx int; elapsed_min numeric;
begin
  select * into s from public.dd_setlist where band_slug = btrim(lower(coalesce(p_band_slug, '')));
  if not found then return null; end if;
  if s.drip_start is null or s.drip_min is null or s.drip_min <= 0 then return null; end if;
  n := jsonb_array_length(coalesce(s.songs, '[]'::jsonb));
  if n = 0 then return null; end if;
  elapsed_min := extract(epoch from (now() - s.drip_start)) / 60.0;
  if elapsed_min < 0 then return null; end if;             -- set hasn't started
  idx := floor(elapsed_min / s.drip_min)::int;
  if idx < 0 or idx >= n then return null; end if;         -- before the first / after the last
  return s.songs -> idx;                                    -- the raw current song (string or object)
end $$;

-- ---- grants: clients call these; the tables themselves stay RLS-locked (no direct access) ----
grant execute on function public.dd_roster_list(text)                               to anon, authenticated, service_role;
grant execute on function public.dd_roster_add(text, text, text, text, text, text, int) to anon, authenticated, service_role;
grant execute on function public.dd_roster_remove(text)                             to anon, authenticated, service_role;
grant execute on function public.dd_setlist_set(text, text, jsonb, timestamptz, numeric) to anon, authenticated, service_role;
grant execute on function public.dd_setlist_get(text)                               to anon, authenticated, service_role;
grant execute on function public.dd_setlist_now(text)                               to anon, authenticated, service_role;

-- ============================================================================
-- SMOKE TEST:
--   select public.dd_roster_add('grateful-dead','Grateful Dead','Jerry Garcia','lead guitar','play',null,0);
--   select public.dd_roster_list('grateful-dead');
--   select public.dd_setlist_set('grateful-dead','Grateful Dead',
--            '["Cold Rain and Snow","Sugaree","Ripple"]'::jsonb, now(), 6);
--   select public.dd_setlist_now('grateful-dead');   -- → "Cold Rain and Snow" (idx 0 in the first 6 min)
-- ============================================================================
