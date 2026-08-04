-- ============================================================================
-- 23_geo_analytics.sql — DeadDance festival GEO-ANALYTICS (Phase 2).
--   The "institutional-sale brain": turns the de-identified background-GPS
--   fragments from 22_geo.sql into AGGREGATE, consented, k-anonymized festival
--   analytics an organizer (ArtsQuest / a festival buyer) can act on. Built ON
--   TOP of 22_geo.sql — it does NOT duplicate or re-grant anything there.
--
-- WHAT THIS FILE IS (and is NOT)
--   IS : a geofence/zone REGISTRY (stages/vendors/gates/zones), five DERIVED
--        aggregate tables the pipeline writes, five k-gated SECURITY DEFINER
--        READ RPCs, and a reference MATERIALIZER that computes the aggregates
--        from raw fragments (the real raw→aggregate spine, service_role-only).
--   NOT: an individual-tracking layer. There is NO RPC here that returns a named
--        person, a single device's path, a lat/lng, or a sub-floor cohort. Every
--        output is a COHORT COUNT or a cohort statistic, and every cohort below
--        the floor is DROPPED (not nulled-in-place, not zeroed) — the row simply
--        does not exist in the output. Individual journeys are OUT OF SCOPE by
--        design (privacy + legality), not merely unimplemented.
--
-- THE FIVE METRICS (all suppressed at the cohort floor):
--   1. Stage attendance over time  — headcount per stage per time-bucket.
--   2. Dwell time                  — median minutes a cohort spent in a zone.
--   3. Corridor flow               — O/D cohort counts (stage→stage, gate→stage…).
--   4. Stage→vendor attribution    — "N who attended Stage A also hit Vendor X
--                                     within T minutes" (cohort count).
--   5. Zone heat                   — relative density per geofence per bucket.
--
-- HONEST LIMIT, BAKED IN (House Law, first-line honesty):
--   * 3–10 m GNSS accuracy → everything resolves to a ZONE / geofence, NEVER a
--     specific unit (not "porta-potty #4", just "the sanitation zone").
--   * contributor_token is ROTATING + EPHEMERAL (22_geo.sql). A cohort count here
--     is a count of DISTINCT TOKENS in a window, which is a conservative PROXY for
--     distinct people — rotation can only INFLATE the token count, so a published
--     cohort of ≥20 tokens may be <20 humans. That direction is safe for the ONE
--     thing suppression protects (never expose a group so small an individual is
--     identifiable) ONLY because we ALSO keep the window short enough that a token
--     does not rotate within it (see the BUCKET note on dd_geo_materialize). We do
--     NOT claim these counts are exact attendance — coverage:'opt-in-sample' on
--     every payload says so out loud.
--
-- K-ANONYMITY FLOOR — reused verbatim from 22_geo.sql, encoded at every call site:
--   K_PRESENCE = 20   (aligned with 07_presence / 21_report / dd_geo_presence_public)
--
-- HOUSE STYLE (matches 07 / 21 / 22): create-or-replace, idempotent, drop-if-exists
--   first, SECURITY DEFINER + set search_path, explicit revoke/grant, safe to re-run.
--   Michael runs this file in the Supabase SQL Editor AFTER 22_geo.sql.
--
-- Run order: after 22_geo.sql (depends on dd_geo_venue, dd_geo_fragment).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. GEOFENCE REGISTRY — named polygons/circles the organizer authors. 22_geo
--    has dd_geo_stage (stages only); analytics also needs vendors, gates, and
--    generic zones, so we add ONE registry that covers all kinds. Public read
--    (reference data — where the stages/vendors/gates/zones ARE is not private).
--    A geofence is a CIRCLE (center + radius) and/or a POLYGON (ordered ring).
-- ---------------------------------------------------------------------------
create table if not exists public.dd_geo_geofence (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.dd_geo_venue(id) on delete cascade,
  kind          text not null check (kind in ('stage','vendor','gate','zone')),
  fence_key     text not null,                   -- stable per-venue key, e.g. 'main-stage'
  name          text not null,
  center_lat    double precision,
  center_lon    double precision,
  radius_m      integer not null default 40,     -- zone radius; NEVER a unit-level radius
  polygon       jsonb   not null default '[]'::jsonb,  -- optional ordered [[lat,lon]...] ring
  created_at    timestamptz not null default now(),
  unique (venue_id, kind, fence_key)
);

