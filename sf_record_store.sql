-- sf_record_store.sql — USED-record order rail for the brand-neutral storefront (records.html).
-- Pattern mirrors sf_band_merch.sql. SAFE TO RUN: it only CAPTURES reservations (server-authoritative,
-- deny-by-default RLS). NOTHING CHARGES — Stripe checkout wires in after the StageFill payment account is live.
-- Supply model = USED copies (first-sale); no rights clearance needed. NEW pressings stay gated elsewhere.
-- Run ONCE. Re-runnable.

create table if not exists public.sf_record_order (
  id          uuid primary key default gen_random_uuid(),
  store       text,                         -- white-label store id (?store=)
  sku         text,                         -- title|artist|format
  title       text,
  artist      text,
  format      text,                         -- Vinyl | CD
  cond        text,                         -- NM | VG+ | VG | G+
  list_cents  int,                          -- quoted price (store confirms on fulfillment)
  quote_cents int,                          -- server-clamped price of record (authoritative)
  contact     text,
  status      text not null default 'reserved', -- reserved | confirmed | invoiced | paid | shipped | void
  created_at  timestamptz not null default now()
);
alter table public.sf_record_order enable row level security;   -- reads via admin RPC only (deny-by-default)

-- Create a reservation. Server clamps price to a sane band so a tampered client cannot set $0 or $9,999.
-- Final price is confirmed by the store at fulfillment; this only holds the copy + captures intent.
create or replace function public.sf_record_order_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_list int; v_quote int; v_id uuid;
begin
  if coalesce(trim(p->>'title'),'') = '' then return jsonb_build_object('error','need_title'); end if;
  v_list  := coalesce(nullif(p->>'list_cents','')::int, 0);
  v_quote := greatest(300, least(50000, v_list));   -- $3.00 .. $500.00 guardrail
  insert into public.sf_record_order(store, sku, title, artist, format, cond, list_cents, quote_cents, contact)
    values (nullif(p->>'store',''), nullif(p->>'sku',''), nullif(p->>'title',''), nullif(p->>'artist',''),
            nullif(p->>'format',''), nullif(p->>'cond',''), v_list, v_quote, nullif(p->>'contact',''))
    returning id into v_id;
  return jsonb_build_object('ok', true, 'order', v_id, 'quote_cents', v_quote, 'status', 'reserved');
end $$;
grant execute on function public.sf_record_order_create(jsonb) to anon, authenticated;

-- Admin read queue (fail-closed: non-admins get nothing).
create or replace function public.sf_record_order_queue()
returns setof public.sf_record_order language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sf_admin a where a.uid = nullif(auth.uid()::text,'')) then return; end if;
  return query select * from public.sf_record_order order by created_at desc;
end $$;
grant execute on function public.sf_record_order_queue() to anon, authenticated;

-- ── GATED / DARK (do NOT run until fan-consent charter + counsel sign-off): data-flywheel taste capture.
-- create table if not exists public.sf_taste_signal ( ... consent_id, artist, format, created_at );
-- create or replace function public.sf_taste_signal(p jsonb) ...  -- opt-in only, aggregated reads only.
