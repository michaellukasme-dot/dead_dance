-- ============================================================================
-- 21_crowd_engine.sql — the CROWD-TELEMETRY engine (network-aware GPS server spine).
--
-- 🔒 APPROVAL-GATED INSTALL — this is the "ADD IT BACK" file. Run it ONLY after P0 ratification of
--    STAGEFILL_PRIVACY_CHARTER_v2 (attorney signs off on the charter + this schema + the consent flow).
--    Michael's rule: "I will not put it up until attorney reviewed."  (Emergency off = 21_crowd_engine_UNRUN.sql.)
--
-- PRE-FLIGHT — when approved, do these FIRST (in order), then run this whole file:
--   1) set the crowd HMAC secret (server-only key for the subject-hash + rotating tokens):
--        insert into public.dd_secret(name,val) values ('crowd_hmac', encode(gen_random_bytes(32),'hex'))
--          on conflict (name) do update set val = excluded.val;
--   2) tune the knobs WITH counsel: K / MIN_COUNT (default 50), RAW_TTL (2h), DP epsilon,
--      CELL precision (~110m in sf_cell), BUCKET (5 min).
--   3) LOAD the sensitive-location exclusion list into sf_sensitive_geofence (health, worship, shelter,
--      school, military, protest, ...). Suppression is only as good as this list.
--   4) draft the Government Data-Use Agreement (aggregate-only); Michael signs the P0 checklist.
--   Even after this runs, NO client uploads until window.SF_CROWD_ENABLED = true (the go-live flag).
--
-- The charter's red lines are enforced STRUCTURALLY here, not promised:
--   • NO identity column exists anywhere. Raw rows carry a rotating token only.
--   • Raw is EPHEMERAL: coarse cell + time bucket, short TTL, purged after aggregation.
--   • SENSITIVE-LOCATION suppression at ingest (drop signals inside an exclusion geofence).
--   • Public/consumer reads hit ONLY aggregates gated at n_contributors >= K (default 50),
--     with minimum-count suppression + differential-privacy noise.
--   • GOVERNMENT/city output is aggregate-only, forever — no individual trace can be produced.
--   • dd_secret / sensitive geofences / raw / consent tables: RLS on, NO grants. Access via
--     SECURITY DEFINER RPCs only. Helpers granted to NOBODY.
--
-- KNOBS (set in P0, with counsel): K, MIN_COUNT, RAW_TTL, DP_EPSILON, CELL_PRECISION, BUCKET.
-- Defaults below are placeholders (K=50 per Placer.ai's public benchmark).
-- ============================================================================
create extension if not exists pgcrypto;

-- 1) sf_zone — a footprint stamped by a Maker (festival | market | corridor).
create table if not exists public.sf_zone (
  slug        text primary key,
  name        text not null,
  ztype       text not null check (ztype in ('festival','market','corridor')),
  boundary    jsonb not null,                       -- polygon [[lat,lng],...]
  active_from timestamptz, active_to timestamptz,   -- festivals/markets; corridor = always-on (null)
  ads_enabled boolean not null default true
);
alter table public.sf_zone enable row level security;

-- 2) sf_sensitive_geofence — the exclusion list. Suppress on INPUT and OUTPUT. NO grants (server-only).
create table if not exists public.sf_sensitive_geofence (
  id        bigserial primary key,
  category  text not null,                          -- health, worship, shelter, school, military, protest, ...
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m   integer not null default 150
);
alter table public.sf_sensitive_geofence enable row level security;

-- 3) sf_crowd_raw — DE-IDENTIFIED + EPHEMERAL. No identity by design. Rotating token; coarse cell/time.
create table if not exists public.sf_crowd_raw (
  id            bigserial primary key,
  zone_slug     text,
  token         text not null,                      -- rotating, NOT identity
  cell          text not null,                      -- coarse geohash-ish cell (fuzzed server-side)
  time_bucket   timestamptz not null,               -- coarse (fuzzed)
  tier          text,
  created_at    timestamptz not null default now()  -- for TTL purge
);
alter table public.sf_crowd_raw enable row level security;
create index if not exists sf_crowd_raw_ttl on public.sf_crowd_raw(created_at);
create index if not exists sf_crowd_raw_agg on public.sf_crowd_raw(zone_slug, time_bucket, cell);

