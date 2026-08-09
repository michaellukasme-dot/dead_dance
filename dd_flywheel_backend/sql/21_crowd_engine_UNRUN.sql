-- ============================================================================
-- 21_crowd_engine_UNRUN.sql — reverses 21_crowd_engine.sql. Run this to un-do the crowd engine
-- and HOLD until counsel ratifies the Privacy Charter (P0). Idempotent + safe to re-run.
--
-- Drops every object 21 created. LEAVES ALONE: 19/20 ticket security, the dd_secret TABLE
-- (ticket_hmac lives there) — we only remove the crowd_hmac KEY if it was set.
-- Nothing was collected (SF_CROWD_ENABLED was off; ingest was never called), so this is a clean wipe.
-- ============================================================================

-- 1) functions first (some reference the tables) --------------------------------------------
drop function if exists public.sf_presence_public(text);
drop function if exists public.sf_crowd_delete();
drop function if exists public.sf_consent_set(text, boolean, text);
drop function if exists public.sf_crowd_purge(interval);
drop function if exists public.sf_crowd_aggregate(integer, integer, integer);
drop function if exists public.sf_crowd_ingest(text, double precision, double precision, text);
drop function if exists public.sf_crowd_ingest(text, text, double precision, double precision, text);  -- legacy signature, if present
drop function if exists public.sf_subject_hash(uuid);
drop function if exists public.sf_dp_noise(integer);
drop function if exists public.sf_in_sensitive(double precision, double precision);
drop function if exists public.sf_cell(double precision, double precision);

-- 2) tables (CASCADE clears indexes/constraints) --------------------------------------------
drop table if exists public.sf_deletion_log     cascade;
drop table if exists public.sf_ad_delivery_agg  cascade;
drop table if exists public.sf_presence_agg     cascade;
drop table if exists public.sf_consent          cascade;
drop table if exists public.sf_crowd_raw        cascade;
drop table if exists public.sf_sensitive_geofence cascade;
drop table if exists public.sf_zone             cascade;

-- 3) remove ONLY the crowd HMAC key (leave the dd_secret table + ticket_hmac untouched) -----
delete from public.dd_secret where name = 'crowd_hmac';

-- ============================================================================
-- Verify it's gone (optional): each should return 0 rows.
--   select relname from pg_class where relname like 'sf_crowd%' or relname in
--     ('sf_zone','sf_sensitive_geofence','sf_consent','sf_presence_agg','sf_ad_delivery_agg','sf_deletion_log');
--   select proname from pg_proc where proname like 'sf_crowd%' or proname in
--     ('sf_cell','sf_in_sensitive','sf_dp_noise','sf_subject_hash','sf_consent_set','sf_presence_public');
-- When you're ready to build for real: P0 ratify (counsel + knobs + sensitive list + secret) → then re-run 21.
-- ============================================================================
