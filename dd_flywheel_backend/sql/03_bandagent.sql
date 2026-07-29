-- dd_bandagent — %BAND_AGENT% per-band learned state (roles, consent, self-provide, roster, asks).
-- The blank-slate agent that learns THIS band. Client is local-first; this spine persists + syncs cross-device.
-- Idempotent — safe to re-run. Until run, the agent works fully client-side and these calls no-op.

create table if not exists public.dd_bandagent (
  band_slug   text primary key,
  state       jsonb not null default '{}'::jsonb,   -- the full agent state blob (consent, roles, roster, selfProvides, asks)
  updated_at  timestamptz not null default now()
);
alter table public.dd_bandagent enable row level security;   -- no direct table access; only the RPCs below

-- Save (upsert) the agent state for a band. Token-light: writing agent state is a band-owned action;
-- gate with a token in production if abuse appears (kept open here to match the local-first client).
create or replace function public.dd_bandagent_save(p_band text, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  insert into public.dd_bandagent(band_slug, state, updated_at)
    values (lower(btrim(p_band)), coalesce(p_state, '{}'::jsonb), now())
    on conflict (band_slug) do update set state = excluded.state, updated_at = now();
  return jsonb_build_object('band', lower(btrim(p_band)), 'ok', true);
end $$;

-- Read the agent state for a band.
create or replace function public.dd_bandagent_get(p_band text)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(state, '{}'::jsonb) from public.dd_bandagent where band_slug = lower(btrim(p_band));
$$;

grant execute on function public.dd_bandagent_save(text, jsonb) to anon, authenticated;
grant execute on function public.dd_bandagent_get(text) to anon, authenticated;

-- smoke (uncomment):
-- select public.dd_bandagent_save('rift', '{"consent":{"taping":true},"roles":{"taper":"fan-9"}}'::jsonb);
-- select public.dd_bandagent_get('rift');