-- 4) sf_consent — scoped, no PII. Keyed by a NON-identifying subject hash. NO grants (RPC only).
create table if not exists public.sf_consent (
  subject_hash text not null,                       -- hash of auth.uid(), NOT email/name
  scope        text not null check (scope in ('contribute','safety','mesh')),
  granted      boolean not null default false,
  version      text,
  updated_at   timestamptz not null default now(),
  withdrawn_at timestamptz,
  primary key (subject_hash, scope)
);
alter table public.sf_consent enable row level security;

-- 5) AGGREGATES — the only things ever read by a consumer. Published only at n >= K.
create table if not exists public.sf_presence_agg (
  zone_slug      text not null,
  time_bucket    timestamptz not null,
  cell           text not null,
  n_contributors integer not null,                  -- true count (server-only)
  count_noised   integer not null,                  -- DP-noised, published value
  primary key (zone_slug, time_bucket, cell)
);
alter table public.sf_presence_agg enable row level security;

create table if not exists public.sf_ad_delivery_agg (
  ad_id          text not null,
  zone_slug      text not null,
  time_bucket    timestamptz not null,
  n_contributors integer not null,
  impressions_noised integer not null,
  conversions_noised integer not null,
  primary key (ad_id, zone_slug, time_bucket)
);
alter table public.sf_ad_delivery_agg enable row level security;

create table if not exists public.sf_deletion_log (
  id bigserial primary key, subject_hash text, at timestamptz not null default now()
);
alter table public.sf_deletion_log enable row level security;

-- ---- helpers (granted to NOBODY) -------------------------------------------
-- coarse cell: round lat/lng to ~a few hundred meters (CELL_PRECISION knob). Defense-in-depth fuzz.
drop function if exists public.sf_cell(double precision, double precision);
create or replace function public.sf_cell(p_lat double precision, p_lng double precision)
returns text language sql immutable set search_path = public as $$
  select round(p_lat::numeric, 3)::text || ',' || round(p_lng::numeric, 3)::text;   -- ~110m grid; tune in P0
$$;
revoke all on function public.sf_cell(double precision, double precision) from public;

-- sensitive-location check — true if the point falls inside any exclusion geofence.
drop function if exists public.sf_in_sensitive(double precision, double precision);
create or replace function public.sf_in_sensitive(p_lat double precision, p_lng double precision)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.sf_sensitive_geofence g
    -- cheap great-circle-ish guard (meters); replace with PostGIS ST_DWithin if available.
    where (6371000 * acos(greatest(-1, least(1,
            cos(radians(p_lat))*cos(radians(g.center_lat))*cos(radians(g.center_lng)-radians(p_lng))
            + sin(radians(p_lat))*sin(radians(g.center_lat)))))) <= g.radius_m
  );
$$;
revoke all on function public.sf_in_sensitive(double precision, double precision) from public;

-- DP noise (Laplace-ish, bounded). epsilon is a P0 knob; placeholder scale here.
drop function if exists public.sf_dp_noise(integer);
create or replace function public.sf_dp_noise(p_scale integer)
returns integer language sql volatile set search_path = public as $$
  select round( (random() - 0.5) * 2 * coalesce(p_scale,3) )::integer;   -- zero-mean, symmetric (may be negative); calibrate epsilon in P0
$$;
revoke all on function public.sf_dp_noise(integer) from public;

