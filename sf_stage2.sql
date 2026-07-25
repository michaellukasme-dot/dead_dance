-- sf_stage2.sql — occupancy telemetry + CRM seed. Run ONCE (AFTER sf_spine.sql, dd_band_plan.sql, sf_hardening.sql).
-- create-or-replace preserves grants.

-- ── sf_get: also return the event id (for the ping loop + owner occupancy) and the public geofences. ──
create or replace function public.sf_get(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'slug', e.slug, 'name', e.name, 'city', e.city, 'state', e.state, 'venue', e.venue, 'cat', e.cat,
      'date_start', e.date_start, 'date_end', e.date_end, 'start_time', e.start_time,
      'lat', e.lat, 'lng', e.lng, 'corners', e.corners, 'floor_url', e.floor_url,
      'locked',   not (e.subscribed or (e.date_start is not null and current_date < e.date_start - e.grace_days)),
      'is_owner', (e.owner = auth.uid()::text)),
    'acts',         coalesce((select jsonb_agg(jsonb_build_object('name',a.name,'stage',a.stage,'time',a."time",'cat',a.cat,'lat',a.lat,'lng',a.lng) order by a."time") from public.sf_act a where a.event_id = e.id), '[]'::jsonb),
    'ticket_types', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'price_cents',t.price_cents,'currency',t.currency)) from public.sf_ticket_type t where t.event_id = e.id and t.active), '[]'::jsonb),
    'geofences',    coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'kind',g.kind,'label',g.label,'lat',g.lat,'lng',g.lng,'radius_m',g.radius_m)) from public.sf_geofence g where g.event_id = e.id), '[]'::jsonb)
  )
  from public.sf_event e
  where e.slug = p_slug and e.status = 'live'
    and ( e.subscribed
          or (e.date_start is not null and current_date < e.date_start - e.grace_days)
          or e.owner = auth.uid()::text )
  limit 1;
$$;

-- ── sf_rollup: owner may roll their own event on demand (live view). Service-role cron (null uid) still allowed;
--    any OTHER authenticated user is denied. ──
create or replace function public.sf_rollup(p_event uuid, p_day date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int; v_me text := nullif(auth.uid()::text,'');
begin
  if v_me is not null and not exists (select 1 from public.sf_event e where e.id = p_event and e.owner = v_me) then
    return 0;
  end if;
  delete from public.sf_occupancy where event_id = p_event and day = p_day;
  insert into public.sf_occupancy(event_id, geofence_id, day, hour, devices, uses)
  select p_event, geofence_id, p_day, extract(hour from ts)::int,
         count(distinct device)::int,
         count(distinct device) filter (where dwell_s >= 120)::int
    from public.sf_ping
   where event_id = p_event and ts::date = p_day and geofence_id is not null
   group by geofence_id, extract(hour from ts)::int;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── Seed the CRM with real festivals (cat = 'festival'). Contacts left blank to fill in. ──
create unique index if not exists sf_prospect_name_uidx on public.sf_prospect(name);   -- makes the seed idempotent
insert into public.sf_prospect (name, city, state, attendance, cat, status) values
  ('Musikfest','Bethlehem','PA',1449000,'festival','new'),
  ('Coachella','Indio','CA',750000,'festival','new'),
  ('Summerfest','Milwaukee','WI',600000,'festival','new'),
  ('EDC Las Vegas','Las Vegas','NV',525000,'festival','new'),
  ('Essence Festival','New Orleans','LA',500000,'festival','new'),
  ('New Orleans Jazz & Heritage','New Orleans','LA',460000,'festival','new'),
  ('Lollapalooza','Chicago','IL',460000,'festival','new'),
  ('Austin City Limits','Austin','TX',450000,'festival','new'),
  ('Stagecoach','Indio','CA',240000,'festival','new'),
  ('Outside Lands','San Francisco','CA',225000,'festival','new'),
  ('Ultra Music Festival','Miami','FL',165000,'festival','new'),
  ('Bonnaroo','Manchester','TN',80000,'festival','new'),
  ('French Quarter Fest','New Orleans','LA',460000,'festival','new'),
  ('Electric Forest','Rothbury','MI',45000,'festival','new'),
  ('Governors Ball','New York','NY',150000,'festival','new'),
  ('Life is Beautiful','Las Vegas','NV',180000,'festival','new'),
  ('Firefly','Dover','DE',90000,'festival','new'),
  ('BottleRock','Napa','CA',120000,'festival','new'),
  ('Riot Fest','Chicago','IL',120000,'festival','new'),
  ('Pitchfork Music Festival','Chicago','IL',60000,'festival','new'),
  ('Hangout Fest','Gulf Shores','AL',120000,'festival','new'),
  ('Shaky Knees','Atlanta','GA',90000,'festival','new'),
  ('Sasquatch / Gorge','George','WA',75000,'festival','new'),
  ('CMA Fest','Nashville','TN',90000,'festival','new')
on conflict (name) do nothing;