-- ---------------------------------------------------------------------------
-- 2. DERIVED AGGREGATE TABLES — cohort COUNTS/STATS only, NEVER a per-token row.
--    Written by the materializer (§5) or an Edge/batch pipeline; read ONLY via
--    the k-gated RPCs (§4). No public read policy => base tables denied to anon.
--    cohort_n = distinct contributor_tokens in the window (the k-anon quantity).
-- ---------------------------------------------------------------------------

-- 2a. Stage attendance over time (metric 1)
create table if not exists public.dd_geo_attendance_agg (
  venue_id      uuid not null references public.dd_geo_venue(id) on delete cascade,
  fence_key     text not null,                   -- a 'stage' geofence
  window_start  timestamptz not null,
  cohort_n      integer not null default 0,      -- distinct tokens seen in the stage this bucket
  primary key (venue_id, fence_key, window_start)
);

-- 2b. Dwell time (metric 2)
create table if not exists public.dd_geo_dwell_agg (
  venue_id        uuid not null references public.dd_geo_venue(id) on delete cascade,
  fence_key       text not null,                 -- any geofence (stage/vendor/gate/zone)
  window_start    timestamptz not null,
  cohort_n        integer not null default 0,    -- distinct tokens the median is over
  median_dwell_min numeric(6,1) not null default 0,
  primary key (venue_id, fence_key, window_start)
);

-- 2c. Corridor flow — origin/destination cohort counts (metric 3)
create table if not exists public.dd_geo_flow_agg (
  venue_id      uuid not null references public.dd_geo_venue(id) on delete cascade,
  origin_key    text not null,
  dest_key      text not null,
  window_start  timestamptz not null,
  cohort_n      integer not null default 0,      -- distinct tokens that moved origin→dest
  primary key (venue_id, origin_key, dest_key, window_start)
);

-- 2d. Stage→vendor attribution (metric 4)
create table if not exists public.dd_geo_attribution_agg (
  venue_id        uuid not null references public.dd_geo_venue(id) on delete cascade,
  from_stage_key  text not null,
  to_vendor_key   text not null,
  within_min      integer not null,              -- the T window the attribution used
  window_start    timestamptz not null,
  cohort_n        integer not null default 0,    -- distinct tokens: stage A then vendor X within T
  primary key (venue_id, from_stage_key, to_vendor_key, within_min, window_start)
);

-- 2e. Zone heat (metric 5) — cohort_n per geofence per bucket; density is derived
--     RELATIVE at read time (share of the max published cell), never an absolute.
create table if not exists public.dd_geo_heat_agg (
  venue_id      uuid not null references public.dd_geo_venue(id) on delete cascade,
  fence_key     text not null,
  window_start  timestamptz not null,
  cohort_n      integer not null default 0,
  primary key (venue_id, fence_key, window_start)
);

-- ============================================================================
-- RLS — enable (not force, same reasoning as 22_geo.sql: the OWNER must bypass so
--   the SECURITY DEFINER reads work). Registry is public-read; the five aggregate
--   base tables have NO public policy → anon/authenticated denied → readable ONLY
--   through the k-gated RPCs below.
-- ============================================================================
alter table public.dd_geo_geofence         enable row level security;
alter table public.dd_geo_attendance_agg   enable row level security;
alter table public.dd_geo_dwell_agg        enable row level security;
alter table public.dd_geo_flow_agg         enable row level security;
alter table public.dd_geo_attribution_agg  enable row level security;
alter table public.dd_geo_heat_agg         enable row level security;

drop policy if exists dd_geo_geofence_read on public.dd_geo_geofence;
create policy dd_geo_geofence_read on public.dd_geo_geofence for select using (true);
-- aggregate base tables: NO policy => denied by default. Read via RPC only.

