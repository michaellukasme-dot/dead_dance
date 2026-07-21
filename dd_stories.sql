-- dd_stories.sql — REAL Stories: the "Create story" row on dd_home_mockup.html.
-- Run ONCE in the Supabase SQL editor (same project as dd_posts / dd_reels).
-- Media (image OR video) is uploaded to the EXISTING public 'reels' storage bucket
-- (created by dd_reels.sql) — run dd_reels.sql first, or this file also ensures it below.
-- After running: Database → Replication → add public.dd_stories for realtime (optional).

create table if not exists public.dd_stories (
  id          uuid primary key default gen_random_uuid(),
  member_id   text,
  member_name text,
  media_url   text not null,
  media_type  text not null default 'image',   -- 'image' | 'video'
  caption     text,
  created_at  timestamptz not null default now()
);
create index if not exists dd_stories_created_idx on public.dd_stories(created_at desc);

alter table public.dd_stories enable row level security;
drop policy if exists dd_stories_read on public.dd_stories;
create policy dd_stories_read on public.dd_stories for select using (true);

create or replace function public.dd_story_add(p_media_url text, p_media_type text, p_caption text, p_member text, p_member_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_media_url),'') = '' then return null; end if;
  insert into public.dd_stories(member_id, member_name, media_url, media_type, caption)
  values (p_member, nullif(btrim(p_member_name),''), p_media_url,
          coalesce(nullif(btrim(p_media_type),''),'image'), nullif(btrim(p_caption),''))
  returning id into v_id;
  return v_id;
end $$;

-- last 48h of stories (FB-style: stories expire) — drop the interval clause to keep them forever.
create or replace function public.dd_stories_list(p_limit int)
returns setof public.dd_stories language sql stable as $$
  select * from public.dd_stories
  where created_at > now() - interval '48 hours'
  order by created_at desc limit coalesce(p_limit,20);
$$;

grant execute on function public.dd_story_add(text,text,text,text,text) to anon, authenticated;
grant execute on function public.dd_stories_list(int)                  to anon, authenticated;

-- ---- Storage: ensure the public 'reels' bucket exists (dd_stories reuses it for media) ----
insert into storage.buckets (id, name, public) values ('reels','reels',true) on conflict (id) do nothing;
drop policy if exists dd_reels_upload  on storage.objects;
create policy dd_reels_upload  on storage.objects for insert to anon, authenticated with check (bucket_id = 'reels');
drop policy if exists dd_reels_pubread on storage.objects;
create policy dd_reels_pubread on storage.objects for select to anon, authenticated using (bucket_id = 'reels');
