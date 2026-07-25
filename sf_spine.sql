-- sf_spine.sql — StageFill production backend (events · ticketing · live occupancy).
-- Run ONCE in the Supabase SQL editor (same project as the DeadDance app).
-- After running: enable Realtime for public.sf_event and public.sf_order (Database → Replication).
-- Identity is auth.uid()::text (anonymous or signed-in), matching the rest of the app.
-- Public reads/writes go through the security-definer RPCs at the bottom; RLS denies direct access by default.

-- ============================================================ TABLES

create table if not exists public.sf_event (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  owner       text not null,                         -- auth.uid()::text of the creator
  name        text not null,
  city        text, state text, venue text,
  cat         text default 'live_music',
  date_start  date, date_end date,
  start_time  text,
  lat         float8, lng float8,
  corners     jsonb,                                 -- {tl,tr,bl,br} outdoor footprint
  floor_url   text,                                  -- indoor floor-plan image (optional)
  stripe_account text,                               -- owner's connected Stripe acct (for payouts)
  status      text not null default 'live',          -- draft | live
  grace_days  int  not null default 14,              -- FREE to build/test; subscription due this many days before date_start
  subscribed  boolean not null default false,        -- flips true when the festival subscribes (billing webhook)
  sub_until   date,                                  -- paid-through date
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists sf_event_live_idx on public.sf_event(status, date_start);
create index if not exists sf_event_owner_idx on public.sf_event(owner);

create table if not exists public.sf_act (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.sf_event(id) on delete cascade,
  name      text not null, stage text, "time" text, cat text,
  lat float8, lng float8, xpct float8, ypct float8
);
create index if not exists sf_act_event_idx on public.sf_act(event_id);

create table if not exists public.sf_ticket_type (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.sf_event(id) on delete cascade,
  name        text not null default 'General',
  price_cents int not null default 0,
  currency    text not null default 'usd',
  qty_total   int,
  qty_sold    int not null default 0,
  active      boolean not null default true
);
create index if not exists sf_ticket_type_event_idx on public.sf_ticket_type(event_id);

create table if not exists public.sf_order (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.sf_event(id) on delete cascade,
  ticket_type_id uuid references public.sf_ticket_type(id) on delete set null,
  buyer          text,
  qty            int not null default 1,
  amount_cents   int not null default 0,
  fee_cents      int not null default 0,             -- 15% ArtsQuest / StageFill platform fee
  stripe_session text,
  status         text not null default 'pending',    -- pending | paid | refunded
  created_at     timestamptz not null default now()
);
create index if not exists sf_order_event_idx on public.sf_order(event_id, created_at);
create index if not exists sf_order_session_idx on public.sf_order(stripe_session);

create table if not exists public.sf_partner (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.sf_event(id) on delete cascade,
  name       text not null, type text, plan text default 'none',
  days       int default 1,
  lat float8, lng float8, points jsonb,
  spend_cents int default 0,
  status     text default 'registered',              -- registered | located
  created_at timestamptz not null default now()
);
create index if not exists sf_partner_event_idx on public.sf_partner(event_id);

create table if not exists public.sf_geofence (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.sf_event(id) on delete cascade,
  kind      text not null default 'stage',           -- platz | stage | potty | first_aid | shop | partner
  label     text,
  lat float8, lng float8, radius_m int default 25
);
create index if not exists sf_geofence_event_idx on public.sf_geofence(event_id);

create table if not exists public.sf_ping (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references public.sf_event(id) on delete cascade,
  device      text,                                  -- rotating on-device hash — NEVER an identity
  geofence_id uuid references public.sf_geofence(id) on delete set null,
  lat float8, lng float8, dwell_s int default 0,
  ts          timestamptz not null default now()
);
create index if not exists sf_ping_roll_idx on public.sf_ping(event_id, ts);

create table if not exists public.sf_occupancy (
  event_id    uuid not null references public.sf_event(id) on delete cascade,
  geofence_id uuid not null references public.sf_geofence(id) on delete cascade,
  day         date not null,
  hour        int  not null,
  devices     int  not null default 0,
  uses        int  not null default 0,
  primary key (event_id, geofence_id, day, hour)
);

-- ============================================================ RLS (deny-by-default; reads/writes via RPCs below)

alter table public.sf_event       enable row level security;
alter table public.sf_act         enable row level security;
alter table public.sf_ticket_type enable row level security;
alter table public.sf_order       enable row level security;
alter table public.sf_partner     enable row level security;
alter table public.sf_geofence    enable row level security;
alter table public.sf_ping        enable row level security;
alter table public.sf_occupancy   enable row level security;

drop policy if exists sf_event_owner on public.sf_event;
create policy sf_event_owner on public.sf_event
  using (owner = auth.uid()::text) with check (owner = auth.uid()::text);

-- child tables: manageable only by the event's owner (public reads happen via the definer RPCs)
drop policy if exists sf_act_owner on public.sf_act;
create policy sf_act_owner on public.sf_act
  using (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text))
  with check (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text));