-- ============================================================================
-- 3. GEOFENCE MATH HELPERS (IMMUTABLE/STABLE, pure) — mirror the node-proven
--    logic in dd_geo_analytics.js. Used by the materializer. Distance = haversine m.
-- ============================================================================
drop function if exists public.dd_geo_haversine_m(double precision, double precision, double precision, double precision);
create or replace function public.dd_geo_haversine_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
language sql immutable
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 2 * 6371000 * asin( least(1, sqrt(
           power(sin(radians(lat2-lat1)/2), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) *
           power(sin(radians(lon2-lon1)/2), 2)
         )))
  end;
$$;

-- point-in-geofence: polygon ray-cast if a ring is authored, else circle test.
-- Returns true if the point is inside the fence. Zone-level, never unit-level.
drop function if exists public.dd_geo_in_fence(double precision, double precision, uuid);
create or replace function public.dd_geo_in_fence(
  p_lat double precision, p_lon double precision, p_fence uuid
) returns boolean
language plpgsql stable
set search_path = public
as $$
declare
  f            public.dd_geo_geofence%rowtype;
  ring_len     int;
  i            int;
  j            int;
  xi double precision; yi double precision;
  xj double precision; yj double precision;
  inside       boolean := false;
begin
  select * into f from public.dd_geo_geofence where id = p_fence;
  if not found or p_lat is null or p_lon is null then
    return false;
  end if;

  -- polygon ray-cast (if a ring of >= 3 vertices is authored)
  ring_len := coalesce(jsonb_array_length(f.polygon), 0);
  if ring_len >= 3 then
    i := 0; j := ring_len - 1;
    while i < ring_len loop
      yi := (f.polygon -> i ->> 0)::double precision;  -- lat
      xi := (f.polygon -> i ->> 1)::double precision;  -- lon
      yj := (f.polygon -> j ->> 0)::double precision;
      xj := (f.polygon -> j ->> 1)::double precision;
      if ((yi > p_lat) <> (yj > p_lat)) and
         (p_lon < (xj - xi) * (p_lat - yi) / nullif((yj - yi),0) + xi) then
        inside := not inside;
      end if;
      j := i; i := i + 1;
    end loop;
    return inside;
  end if;

  -- else circle test
  if f.center_lat is null or f.center_lon is null then
    return false;
  end if;
  return public.dd_geo_haversine_m(p_lat, p_lon, f.center_lat, f.center_lon) <= f.radius_m;
end;
$$;

-- ============================================================================
-- 4. K-GATED READ RPCs — SECURITY DEFINER, anon-granted. Every one DROPS any
--    row whose cohort_n < K_PRESENCE (20). A dropped cohort is NEVER emitted —
--    not as null, not as zero — it simply is not in the payload. Each payload
--    reports how many rows were suppressed so the withholding is HONEST, and
--    carries coverage:'opt-in-sample' so the number is never mistaken for exact
--    total attendance. NO PII, no token, no lat/lng ever leaves these functions.
-- ============================================================================

