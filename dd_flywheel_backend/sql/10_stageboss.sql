-- dd_stageboss — the Autonomous Festival Stage-Manager Agent's spine.
-- Stores proforma DRAFTS (organizer is still deciding) and CONFIRMED bookings (organizer said yes).
-- Client (dd_stageboss.js) is local-first + guarded: no backend = the agent still plans, just doesn't persist.
-- Idempotent — safe to re-run.

-- ---- proforma drafts (a plan the organizer is reviewing; overwrite as they retune) ----
create table if not exists public.dd_stageboss_plan (
  plan_id     text primary key,
  org         text,
  festival    text,
  acts_budget numeric,
  act_spend   numeric,
  stages      int,
  plan_json   jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.dd_stageboss_plan enable row level security;

-- ---- confirmed bookings (the organizer pressed CONFIRM — this is the "booked" record) ----
create table if not exists public.dd_stageboss_booking (
  plan_id      text primary key,
  org          text,
  stages       int,
  act_spend    numeric,
  stagefill_fee numeric,
  confirmed_at timestamptz not null default now()
);
alter table public.dd_stageboss_booking enable row level security;

-- Save/replace a proforma draft (organizer retunes freely before confirming).
create or replace function public.sf_stageboss_save(p_plan_id text, p_org text, p_festival text, p_budget numeric, p_spend numeric, p_stages int, p_json jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.dd_stageboss_plan(plan_id, org, festival, acts_budget, act_spend, stages, plan_json, updated_at)
    values (p_plan_id, nullif(p_org,''), p_festival, p_budget, p_spend, p_stages, p_json, now())
    on conflict (plan_id) do update set org=excluded.org, festival=excluded.festival, acts_budget=excluded.acts_budget,
      act_spend=excluded.act_spend, stages=excluded.stages, plan_json=excluded.plan_json, updated_at=now();
  return jsonb_build_object('plan_id', p_plan_id, 'ok', true);
end $$;

-- Confirm a plan → book it (idempotent; re-confirm is a no-op that returns the same row).
create or replace function public.sf_stageboss_confirm(p_plan_id text, p_org text, p_stages int, p_spend numeric, p_fee numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.dd_stageboss_booking(plan_id, org, stages, act_spend, stagefill_fee)
    values (p_plan_id, nullif(p_org,''), coalesce(p_stages,0), coalesce(p_spend,0), coalesce(p_fee,0))
    on conflict (plan_id) do nothing;
  return jsonb_build_object('plan_id', p_plan_id, 'ok', true);
end $$;

-- Grants: an organizer (anon in the maker, or authenticated) may save drafts + confirm their own plans.
grant execute on function public.sf_stageboss_save(text, text, text, numeric, numeric, int, jsonb) to anon, authenticated;
grant execute on function public.sf_stageboss_confirm(text, text, int, numeric, numeric)             to anon, authenticated;
