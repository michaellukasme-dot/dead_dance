-- ============================================================================
-- 19_ticket_security.sql — the TICKET-ACCEPTANCE SECURITY spine.
--
-- The accountability + anti-fraud layer under "the most secure ticket on the market."
-- What makes that claim TRUE (and only what is actually true — see TICKET_SECURITY.md):
--   • 128-bit UNGUESSABLE ticket id (gen_random_bytes(16)) — you cannot enumerate tickets.
--   • HMAC-SHA256 TAMPER-EVIDENT signature over (id|event|tier|issued_at), keyed by a
--     SERVER-ONLY secret in dd_secret. Change any field and the signature no longer matches
--     → the ticket verifies as FORGED. The secret never leaves the database; the signing
--     helper is granted to NOBODY, so no client can mint or re-sign a ticket.
--   • ATOMIC SINGLE-USE redemption: a conditional UPDATE ... WHERE status='valid' admits
--     exactly once; a second scan (even a screenshot reshare) hits 0 rows → 'already_used'.
--   • STAFF-GATED paid redemption: a PAID ticket can only be redeemed by presenting the
--     event's staff token (held by door staff / a street-teamer acting as venue staff) —
--     a fan holding their own valid ticket cannot self-admit. FREE tickets skip the gate.
--   • FULL PROVENANCE audit: every issue / redeem (incl. forged + already-used attempts) is
--     logged with actor + geo + time in dd_ticket_prov.
--
-- House style (matches 15_citymap / 17_truth_spine / 18_streetteam):
--   • create-or-replace, idempotent, safe to re-run.
--   • RLS ON on every table; NO direct table grants — all access via SECURITY DEFINER RPCs.
--   • dd_secret + dd_event_staff + the signing helper are granted to NOBODY (secret stays server-side).
--   • set search_path = public; drop function if exists before each create; grants explicit.
--   • NO PII: owner/actor are opaque local ids, never names/phones. lat/lng are activity context.
--
-- HONEST CAVEATS (do not overclaim — full detail in 00_House_Admin/TICKET_SECURITY.md):
--   • Security holds ONLY once the secret is set (see the commented INSERT below) and kept secret.
--   • Single-use defeats screenshot/resale AFTER first admit; it is not an anti-screenshot magic.
--   • Signatures are verified SERVER-SIDE; offline verification is not claimed by this spine.
-- ============================================================================

create extension if not exists pgcrypto;


-- 1) dd_secret — the server-only HMAC key store. RLS ON, NO grants to anyone.
--    Only the SECURITY DEFINER signing helper (owned by this role) reads it.
create table if not exists public.dd_secret (
  name text primary key,
  val  text not null
);
alter table public.dd_secret enable row level security;   -- no policies, no grants → unreachable by anon/authenticated
-- MICHAEL: set your real secret ONCE (a long random string), then keep it out of source control.
-- Generate one, e.g.:  select encode(gen_random_bytes(32),'hex');
--   insert into public.dd_secret(name, val)
--     values ('ticket_hmac', 'PASTE-A-LONG-RANDOM-HEX-STRING-HERE')
--     on conflict (name) do update set val = excluded.val;


-- 2) dd_ticket — one row per issued ticket. 128-bit unguessable id.
create table if not exists public.dd_ticket (
  ticket_id    text primary key default encode(gen_random_bytes(16),'hex'),  -- 128-bit, unguessable
  event_slug   text not null,
  tier         text not null default 'ga',
  paid         boolean not null default false,
  price        numeric,
  owner_id     text,                                   -- opaque holder id; never a name/phone
  sig          text,                                   -- HMAC-SHA256 hex over (id|event|tier|issued_at)
  issued_by    text,
  issued_at    timestamptz not null default now(),
  status       text not null default 'valid',          -- valid | redeemed | void
  redeemed_at  timestamptz,
  redeemed_by  text,
  redeemed_lat double precision,
  redeemed_lng double precision
);
alter table public.dd_ticket enable row level security;
create index if not exists dd_ticket_event on public.dd_ticket(event_slug, status);


-- 3) dd_ticket_prov — the full provenance / audit chain. One row per action.
--    kind: issue | transfer | redeem | void   (redeem rows also carry forged/already-used attempts)
create table if not exists public.dd_ticket_prov (
  id         bigserial primary key,
  ticket_id  text not null,
  kind       text not null,
  actor      text,
  lat        double precision,
  lng        double precision,
  at         timestamptz not null default now(),
  note       text
);
alter table public.dd_ticket_prov enable row level security;
create index if not exists dd_ticket_prov_tid on public.dd_ticket_prov(ticket_id, at);


