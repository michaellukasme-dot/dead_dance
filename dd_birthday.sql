-- dd_birthday.sql — REAL birthdays. FRIENDS-ONLY.
-- Run this ONCE in the Supabase SQL editor (same project as dd_friends / dd_profile / dd_posts). Safe to re-run.
--
-- Birthdays are FRIENDS-ONLY: a member stores their own month/day (year optional, for age).
-- A member can upsert/read ONLY their own row (RLS). Friends' birthdays are NEVER exposed by a
-- raw table read — they come out solely through dd_birthdays_friends() (security definer), which
-- returns only the caller's ACCEPTED friends (either-direction, mirrors dd_friends_list). Strangers
-- can never read your birthday. Identity = Supabase Auth (auth.uid()); the client can't spoof an id.

-- ---- table ------------------------------------------------------------------
create table if not exists public.dd_birthdays (
  member_id  text primary key,                            -- auth.uid()::text
  month      int not null check (month between 1 and 12),
  day        int not null check (day between 1 and 31),
  year       int,                                         -- optional (only for age)
  updated_at timestamptz not null default now()
);

-- ---- RLS: a member can read/upsert ONLY their own row -----------------------
alter table public.dd_birthdays enable row level security;

drop policy if exists dd_birthdays_read_self on public.dd_birthdays;
create policy dd_birthdays_read_self on public.dd_birthdays
  for select to authenticated
  using (member_id = auth.uid()::text);

drop policy if exists dd_birthdays_ins_self on public.dd_birthdays;
create policy dd_birthdays_ins_self on public.dd_birthdays
  for insert to authenticated
  with check (member_id = auth.uid()::text);

drop policy if exists dd_birthdays_upd_self on public.dd_birthdays;
create policy dd_birthdays_upd_self on public.dd_birthdays
  for update to authenticated
  using (member_id = auth.uid()::text)
  with check (member_id = auth.uid()::text);
-- Friends' rows are NEVER readable directly — only via dd_birthdays_friends() below.

-- ---- upsert the caller's own birthday ---------------------------------------
create or replace function public.dd_birthday_set(p_month int, p_day int, p_year int)
returns void language plpgsql security definer set search_path = public as $$
declare v_me text := auth.uid()::text;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if p_month is null or p_month < 1 or p_month > 12 then raise exception 'invalid month'; end if;
  if p_day   is null or p_day   < 1 or p_day   > 31 then raise exception 'invalid day';   end if;
  insert into public.dd_birthdays (member_id, month, day, year, updated_at)
  values (v_me, p_month, p_day, nullif(p_year, 0), now())
  on conflict (member_id) do update
     set month = excluded.month, day = excluded.day, year = excluded.year, updated_at = now();
end $$;

-- ---- the caller's own birthday (row or nothing) -----------------------------
create or replace function public.dd_birthday_mine()
returns setof public.dd_birthdays language sql stable security definer set search_path = public as $$
  select * from public.dd_birthdays where member_id = auth.uid()::text;
$$;

-- ---- the caller's ACCEPTED friends who have a birthday set ------------------
-- Mirrors dd_friends_list's accepted, either-direction join. Name comes from the profile if set,
-- else the name captured on the friend request, else a gentle fallback. Only accepted friends.
create or replace function public.dd_birthdays_friends()
returns table (member_id text, name text, month int, day int, year int)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid()::text as uid),
  fr as (
    select case when r.from_id = (select uid from me) then r.to_id   else r.from_id   end as fid,
           case when r.from_id = (select uid from me) then r.to_name else r.from_name end as fname
    from public.dd_friend_requests r
    where r.status = 'accepted'
      and (select uid from me) in (r.from_id, r.to_id)
  )
  select b.member_id,
         coalesce(nullif(btrim(p.name), ''), nullif(btrim(fr.fname), ''), 'A head') as name,
         b.month, b.day, b.year
  from fr
  join public.dd_birthdays b on b.member_id = fr.fid
  left join public.dd_profile p on p.uid = fr.fid;
$$;

-- ---- grants -----------------------------------------------------------------
grant execute on function public.dd_birthday_set(int,int,int) to anon, authenticated;
grant execute on function public.dd_birthday_mine()           to anon, authenticated;
grant execute on function public.dd_birthdays_friends()       to anon, authenticated;

-- ---- OPTIONAL smoke test (run signed-in from the app, not the SQL editor):
--   select public.dd_birthday_set(8, 9, 1990);
--   select * from public.dd_birthday_mine();
--   select * from public.dd_birthdays_friends();
