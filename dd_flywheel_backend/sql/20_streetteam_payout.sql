-- ============================================================================
-- 20_streetteam_payout.sql — the STREET-TEAM MUG-CHALLENGE / PAYOUT spine.
--
-- The Lehigh "$13 MUG + FIRST BEER" program: a street-teamer who spreads the app to
-- 100 REAL phones earns $13 (a MusikFest mug + their first beer). This spine makes the
-- count HONEST and the payout HONEST:
--   • We count REAL REFERRED JOINS — distinct NEW devices that opened THIS member's
--     share link (?ref=st:<member>) and landed in the app. NOT share-taps.
--   • One row per (festival, member, new-device) via a UNIQUE constraint → the same
--     phone can never be counted twice, and a member can never count themselves.
--   • CLAIM ONLY — NEVER PAYS. At >= 100 phones a member records a PENDING claim with
--     the Venmo/PayPal handle THEY enter. Michael reads sf_st_payout_list() and sends
--     the $13 BY HAND. No code moves money.
--
-- House style (matches 15_citymap / 17_truth_spine / 18_streetteam / 19_ticket_security):
--   • create-or-replace, idempotent, safe to re-run.
--   • RLS ON on every table; NO direct table grants — all access via SECURITY DEFINER RPCs.
--   • set search_path = public; on-conflict do-nothing; drop function if exists before create.
--   • grant execute to anon, authenticated, service_role — EXCEPT sf_st_payout_list, which
--     returns claimants' payout handles → granted to service_role ONLY (admin read).
--   • NO PII beyond the payout handle the user THEMSELVES enters. member/device are opaque
--     ids; the new device id is stored HASHED (md5) as device_hash.
--
-- HONEST CAVEATS:
--   • "Referred join" = a new device that OPENED the share link and hit sf_st_refer on
--     landing. It is device-deduped, not identity-verified — a determined user with many
--     devices/browsers could inflate it. It is honest about what it measures (distinct
--     landing devices), not a fraud-proof KYC count.
--   • sf_st_payout_claim records a PENDING claim only. Nothing here pays anyone. Status
--     moves to 'paid' ONLY when Michael marks it so (manual UPDATE / admin tool).
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()


-- 1) dd_st_referral — one row per (festival, member, NEW device). The honest count. -----
create table if not exists public.dd_st_referral (
  festival_slug text not null,
  member_id     text not null,                       -- the SHARER credited (opaque dd.st.me id)
  device_hash   text not null,                       -- md5 of the NEW device's local id (never reversible; no PII)
  at            timestamptz not null default now(),
  primary key (festival_slug, member_id, device_hash)  -- UNIQUE: one credit per (member, new device)
);
alter table public.dd_st_referral enable row level security;   -- no direct access; only the RPCs below
create index if not exists dd_st_referral_fest_member on public.dd_st_referral(festival_slug, member_id);


-- 2) dd_st_payout — the CLAIM ledger. Michael marks 'paid'. Never auto-paid. -----------
create table if not exists public.dd_st_payout (
  id               uuid primary key default gen_random_uuid(),
  festival_slug    text not null,
  member_id        text not null,
  program          text not null default 'lehigh-mug',
  phones_at_claim  integer not null,
  handle           text,                             -- the Venmo/PayPal handle the USER entered (their only PII)
  method           text,                             -- 'venmo' | 'paypal'
  amount_cents     integer not null default 1300,    -- $13.00
  status           text not null default 'pending',  -- pending | paid | void
  claimed_at       timestamptz not null default now(),
  paid_at          timestamptz,
  unique (festival_slug, member_id, program)         -- one claim per member per program (idempotent)
);
alter table public.dd_st_payout enable row level security;
create index if not exists dd_st_payout_status on public.dd_st_payout(status, claimed_at);


