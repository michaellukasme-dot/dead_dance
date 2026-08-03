-- ============================================================================
-- 21_report_aggregates.sql — the PUBLIC, PRIVACY-SAFE report aggregates.
--
-- WHY THIS FILE EXISTS
--   The free StageFill "Data Report" (report.html / dd_report.js) sells the paid
--   tiers by showing REAL, app-measured festival numbers. Attendance / dwell had
--   been rendered as clearly-labeled SAMPLE because the only real aggregates
--   (sf_presence_counts in 07_presence.sql) are service_role-only for privacy.
--   This file adds NEW anon-granted, read-only aggregate RPCs so those numbers can
--   become REAL -- without punching a hole in the existing privacy gate.
--
-- HONEST FRAMING (this is the sales pitch to ArtsQuest, and it must be true):
--   Today DeadDance is NOT MusikFest's official app. So these numbers are an
--   OPT-IN SAMPLE -- "measured by the DeadDance map" -- NOT true festival
--   attendance. coverage = 'sample' is returned on every payload to say so out
--   loud. At an official event (e.g. Oktoberfest with StageFill as THE map)
--   coverage -> 100% and the same numbers become real total attendance.
--
-- PRIVACY LAW (load-bearing -- this data is exposed PUBLICLY to anon):
--   * COHORT SUPPRESSION IS BAKED IN. Any distinct-count below the threshold (20,
--     the same idea already used by sf_presence_counts' `having >= 20`) is NEVER
--     returned as a raw number -- it comes back as null with a `*_suppressed:true`
--     flag (a suppressed cell = "not enough data yet", never a zero, never a guess).
--   * NEVER a per-individual row. These functions return ONLY aggregate counts.
--     No actor/owner/member id, no name, no phone, no lat/lng -- nothing re-identifying.
--   * Counts are DEVICES / verified attendances, never identities.
--
-- HOUSE STYLE (matches 07_presence / 18_streetteam / 19_ticket_security):
--   * create-or-replace, idempotent, safe to re-run. drop function if exists first.
--   * SECURITY DEFINER; set search_path = public. Explicit grants (anon + up).
--   * Derives ONLY from REAL tables:
--       dd_ticket       (19_ticket_security.sql) -- status='redeemed' = a real admit
--       dd_presence     (07_presence.sql)        -- verified at-show grant (has stage_id)
--       dd_st_member    (18_streetteam.sql)      -- street-team recruiters (reach signal)
--   * Does NOT touch / re-grant sf_presence_counts -- that stays service_role-only.
--
-- WHAT'S REAL vs STILL SAMPLE after this file:
--   REAL (app-measured, suppressed): admits, unique_devices, by-stage admits,
--     street-team reach, and the per-act/stage verified-attendance slice.
--   STILL SAMPLE (no real pipeline): dwell-MINUTES per stage, peak-hour curve,
--     weather correlation, top-acts-by-draw, crowd flow in/out, fans-gained.
--
-- Run order: after 07_presence.sql, 18_streetteam.sql, 19_ticket_security.sql.
-- ============================================================================

-- Threshold note: 20. Encoded directly in each function (v_min := 20) so the
-- suppression rule is visible at every call site and cannot drift silently.

-- ---------------------------------------------------------------------------
-- 1) sf_report_festival(p_festival) -- the festival-wide, suppressed aggregate.
--    Returns jsonb; every count < 20 is suppressed (null + *_suppressed:true).
--    Event matching: exact festival slug OR per-act events named "<fest>-<act>".
-- ---------------------------------------------------------------------------
drop function if exists public.sf_report_festival(text);
create or replace function public.sf_report_festival(p_festival text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min       constant int := 20;   -- cohort-suppression threshold (see header)
  v_fest      text;
  v_like      text;
  v_redeemed  bigint := 0;   -- real admits from dd_ticket (status='redeemed')
  v_presence  bigint := 0;   -- verified at-show grants from dd_presence
  v_admits    bigint := 0;
  v_dev_tix   bigint := 0;   -- distinct ticket owners (devices)
  v_dev_pres  bigint := 0;   -- distinct presence actors (devices)
  v_devices   bigint := 0;
  v_reach     bigint := 0;   -- distinct street-team members (recruiters)
  v_stages    jsonb  := '[]'::jsonb;
begin
  v_fest := lower(btrim(coalesce(p_festival, '')));
  if v_fest = '' then
    return jsonb_build_object('ok', false, 'err', 'festival required');
  end if;
  v_like := v_fest || '-%';

  -- admits: two REAL verified-attendance signals, summed.
  --   (a) redeemed tickets -- free proximity-accepts now redeem THROUGH dd_ticket.
  select count(*)
    into v_redeemed
    from public.dd_ticket
   where status = 'redeemed'
     and (event_slug = v_fest or event_slug like v_like);

  --   (b) presence grants -- the older verified at-show subgroup.
  select count(distinct actor)
    into v_presence
    from public.dd_presence
   where (event_id = v_fest or event_id like v_like);

  v_admits := coalesce(v_redeemed, 0) + coalesce(v_presence, 0);

  -- unique devices: distinct ticket owners + distinct presence actors (device ids, never identities).
  select count(distinct owner_id)
    into v_dev_tix
    from public.dd_ticket
   where owner_id is not null
     and (event_slug = v_fest or event_slug like v_like);

  select count(distinct actor)
    into v_dev_pres
    from public.dd_presence
   where (event_id = v_fest or event_id like v_like);

  v_devices := coalesce(v_dev_tix, 0) + coalesce(v_dev_pres, 0);

  -- street-team reach: distinct recruiters who joined for this festival.
  select count(distinct member_id)
    into v_reach
    from public.dd_st_member
   where festival_slug = v_fest;

  -- by-stage admits: distinct presence actors per stage. EACH CELL suppressed < 20.
  -- Only stages with >=1 presence appear; a small cell returns admits=null + suppressed:true
  -- ("not enough data yet"), NEVER a raw small number, NEVER a fake zero.
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'stage', stage_id,
               'admits', case when n >= v_min then n else null end,
               'suppressed', (n < v_min)
             )
             order by n desc, stage_id asc
           ),
           '[]'::jsonb)
    into v_stages
    from (
      select stage_id, count(distinct actor)::bigint as n
        from public.dd_presence
       where (event_id = v_fest or event_id like v_like)
         and stage_id is not null
       group by stage_id
    ) s;

  return jsonb_build_object(
    'ok', true,
    'app_measured', true,
    'coverage', 'sample',                         -- opt-in sample today; 100% as the official app
    'festival', v_fest,
    'threshold', v_min,
    'admits',                    case when v_admits  >= v_min then v_admits  else null end,
    'admits_suppressed',         (v_admits  < v_min),
    'unique_devices',            case when v_devices >= v_min then v_devices else null end,
    'unique_devices_suppressed', (v_devices < v_min),
    'street_team_reach',         case when v_reach   >= v_min then v_reach   else null end,
    'street_team_reach_suppressed', (v_reach < v_min),
    'by_stage', v_stages
  );
