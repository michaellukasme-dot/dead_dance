-- sf_fill.sql — co-promotion: attribution + low-sales detection so BAND and VENUE jointly fill an event.
-- Run ONCE, AFTER sf_venue.sql. Re-runnable. StageFill stays the single ticket authority (no oversell);
-- this only records WHO brought each buyer and whether the show is pacing behind.

-- who drove the sale: 'band' (fan link), 'venue' (patron link), 'door', or 'direct'
alter table public.sf_order add column if not exists ref_src text default 'direct';

-- fill status for an event: capacity, sold, days out, a "behind pace" flag, and the band/venue/direct split.
create or replace function public.sf_fill_status(p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_start date; v_cap int; v_sold int; v_days int; v_behind boolean := false;
begin
  select id, date_start into v_id, v_start from public.sf_event where slug = p_slug and status = 'live';
  if v_id is null then return jsonb_build_object('error','not_found'); end if;
  select nullif(sum(qty_total),0), coalesce(sum(qty_sold),0)::int
    into v_cap, v_sold
    from public.sf_ticket_type where event_id = v_id and active;      -- sum(qty_total) is NULL if every tier is unlimited
  v_days := case when v_start is null then null else (v_start - current_date) end;
  -- behind = inside 21 days AND under 60% of a straight-line 45-day sell pace
  if v_cap is not null and v_cap > 0 and v_days is not null and v_days between 0 and 21 then
    v_behind := (v_sold::numeric / v_cap) < greatest(0, 1 - v_days/45.0) * 0.6;
  end if;
  return jsonb_build_object(
    'slug', p_slug, 'capacity', v_cap, 'sold', v_sold, 'days_left', v_days, 'behind', v_behind,
    'by_ref', coalesce((select jsonb_object_agg(rs, q) from (
        select coalesce(ref_src,'direct') rs, sum(qty)::int q
          from public.sf_order where event_id = v_id and status = 'paid'
         group by coalesce(ref_src,'direct')) x), '{}'::jsonb)
  );
end $$;
grant execute on function public.sf_fill_status(text) to anon, authenticated;
