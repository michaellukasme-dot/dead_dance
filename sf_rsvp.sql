-- sf_rsvp.sql — real FREE-ticket RSVP (replaces the client stub). Run ONCE, AFTER sf_venue.sql. Re-runnable.
-- A free ticket type gets a genuine, capacity-safe reservation + a scannable check-in token, so free
-- entries admit at the door exactly like paid ones (sf_checkin already honors status='paid'). No money.

create or replace function public.sf_rsvp(p_tt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_tt public.sf_ticket_type;
        v_taken int; v_order uuid; v_token text; v_ex_id uuid; v_ex_tok text;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  select * into v_tt from public.sf_ticket_type where id = p_tt for update;   -- lock: serialize concurrent RSVPs
  if not found or not v_tt.active then return jsonb_build_object('error','ticket_unavailable'); end if;
  if v_tt.price_cents > 0 then return jsonb_build_object('error','not_free'); end if;   -- paid types must go through checkout
  -- one RSVP per device per ticket type — return the existing pass instead of double-booking
  select id, checkin_token into v_ex_id, v_ex_tok from public.sf_order
    where ticket_type_id = p_tt and buyer = v_me and status = 'paid' and tender = 'free' limit 1;
  if v_ex_id is not null then return jsonb_build_object('ok', true, 'token', v_ex_tok, 'already', true); end if;
  if v_tt.qty_total is not null then
    v_taken := v_tt.qty_sold + coalesce((select sum(qty) from public.sf_order
      where ticket_type_id = p_tt and status = 'pending' and reserved_until is not null and reserved_until > now()), 0);
    if v_taken + 1 > v_tt.qty_total then return jsonb_build_object('error','full'); end if;
  end if;
  insert into public.sf_order(event_id, ticket_type_id, buyer, qty, amount_cents, fee_cents, status, tender)
    values (v_tt.event_id, p_tt, v_me, 1, 0, 0, 'paid', 'free')
    returning id, checkin_token into v_order, v_token;
  update public.sf_ticket_type set qty_sold = qty_sold + 1 where id = p_tt;
  return jsonb_build_object('ok', true, 'token', v_token);
end $$;
grant execute on function public.sf_rsvp(uuid) to anon, authenticated;

-- release a free RSVP (returns the spot to the pool) — only if not yet checked in
create or replace function public.sf_rsvp_release(p_tt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,'');
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  update public.sf_order set status = 'released'
    where ticket_type_id = p_tt and buyer = v_me and status = 'paid' and tender = 'free' and checked_in_at is null;
  if found then update public.sf_ticket_type set qty_sold = greatest(0, qty_sold - 1) where id = p_tt; end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.sf_rsvp_release(uuid) to anon, authenticated;
