-- dd_bandadopt — the "Adopt a Band" scratch-off: which bands a friend has claimed to post for.
-- Shared state so 800 friends don't double up. Client (adopt_a_band.html) is local-first + guarded.
-- Idempotent — safe to re-run.

create table if not exists public.dd_bandadopt (
  slug        text primary key,
  by_fan      text,
  created_at  timestamptz not null default now()
);
alter table public.dd_bandadopt enable row level security;

-- Claim a band (first claim wins; idempotent — re-claim is a no-op).
create or replace function public.dd_bandadopt_claim(p_slug text, p_by text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.dd_bandadopt(slug, by_fan)
    values (lower(btrim(p_slug)), coalesce(nullif(p_by,''),'anon'))
    on conflict (slug) do nothing;
  return jsonb_build_object('slug', lower(btrim(p_slug)), 'ok', true);
end $$;

-- List all claimed bands (for the live scratch-off).
create or replace function public.dd_bandadopt_list()
returns table(slug text, by text, created_at timestamptz)
language sql security definer set search_path=public as $$
  select slug, by_fan as by, created_at from public.dd_bandadopt order by created_at asc;
$$;

grant execute on function public.dd_bandadopt_claim(text, text) to anon, authenticated;
grant execute on function public.dd_bandadopt_list() to anon, authenticated;
