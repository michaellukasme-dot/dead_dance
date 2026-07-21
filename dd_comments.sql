-- dd_comments.sql — REAL comments on feed posts.
-- Run this ONCE in the Supabase SQL editor (same project as dd_posts / dd_post_reactions).
-- After running, enable Realtime for public.dd_post_comments (Database → Replication → add the table).

create table if not exists public.dd_post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     text not null,                 -- text so it matches however dd_posts.id serializes (uuid or bigint)
  author_id   text not null,
  author_name text,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists dd_post_comments_post_idx on public.dd_post_comments(post_id, created_at);

alter table public.dd_post_comments enable row level security;

-- read: anyone can read comments (public feed)
drop policy if exists dd_post_comments_read on public.dd_post_comments;
create policy dd_post_comments_read on public.dd_post_comments for select using (true);

-- writes go through the security-definer RPC below (not direct table insert)

create or replace function public.dd_comment_add(p_post_id text, p_author_id text, p_author_name text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_body),'') = '' then return null; end if;
  insert into public.dd_post_comments(post_id, author_id, author_name, body)
  values (p_post_id, p_author_id, coalesce(nullif(btrim(p_author_name),''),'A head'), btrim(p_body))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.dd_comments_get(p_post_id text)
returns setof public.dd_post_comments language sql stable as $$
  select * from public.dd_post_comments where post_id = p_post_id order by created_at asc;
$$;

create or replace function public.dd_comment_counts(p_ids text[])
returns table(post_id text, n bigint) language sql stable as $$
  select post_id, count(*)::bigint from public.dd_post_comments
  where post_id = any(p_ids) group by post_id;
$$;

grant execute on function public.dd_comment_add(text,text,text,text) to anon, authenticated;
grant execute on function public.dd_comments_get(text)            to anon, authenticated;
grant execute on function public.dd_comment_counts(text[])        to anon, authenticated;
