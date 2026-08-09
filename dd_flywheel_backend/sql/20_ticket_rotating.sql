-- ============================================================================
-- 20_ticket_rotating.sql — makes "Screenshots won't get you in" LITERALLY TRUE.
--
-- Builds a rotating, time-based entry code on top of the static signed ticket in 19.
-- Model (like Ticketmaster SafeTix): each ticket gets a PER-TICKET seed. The holder's
-- device fetches the seed ONCE (proving it holds the real ticket via the static sig),
-- then generates a NEW code every ~15s on-device: code = HMAC(seed, id|step). The gate
-- verifies the code against the CURRENT time-step (±1 for clock skew). A screenshot shows
-- one step's code and goes STALE within ~30s — worthless even before the first scan.
-- Single-use redemption from 19 stays as defense-in-depth.
--
-- House style: idempotent, create-or-replace, RLS ON, secret/seed never granted to clients,
-- all access via SECURITY DEFINER RPCs. Safe to re-run. Requires 19_ticket_security.sql first.
-- ============================================================================

create extension if not exists pgcrypto;

-- STEP WINDOW (seconds). Smaller = a screenshot dies faster; too small = clock-skew misses.
-- 15s + a ±1 step tolerance ⇒ a screenshot is dead within ~30 seconds.

-- 1) per-ticket SEED — a secret unique to each ticket. Exposing one seed only ever risks
--    that one ticket (never the global HMAC key). Backfill existing rows.
alter table public.dd_ticket add column if not exists seed text;
update public.dd_ticket set seed = encode(gen_random_bytes(20),'hex') where seed is null;
alter table public.dd_ticket alter column seed set default encode(gen_random_bytes(20),'hex');

-- helper: the rotating code for (id, seed, step) — first 16 hex of HMAC(id|step, seed).
-- Granted to NOBODY; used only inside the SECURITY DEFINER RPCs below.
drop function if exists public.dd_ticket_rotcode(text, text, bigint);
create or replace function public.dd_ticket_rotcode(p_id text, p_seed text, p_step bigint)
returns text language sql immutable set search_path = public, extensions as $$
  select substring(encode(hmac(p_id || '|' || p_step::text, p_seed, 'sha256'), 'hex') from 1 for 16);
$$;
revoke all on function public.dd_ticket_rotcode(text, text, bigint) from public;

