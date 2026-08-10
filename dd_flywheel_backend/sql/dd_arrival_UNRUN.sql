-- ============================================================================
-- dd_arrival_UNRUN.sql  —  ⛔ DO NOT RUN UNTIL THE GATE IS MET ⛔
--
-- The ARRIVAL PROXIMITY server: a fan (WITH CONSENT) taps "Drive me there" → the phone's default
-- map drives them → and, as they approach, the venue HOST gets a Twilio heads-up ("a guest is N min
-- out"), parking is PRE-RESERVED, the party is flagged EXPECTED, and the fan is told all of it.
-- The fan is driven back into OUR context (grounds map, pre-park, live setlist).
--
-- ⚠️ IT NEVER BYPASSES TICKET SECURITY: "pre-check-in" here is only an EXPECTED-ARRIVAL flag for the
--    host + a parking hold. The actual door admit still requires the secure ROTATING ticket
--    (sf_ticket_redeem_rot). Nothing in this file can admit anyone. The §1 TIX invariants stand.
--
-- THE GATE (all must be true before running):
--   1) STAGEFILL_PRIVACY_CHARTER_v2 ratified (P0 + counsel) — fan live-location shared to a third
--      party (the venue) is the charter's core question. Consent is per-fan ('arrival' scope, DDConsent).
--   2) A live Twilio number + the notify edge function deployed.
--   3) window.SF_ARRIVAL_ENABLED = true in the client (dd_arrival.js), flipped only after 1 & 2.
-- Client stays inert until then: "Drive me there" (the map handoff) works now; the broadcast does not.
--
-- Idempotent, RLS on, SECURITY DEFINER RPCs, opaque owner ids only (no PII). Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- arrival pings (append-only trail; opaque owner, coarse distance — never a raw track)
create table if not exists public.dd_arrival (
  id          uuid primary key default gen_random_uuid(),
  event_slug  text not null,
  owner_id    text,                    -- opaque per-fan id, no PII
  dist_m      int,
  eta_min     int,
  phase       text,                    -- 'approaching' | 'arriving' | 'arrived'
  at          timestamptz not null default now()
);
create index if not exists dd_arrival_idx on public.dd_arrival (event_slug, at);
alter table public.dd_arrival enable row level security;

-- parking holds (pre-reserved on 'arriving')
create table if not exists public.dd_parking_hold (
  event_slug  text not null,
  owner_id    text not null,
  held_at     timestamptz not null default now(),
  primary key (event_slug, owner_id)
);
alter table public.dd_parking_hold enable row level security;

-- sf_arrival_ping — record a phase crossing; reserve parking on 'arriving'; return the fan-facing line.
-- The Twilio SMS to the HOST is fired by the notify edge function (reads new dd_arrival rows) — NOT here.
drop function if exists public.sf_arrival_ping(text, int, int, text, text);
create or replace function public.sf_arrival_ping(
  p_event text, p_dist_m int, p_eta_min int, p_phase text, p_owner text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e text; v_o text; v_ph text; v_tell text;
begin
  v_e := btrim(coalesce(p_event, '')); v_o := nullif(btrim(coalesce(p_owner, '')), '');
  v_ph := (case when p_phase in ('approaching','arriving','arrived') then p_phase else 'approaching' end);
  if v_e = '' then return jsonb_build_object('ok', false, 'reason', 'event'); end if;

  insert into public.dd_arrival(event_slug, owner_id, dist_m, eta_min, phase)
    values (v_e, v_o, greatest(0, coalesce(p_dist_m,0)), greatest(0, coalesce(p_eta_min,0)), v_ph);

  if v_ph = 'arriving' and v_o is not null then
    insert into public.dd_parking_hold(event_slug, owner_id) values (v_e, v_o)
      on conflict (event_slug, owner_id) do update set held_at = now();
  end if;

  v_tell := (case v_ph
    when 'approaching' then 'We let the venue know you''re about ' || coalesce(p_eta_min,0) || ' min out. 🌹'
    when 'arriving'    then 'Parking''s reserved and you''re on the host''s expected list — pull in. 🅿️'
    when 'arrived'     then 'Welcome — open your ticket at the gate. Your grounds map is ready. 🎪'
    else 'On our way to you.' end);
  return jsonb_build_object('ok', true, 'phase', v_ph, 'tell', v_tell);
end $$;

grant execute on function public.sf_arrival_ping(text, int, int, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- ROLLBACK / turn off:
--   set window.SF_ARRIVAL_ENABLED = false; (client stops all broadcast)
--   drop function if exists public.sf_arrival_ping(text,int,int,text,text);
--   -- tables may be kept (append-only history) or dropped if required by counsel.
-- ============================================================================
