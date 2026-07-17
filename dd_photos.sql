-- dd_photos.sql — durable crowd media (the clay for Surround collages + the blog river).
-- Storage bucket holds the bytes; dd_photos holds where/when/who so we can aggregate by
-- stage, Platz, act, and day. Idempotent — safe to re-run. Run in Supabase SQL editor.

-- 1) public bucket for crowd media. public READ so collages/blog can render the tiles.
insert into storage.buckets (id, name, public)
values ('crowd', 'crowd', true)
on conflict (id) do nothing;

-- 2) festival visitors have no login, so allow ANON inserts into (only) the crowd bucket,
--    and public reads from it. Writes elsewhere are unaffected.
drop policy if exists "crowd anon insert" on storage.objects;
create policy "crowd anon insert" on storage.objects
  for insert to anon with check (bucket_id = 'crowd');

drop policy if exists "crowd public read" on storage.objects;
create policy "crowd public read" on storage.objects
  for select to anon using (bucket_id = 'crowd');

-- 3) metadata table — one row per uploaded photo/video
create table if not exists dd_photos (
  id         uuid primary key,
  url        text not null,
  lat        double precision,
  lng        double precision,
  kind       text default 'crowd',   -- 'crowd' | 'profile' | 'surround' | ...
  day        date,
  cell       text,                    -- the k-anon grid cell, when known (per-stage/Platz aggregation)
  token      text,                    -- pseudonymous device id (never PII)
  created_at timestamptz default now()
);
create index if not exists dd_photos_day_idx  on dd_photos (day);
create index if not exists dd_photos_cell_idx on dd_photos (cell);
create index if not exists dd_photos_kind_idx on dd_photos (kind);

alter table dd_photos enable row level security;
-- reads are public (the feed is curated downstream); writes only via the definer RPC below
drop policy if exists "photos public read" on dd_photos;
create policy "photos public read" on dd_photos for select to anon using (true);

-- 4) the ONLY write path — SECURITY DEFINER so anon can log a row without direct table grants
create or replace function dd_photo_add(
  p_id uuid, p_url text, p_lat double precision, p_lng double precision,
  p_kind text, p_day date, p_cell text, p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into dd_photos (id, url, lat, lng, kind, day, cell, token)
  values (p_id, p_url, p_lat, p_lng, coalesce(p_kind, 'crowd'), coalesce(p_day, current_date), p_cell, p_token)
  on conflict (id) do update
    set url = excluded.url, lat = excluded.lat, lng = excluded.lng, cell = excluded.cell;
end $$;
grant execute on function dd_photo_add(uuid, text, double precision, double precision, text, date, text, text) to anon;

-- 5) feed RPC — recent crowd media for the blog river / Surround collage builder.
--    Filter by kind (e.g. exclude 'profile') and by time window.
create or replace function dd_photo_feed(
  p_since timestamptz default now() - interval '2 days',
  p_kind  text        default null)
returns setof dd_photos
language sql security definer set search_path = public as $$
  select * from dd_photos
  where created_at >= p_since
    and kind <> 'profile'
    and (p_kind is null or kind = p_kind)
  order by created_at desc
  limit 500;
$$;
grant execute on function dd_photo_feed(timestamptz, text) to anon;

-- 6) per-cell media count — how many photos came from a given stage/Platz cell in a window
--    (feeds the "attendees per act" story with real crowd content, not just device counts).
create or replace function dd_photo_cell_count(
  p_cell text, p_since timestamptz default now() - interval '1 day')
returns integer
language sql security definer set search_path = public as $$
  select count(*)::int from dd_photos where cell = p_cell and created_at >= p_since;
$$;
grant execute on function dd_photo_cell_count(text, timestamptz) to anon;