-- 2) sf_ticket_seed — hand the device its seed, ONLY if it presents the valid static sig
--    (i.e. it actually holds the real ticket). Device caches it and rolls codes offline.
drop function if exists public.sf_ticket_seed(text, text);
create or replace function public.sf_ticket_seed(p_ticket text, p_sig text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_expected text;
begin
  select * into r from public.dd_ticket where ticket_id = btrim(coalesce(p_ticket,''));
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  v_expected := public.dd_ticket_sig(r.ticket_id, r.event_slug, r.tier, r.issued_at);
  if v_expected is null then return jsonb_build_object('ok', false, 'reason', 'secret_not_set'); end if;
  if btrim(coalesce(p_sig,'')) <> v_expected then
    return jsonb_build_object('ok', false, 'reason', 'forged');   -- only the real holder gets the seed
  end if;
  return jsonb_build_object('ok', true, 'seed', r.seed, 'window', 15, 'id', r.ticket_id);
end $$;

-- 3) sf_ticket_redeem_rot — atomic single-use admit using the ROTATING code.
--    Rejects a stale step (screenshot older than the ±1 window) AND a wrong code (forgery),
--    then applies the same PAID→staff gate + single-use + provenance as sf_ticket_redeem.
drop function if exists public.sf_ticket_redeem_rot(text, bigint, text, text, double precision, double precision, text);
create or replace function public.sf_ticket_redeem_rot(
  p_ticket text, p_step bigint, p_code text, p_staff_token text,
  p_lat double precision, p_lng double precision, p_by text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id text; r record; v_cur bigint; v_expected text; v_staff text; v_rows int; v_when timestamptz; v_by text;
begin
  v_id := btrim(coalesce(p_ticket, ''));
  v_by := nullif(btrim(coalesce(p_by,'')),'');
  if v_id = '' then return jsonb_build_object('ok', false, 'reason', 'ticket required'); end if;

  select * into r from public.dd_ticket where ticket_id = v_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found', 'authentic', false); end if;
  if r.seed is null then return jsonb_build_object('ok', false, 'reason', 'secret_not_set', 'authentic', false); end if;

  -- (1) STALENESS — the claimed step must be within ±1 of the server's current step.
  v_cur := floor(extract(epoch from now()) / 15)::bigint;
  if p_step is null or p_step < v_cur - 1 or p_step > v_cur + 1 then
    insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
      values (v_id, 'redeem', v_by, p_lat, p_lng, 'STALE-code-attempt');
    return jsonb_build_object('ok', false, 'reason', 'stale', 'authentic', true);
  end if;

  -- (2) AUTHENTICITY — recompute the rotating code for the claimed step; must match.
  v_expected := public.dd_ticket_rotcode(v_id, r.seed, p_step);
  if btrim(lower(coalesce(p_code,''))) <> v_expected then
    insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
      values (v_id, 'redeem', v_by, p_lat, p_lng, 'FORGED-rot-attempt');
    return jsonb_build_object('ok', false, 'reason', 'forged', 'authentic', false);
  end if;

  -- (3) PAID → staff gate (same as 19).
  if r.paid then
    select staff_token into v_staff from public.dd_event_staff where event_slug = r.event_slug;
    if v_staff is null then
      insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
        values (v_id, 'redeem', v_by, p_lat, p_lng, 'no-staff-registered');
      return jsonb_build_object('ok', false, 'reason', 'no_staff', 'authentic', true);
    end if;
    if btrim(coalesce(p_staff_token,'')) <> v_staff then
      insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
        values (v_id, 'redeem', v_by, p_lat, p_lng, 'not-staff-attempt');
      return jsonb_build_object('ok', false, 'reason', 'not_staff', 'authentic', true);
    end if;
  end if;

  -- (4) ATOMIC single-use (race-safe) + audit.
  update public.dd_ticket
     set status = 'redeemed', redeemed_at = now(), redeemed_by = v_by, redeemed_lat = p_lat, redeemed_lng = p_lng
   where ticket_id = v_id and status = 'valid';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    select redeemed_at into v_when from public.dd_ticket where ticket_id = v_id;
    insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
      values (v_id, 'redeem', v_by, p_lat, p_lng, 'already-used-attempt');
    return jsonb_build_object('ok', false, 'reason', 'already_used', 'authentic', true, 'redeemed_at', v_when);
  end if;

  insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
    values (v_id, 'redeem', v_by, p_lat, p_lng, 'admitted-rot');
  return jsonb_build_object('ok', true, 'status', 'admitted', 'authentic', true);
end $$;

-- ---- grants: clients call seed + redeem_rot; the seed column, rotcode helper, secret are NOT granted.
grant execute on function public.sf_ticket_seed(text, text)                                                                to anon, authenticated, service_role;
grant execute on function public.sf_ticket_redeem_rot(text, bigint, text, text, double precision, double precision, text)  to anon, authenticated, service_role;

-- ============================================================================
-- SMOKE TEST (after 19's secret is set):
--   select public.sf_ticket_issue('musikfest-2026','ga', false, 0, 'st-abc', 'st-abc');  -- {ticket_id, sig}
--   select public.sf_ticket_seed('<ID>','<SIG>');                                        -- {seed, window:15}
--   -- compute step = floor(epoch/15) and code = substr(hmac(id|step, seed),1,16), then:
--   select public.sf_ticket_redeem_rot('<ID>', <STEP>, '<CODE>', null, 40.61, -75.38, 'door');  -- {admitted}
--   select public.sf_ticket_redeem_rot('<ID>', <STEP-5>, '<OLDCODE>', null, null, null, 'door'); -- {reason:'stale'}
-- ============================================================================