end $$;

revoke all on function public.sf_report_festival(text) from public;
grant execute on function public.sf_report_festival(text) to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 2) sf_report_act(p_festival, p_act) -- the per-act / per-stage slice.
--    p_act is matched against dd_presence.stage_id (the stage the act plays on).
--    Same suppression: admits < 20 -> null + admits_suppressed:true.
-- ---------------------------------------------------------------------------
drop function if exists public.sf_report_act(text, text);
create or replace function public.sf_report_act(p_festival text, p_act text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min    constant int := 20;
  v_fest   text;
  v_like   text;
  v_stage  text;
  v_admits bigint := 0;
begin
  v_fest  := lower(btrim(coalesce(p_festival, '')));
  v_stage := lower(btrim(coalesce(p_act, '')));
  if v_fest = '' or v_stage = '' then
    return jsonb_build_object('ok', false, 'err', 'festival and act/stage required');
  end if;
  v_like := v_fest || '-%';

  -- verified at-this-stage attendances (distinct devices), for this festival's events.
  select count(distinct actor)
    into v_admits
    from public.dd_presence
   where (event_id = v_fest or event_id like v_like)
     and lower(btrim(coalesce(stage_id, ''))) = v_stage;

  return jsonb_build_object(
    'ok', true,
    'app_measured', true,
    'coverage', 'sample',
    'festival', v_fest,
    'act', p_act,
    'threshold', v_min,
    'admits',            case when v_admits >= v_min then v_admits else null end,
    'admits_suppressed', (v_admits < v_min)
  );
end $$;

revoke all on function public.sf_report_act(text, text) from public;
grant execute on function public.sf_report_act(text, text) to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- SANITY (run manually; every count below 20 must come back null, not the raw n):
--   select public.sf_report_festival('musikfest-2026');
--   select public.sf_report_act('musikfest-2026','wind-creek-steel-stage');
-- ADVERSARIAL: confirm sf_presence_counts is STILL service_role-only (unchanged):
--   select has_function_privilege('anon','public.sf_presence_counts()','execute');  -- expect false
-- ---------------------------------------------------------------------------
