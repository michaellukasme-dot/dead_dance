-- ============================================================================
-- 07_presence.sql — presence → ticket (the verified at-show subgroup)
--
-- When a fan PERSISTS at a stage while an act plays, dd_presence.js grants them
-- the event ticket and calls sf_presence_grant(). This records the verified,
-- consented attendance — the "gated at-show subgroup" a band can actually trust.
--
-- Privacy law (see DATA_what_the_band_needs_to_know):
--   • a fan sees only their own rows (RLS)
--   • analytics are aggregate, admin/service-role only, cohorts < 20 suppressed
--   • counts are DEVICES/accounts, never identities exposed
--
-- Guarded: the client works local-first; this is only touched when SB is up.
-- ============================================================================

create table if not exists public.dd_presence (
  id          bigint generated always as identity primary key,
  actor       uuid        not null default auth.uid(),   -- the fan; RLS-scoped, never exposed in analytics
  event_id    text        not null,
  stage_id    text,
  granted_at  timestamptz not null default now(),
  unique (actor, event_id)                                -- IDEMPOTENT: one presence-grant per fan per event
);

alter table public.dd_presence enable row level security;

-- a fan can read / insert ONLY their own presence rows
drop policy if exists dd_presence_self_read  on public.dd_presence;
drop policy if exists dd_presence_self_write on public.dd_presence;
create policy dd_presence_self_read  on public.dd_presence for select using (actor = auth.uid());
create policy dd_presence_self_write on public.dd_presence for insert with check (actor = auth.uid());

-- ---- idempotent grant RPC (single-row upsert; safe to call repeatedly) ------
create or replace function public.sf_presence_grant(p_event text, p_stage text default null)
returns table (event_id text, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare v_existed boolean := false;
begin
  if auth.uid() is null then
    return query select p_event, false;   -- anonymous: client stays local-first, no server grant
    return;
  end if;
  select true into v_existed
    from public.dd_presence where actor = auth.uid() and event_id = p_event;
  insert into public.dd_presence(actor, event_id, stage_id)
    values (auth.uid(), p_event, p_stage)
    on conflict (actor, event_id) do nothing;   -- idempotent
  return query select p_event, coalesce(v_existed, false);
end;
$$;

revoke all on function public.sf_presence_grant(text, text) from public;
grant execute on function public.sf_presence_grant(text, text) to authenticated;

-- ---- ANALYTICS (service-role ONLY; aggregate; cohorts < 20 suppressed) ------
create or replace function public.sf_presence_counts()
returns table (event_id text, attendees bigint)
language sql
security definer
set search_path = public
as $$
  select event_id, count(distinct actor)::bigint as attendees
  from public.dd_presence
  group by event_id
  having count(distinct actor) >= 20;   -- privacy: suppress small cohorts
$$;

revoke all on function public.sf_presence_counts() from public;
revoke all on function public.sf_presence_counts() from authenticated;   -- NOT for fans
grant  execute on function public.sf_presence_counts() to service_role;   -- admin/analytics only

-- Run order: after 01_fans_schema.sql. Depends on Supabase auth (auth.uid()).
