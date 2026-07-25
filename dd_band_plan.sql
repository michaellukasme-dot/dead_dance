-- dd_band_plan.sql — BAND freemium. A band unlocks pro (incl. selling tickets) EITHER by
-- turning ON DeadDance ticketing (free), OR a $20/mo subscription.  unlocked = ticketing_enabled OR subscribed.
-- Run ONCE in the Supabase SQL editor. Additive — touches nothing else.
-- Keyed by band slug (same slug the band page / invite links use).

create table if not exists public.dd_band_plan (
  band              text primary key,                 -- band slug
  ticketing_enabled boolean not null default false,   -- the ✅ "let DeadDance sell my tickets" checkbox
  subscribed        boolean not null default false,   -- the $20/mo alternative (set by billing webhook)
  sub_until         date,
  updated_at        timestamptz not null default now()
);

alter table public.dd_band_plan enable row level security;
-- no public table policies: reads/writes go through the definer RPCs below.

-- Plan state for a band (always returns a row, even before one exists). unlocked = free-ticketing OR subscribed.
create or replace function public.dd_band_plan_get(p_band text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'band', p_band, 'ticketing_enabled', te, 'subscribed', sub, 'sub_until', su,
    'unlocked', (te or sub)
  )
  from (
    select coalesce((select ticketing_enabled from public.dd_band_plan where band = p_band), false) te,
           coalesce((select subscribed        from public.dd_band_plan where band = p_band), false) sub,
                    (select sub_until          from public.dd_band_plan where band = p_band)         su
  ) q;
$$;

-- The band flips its own free-ticketing switch. (Production: tie to band ownership once band auth lands.)
create or replace function public.dd_band_ticketing_set(p_band text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.dd_band_plan(band, ticketing_enabled) values (p_band, p_on)
  on conflict (band) do update set ticketing_enabled = p_on, updated_at = now();
  return true;
end $$;

-- Billing webhook only — flips the $20/mo subscription on/through a date.
create or replace function public.dd_band_subscribe(p_band text, p_until date)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.dd_band_plan(band, subscribed, sub_until) values (p_band, true, p_until)
  on conflict (band) do update set subscribed = true, sub_until = p_until, updated_at = now();
  return found or true;
end $$;

grant execute on function public.dd_band_plan_get(text)            to anon, authenticated;
grant execute on function public.dd_band_ticketing_set(text, boolean) to anon, authenticated;
revoke execute on function public.dd_band_subscribe(text, date) from public;
grant  execute on function public.dd_band_subscribe(text, date) to service_role;
