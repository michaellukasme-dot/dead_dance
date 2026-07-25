-- sf_hardening2.sql — Claudine pass-2 fixes. Run ONCE (AFTER sf_spine, dd_band_plan, sf_hardening, sf_stage2).

-- ── BLOCKER A: kill direct-table tamper. All writes go through the security-definer RPCs (which bypass this).
--    Removes the "owner UPDATEs subscribed=true" free-unlock and direct qty_sold edits. SELECT stays (RLS-gated). ──
revoke insert, update, delete on public.sf_event        from authenticated;
revoke insert, update, delete on public.sf_act          from authenticated;
revoke insert, update, delete on public.sf_ticket_type  from authenticated;
revoke insert, update, delete on public.sf_partner      from authenticated;
revoke insert, update, delete on public.sf_geofence     from authenticated;

-- ── HIGH C: telemetry integrity. device is SERVER-derived from auth.uid() (client value ignored); a session is
--    required; client dwell_s is discarded (dwell is computed from ping timestamps in the rollup). ──
create or replace function public.sf_ping_batch(p_event uuid, p_pings jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_p jsonb; v_gf uuid;
        v_me text := nullif(auth.uid()::text,'');
        v_dev text;
begin
  if v_me is null then return 0; end if;                              -- must have a (even anonymous) session
  if jsonb_typeof(p_pings) <> 'array' then return 0; end if;
  if not exists (select 1 from public.sf_event e where e.id = p_event and e.status = 'live') then return 0; end if;
  v_dev := md5('sfdev|' || v_me || '|' || current_date::text);       -- one stable device per session per day; NOT client-set
  for v_p in select el from jsonb_array_elements(p_pings) el limit 300 loop
    v_gf := nullif(v_p->>'geofence_id','')::uuid;
    if v_gf is null or not exists (select 1 from public.sf_geofence g where g.id = v_gf and g.event_id = p_event) then
      continue;
    end if;
    insert into public.sf_ping(event_id, device, geofence_id, lat, lng, dwell_s)
    values (p_event, v_dev, v_gf, nullif(v_p->>'lat','')::float8, nullif(v_p->>'lng','')::float8, 0);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- shared aggregation: dwell computed from timestamp spread per device·geofence·hour (client can't inflate "uses").
create or replace function public.sf_rollup(p_event uuid, p_day date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from public.sf_occupancy where event_id = p_event and day = p_day;
  insert into public.sf_occupancy(event_id, geofence_id, day, hour, devices, uses)
  select p_event, q.geofence_id, p_day, q.hour, count(*)::int, count(*) filter (where q.span >= 120)::int
  from (
    select geofence_id, extract(hour from ts)::int as hour, device,
           extract(epoch from (max(ts) - min(ts))) as span
      from public.sf_ping
     where event_id = p_event and ts::date = p_day and geofence_id is not null
     group by geofence_id, extract(hour from ts)::int, device
  ) q
  group by q.geofence_id, q.hour;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- cron only (service role). Anon/authenticated may no longer force-rollup arbitrary events.
revoke execute on function public.sf_rollup(uuid, date) from public, anon, authenticated;
grant  execute on function public.sf_rollup(uuid, date) to service_role;

-- owner-only on-demand rollup for the "live occupancy" view (resolves slug, checks ownership).
create or replace function public.sf_rollup_mine(p_slug text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_me text := nullif(auth.uid()::text,'');
begin
  if v_me is null then return 0; end if;
  select id into v_id from public.sf_event where slug = p_slug and owner = v_me;
  if v_id is null then return 0; end if;
  return public.sf_rollup(v_id, current_date);
end $$;
grant execute on function public.sf_rollup_mine(text) to anon, authenticated;

-- ── MEDIUM D+E: atomic, idempotent ticket fulfillment (webhook uses this). Seen-marker + paid-flip + capped
--    qty bump in ONE transaction, so a mid-way failure rolls back and Stripe's retry reprocesses cleanly. ──
create or replace function public.sf_ticket_fulfill(p_event_id text, p_order uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_tt uuid; v_qty int;
begin
  insert into public.sf_webhook_event(id) values (p_event_id) on conflict (id) do nothing;
  if not found then return false; end if;                      -- already processed (idempotent)
  update public.sf_order set status = 'paid'
    where id = p_order and status = 'pending'
    returning ticket_type_id, qty into v_tt, v_qty;
  if v_tt is not null then
    update public.sf_ticket_type set qty_sold = qty_sold + coalesce(v_qty,1) where id = v_tt;
  end if;
  return true;
end $$;
revoke execute on function public.sf_ticket_fulfill(text, uuid) from public, anon, authenticated;
grant  execute on function public.sf_ticket_fulfill(text, uuid) to service_role;