-- 3) sf_st_refer — credit a referral (insert-on-conflict-do-nothing). Returns {ok, count}.
--    Guards: festival+member+device required; a member CANNOT count themselves (device==member).
drop function if exists public.sf_st_refer(text, text, text);
create or replace function public.sf_st_refer(p_festival text, p_member text, p_device text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_fest text; v_mem text; v_devraw text; v_dev text; v_count integer;
begin
  v_fest   := lower(btrim(coalesce(p_festival, '')));
  v_mem    := btrim(coalesce(p_member, ''));
  v_devraw := lower(btrim(coalesce(p_device, '')));
  if v_fest = '' or v_mem = '' or v_devraw = '' then
    return jsonb_build_object('ok', false, 'err', 'festival, member, device required');
  end if;
  if v_devraw = lower(v_mem) then
    -- a member can never count themselves
    select count(distinct device_hash) into v_count from public.dd_st_referral
      where festival_slug = v_fest and member_id = v_mem;
    return jsonb_build_object('ok', false, 'err', 'self', 'count', coalesce(v_count, 0));
  end if;

  v_dev := md5(v_devraw);   -- store the NEW device id HASHED (no reversible id)

  insert into public.dd_st_referral(festival_slug, member_id, device_hash)
    values (v_fest, v_mem, v_dev)
    on conflict (festival_slug, member_id, device_hash) do nothing;

  select count(distinct device_hash) into v_count from public.dd_st_referral
    where festival_slug = v_fest and member_id = v_mem;

  return jsonb_build_object('ok', true, 'count', coalesce(v_count, 0));
end $$;


-- 4) sf_st_phone_count — distinct referred devices for a member. --------------------------
drop function if exists public.sf_st_phone_count(text, text);
create or replace function public.sf_st_phone_count(p_festival text, p_member text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_fest text; v_mem text; v_count integer;
begin
  v_fest := lower(btrim(coalesce(p_festival, '')));
  v_mem  := btrim(coalesce(p_member, ''));
  if v_fest = '' or v_mem = '' then
    return jsonb_build_object('ok', false, 'err', 'festival and member required', 'count', 0);
  end if;
  select count(distinct device_hash) into v_count from public.dd_st_referral
    where festival_slug = v_fest and member_id = v_mem;
  return jsonb_build_object('ok', true, 'count', coalesce(v_count, 0));
end $$;


-- 5) sf_st_payout_claim — at >= threshold, record a PENDING claim (idempotent). NEVER pays.
--    threshold 100 phones → amount 1300 cents. Below threshold → {ok:false, eligible:false}.
drop function if exists public.sf_st_payout_claim(text, text, text, text, text);
create or replace function public.sf_st_payout_claim(
  p_festival text, p_member text, p_program text, p_handle text, p_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_fest text; v_mem text; v_prog text; v_handle text; v_method text;
  v_count integer; v_threshold integer := 100; v_amount integer := 1300;
  v_row public.dd_st_payout%rowtype;
begin
  v_fest   := lower(btrim(coalesce(p_festival, '')));
  v_mem    := btrim(coalesce(p_member, ''));
  v_prog   := lower(btrim(coalesce(nullif(btrim(coalesce(p_program,'')),''), 'lehigh-mug')));
  v_handle := btrim(coalesce(p_handle, ''));
  v_method := lower(btrim(coalesce(p_method, '')));
  if v_fest = '' or v_mem = '' then
    return jsonb_build_object('ok', false, 'err', 'festival and member required');
  end if;

  select count(distinct device_hash) into v_count from public.dd_st_referral
    where festival_slug = v_fest and member_id = v_mem;
  v_count := coalesce(v_count, 0);

  if v_count < v_threshold then
    -- NOT eligible yet — never records a claim, never pays.
    return jsonb_build_object('ok', false, 'eligible', false, 'count', v_count, 'needed', v_threshold);
  end if;

  if v_handle = '' then
    return jsonb_build_object('ok', false, 'eligible', true, 'count', v_count,
                              'err', 'payout handle required to submit a claim');
  end if;

  -- idempotent per (festival, member, program): one claim only. Fill the handle on first submit.
  insert into public.dd_st_payout(festival_slug, member_id, program, phones_at_claim, handle, method, amount_cents, status)
    values (v_fest, v_mem, v_prog, v_count, v_handle, v_method, v_amount, 'pending')
    on conflict (festival_slug, member_id, program) do update
      set handle = coalesce(nullif(excluded.handle,''), public.dd_st_payout.handle),
          method = coalesce(nullif(excluded.method,''), public.dd_st_payout.method),
          phones_at_claim = greatest(public.dd_st_payout.phones_at_claim, excluded.phones_at_claim)
    returning * into v_row;

  return jsonb_build_object(
    'ok', true, 'eligible', true, 'claim_id', v_row.id, 'status', v_row.status,
    'count', v_count, 'amount_cents', v_row.amount_cents,
    'handle', v_row.handle, 'method', v_row.method,
    'note', 'Claim recorded as PENDING. Michael sends the $13 by hand — this is not an instant/auto payment.'
  );
end $$;


-- 6) sf_st_payout_list — PENDING claims for Michael to pay. Returns handles → admin-only.
drop function if exists public.sf_st_payout_list();
create or replace function public.sf_st_payout_list()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'claim_id', id, 'festival', festival_slug, 'member', member_id, 'program', program,
           'phones_at_claim', phones_at_claim, 'handle', handle, 'method', method,
           'amount_cents', amount_cents, 'status', status, 'claimed_at', claimed_at
         ) order by claimed_at asc), '[]'::jsonb)
    into v_out
  from public.dd_st_payout
  where status = 'pending';
  return coalesce(v_out, '[]'::jsonb);
end $$;


-- GRANTS ---------------------------------------------------------------------------------
grant execute on function public.sf_st_refer(text, text, text)                        to anon, authenticated, service_role;
grant execute on function public.sf_st_phone_count(text, text)                        to anon, authenticated, service_role;
grant execute on function public.sf_st_payout_claim(text, text, text, text, text)     to anon, authenticated, service_role;
-- sf_st_payout_list returns claimants' payout handles → ADMIN ONLY (never anon/authenticated):
grant execute on function public.sf_st_payout_list()                                  to service_role;


-- ============================================================================
-- SMOKE TEST (commented — paste into the SQL editor after running the file above)
-- ============================================================================
-- -- a new device credits sharer st-abc:
-- select public.sf_st_refer('musikfest-2026','st-abc','device-0001');   -- {ok:true, count:1}
-- select public.sf_st_refer('musikfest-2026','st-abc','device-0001');   -- {ok:true, count:1}  (idempotent — same device)
-- select public.sf_st_refer('musikfest-2026','st-abc','st-abc');        -- {ok:false, err:'self'} (can't count yourself)
-- select public.sf_st_phone_count('musikfest-2026','st-abc');           -- {ok:true, count:1}
-- select public.sf_st_payout_claim('musikfest-2026','st-abc','lehigh-mug','@mikes-venmo','venmo');  -- {ok:false, eligible:false, count:1, needed:100}
-- -- (after 100 distinct devices) → {ok:true, eligible:true, status:'pending', amount_cents:1300, ...}
-- select public.sf_st_payout_list();   -- [ pending claims ]  (service_role only)
-- ============================================================================
