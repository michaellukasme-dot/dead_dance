-- sf_reserve.sql — ticket STOCK RESERVATION (kills the oversell race). Run ONCE, AFTER sf_hardening2.sql.
-- Safe to re-run (idempotent: add-column-if-not-exists, create-index-if-not-exists, create-or-replace fn).
--
-- The race we're closing: qty_sold only moves AFTER payment, so N buyers could all pass the
-- "is there stock?" check while sitting on the Stripe page, then all pay → oversell. Now a buyer
-- RESERVES stock the instant checkout opens; the reservation counts against capacity for a fixed
-- window, and the Stripe session is set to expire on the SAME clock (so a stale session can't be
-- paid after the hold lapses). Concurrent buyers are serialized by a row lock on the ticket type.

-- 1) reservation window marker on the order
alter table public.sf_order add column if not exists reserved_until timestamptz;

-- 2) fast availability sum (pending, still-held rows per ticket type)
create index if not exists sf_order_hold_idx
  on public.sf_order (ticket_type_id, status, reserved_until);

-- 3) atomic reserve-and-order. Returns the order + server-computed price so the edge function
--    stays thin and un-raceable. The FOR UPDATE row lock serializes buyers competing for the last seat.
create or replace function public.sf_reserve(p_tt uuid, p_qty int, p_buyer text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tt public.sf_ticket_type; v_taken int; v_amount int; v_fee int; v_order uuid; v_qty int;
begin
  v_qty := greatest(1, least(20, coalesce(p_qty, 1)));

  -- lock the ticket type: any other reservation for this type waits here, so it will SEE our hold.
  select * into v_tt from public.sf_ticket_type where id = p_tt for update;
  if not found or not v_tt.active then return jsonb_build_object('error','ticket_unavailable'); end if;
  if v_tt.price_cents <= 0 then return jsonb_build_object('error','free_ticket_no_checkout'); end if;

  -- housekeeping: release this type's expired holds so they stop occupying capacity (and reporting).
  update public.sf_order set status = 'expired'
    where ticket_type_id = p_tt and status = 'pending'
      and reserved_until is not null and reserved_until < now();

  -- capacity check = already sold + still-active holds. NULL qty_total = unlimited.
  if v_tt.qty_total is not null then
    select coalesce(sum(qty), 0) into v_taken from public.sf_order
      where ticket_type_id = p_tt and status = 'pending'
        and reserved_until is not null and reserved_until > now();
    v_taken := v_taken + v_tt.qty_sold;
    if v_taken + v_qty > v_tt.qty_total then
      return jsonb_build_object('error','sold_out','available', greatest(0, v_tt.qty_total - v_taken));
    end if;
  end if;

  v_amount := v_tt.price_cents * v_qty;
  v_fee    := round(v_amount * 1500.0 / 10000.0);   -- 15% StageFill / ArtsQuest platform fee

  insert into public.sf_order(event_id, ticket_type_id, buyer, qty, amount_cents, fee_cents, status, reserved_until)
    values (v_tt.event_id, p_tt, p_buyer, v_qty, v_amount, v_fee, 'pending', now() + interval '30 minutes')
    returning id into v_order;

  return jsonb_build_object(
    'order_id', v_order, 'event_id', v_tt.event_id, 'qty', v_qty,
    'amount_cents', v_amount, 'fee_cents', v_fee,
    'price_cents', v_tt.price_cents, 'currency', v_tt.currency, 'name', v_tt.name,
    'reserved_secs', 1800);
end $$;
revoke execute on function public.sf_reserve(uuid, int, text) from public, anon, authenticated;
grant  execute on function public.sf_reserve(uuid, int, text) to service_role;   -- edge function (service role) only

-- 4) defense-in-depth: fulfillment must not honor a hold that already lapsed (aligned Stripe expiry
--    should prevent this, but if a session is somehow paid late we refuse to oversell rather than
--    silently blow past capacity). Re-checks the window; a lapsed order is left for refund handling.
create or replace function public.sf_ticket_fulfill(p_event_id text, p_order uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_tt uuid; v_qty int;
begin
  insert into public.sf_webhook_event(id) values (p_event_id) on conflict (id) do nothing;
  if not found then return false; end if;                       -- already processed (idempotent)
  update public.sf_order set status = 'paid'
    where id = p_order and status = 'pending'
      and (reserved_until is null or reserved_until > now() - interval '10 minutes')  -- grace for webhook lag
    returning ticket_type_id, qty into v_tt, v_qty;
  if v_tt is not null then
    update public.sf_ticket_type set qty_sold = qty_sold + coalesce(v_qty, 1) where id = v_tt;
  end if;
  return true;
end $$;
revoke execute on function public.sf_ticket_fulfill(text, uuid) from public, anon, authenticated;
grant  execute on function public.sf_ticket_fulfill(text, uuid) to service_role;
