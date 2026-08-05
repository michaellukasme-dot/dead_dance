-- ============================================================================
-- 24_push.sql — DeadDance PHASE 4 push-token spine (native APNs/FCM registration).
--
-- WHAT THIS FILE IS
--   The privacy-by-schema store for DEVICE PUSH TOKENS, so the server can send
--   the few genuinely-LIVE notifications it alone knows (a schedule change,
--   "band on NOW"). It is the routing book — device token + platform — and
--   NOTHING about a person. On-device SCHEDULED reminders (doors / "band on in 10"
--   / set-break-over) need NONE of this: they fire OFFLINE from the device via
--   dd_notify_schedule.js. This table is ONLY the remote-push address list.
--
-- CRITICAL HONESTY (House Law): this SQL registers/stores tokens and purges stale
--   ones. It does NOT send a push. The actual APNs/FCM send is a SERVER function
--   (functions/send_push) reading Michael's APNs auth key + FCM service account
--   from SERVER secrets — never the client, never this DB. That function returns
--   501 until the keys are set. No fake "delivered" anywhere in this stack.
--
-- PRIVACY IS STRUCTURAL, NOT PROMISED (mirrors 22_geo.sql):
--   * IDS-ONLY. The row keys on a subject_hash — an app-identity HASH, NEVER email
--     / phone / name / auth.uid(). There is no PII column here BY DESIGN.
--   * The device_token is a push ROUTING address (APNs/FCM), not a secret and not
--     an identity. It rotates; we upsert on it.
--   * Registration is ONLY through a SECURITY DEFINER RPC that accepts a hash + a
--     token + platform + optional app version — and nothing else.
--   * RLS ON. Anon/authenticated get NO read path to the token table (denied by
--     default, no select policy). The owner bypasses so the definer upsert works.
--   * A retention job purges stale/disabled tokens so the routing book does not
--     become a stale surveillance list.
--
-- HOUSE STYLE (matches 22_geo / 07_presence):
--   create-or-replace, idempotent, drop-if-exists first, SECURITY DEFINER +
--   set search_path = public, explicit revoke/grant. Safe to re-run.
--
-- Run order: standalone (own namespace). Depends only on gen_random_uuid()
--   (pgcrypto, present by default on Supabase). Michael runs this in the SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PUSH TOKEN — one row per (subject_hash, device_token). IDS-ONLY, no PII.
--    subject_hash = app-identity HASH (never email). device_token = APNs/FCM
--    routing address. platform pins which sender to use. NO name/email/auth.uid.
-- ---------------------------------------------------------------------------
create table if not exists public.dd_push_token (
  id            uuid primary key default gen_random_uuid(),
  subject_hash  text not null,                 -- app-identity HASH, NOT PII
  device_token  text not null,                 -- APNs/FCM routing token (not a secret)
  platform      text not null
                  check (platform in ('ios','android','web')),
  app_version   text,                          -- optional, for targeting/debug (not PII)
  disabled      boolean not null default false, -- set true when a send reports the token is dead
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (device_token)                          -- one row per device token (upsert target)
);

-- fast lookup of a subject's live tokens (the server fans out to these).
create index if not exists dd_push_token_subject_idx
  on public.dd_push_token (subject_hash) where disabled = false;

-- ============================================================================
-- RLS — forced-off intentionally (same rationale as 22_geo): RLS ENABLED so
-- anon/authenticated have NO read/write path (denied by default, no policy); the
-- table OWNER bypasses so the SECURITY DEFINER upsert can write. FORCE here would
-- break the definer path on run.
-- ============================================================================
alter table public.dd_push_token enable row level security;
-- NO select/insert/update/delete policy for anon/authenticated → the token list is
-- sealed. The ONLY write path is dd_push_register_token (SECURITY DEFINER) below.