drop policy if exists sf_ticket_type_owner on public.sf_ticket_type;
create policy sf_ticket_type_owner on public.sf_ticket_type
  using (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text))
  with check (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text));

drop policy if exists sf_partner_owner on public.sf_partner;
create policy sf_partner_owner on public.sf_partner
  using (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text))
  with check (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text));

drop policy if exists sf_geofence_owner on public.sf_geofence;
create policy sf_geofence_owner on public.sf_geofence
  using (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text))
  with check (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text));

drop policy if exists sf_order_read on public.sf_order;
create policy sf_order_read on public.sf_order for select
  using (buyer = auth.uid()::text
         or exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text));

drop policy if exists sf_occupancy_owner on public.sf_occupancy;
create policy sf_occupancy_owner on public.sf_occupancy for select
  using (exists (select 1 from public.sf_event e where e.id = event_id and e.owner = auth.uid()::text));

-- sf_ping: no policies → no direct access; inserts happen through sf_ping_batch (security definer).

-- ============================================================ RPCs

-- Publish (create/update) the caller's event + its acts, ticket types, and geofences. Returns the slug.
create or replace function public.sf_publish(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me   text := coalesce(nullif(auth.uid()::text,''), nullif(p->>'owner',''));
  v_slug text := nullif(p->>'slug','');
  v_id   uuid;
  v_row  jsonb;
begin
  if v_me is null then raise exception 'no identity'; end if;
  if v_slug is null then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(p->>'name','event')), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then v_slug := 'event'; end if;
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);
  end if;

  insert into public.sf_event(slug, owner, name, city, state, venue, cat, date_start, date_end, start_time,
                              lat, lng, corners, floor_url, status)
  values (v_slug, v_me, coalesce(p->>'name','Untitled event'), p->>'city', p->>'state', p->>'venue',
          coalesce(p->>'cat','live_music'), nullif(p->>'start','')::date, nullif(p->>'end','')::date, p->>'time',
          nullif(p->>'lat','')::float8, nullif(p->>'lng','')::float8, p->'corners', p->>'floor_url',
          coalesce(p->>'status','live'))
  on conflict (slug) do update set
     name=excluded.name, city=excluded.city, state=excluded.state, venue=excluded.venue, cat=excluded.cat,
     date_start=excluded.date_start, date_end=excluded.date_end, start_time=excluded.start_time,
     lat=excluded.lat, lng=excluded.lng, corners=excluded.corners, floor_url=excluded.floor_url,
     status=excluded.status, updated_at=now()
   where public.sf_event.owner = v_me
  returning id into v_id;

  if v_id is null then raise exception 'slug already taken'; end if;

  delete from public.sf_act where event_id = v_id;
  for v_row in select el from jsonb_array_elements(coalesce(p->'acts','[]'::jsonb)) el loop
    insert into public.sf_act(event_id, name, stage, "time", cat, lat, lng, xpct, ypct)
    values (v_id, v_row->>'name', v_row->>'stage', v_row->>'time', v_row->>'cat',
            nullif(v_row->>'lat','')::float8, nullif(v_row->>'lng','')::float8,
            nullif(v_row->>'xpct','')::float8, nullif(v_row->>'ypct','')::float8);
  end loop;

  delete from public.sf_ticket_type where event_id = v_id;
  for v_row in select el from jsonb_array_elements(coalesce(p->'ticket_types','[]'::jsonb)) el loop
    insert into public.sf_ticket_type(event_id, name, price_cents, currency, qty_total)
    values (v_id, coalesce(v_row->>'name','General'), coalesce(nullif(v_row->>'price_cents','')::int,0),
            coalesce(v_row->>'currency','usd'), nullif(v_row->>'qty_total','')::int);
  end loop;

  delete from public.sf_geofence where event_id = v_id;
  for v_row in select el from jsonb_array_elements(coalesce(p->'geofences','[]'::jsonb)) el loop
    insert into public.sf_geofence(event_id, kind, label, lat, lng, radius_m)
    values (v_id, coalesce(v_row->>'kind','stage'), v_row->>'label',
            nullif(v_row->>'lat','')::float8, nullif(v_row->>'lng','')::float8,
            coalesce(nullif(v_row->>'radius_m','')::int, 25));
  end loop;

  return v_slug;