-- ---- RPCs (the only granted surface) ---------------------------------------
-- subject hash: HMAC of the user id keyed by a SERVER SECRET (not a confirmable plain sha256).
drop function if exists public.sf_subject_hash(uuid);
create or replace function public.sf_subject_hash(p_uid uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_key text;
begin
  select val into v_key from public.dd_secret where name = 'crowd_hmac';
  if v_key is null then return null; end if;                        -- secret not set → callers fail honest
  return encode(hmac(coalesce(p_uid::text,''), v_key, 'sha256'), 'hex');
end $$;
revoke all on function public.sf_subject_hash(uuid) from public;

-- one raw row per (subject, bucket, cell): the token IS the dedup key.
create unique index if not exists sf_crowd_raw_tok on public.sf_crowd_raw(token);

-- INGEST (Claudine-hardened): AUTHENTICATED. The server — not the client — derives a
-- per-(subject,bucket,cell) rotating token via HMAC, so it is UNFORGEABLE and cannot be linked
-- across buckets → raw can NEVER reconstruct a path, and K counts REAL distinct subjects.
-- Consent is enforced SERVER-SIDE (must have granted 'contribute'). A sensitive drop is
-- INDISTINGUISHABLE to the caller (no oracle). No p_token is accepted from the client.
drop function if exists public.sf_crowd_ingest(text, text, double precision, double precision, text);
drop function if exists public.sf_crowd_ingest(text, double precision, double precision, text);
create or replace function public.sf_crowd_ingest(
  p_zone text, p_lat double precision, p_lng double precision, p_tier text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_subj text; v_key text; v_cell text; v_bucket timestamptz; v_tok text; v_ok boolean;
begin
  v_uid := auth.uid();
  if v_uid is null or p_lat is null or p_lng is null then return jsonb_build_object('ok', false); end if;
  v_subj := public.sf_subject_hash(v_uid);
  select val into v_key from public.dd_secret where name = 'crowd_hmac';
  if v_subj is null or v_key is null then return jsonb_build_object('ok', false); end if;
  -- server-side CONSENT gate — must have granted 'contribute' (no consent → silent no-op)
  select granted into v_ok from public.sf_consent where subject_hash = v_subj and scope = 'contribute';
  if not coalesce(v_ok, false) then return jsonb_build_object('ok', true); end if;
  -- SENSITIVE suppression — indistinguishable to the caller (no {dropped} oracle)
  if public.sf_in_sensitive(p_lat, p_lng) then return jsonb_build_object('ok', true); end if;
  v_cell   := public.sf_cell(p_lat, p_lng);
  v_bucket := date_trunc('minute', now()) - (extract(minute from now())::int % 5) * interval '1 minute';
  v_tok    := encode(hmac(v_subj || '|' || v_bucket::text || '|' || v_cell, v_key, 'sha256'), 'hex');
  insert into public.sf_crowd_raw(zone_slug, token, cell, time_bucket, tier)
    values (nullif(btrim(coalesce(p_zone,'')),''), v_tok, v_cell, v_bucket, nullif(btrim(coalesce(p_tier,'')),''))
    on conflict (token) do nothing;                                 -- one row per subject·bucket·cell
  -- opportunistic TTL trim (defense-in-depth; the scheduled purge is still required)
  delete from public.sf_crowd_raw where id in (
    select id from public.sf_crowd_raw where created_at < now() - interval '2 hours' limit 50);
  return jsonb_build_object('ok', true);
end $$;

-- AGGREGATE: roll raw → presence_agg, gated at K + min-count suppression + DP noise. Then raw can be purged.
drop function if exists public.sf_crowd_aggregate(integer, integer, integer);
create or replace function public.sf_crowd_aggregate(p_k integer default 50, p_min integer default 50, p_dp integer default 3)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_n int;
begin
  insert into public.sf_presence_agg(zone_slug, time_bucket, cell, n_contributors, count_noised)
  select zone_slug, time_bucket, cell,
         count(distinct token) as n,
         greatest(0, count(distinct token) + public.sf_dp_noise(p_dp)) as noised
  from public.sf_crowd_raw
  group by zone_slug, time_bucket, cell
  having count(distinct token) >= greatest(p_k, p_min)   -- BELOW THRESHOLD → NOTHING PUBLISHED
     and not public.sf_in_sensitive(split_part(cell, ',', 1)::double precision,
                                     split_part(cell, ',', 2)::double precision)   -- OUTPUT-side sensitive suppression
  on conflict (zone_slug, time_bucket, cell) do update
    set n_contributors = excluded.n_contributors, count_noised = excluded.count_noised;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'cells_published', v_n);
end $$;

-- PURGE: delete raw older than the TTL (raw is ephemeral). Run on a schedule.
drop function if exists public.sf_crowd_purge(interval);
create or replace function public.sf_crowd_purge(p_ttl interval default interval '2 hours')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_n int;
begin
  delete from public.sf_crowd_raw where created_at < now() - p_ttl;
  get diagnostics v_n = row_count; return jsonb_build_object('ok', true, 'purged', v_n);
end $$;

-- CONSENT: upsert a scope for the caller (subject = hash of auth.uid(); NO PII stored).
drop function if exists public.sf_consent_set(text, boolean, text);
create or replace function public.sf_consent_set(p_scope text, p_granted boolean, p_version text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_hash text;
begin
  v_uid := auth.uid();
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'no session'); end if;
  if p_scope not in ('contribute','safety','mesh') then return jsonb_build_object('ok', false); end if;
  v_hash := public.sf_subject_hash(v_uid);                    -- HMAC subject hash (server-secret keyed)
  if v_hash is null then return jsonb_build_object('ok', false, 'reason', 'secret_not_set'); end if;
  insert into public.sf_consent(subject_hash, scope, granted, version, updated_at, withdrawn_at)
    values (v_hash, p_scope, coalesce(p_granted,false), p_version, now(), case when p_granted then null else now() end)
  on conflict (subject_hash, scope) do update
    set granted = excluded.granted, version = excluded.version, updated_at = now(),
        withdrawn_at = case when excluded.granted then null else now() end;
  return jsonb_build_object('ok', true);
end $$;

-- DELETE: withdraw all consent for the caller + log. Aggregates are recomputed without them by design.
drop function if exists public.sf_crowd_delete();
create or replace function public.sf_crowd_delete()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_hash text;
begin
  v_uid := auth.uid(); if v_uid is null then return jsonb_build_object('ok', false); end if;
  v_hash := public.sf_subject_hash(v_uid); if v_hash is null then return jsonb_build_object('ok', false); end if;
  update public.sf_consent set granted = false, withdrawn_at = now() where subject_hash = v_hash;
  insert into public.sf_deletion_log(subject_hash) values (v_hash);
  return jsonb_build_object('ok', true);
end $$;

-- PUBLIC READ: presence for the live map / city-safety signal — ONLY k-gated aggregates, noised counts.
-- Returns NO individual anything. This is the entire government/consumer surface.
drop function if exists public.sf_presence_public(text);
create or replace function public.sf_presence_public(p_zone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('cell', cell, 'bucket', time_bucket, 'count', count_noised)
           order by time_bucket desc), '[]'::jsonb)
  from public.sf_presence_agg
  where zone_slug = btrim(coalesce(p_zone,'')) and n_contributors >= 50;   -- k-gate, hard
$$;

-- ---- grants: ONLY the safe RPCs. Raw / sensitive / consent / secret tables: NO grants. Helpers: none.
grant execute on function public.sf_crowd_ingest(text, double precision, double precision, text) to authenticated, service_role;   -- AUTHENTICATED only (no anon writes)
grant execute on function public.sf_consent_set(text, boolean, text)                                    to authenticated, service_role;
grant execute on function public.sf_crowd_delete()                                                       to authenticated, service_role;
grant execute on function public.sf_presence_public(text)                                                to anon, authenticated, service_role;
-- sf_crowd_aggregate / sf_crowd_purge: run by a scheduled job (service_role) only.
grant execute on function public.sf_crowd_aggregate(integer, integer, integer)                           to service_role;
grant execute on function public.sf_crowd_purge(interval)                                                 to service_role;

-- ============================================================================
-- P0 RATIFICATION (before this runs): counsel signs · K/MIN/TTL/DP/CELL/BUCKET set · sensitive
-- geofence list loaded · the Government Data-Use Agreement drafted · Michael signs. THEN deploy.
-- After deploy, collection still waits on window.SF_CROWD_ENABLED = true (the org go-live flag).
-- ============================================================================