-- ============================================================================
-- REGISTER RPC (SECURITY DEFINER) — IDS-ONLY upsert. Accepts a hash + token +
--   platform + optional app version. NOTHING ELSE. Never touches auth.uid().
--   on-conflict (device_token) → re-point the token to the current subject and
--   bump last_seen (a token can move devices/reinstalls; the token is the key).
-- ============================================================================
drop function if exists public.dd_push_register_token(text, text, text, text);
create or replace function public.dd_push_register_token(
  p_subject_hash text,
  p_device_token text,
  p_platform     text,
  p_app_version  text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash  text := btrim(coalesce(p_subject_hash, ''));
  v_token text := btrim(coalesce(p_device_token, ''));
  v_plat  text := lower(btrim(coalesce(p_platform, '')));
begin
  -- structural guards — reject anything that isn't the shape we accept.
  if v_hash = '' then
    return jsonb_build_object('ok', false, 'err', 'subject_hash required');
  end if;
  if v_token = '' then
    return jsonb_build_object('ok', false, 'err', 'device_token required');
  end if;
  if v_plat not in ('ios','android','web') then
    return jsonb_build_object('ok', false, 'err', 'platform must be ios|android|web');
  end if;
  -- cheap abuse guard: a real APNs/FCM token is bounded; reject absurd input.
  if length(v_token) > 8192 or length(v_hash) > 512 then
    return jsonb_build_object('ok', false, 'err', 'input too large');
  end if;

  insert into public.dd_push_token
      (subject_hash, device_token, platform, app_version, disabled, updated_at, last_seen_at)
  values
      (v_hash, v_token, v_plat, nullif(btrim(coalesce(p_app_version,'')),''), false, now(), now())
  on conflict (device_token) do update
    set subject_hash = excluded.subject_hash,
        platform     = excluded.platform,
        app_version  = coalesce(excluded.app_version, public.dd_push_token.app_version),
        disabled     = false,          -- re-registering revives a token
        updated_at   = now(),
        last_seen_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- registration is the ONLY write path for anon/authenticated; the table stays sealed.
revoke all on function public.dd_push_register_token(text, text, text, text) from public;
grant execute on function public.dd_push_register_token(text, text, text, text) to anon, authenticated;

-- ============================================================================
-- DISABLE RPC (SECURITY DEFINER) — server marks a token dead after an APNs/FCM
--   'Unregistered'/'NotRegistered' response. Admin/job only (service_role).
-- ============================================================================
drop function if exists public.dd_push_disable_token(text);
create or replace function public.dd_push_disable_token(p_device_token text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  update public.dd_push_token set disabled = true, updated_at = now()
    where device_token = btrim(coalesce(p_device_token,'')) and disabled = false;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.dd_push_disable_token(text) from public;
revoke all on function public.dd_push_disable_token(text) from anon;
revoke all on function public.dd_push_disable_token(text) from authenticated;
grant  execute on function public.dd_push_disable_token(text) to service_role;  -- send-job only

-- ============================================================================
-- RETENTION PURGE — delete stale / disabled tokens. Keeps the routing book live,
--   not a stale address graveyard. TOKEN_RETENTION = 60 days since last_seen.
--   Run daily via pg_cron (see the commented schedule) OR manually.
-- ============================================================================
drop function if exists public.dd_push_purge_tokens();
create or replace function public.dd_push_purge_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from public.dd_push_token
    where disabled = true
       or last_seen_at < now() - interval '60 days';   -- TOKEN_RETENTION
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.dd_push_purge_tokens() from public;
revoke all on function public.dd_push_purge_tokens() from anon;
revoke all on function public.dd_push_purge_tokens() from authenticated;
grant  execute on function public.dd_push_purge_tokens() to service_role;  -- job/admin only

-- Schedule the purge (requires the pg_cron extension). Uncomment on Supabase:
-- select cron.schedule('dd_push_purge_tokens', '30 3 * * *',
--   $$ select public.dd_push_purge_tokens(); $$);

-- ============================================================================
-- NOTES
--   * The SEND uses these tokens SERVER-side only (functions/send_push, reading
--     APNs .p8 auth key + FCM service account from SERVER secrets). No key ever
--     lives in the client or in this DB. This file is the address book, not the
--     postman.
--   * IDS-ONLY: there is no email/name/auth.uid() column here by design. A token
--     is a routing address; the subject_hash is a de-identified app hash. This is
--     the same privacy shape as 22_geo.sql's contributor_token.
--   * On-device SCHEDULED reminders (dd_notify_schedule.js) need NONE of this —
--     they fire offline from the device. Only genuinely-live server pushes do.
-- ============================================================================