end $$;

-- Public national list (live events only), optional state/city/category filters.
create or replace function public.sf_list(p_state text default null, p_city text default null, p_cat text default null)
returns setof public.sf_event language sql stable security definer set search_path = public as $$
  select * from public.sf_event
   where status = 'live'
     and (p_state is null or state = p_state)
     and (p_city  is null or city  = p_city)
     and (p_cat   is null or cat   = p_cat)
   order by date_start asc nulls last, created_at desc;
$$;

-- Public single-event bundle (event + acts + active ticket types) by slug.
create or replace function public.sf_get(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'event',        to_jsonb(e),
    'acts',         coalesce((select jsonb_agg(to_jsonb(a) order by a."time") from public.sf_act a where a.event_id = e.id), '[]'::jsonb),
    'ticket_types', coalesce((select jsonb_agg(to_jsonb(t)) from public.sf_ticket_type t where t.event_id = e.id and t.active), '[]'::jsonb)
  )
  from public.sf_event e
  where e.slug = p_slug and e.status = 'live'
  limit 1;
$$;

-- Subscription gate (FREEMIUM): free to build/test until `grace_days` before the festival, then locked until subscribed.
-- The client shows a blocking "subscription" toast when locked=true.
create or replace function public.sf_gate(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug',       e.slug,
    'subscribed', e.subscribed,
    'grace_days', e.grace_days,
    'date_start', e.date_start,
    'lock_on',    case when e.date_start is null then null else (e.date_start - e.grace_days) end,
    'days_left',  case when e.date_start is null then null else (e.date_start - e.grace_days) - current_date end,
    'locked',     (not e.subscribed)
                  and e.date_start is not null
                  and current_date >= (e.date_start - e.grace_days)
  )
  from public.sf_event e where e.slug = p_slug limit 1;
$$;

-- Billing webhook (service role) flips a festival to subscribed through a date. Never exposed to anon/authenticated.
create or replace function public.sf_mark_subscribed(p_slug text, p_until date)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.sf_event set subscribed = true, sub_until = p_until, updated_at = now() where slug = p_slug;
  return found;
end $$;