-- 4.1 Stage attendance over time (metric 1)
drop function if exists public.dd_geo_attendance(uuid, timestamptz, timestamptz);
create or replace function public.dd_geo_attendance(
  p_venue uuid, p_from timestamptz default null, p_to timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min  constant int := 20;   -- K_PRESENCE
  v_rows jsonb := '[]'::jsonb;
  v_supp int := 0;
begin
  if p_venue is null then
    return jsonb_build_object('ok', false, 'err', 'venue required');
  end if;

  select count(*) into v_supp
    from public.dd_geo_attendance_agg a
   where a.venue_id = p_venue
     and (p_from is null or a.window_start >= p_from)
     and (p_to   is null or a.window_start <  p_to)
     and a.cohort_n < v_min;

  select coalesce(jsonb_agg(
           jsonb_build_object('stage', fence_key, 'window_start', window_start, 'headcount', cohort_n)
           order by window_start asc, cohort_n desc), '[]'::jsonb)
    into v_rows
    from public.dd_geo_attendance_agg a
   where a.venue_id = p_venue
     and (p_from is null or a.window_start >= p_from)
     and (p_to   is null or a.window_start <  p_to)
     and a.cohort_n >= v_min;   -- SUPPRESS: sub-floor rows are dropped, not returned

  return jsonb_build_object('ok', true, 'metric', 'stage_attendance',
    'coverage', 'opt-in-sample', 'threshold', v_min,
    'suppressed_rows', v_supp, 'rows', v_rows);
end $$;
revoke all on function public.dd_geo_attendance(uuid, timestamptz, timestamptz) from public;
grant execute on function public.dd_geo_attendance(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;

-- 4.2 Dwell time (metric 2)
drop function if exists public.dd_geo_dwell(uuid, timestamptz, timestamptz);
create or replace function public.dd_geo_dwell(
  p_venue uuid, p_from timestamptz default null, p_to timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min  constant int := 20;
  v_rows jsonb := '[]'::jsonb;
  v_supp int := 0;
begin
  if p_venue is null then
    return jsonb_build_object('ok', false, 'err', 'venue required');
  end if;

  select count(*) into v_supp
    from public.dd_geo_dwell_agg d
   where d.venue_id = p_venue
     and (p_from is null or d.window_start >= p_from)
     and (p_to   is null or d.window_start <  p_to)
     and d.cohort_n < v_min;

  select coalesce(jsonb_agg(
           jsonb_build_object('zone', fence_key, 'window_start', window_start,
                              'median_dwell_min', median_dwell_min, 'cohort_n', cohort_n)
           order by median_dwell_min desc), '[]'::jsonb)
    into v_rows
    from public.dd_geo_dwell_agg d
   where d.venue_id = p_venue
     and (p_from is null or d.window_start >= p_from)
     and (p_to   is null or d.window_start <  p_to)
     and d.cohort_n >= v_min;

  return jsonb_build_object('ok', true, 'metric', 'dwell',
    'coverage', 'opt-in-sample', 'threshold', v_min,
    'suppressed_rows', v_supp, 'rows', v_rows);
end $$;
revoke all on function public.dd_geo_dwell(uuid, timestamptz, timestamptz) from public;
grant execute on function public.dd_geo_dwell(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;

-- 4.3 Corridor flow — O/D cohort counts (metric 3)
drop function if exists public.dd_geo_flow(uuid, timestamptz, timestamptz);
create or replace function public.dd_geo_flow(
  p_venue uuid, p_from timestamptz default null, p_to timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min  constant int := 20;
  v_rows jsonb := '[]'::jsonb;
  v_supp int := 0;
begin
  if p_venue is null then
    return jsonb_build_object('ok', false, 'err', 'venue required');
  end if;

  select count(*) into v_supp
    from public.dd_geo_flow_agg f
   where f.venue_id = p_venue
     and (p_from is null or f.window_start >= p_from)
     and (p_to   is null or f.window_start <  p_to)
     and f.cohort_n < v_min;

  select coalesce(jsonb_agg(
           jsonb_build_object('origin', origin_key, 'dest', dest_key,
                              'window_start', window_start, 'cohort_n', cohort_n)
           order by cohort_n desc), '[]'::jsonb)
    into v_rows
    from public.dd_geo_flow_agg f
   where f.venue_id = p_venue
     and (p_from is null or f.window_start >= p_from)
     and (p_to   is null or f.window_start <  p_to)
     and f.cohort_n >= v_min;

  return jsonb_build_object('ok', true, 'metric', 'flow',
    'coverage', 'opt-in-sample', 'threshold', v_min,
    'suppressed_rows', v_supp, 'rows', v_rows);
end $$;
revoke all on function public.dd_geo_flow(uuid, timestamptz, timestamptz) from public;
grant execute on function public.dd_geo_flow(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;

-- 4.4 Stage→vendor attribution (metric 4)
drop function if exists public.dd_geo_attribution(uuid, timestamptz, timestamptz);
create or replace function public.dd_geo_attribution(
  p_venue uuid, p_from timestamptz default null, p_to timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min  constant int := 20;
  v_rows jsonb := '[]'::jsonb;
  v_supp int := 0;
begin
  if p_venue is null then
    return jsonb_build_object('ok', false, 'err', 'venue required');
  end if;

  select count(*) into v_supp
    from public.dd_geo_attribution_agg t
   where t.venue_id = p_venue
     and (p_from is null or t.window_start >= p_from)
     and (p_to   is null or t.window_start <  p_to)
     and t.cohort_n < v_min;

  select coalesce(jsonb_agg(
           jsonb_build_object('stage', from_stage_key, 'vendor', to_vendor_key,
                              'within_min', within_min, 'window_start', window_start,
                              'cohort_n', cohort_n)
           order by cohort_n desc), '[]'::jsonb)
    into v_rows
    from public.dd_geo_attribution_agg t
   where t.venue_id = p_venue
     and (p_from is null or t.window_start >= p_from)
     and (p_to   is null or t.window_start <  p_to)
     and t.cohort_n >= v_min;

  return jsonb_build_object('ok', true, 'metric', 'attribution',
    'coverage', 'opt-in-sample', 'threshold', v_min,
    'suppressed_rows', v_supp, 'rows', v_rows);
end $$;
revoke all on function public.dd_geo_attribution(uuid, timestamptz, timestamptz) from public;
grant execute on function public.dd_geo_attribution(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;

-- 4.5 Zone heat (metric 5) — cohort_n per fence per bucket, PLUS a relative
--     density (0..1) computed over the PUBLISHED (>= floor) cells only, so a
--     suppressed cell never influences or leaks through the normalization.
drop function if exists public.dd_geo_heat(uuid, timestamptz, timestamptz);
create or replace function public.dd_geo_heat(
  p_venue uuid, p_from timestamptz default null, p_to timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min  constant int := 20;
  v_rows jsonb := '[]'::jsonb;
  v_supp int := 0;
  v_max  int  := 0;
begin
  if p_venue is null then
    return jsonb_build_object('ok', false, 'err', 'venue required');
  end if;

  select count(*) into v_supp
    from public.dd_geo_heat_agg h
   where h.venue_id = p_venue
     and (p_from is null or h.window_start >= p_from)
     and (p_to   is null or h.window_start <  p_to)
     and h.cohort_n < v_min;

  select coalesce(max(cohort_n), 0) into v_max
    from public.dd_geo_heat_agg h
   where h.venue_id = p_venue
     and (p_from is null or h.window_start >= p_from)
     and (p_to   is null or h.window_start <  p_to)
     and h.cohort_n >= v_min;

  select coalesce(jsonb_agg(
           jsonb_build_object('zone', fence_key, 'window_start', window_start,
                              'cohort_n', cohort_n,
                              'density', case when v_max > 0
                                              then round((cohort_n::numeric / v_max), 3)
                                              else 0 end)
           order by cohort_n desc), '[]'::jsonb)
    into v_rows
    from public.dd_geo_heat_agg h
   where h.venue_id = p_venue
     and (p_from is null or h.window_start >= p_from)
     and (p_to   is null or h.window_start <  p_to)
     and h.cohort_n >= v_min;

  return jsonb_build_object('ok', true, 'metric', 'heat',
    'coverage', 'opt-in-sample', 'threshold', v_min,
    'suppressed_rows', v_supp, 'rows', v_rows);
end $$;
revoke all on function public.dd_geo_heat(uuid, timestamptz, timestamptz) from public;
grant execute on function public.dd_geo_heat(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;

-- ============================================================================
-- 5. REFERENCE MATERIALIZER (service_role ONLY) — the real raw→aggregate spine.
--    Reads de-identified dd_geo_fragment, resolves each point to a geofence, and
--    (re)builds the five aggregate tables for one venue. This is the SQL form of
--    the batch/Edge pipeline named in 22_geo.sql; its geofence/dwell/flow math
--    mirrors the node-PROVEN logic in dd_geo_analytics.js.
--
--    POINT-ENCODING CONTRACT (documented, not assumed silently): each fragment's
--    `points` jsonb is an array of [lat, lon, epoch_ms, acc] in ABSOLUTE degrees.
--    If the on-device encoder ships deltas, the pipeline MUST expand them to
--    absolute BEFORE this runs (the ingest RPC stores points verbatim). This
--    function does not invent coordinates it was not given.
--
--    PRIVACY: writes ONLY cohort counts/stats. It reads the raw table (allowed
--    because it is the table owner via SECURITY DEFINER) but PERSISTS nothing
--    per-token. Sub-floor cohorts may land in the agg tables as small cohort_n;
--    the READ RPCs (§4) are what DROP them below the floor — the agg tables are
--    sealed (no public read), so the floor lives at exactly one auditable place
--    (the read boundary).
--
--    BUCKET note: p_bucket_min (default 15) is the time-bucket width. Keep it well
--    under the 30-min token rotation (22_geo.sql) so a person appears at most once
--    per bucket and cohort_n ≈ distinct people, not distinct rotations.
--    p_attr_within_min: the T window for stage→vendor attribution (default 30).
-- ============================================================================
drop function if exists public.dd_geo_materialize(uuid, integer, integer);
create or replace function public.dd_geo_materialize(
  p_venue uuid,
  p_bucket_min integer default 15,
  p_attr_within_min integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket_s int := greatest(1, coalesce(p_bucket_min, 15)) * 60;
begin
  if p_venue is null then
    return jsonb_build_object('ok', false, 'err', 'venue required');
  end if;

  -- expand every fragment point of this venue into (token, ts, lat, lon)
  drop table if exists _pts;
  create temp table _pts on commit drop as
    select fr.contributor_token as token,
           to_timestamp( (pt->>2)::double precision / 1000.0 ) as ts,
           (pt->>0)::double precision as lat,
           (pt->>1)::double precision as lon
      from public.dd_geo_fragment fr
      cross join lateral jsonb_array_elements(fr.points) as pt
     where fr.venue_id = p_venue
       and jsonb_typeof(fr.points) = 'array'
       and jsonb_array_length(pt) >= 3;

  -- resolve each point to every geofence it falls in (zone-level)
  drop table if exists _hits;
  create temp table _hits on commit drop as
    select p.token, p.ts, g.fence_key, g.kind,
           to_timestamp( floor(extract(epoch from p.ts) / v_bucket_s) * v_bucket_s ) as bucket
      from _pts p
      join public.dd_geo_geofence g
        on g.venue_id = p_venue
       and public.dd_geo_in_fence(p.lat, p.lon, g.id);

  -- 1) ATTENDANCE (stages) + 5) HEAT (all fences): distinct tokens per fence/bucket
  delete from public.dd_geo_attendance_agg where venue_id = p_venue;
  insert into public.dd_geo_attendance_agg (venue_id, fence_key, window_start, cohort_n)
    select p_venue, fence_key, bucket, count(distinct token)
      from _hits where kind = 'stage'
     group by fence_key, bucket;

  delete from public.dd_geo_heat_agg where venue_id = p_venue;
  insert into public.dd_geo_heat_agg (venue_id, fence_key, window_start, cohort_n)
    select p_venue, fence_key, bucket, count(distinct token)
      from _hits group by fence_key, bucket;

  -- 2) DWELL: per (token, fence, bucket) span = last-first ts; median across tokens
  delete from public.dd_geo_dwell_agg where venue_id = p_venue;
  insert into public.dd_geo_dwell_agg (venue_id, fence_key, window_start, cohort_n, median_dwell_min)
    select p_venue, fence_key, bucket,
           count(*) as cohort_n,   -- one row per token here → count(*) = distinct tokens
           round( (percentile_cont(0.5) within group (order by dwell_min))::numeric, 1)
      from (
        select token, fence_key, bucket,
               (extract(epoch from (max(ts) - min(ts))) / 60.0) as dwell_min
          from _hits
         group by token, fence_key, bucket
      ) per_token
     group by fence_key, bucket;

  -- 3) FLOW: per token, order its fence VISITS (first ts in each fence), take
  --    consecutive DISTINCT-fence transitions; count distinct tokens per O/D/bucket
  --    (bucketed on the origin visit).
  delete from public.dd_geo_flow_agg where venue_id = p_venue;
  insert into public.dd_geo_flow_agg (venue_id, origin_key, dest_key, window_start, cohort_n)
    select p_venue, origin_key, dest_key, obucket, count(distinct token)
      from (
        select token, origin_key, first_ts, dest_key,
               to_timestamp( floor(extract(epoch from first_ts) / v_bucket_s) * v_bucket_s ) as obucket
          from (
            select token, fence_key as origin_key, first_ts,
                   lead(fence_key) over (partition by token order by first_ts) as dest_key
              from (
                select token, fence_key, min(ts) as first_ts
                  from _hits group by token, fence_key
              ) visits
          ) seq
      ) transitions
     where dest_key is not null and dest_key <> origin_key
     group by origin_key, dest_key, obucket;

  -- 4) ATTRIBUTION: token at a STAGE, then at a VENDOR within T minutes AFTER.
  delete from public.dd_geo_attribution_agg where venue_id = p_venue;
  insert into public.dd_geo_attribution_agg
        (venue_id, from_stage_key, to_vendor_key, within_min, window_start, cohort_n)
    select p_venue, s.fence_key, v.fence_key, coalesce(p_attr_within_min,30),
           to_timestamp( floor(extract(epoch from s.first_ts) / v_bucket_s) * v_bucket_s ),
           count(distinct s.token)
      from (
        select token, fence_key, min(ts) as first_ts
          from _hits where kind = 'stage' group by token, fence_key
      ) s
      join (
        select token, fence_key, min(ts) as first_ts
          from _hits where kind = 'vendor' group by token, fence_key
      ) v
        on v.token = s.token
       and v.first_ts >  s.first_ts
       and v.first_ts <= s.first_ts + make_interval(mins => coalesce(p_attr_within_min,30))
     group by s.fence_key, v.fence_key,
              to_timestamp( floor(extract(epoch from s.first_ts) / v_bucket_s) * v_bucket_s );

  return jsonb_build_object('ok', true, 'venue', p_venue,
    'bucket_min', coalesce(p_bucket_min,15), 'attr_within_min', coalesce(p_attr_within_min,30));
end $$;

-- materializer is admin/job only — NEVER anon/authenticated.
revoke all on function public.dd_geo_materialize(uuid, integer, integer) from public;
revoke all on function public.dd_geo_materialize(uuid, integer, integer) from anon;
revoke all on function public.dd_geo_materialize(uuid, integer, integer) from authenticated;
grant  execute on function public.dd_geo_materialize(uuid, integer, integer) to service_role;

-- ============================================================================
-- SANITY / ADVERSARIAL (run manually — none should ever leak a sub-floor cohort):
--   -- every read RPC returns coverage:'opt-in-sample' and only rows >= 20:
--   select public.dd_geo_attendance('<venue-uuid>');
--   select public.dd_geo_dwell('<venue-uuid>');
--   select public.dd_geo_flow('<venue-uuid>');
--   select public.dd_geo_attribution('<venue-uuid>');
--   select public.dd_geo_heat('<venue-uuid>');
--   -- anon MUST NOT run the materializer or read the base agg tables:
--   select has_function_privilege('anon','public.dd_geo_materialize(uuid,integer,integer)','execute'); -- expect false
--   select has_table_privilege('anon','public.dd_geo_attendance_agg','select');                        -- expect false
--   -- 22_geo.sql invariants unchanged (ingest still the only anon write path):
--   select has_function_privilege('anon','public.dd_geo_ingest_fragment(uuid,uuid,text,text,jsonb,text)','execute'); -- expect true
-- ============================================================================
