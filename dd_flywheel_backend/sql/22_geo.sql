-- ============================================================================
-- 22_geo.sql — DeadDance festival GEO spine (Phase 1 native GPS backend).
--
-- WHAT THIS FILE IS
--   The privacy-by-schema backend for background-GPS telemetry, ADAPTED from the
--   GPSG (connectivity_aware_gps) privacy skeleton into a fresh dd_geo_* namespace
--   in DeadDance's OWN Supabase project. The privacy SHAPE carries over verbatim;
--   the DOMAIN reshapes from thru-hike (trailhead→terminus centerline) to festival
--   VENUE / STAGE / CORRIDOR.
--
-- CRITICAL HONESTY (House Law): "walk me to my stage" needs NO server — the blue
--   dot + arrow are 100% on-device (GNSS needs no cell). This file is ONLY for the
--   OPTIONAL, OPT-IN telemetry/presence products (crowd-geometry for unmapped
--   corridors, aggregate crowd-density). The app works fully without any of it.
--
-- PRIVACY IS STRUCTURAL, NOT PROMISED (adapted from PRIVACY_CHARTER.md):
--   * Raw fragments carry a ROTATING, EPHEMERAL contributor_token — NEVER identity.
--     There is no user_id / email / auth.uid() column on the raw table by design.
--   * Ingest is ONLY through a SECURITY DEFINER RPC that accepts ids + a token +
--     decimated points — and nothing else. It never reads or stores auth.uid().
--   * Public reads are gated to DERIVED/AGGREGATE tables above a k-anonymity floor.
--   * A retention job purges processed raw fragments; only the derived commons
--     (corridor geometry, coverage cells, aggregate presence counts) persists.
--   * RLS ON everywhere. Anon/authenticated have NO read or write path to the raw
--     fragment / presence-base / consent tables (denied by default, no policy);
--     the table owner bypasses so the definer ingest + k-gated view work (as in 07).
--
-- HOUSE STYLE (matches 07_presence / 21_report_aggregates):
--   create-or-replace, idempotent, drop-if-exists first, SECURITY DEFINER +
--   set search_path = public, explicit revoke/grant. Safe to re-run.
--
-- K-ANONYMITY FLOORS (baked at every call site so they cannot drift silently):
--   K_GEOM = 5   — geometry/coverage (not per-person; 5 independent contributors)
--   K_PRESENCE = 20 — presence COUNTS, aligned with DeadDance's existing 07/21 rule
--
-- Run order: standalone (own namespace). Depends only on gen_random_uuid()
--   (pgcrypto, present by default on Supabase). Michael runs this in the SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. VENUE — a festival site. Surveyed by the organizer. Public read.
-- ---------------------------------------------------------------------------
create table if not exists public.dd_geo_venue (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,           -- e.g. 'musikfest-2026'
  name         text not null,
  center_lat   double precision,
  center_lon   double precision,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. STAGE / ZONE — surveyed coordinates + geofence radius. Public read.
--    These are AUTHORED by the organizer (no crowd-geometry needed) → the
--    "you're near Stage X" geofences and the "walk me to my stage" targets.
-- ---------------------------------------------------------------------------
create table if not exists public.dd_geo_stage (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.dd_geo_venue(id) on delete cascade,
  stage_key    text not null,                  -- stable per-venue key, e.g. 'main'
  name         text not null,
  lat          double precision not null,
  lon          double precision not null,
  geofence_radius_m integer not null default 50,
  created_at   timestamptz not null default now(),
  unique (venue_id, stage_key)
);

-- ---------------------------------------------------------------------------
-- 3. CORRIDOR — a walkway centerline. 'surveyed' = organizer-authored (trusted,
--    always public). 'crowd' = accreted from de-identified fragments (public ONLY
--    at/above K_GEOM). Reshape of gpsg_centerline for [CORR]/[TRAIL].
-- ---------------------------------------------------------------------------
create table if not exists public.dd_geo_corridor (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.dd_geo_venue(id) on delete cascade,
  name           text,
  source         text not null default 'crowd'
                   check (source in ('surveyed','crowd')),
  geom_status    text not null default 'seeded'
                   check (geom_status in ('seeded','accreting','mapped')),
  geometry       jsonb not null default '[]'::jsonb,  -- ordered [[lat,lon]...]
  confidence     real  not null default 0,            -- 0..1 sample density/agreement
  n_contributors integer not null default 0,          -- gate 'crowd' publish on >= K_GEOM
  recomputed_at  timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. RAW FRAGMENTS — DE-IDENTIFIED, SHORT-LIVED. No identity column BY DESIGN.
--    contributor_token is rotating + ephemeral. Ingest via RPC only; no public
--    read/write. Reshape of gpsg_track_fragments.
-- ---------------------------------------------------------------------------
create table if not exists public.dd_geo_fragment (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid references public.dd_geo_venue(id) on delete cascade,
  corridor_id       uuid references public.dd_geo_corridor(id) on delete set null,
  contributor_token text not null,               -- ROTATING, NOT identity
  tier              text,                         -- connectivity tier at capture
  points            jsonb not null,               -- decimated [[dlat,dlon,dt,acc]...]
  captured_bucket   timestamptz,                  -- COARSE (hour-truncated) time
  uploaded_at       timestamptz not null default now(),
  client_frag_id    text not null,               -- idempotency key (resumable upload)
  processed         boolean not null default false,
  unique (contributor_token, client_frag_id)      -- dedup / idempotent
);

-- ---------------------------------------------------------------------------
-- 5. COVERAGE CELLS — the festival dead-zone map (aggregate). gpsg_coverage_cells.
-- ---------------------------------------------------------------------------
create table if not exists public.dd_geo_coverage_cell (
  geocell         text not null,                 -- geohash / grid-bin id
  tier            text not null,
  sample_count    integer not null default 0,
  n_contributors  integer not null default 0,    -- gate publish on >= K_GEOM
  updated_at      timestamptz not null default now(),
  primary key (geocell, tier)
);

-- ---------------------------------------------------------------------------
-- 6. AGGREGATE PRESENCE — counts ONLY, per stage/zone per time window. Never an
--    individual track. Read through the k-gated VIEW below, never the base table.
-- ---------------------------------------------------------------------------
create table if not exists public.dd_geo_presence_agg (
  venue_id      uuid not null references public.dd_geo_venue(id) on delete cascade,
  stage_key     text not null,
  window_start  timestamptz not null,
  fan_count     integer not null default 0,
  primary key (venue_id, stage_key, window_start)
);

-- ---------------------------------------------------------------------------
-- 7. CONSENT — scoped, revocable, NO PII. Keyed by app-identity hash, not email.
--    navigate / presence / geometry are separate toggles (all default OFF).
-- ---------------------------------------------------------------------------
create table if not exists public.dd_geo_consent (
  subject_hash    text primary key,              -- app identity HASH, not email
  navigate_optin  boolean not null default false,
  presence_optin  boolean not null default false,
  geometry_optin  boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- RLS — forced; public sees ONLY aggregates above the k floor.
-- ============================================================================
alter table public.dd_geo_venue          enable row level security;
alter table public.dd_geo_stage          enable row level security;
alter table public.dd_geo_corridor       enable row level security;
alter table public.dd_geo_fragment       enable row level security;
alter table public.dd_geo_coverage_cell  enable row level security;
alter table public.dd_geo_presence_agg   enable row level security;
alter table public.dd_geo_consent        enable row level security;
-- NOTE: we intentionally do NOT `force row level security` here. RLS is ENABLED
-- (anon/authenticated get NO read path to the raw fragment / presence-base /
-- consent tables — denied by default with no policy). The table OWNER still
-- bypasses, which is REQUIRED so (a) the SECURITY DEFINER ingest can insert and
-- (b) the k-gated dd_geo_presence_public view can read its base table. This is the
-- same pattern as 07_presence.sql. FORCE here would break both on run.

-- venue + stage: public, surveyed reference data → readable by anyone.
drop policy if exists dd_geo_venue_read on public.dd_geo_venue;
create policy dd_geo_venue_read on public.dd_geo_venue for select using (true);
drop policy if exists dd_geo_stage_read on public.dd_geo_stage;
create policy dd_geo_stage_read on public.dd_geo_stage for select using (true);

-- corridor: surveyed corridors always public; crowd corridors ONLY at/above K_GEOM.
drop policy if exists dd_geo_corridor_read on public.dd_geo_corridor;
create policy dd_geo_corridor_read on public.dd_geo_corridor
  for select using (source = 'surveyed' or n_contributors >= 5 /* K_GEOM */);

-- coverage cells: public only above K_GEOM.
drop policy if exists dd_geo_coverage_read on public.dd_geo_coverage_cell;
create policy dd_geo_coverage_read on public.dd_geo_coverage_cell
  for select using (n_contributors >= 5 /* K_GEOM */);

-- RAW FRAGMENTS: NO public read, NO public write. No policy => denied by default.
-- Ingest happens ONLY through dd_geo_ingest_fragment (SECURITY DEFINER) below.

-- presence base table: NO public read (no policy). Read via the k-gated view only.

-- consent: a subject may read/write only their OWN row (matched by subject_hash
-- passed to the RPCs; the base table is not directly writable by anon).
-- (no public policy => base table denied; use dd_geo_set_consent RPC.)

-- ---------------------------------------------------------------------------
-- k-gated PRESENCE view — counts only, and only when fan_count >= K_PRESENCE.
-- ---------------------------------------------------------------------------
drop view if exists public.dd_geo_presence_public;
create view public.dd_geo_presence_public as
  select venue_id, stage_key, window_start, fan_count
  from public.dd_geo_presence_agg
  where fan_count >= 20 /* K_PRESENCE — aligned with 07_presence / 21_report */;

grant select on public.dd_geo_presence_public to anon, authenticated;

-- ============================================================================
-- INGEST RPC (SECURITY DEFINER) — IDS-ONLY. Strips/never accepts identity.
--   Accepts: venue id, corridor id, rotating token, tier, decimated points,
--            client idempotency id. NOTHING ELSE. Never touches auth.uid().
--   Idempotent (on conflict do nothing). Coarsens the timestamp at write.
-- ============================================================================
drop function if exists public.dd_geo_ingest_fragment(uuid, uuid, text, text, jsonb, text);
create or replace function public.dd_geo_ingest_fragment(
  p_venue         uuid,
  p_corridor      uuid,
  p_token         text,
  p_tier          text,
  p_points        jsonb,
  p_client_frag_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
begin
  -- structural guards — reject anything that isn't the shape we accept.
  if v_token = '' then
    return jsonb_build_object('ok', false, 'err', 'token required');
  end if;
  if p_client_frag_id is null or btrim(p_client_frag_id) = '' then
    return jsonb_build_object('ok', false, 'err', 'client_frag_id required');
  end if;
  if p_points is null or jsonb_typeof(p_points) <> 'array' then
    return jsonb_build_object('ok', false, 'err', 'points must be a jsonb array');
  end if;
  -- cheap abuse guard: cap fragment size (a fragment is decimated SHAPE, not a life)
  if jsonb_array_length(p_points) > 2000 then
    return jsonb_build_object('ok', false, 'err', 'fragment too large');
  end if;

  -- INSERT ONLY the whitelisted columns. No identity is read or stored here.
  insert into public.dd_geo_fragment
      (venue_id, corridor_id, contributor_token, tier, points, captured_bucket, client_frag_id)
  values
      (p_venue, p_corridor, v_token, p_tier, p_points, date_trunc('hour', now()), p_client_frag_id)
  on conflict (contributor_token, client_frag_id) do nothing;   -- idempotent / resumable

  return jsonb_build_object('ok', true);
end;
$$;

-- ingest is the ONLY write path for anon/authenticated; the raw table stays sealed.
revoke all on function public.dd_geo_ingest_fragment(uuid, uuid, text, text, jsonb, text) from public;
grant execute on function public.dd_geo_ingest_fragment(uuid, uuid, text, text, jsonb, text) to anon, authenticated;

-- ============================================================================
-- CONSENT RPC (SECURITY DEFINER) — a subject sets their OWN scoped toggles.
--   subject_hash is an app-identity HASH (never email/phone). No PII stored.
-- ============================================================================
drop function if exists public.dd_geo_set_consent(text, boolean, boolean, boolean);
create or replace function public.dd_geo_set_consent(
  p_subject_hash text,
  p_navigate     boolean default false,
  p_presence     boolean default false,
  p_geometry     boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_subject_hash is null or btrim(p_subject_hash) = '' then
    return jsonb_build_object('ok', false, 'err', 'subject_hash required');
  end if;
  insert into public.dd_geo_consent (subject_hash, navigate_optin, presence_optin, geometry_optin, updated_at)
  values (p_subject_hash, coalesce(p_navigate,false), coalesce(p_presence,false), coalesce(p_geometry,false), now())
  on conflict (subject_hash) do update
    set navigate_optin = excluded.navigate_optin,
        presence_optin = excluded.presence_optin,
        geometry_optin = excluded.geometry_optin,
        updated_at     = now();
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.dd_geo_set_consent(text, boolean, boolean, boolean) from public;
grant execute on function public.dd_geo_set_consent(text, boolean, boolean, boolean) to anon, authenticated;

-- ============================================================================
-- RETENTION PURGE — delete processed raw fragments after the extraction window.
--   Keeps the derived commons, not the surveillance trail. Run hourly via pg_cron
--   (see the commented schedule) OR manually. FRAG_RETENTION = 7 days (tune in
--   the privacy sign-off, mirrors GPSG).
-- ============================================================================
drop function if exists public.dd_geo_purge_fragments();
create or replace function public.dd_geo_purge_fragments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from public.dd_geo_fragment
    where processed = true
      and uploaded_at < now() - interval '7 days';   -- FRAG_RETENTION
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.dd_geo_purge_fragments() from public;
revoke all on function public.dd_geo_purge_fragments() from anon;
revoke all on function public.dd_geo_purge_fragments() from authenticated;
grant  execute on function public.dd_geo_purge_fragments() to service_role;  -- job/admin only

-- Schedule the purge (requires the pg_cron extension). Uncomment on Supabase:
-- select cron.schedule('dd_geo_purge_fragments', '0 * * * *',
--   $$ select public.dd_geo_purge_fragments(); $$);

-- ============================================================================
-- NOTES
--   * Corridor geometry, coverage cells, and presence aggregates are written by
--     the SERVER pipeline (Edge Function / batch) FROM processed fragments, then
--     the fragments are purged. Nothing here stores a stable per-fan track — that
--     is the point, enforced by the schema, not by a promise.
--   * The anon key in the app is public by design; RLS + the SECURITY DEFINER
--     ingest boundary is the real gate. No secret lives in the client.
--   * "walk me to my stage" reads dd_geo_stage (surveyed, public) for geofences
--     and does its blue-dot math ON DEVICE — it needs none of the write path above.
-- ============================================================================