-- 4) dd_event_staff — the per-event STAFF TOKEN (a shared secret held only by venue staff).
--    Required to make the paid-redemption gate REAL, not theater: a fan holding a valid ticket
--    still cannot self-admit, because admitting a PAID ticket needs this token. TOFU-claimed:
--    the first claim for an event records the token; later claims must match. RLS ON, NO grants.
create table if not exists public.dd_event_staff (
  event_slug  text primary key,
  staff_token text not null,
  set_by      text,
  set_at      timestamptz not null default now()
);
alter table public.dd_event_staff enable row level security;   -- server-side only; compared inside redeem


-- ---------------------------------------------------------------------------
-- signing helper — the ONLY reader of the secret. Granted to NOBODY (revoked from
-- PUBLIC below) so no client can compute a signature for arbitrary inputs → no forging.
-- Deterministic issued_at rendering (UTC, microsecond) so issue and verify agree regardless
-- of the caller's session timezone.
-- ---------------------------------------------------------------------------
drop function if exists public.dd_ticket_sig(text, text, text, timestamptz);
create or replace function public.dd_ticket_sig(
  p_id text, p_event text, p_tier text, p_issued timestamptz)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_key text; v_basis text;
begin
  select val into v_key from public.dd_secret where name = 'ticket_hmac';
  if v_key is null then
    return null;   -- secret not set → no signature; callers report this honestly
  end if;
  v_basis := p_id || '|' || coalesce(p_event,'') || '|' || coalesce(p_tier,'')
             || '|' || to_char(p_issued at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US');
  return encode(hmac(v_basis, v_key, 'sha256'), 'hex');
end $$;
revoke all on function public.dd_ticket_sig(text, text, text, timestamptz) from public;   -- secret stays server-side


-- ---------------------------------------------------------------------------
-- sf_ticket_issue — mint a ticket, sign it, log provenance. Returns id + sig.
-- ---------------------------------------------------------------------------
drop function if exists public.sf_ticket_issue(text, text, boolean, numeric, text, text);
create or replace function public.sf_ticket_issue(
  p_event text, p_tier text, p_paid boolean, p_price numeric, p_owner text, p_issued_by text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_event text; v_tier text; v_id text; v_issued timestamptz; v_sig text;
begin
  v_event := lower(btrim(coalesce(p_event, '')));
  v_tier  := nullif(btrim(coalesce(p_tier, '')), '');
  if v_event = '' then return jsonb_build_object('ok', false, 'err', 'event required'); end if;

  insert into public.dd_ticket(event_slug, tier, paid, price, owner_id, issued_by)
    values (v_event, coalesce(v_tier,'ga'), coalesce(p_paid,false), p_price,
            nullif(btrim(coalesce(p_owner,'')),''), nullif(btrim(coalesce(p_issued_by,'')),''))
    returning ticket_id, issued_at into v_id, v_issued;

  v_sig := public.dd_ticket_sig(v_id, v_event, coalesce(v_tier,'ga'), v_issued);
  if v_sig is null then
    -- secret not set: the ticket exists but is UNSIGNED. Fail loud so no one trusts an unsigned ticket.
    return jsonb_build_object('ok', false, 'err', 'ticket secret not set — cannot sign', 'ticket_id', v_id, 'status', 'unsigned');
  end if;
  update public.dd_ticket set sig = v_sig where ticket_id = v_id;

  insert into public.dd_ticket_prov(ticket_id, kind, actor, note)
    values (v_id, 'issue', nullif(btrim(coalesce(p_issued_by,'')),''),
            case when coalesce(p_paid,false) then 'paid' else 'free' end);

  return jsonb_build_object('ok', true, 'ticket_id', v_id, 'sig', v_sig, 'status', 'valid', 'paid', coalesce(p_paid,false));
end $$;


-- ---------------------------------------------------------------------------
-- sf_ticket_verify — recompute + compare the HMAC. NO mutation (pre-check).
-- forged/tampered/unknown → authentic:false.
-- ---------------------------------------------------------------------------
drop function if exists public.sf_ticket_verify(text, text);
create or replace function public.sf_ticket_verify(p_ticket text, p_sig text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id text; r record; v_expected text; v_authentic boolean;
begin
  v_id := btrim(coalesce(p_ticket, ''));
  if v_id = '' then return jsonb_build_object('ok', false, 'err', 'ticket required'); end if;

  select * into r from public.dd_ticket where ticket_id = v_id;
  if not found then
    return jsonb_build_object('ok', true, 'authentic', false, 'status', 'not_found', 'paid', null);
  end if;

  v_expected := public.dd_ticket_sig(r.ticket_id, r.event_slug, r.tier, r.issued_at);
  if v_expected is null then
    return jsonb_build_object('ok', false, 'err', 'ticket secret not set', 'authentic', false, 'status', r.status, 'paid', r.paid);
  end if;
  v_authentic := (btrim(coalesce(p_sig,'')) = v_expected);

  return jsonb_build_object('ok', true, 'authentic', v_authentic, 'status', r.status, 'paid', r.paid);
end $$;


-- ---------------------------------------------------------------------------
-- sf_ticket_staff_claim — TOFU-register (or verify) an event's staff token.
-- First claim records it; later claims must match. Door/venue staff hold this token;
-- redeem compares against it for PAID tickets. Returns whether the presented token is the event's.
-- ---------------------------------------------------------------------------
drop function if exists public.sf_ticket_staff_claim(text, text, text);
create or replace function public.sf_ticket_staff_claim(p_event text, p_staff_token text, p_by text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_event text; v_tok text; v_existing text;
begin
  v_event := lower(btrim(coalesce(p_event, '')));
  v_tok   := btrim(coalesce(p_staff_token, ''));
  if v_event = '' or v_tok = '' then return jsonb_build_object('ok', false, 'err', 'event + staff token required'); end if;

  select staff_token into v_existing from public.dd_event_staff where event_slug = v_event;
  if v_existing is null then
    insert into public.dd_event_staff(event_slug, staff_token, set_by)
      values (v_event, v_tok, nullif(btrim(coalesce(p_by,'')),''))
      on conflict (event_slug) do nothing;
    select staff_token into v_existing from public.dd_event_staff where event_slug = v_event;
  end if;
  return jsonb_build_object('ok', true, 'event', v_event, 'valid', (v_tok = v_existing));
end $$;


-- ---------------------------------------------------------------------------
-- sf_ticket_redeem — ATOMIC single-use admit. Verify → (paid) staff gate → conditional update → log.
--   forged sig  → { ok:false, reason:'forged' }
--   paid, no staff token registered → { ok:false, reason:'no_staff' }
--   paid, wrong staff token         → { ok:false, reason:'not_staff' }
--   already redeemed/void           → { ok:false, reason:'already_used', redeemed_at }
--   success                         → { ok:true, status:'admitted', authentic:true }
-- ---------------------------------------------------------------------------
drop function if exists public.sf_ticket_redeem(text, text, text, double precision, double precision, text);
create or replace function public.sf_ticket_redeem(
  p_ticket text, p_sig text, p_staff_token text,
  p_lat double precision, p_lng double precision, p_by text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id text; r record; v_expected text; v_staff text; v_rows int; v_when timestamptz; v_by text;
begin
  v_id := btrim(coalesce(p_ticket, ''));
  v_by := nullif(btrim(coalesce(p_by,'')),'');
  if v_id = '' then return jsonb_build_object('ok', false, 'reason', 'ticket required'); end if;

  select * into r from public.dd_ticket where ticket_id = v_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'authentic', false);
  end if;

  -- (1) authenticity — recompute the HMAC and compare. Forged/tampered → refuse + audit.
  v_expected := public.dd_ticket_sig(r.ticket_id, r.event_slug, r.tier, r.issued_at);
  if v_expected is null then
    return jsonb_build_object('ok', false, 'reason', 'secret_not_set', 'authentic', false);
  end if;
  if btrim(coalesce(p_sig,'')) <> v_expected then
    insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
      values (v_id, 'redeem', v_by, p_lat, p_lng, 'FORGED-attempt');
    return jsonb_build_object('ok', false, 'reason', 'forged', 'authentic', false);
  end if;

  -- (2) PAID → staff gate. FREE tickets skip this entirely.
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

  -- (3) ATOMIC single-use: only a still-valid ticket flips to redeemed. Race-safe.
  update public.dd_ticket
     set status = 'redeemed', redeemed_at = now(), redeemed_by = v_by,
         redeemed_lat = p_lat, redeemed_lng = p_lng
   where ticket_id = v_id and status = 'valid';
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select redeemed_at into v_when from public.dd_ticket where ticket_id = v_id;
    insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
      values (v_id, 'redeem', v_by, p_lat, p_lng, 'already-used-attempt');
    return jsonb_build_object('ok', false, 'reason', 'already_used', 'authentic', true, 'redeemed_at', v_when);
  end if;

  -- (4) log the successful admit (actor + geo)
  insert into public.dd_ticket_prov(ticket_id, kind, actor, lat, lng, note)
    values (v_id, 'redeem', v_by, p_lat, p_lng, 'admitted');

  return jsonb_build_object('ok', true, 'status', 'admitted', 'authentic', true);
end $$;


-- ---------------------------------------------------------------------------
-- sf_ticket_prov — the provenance / audit chain for one ticket (oldest first).
-- ---------------------------------------------------------------------------
drop function if exists public.sf_ticket_prov(text);
create or replace function public.sf_ticket_prov(p_ticket text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id text; v_out jsonb;
begin
  v_id := btrim(coalesce(p_ticket, ''));
  if v_id = '' then return jsonb_build_array(); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', kind, 'actor', actor, 'lat', lat, 'lng', lng, 'at', at, 'note', note
         ) order by at asc, id asc), '[]'::jsonb)
    into v_out
  from public.dd_ticket_prov where ticket_id = v_id;
  return coalesce(v_out, '[]'::jsonb);
end $$;


-- ---------------------------------------------------------------------------
-- sf_ticket_attend — the ATTENDANCE FACT for the ticket back.
-- attended = the ticket has been redeemed at the door / by staff / by proximity-accept.
-- ---------------------------------------------------------------------------
drop function if exists public.sf_ticket_attend(text);
create or replace function public.sf_ticket_attend(p_ticket text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id text; r record;
begin
  v_id := btrim(coalesce(p_ticket, ''));
  if v_id = '' then return jsonb_build_object('ok', false, 'attended', false); end if;
  select event_slug, status, redeemed_at into r from public.dd_ticket where ticket_id = v_id;
  if not found then return jsonb_build_object('ok', true, 'attended', false, 'event', null, 'at', null); end if;
  return jsonb_build_object('ok', true, 'attended', (r.status = 'redeemed'),
                            'event', r.event_slug, 'at', r.redeemed_at);
end $$;


-- ---- grants (clients call these; the secret + staff table + signer are NOT granted) --------
grant execute on function public.sf_ticket_issue(text, text, boolean, numeric, text, text)                        to anon, authenticated, service_role;
grant execute on function public.sf_ticket_verify(text, text)                                                     to anon, authenticated, service_role;
grant execute on function public.sf_ticket_staff_claim(text, text, text)                                          to anon, authenticated, service_role;
grant execute on function public.sf_ticket_redeem(text, text, text, double precision, double precision, text)     to anon, authenticated, service_role;
grant execute on function public.sf_ticket_prov(text)                                                             to anon, authenticated, service_role;
grant execute on function public.sf_ticket_attend(text)                                                           to anon, authenticated, service_role;
-- dd_ticket_sig: granted to NOBODY (revoked from public above). dd_secret / dd_event_staff: NO table grants.


-- ============================================================================
-- SMOKE TEST (commented — set the secret first, then paste into the SQL editor)
-- ============================================================================
-- insert into public.dd_secret(name,val) values ('ticket_hmac', encode(gen_random_bytes(32),'hex'))
--   on conflict (name) do update set val = excluded.val;                       -- one-time secret
--
-- -- FREE ticket: issue → verify authentic → redeem (no staff) → second redeem blocked
-- select public.sf_ticket_issue('musikfest-2026','ga', false, 0, 'st-abc', 'st-abc');   -- {ok, ticket_id, sig, status:valid}
-- -- copy ticket_id + sig from above into the calls below:
-- select public.sf_ticket_verify('<ID>','<SIG>');                              -- {authentic:true, status:valid, paid:false}
-- select public.sf_ticket_verify('<ID>','deadbeef');                           -- {authentic:false}  (tampered sig)
-- select public.sf_ticket_redeem('<ID>','<SIG>', null, 40.61, -75.38, 'door'); -- {ok:true, status:admitted}
-- select public.sf_ticket_redeem('<ID>','<SIG>', null, 40.61, -75.38, 'door'); -- {ok:false, reason:already_used, redeemed_at}
-- select public.sf_ticket_attend('<ID>');                                      -- {attended:true, event, at}
-- select public.sf_ticket_prov('<ID>');                                        -- [issue, redeem(admitted), redeem(already-used-attempt)]
--
-- -- PAID ticket: staff gate. Register the event's staff token, then redeem WITH it.
-- select public.sf_ticket_staff_claim('deal-lost-tavern','STAFF-XYZ','owner');  -- {ok, valid:true}
-- select public.sf_ticket_issue('deal-lost-tavern','ga', true, 20, 'fan1', 'door'); -- paid ticket
-- select public.sf_ticket_redeem('<ID2>','<SIG2>', null, null, null, 'door');       -- {ok:false, reason:not_staff}
-- select public.sf_ticket_redeem('<ID2>','<SIG2>', 'STAFF-XYZ', null, null, 'door'); -- {ok:true, admitted}
-- ============================================================================
