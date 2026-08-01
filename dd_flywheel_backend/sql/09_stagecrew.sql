-- dd_stagecrew — the "Surround the Stage" street-team checklist: which stages a crew has covered.
-- Shared state so two teams of 4 don't both walk the same stage. Client (stage_crew.html) is local-first + guarded.
-- Mirrors dd_bandadopt exactly. Idempotent — safe to re-run.

create table if not exists public.dd_stagecrew (
  slug        text primary key,
  by_crew     text,
  created_at  timestamptz not null default now()
);
alter table public.dd_stagecrew enable row level security;

-- Claim a stage as covered (first claim wins; idempotent — re-claim is a no-op).
create or replace function public.dd_stagecrew_claim(p_slug text, p_by text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.dd_stagecrew(slug, by_crew)
    values (lower(btrim(p_slug)), coalesce(nullif(p_by,''),'crew'))
    on conflict (slug) do nothing;
  return jsonb_build_object('slug', lower(btrim(p_slug)), 'ok', true);
end $$;

-- List all covered stages (for the live checklist).
create or replace function public.dd_stagecrew_list()
returns table(slug text, by text, created_at timestamptz)
language sql security definer set search_path=public as $$
  select slug, by_crew as by, created_at from public.dd_stagecrew order by created_at asc;
$$;

grant execute on function public.dd_stagecrew_claim(text, text) to anon, authenticated;
grant execute on function public.dd_stagecrew_list() to anon, authenticated;