-- Owner pins a partner's exact location (front door + corners, or booth spot).
create or replace function public.sf_partner_pin(p_id uuid, p_lat float8, p_lng float8, p_points jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  update public.sf_partner pa
     set lat = p_lat, lng = p_lng, points = p_points, status = 'located'
   where pa.id = p_id
     and exists (select 1 from public.sf_event e where e.id = pa.event_id and e.owner = auth.uid()::text)
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

-- Ingest a batch of device pings (anonymous ok; device is a hash, never an identity). Rate-capped at 300/call.
create or replace function public.sf_ping_batch(p_event uuid, p_pings jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_p jsonb;
begin
  if jsonb_typeof(p_pings) <> 'array' then return 0; end if;
  for v_p in select el from jsonb_array_elements(p_pings) el limit 300 loop
    insert into public.sf_ping(event_id, device, geofence_id, lat, lng, dwell_s)
    values (p_event, left(coalesce(v_p->>'device',''), 64), nullif(v_p->>'geofence_id','')::uuid,
            nullif(v_p->>'lat','')::float8, nullif(v_p->>'lng','')::float8,
            coalesce(nullif(v_p->>'dwell_s','')::int, 0));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Roll a day's pings into hourly occupancy (distinct devices + dwell-qualified uses). Called by cron/edge.
create or replace function public.sf_rollup(p_event uuid, p_day date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
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

-- Owner-only: the daily occupancy report data (joined to geofence labels).
create or replace function public.sf_occupancy_get(p_event uuid, p_day date)
returns table(geofence_id uuid, kind text, label text, hour int, devices int, uses int)
language sql stable security definer set search_path = public as $$
  select o.geofence_id, g.kind, g.label, o.hour, o.devices, o.uses
    from public.sf_occupancy o
    join public.sf_geofence g on g.id = o.geofence_id
    join public.sf_event e   on e.id = o.event_id
   where o.event_id = p_event and o.day = p_day
     and e.owner = auth.uid()::text
   order by g.label, o.hour;
$$;

-- ============================================================ PROSPECT CRM (the 800 — direct go-to-market)

create table if not exists public.sf_admin ( uid text primary key );   -- StageFill sales/admin; seed your own auth uid

create table if not exists public.sf_prospect (
  id            uuid primary key default gen_random_uuid(),
  name          text not null, city text, state text,
  attendance    int, cat text,
  contact_name  text, contact_email text, contact_phone text,
  maker_token   text unique default substr(md5(random()::text), 1, 10),  -- token in the Maker link (prefills name/city/state)
  status        text not null default 'new',        -- new | sent | opened | building | subscribed | declined
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sf_prospect_status_idx on public.sf_prospect(status);

alter table public.sf_admin    enable row level security;
alter table public.sf_prospect enable row level security;
-- no public policies: prospect data is internal; all access via the admin-gated RPCs below.

create or replace function public.sf_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sf_admin a where a.uid = auth.uid()::text);
$$;

create or replace function public.sf_prospect_list(p_status text default null)
returns setof public.sf_prospect language sql stable security definer set search_path = public as $$
  select * from public.sf_prospect
   where public.sf_is_admin() and (p_status is null or status = p_status)
   order by attendance desc nulls last, name;
$$;

create or replace function public.sf_prospect_upsert(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not public.sf_is_admin() then raise exception 'not authorized'; end if;
  if v_id is null then
    insert into public.sf_prospect(name, city, state, attendance, cat, contact_name, contact_email, contact_phone, status, notes)
    values (p->>'name', p->>'city', p->>'state', nullif(p->>'attendance','')::int, p->>'cat',
            p->>'contact_name', p->>'contact_email', p->>'contact_phone', coalesce(p->>'status','new'), p->>'notes')
    returning id into v_id;
  else
    update public.sf_prospect set
      name=coalesce(p->>'name',name), city=coalesce(p->>'city',city), state=coalesce(p->>'state',state),
      attendance=coalesce(nullif(p->>'attendance','')::int,attendance), cat=coalesce(p->>'cat',cat),
      contact_name=coalesce(p->>'contact_name',contact_name), contact_email=coalesce(p->>'contact_email',contact_email),
      contact_phone=coalesce(p->>'contact_phone',contact_phone), status=coalesce(p->>'status',status),
      notes=coalesce(p->>'notes',notes), updated_at=now()
     where id=v_id;
  end if;
  return v_id;
end $$;

-- ============================================================ GRANTS

grant select, insert, update, delete on public.sf_event, public.sf_act, public.sf_ticket_type,
      public.sf_partner, public.sf_geofence to authenticated;
grant select on public.sf_order, public.sf_occupancy to authenticated;

grant execute on function public.sf_publish(jsonb)                              to anon, authenticated;
grant execute on function public.sf_list(text, text, text)                      to anon, authenticated;
grant execute on function public.sf_get(text)                                   to anon, authenticated;
grant execute on function public.sf_partner_pin(uuid, float8, float8, jsonb)    to anon, authenticated;
grant execute on function public.sf_ping_batch(uuid, jsonb)                     to anon, authenticated;
grant execute on function public.sf_rollup(uuid, date)                          to anon, authenticated;
grant execute on function public.sf_occupancy_get(uuid, date)                   to anon, authenticated;
grant execute on function public.sf_gate(text)                                  to anon, authenticated;

grant select on public.sf_prospect to authenticated;   -- RLS denies direct rows; access is via the admin-gated RPCs
grant execute on function public.sf_is_admin()                                  to authenticated;
grant execute on function public.sf_prospect_list(text)                         to authenticated;
grant execute on function public.sf_prospect_upsert(jsonb)                      to authenticated;

-- billing webhook only — lock it down
revoke execute on function public.sf_mark_subscribed(text, date) from public;
grant  execute on function public.sf_mark_subscribed(text, date) to service_role;
