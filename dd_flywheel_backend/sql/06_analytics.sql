-- dd analytics — the SORTING LAYER's demographic engine. Consented, AGGREGATE-ONLY, privacy-thresholded.
-- Answers the cross-membership + cohort questions the sorting layer unlocks:
--   • "How many CountryDance fans are also DeadDance fans?"
--   • "How many DeadDance fans were born after Jerry died (1995)?"
--   • "Of that cohort, their top-10 other events?"
-- The write helpers stream from the app (alongside the existing DDTele firehose). Idempotent — safe to re-run.

create table if not exists public.dd_membership (
  fan_id text not null, group_key text not null, group_type text not null default 'genre',
  joined_at timestamptz not null default now(), primary key (fan_id, group_key));
create table if not exists public.dd_profile (
  fan_id text primary key, birth_year int, region text, consented boolean not null default false,
  updated_at timestamptz not null default now());
create table if not exists public.dd_attend (
  fan_id text not null, event_key text not null, group_key text, attended_at timestamptz not null default now(),
  primary key (fan_id, event_key));
alter table public.dd_membership enable row level security;
alter table public.dd_profile   enable row level security;
alter table public.dd_attend    enable row level security;
create table if not exists public.dd_purchase (
  id bigint generated always as identity primary key,
  fan_id text not null, item_key text not null, category text not null default 'merch',
  qty int not null default 1, amount_cents int not null default 0, at timestamptz not null default now());
alter table public.dd_purchase  enable row level security;

-- ---- WRITE helpers (users record their OWN data; anon-ok; idempotent) ----
create or replace function public.dd_join_group(p_fan text, p_group text, p_type text) returns void
 language sql security definer set search_path=public as $$
 insert into dd_membership(fan_id,group_key,group_type) values (p_fan, lower(btrim(p_group)), coalesce(p_type,'genre'))
 on conflict (fan_id,group_key) do nothing; $$;
create or replace function public.dd_set_profile(p_fan text, p_birth_year int, p_region text, p_consent boolean) returns void
 language sql security definer set search_path=public as $$
 insert into dd_profile(fan_id,birth_year,region,consented,updated_at) values (p_fan,p_birth_year,p_region,coalesce(p_consent,false),now())
 on conflict (fan_id) do update set birth_year=excluded.birth_year, region=excluded.region, consented=excluded.consented, updated_at=now(); $$;
create or replace function public.dd_log_attend(p_fan text, p_event text, p_group text) returns void
 language sql security definer set search_path=public as $$
 insert into dd_attend(fan_id,event_key,group_key) values (p_fan, lower(btrim(p_event)), lower(btrim(p_group)))
 on conflict (fan_id,event_key) do nothing; $$;
create or replace function public.dd_log_purchase(p_fan text, p_item text, p_category text, p_qty int, p_amount_cents int) returns void
 language sql security definer set search_path=public as $$
 insert into dd_purchase(fan_id,item_key,category,qty,amount_cents)
 values (p_fan, lower(btrim(p_item)), lower(coalesce(nullif(p_category,''),'merch')), greatest(coalesce(p_qty,1),1), coalesce(p_amount_cents,0)); $$;

-- PRIVACY: suppress any cohort smaller than 20 to prevent re-identification.
create or replace function public._agg(n bigint) returns bigint language sql immutable as $$ select case when n >= 20 then n else null end; $$;

-- "How many %A% fans are also %B% fans?"
create or replace function public.dd_x_membership(p_a text, p_b text) returns bigint
 language sql security definer set search_path=public as $$
 select public._agg(count(*)) from (
   select fan_id from dd_membership where group_key=lower(btrim(p_a))
   intersect
   select fan_id from dd_membership where group_key=lower(btrim(p_b))) x; $$;

-- "How many %GROUP% fans were born after %YEAR%?" (e.g., deaddance, 1995 — after Jerry)
create or replace function public.dd_cohort_born_after(p_group text, p_year int) returns bigint
 language sql security definer set search_path=public as $$
 select public._agg(count(*)) from dd_membership m join dd_profile p on p.fan_id=m.fan_id
 where m.group_key=lower(btrim(p_group)) and p.consented and p.birth_year > p_year; $$;

-- "Of that cohort, their TOP N other events?"
create or replace function public.dd_cohort_top_events(p_group text, p_year int, p_limit int default 10)
 returns table(event_key text, fans bigint) language sql security definer set search_path=public as $$
 with cohort as (
   select m.fan_id from dd_membership m join dd_profile p on p.fan_id=m.fan_id
   where m.group_key=lower(btrim(p_group)) and p.consented and p.birth_year > p_year)
 select a.event_key, count(distinct a.fan_id) as fans
 from dd_attend a join cohort c on c.fan_id=a.fan_id
 group by a.event_key having count(distinct a.fan_id) >= 20
 order by fans desc limit coalesce(p_limit,10); $$;

-- "How many T-shirts does that cohort buy?" (category e.g. 'tshirt') → units + revenue + buyers (aggregate)
create or replace function public.dd_cohort_purchases(p_group text, p_year int, p_category text)
 returns table(units bigint, revenue_cents bigint, buyers bigint) language sql security definer set search_path=public as $$
 with cohort as (
   select m.fan_id from dd_membership m join dd_profile p on p.fan_id=m.fan_id
   where m.group_key=lower(btrim(p_group)) and p.consented and (p_year is null or p.birth_year > p_year))
 select sum(pu.qty)::bigint, sum(pu.amount_cents)::bigint, count(distinct pu.fan_id)::bigint
 from dd_purchase pu join cohort c on c.fan_id=pu.fan_id
 where p_category is null or pu.category=lower(btrim(p_category))
 having count(distinct pu.fan_id) >= 20; $$;

-- GRANTS: writes are user-facing (anon). ANALYTICS READS are NOT granted to anon/authenticated —
-- they run under the service role (owner dashboards / server) only. Demographic data never leaks to a client.
grant execute on function public.dd_join_group(text,text,text)          to anon, authenticated;
grant execute on function public.dd_set_profile(text,int,text,boolean)  to anon, authenticated;
grant execute on function public.dd_log_attend(text,text,text)          to anon, authenticated;
grant execute on function public.dd_log_purchase(text,text,text,int,int) to anon, authenticated;
-- (intentionally NO grant on dd_x_membership / dd_cohort_born_after / dd_cohort_top_events — service role / admin only)
