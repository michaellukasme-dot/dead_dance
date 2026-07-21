-- dd_reels.sql — REAL reels: video clips uploaded by the family.
-- Run ONCE in the Supabase SQL editor (same project as dd_posts). Creates the table,
-- the RPCs, AND a public 'reels' storage bucket with upload/read policies.
-- After running: Database → Replication → add public.dd_reels for realtime (optional but nice).

create table if not exists public.dd_reels (
  id         uuid primary key default gen_random_uuid(),
  member_id  text,
  video_url  text not null,
  poster_url text,
  band       text,
  caption    text,
  kind       text not null default 'original',   -- 'original' | 'gathered'
  created_at timestamptz not null default now()
);
create index if not exists dd_reels_created_idx on public.dd_reels(created_at desc);

alter table public.dd_reels enable row level security;
drop policy if exists dd_reels_read on public.dd_reels;
create policy dd_reels_read on public.dd_reels for select using (true);

create or replace function public.dd_reel_add(p_video_url text, p_poster_url text, p_band text, p_caption text, p_kind text, p_member text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_video_url),'') = '' then return null; end if;
  insert into public.dd_reels(member_id, video_url, poster_url, band, caption, kind)
  values (p_member, p_video_url, nullif(btrim(p_poster_url),''), nullif(btrim(p_band),''),
          nullif(btrim(p_caption),''), coalesce(nullif(btrim(p_kind),''),'original'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.dd_reels_list(p_limit int)
returns setof public.dd_reels language sql stable as $$
  select * from public.dd_reels order by created_at desc limit coalesce(p_limit,24);
$$;

grant execute on function public.dd_reel_add(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.dd_reels_list(int)                          to anon, authenticated;

-- ---- Storage: public 'reels' bucket + upload/read policies (so uploads persist for everyone) ----
insert into storage.buckets (id, name, public) values ('reels','reels',true) on conflict (id) do nothing;
drop policy if exists dd_reels_upload  on storage.objects;
create policy dd_reels_upload  on storage.objects for insert to anon, authenticated with check (bucket_id = 'reels');
drop policy if exists dd_reels_pubread on storage.objects;
create policy dd_reels_pubread on storage.objects for select to anon, authenticated using (bucket_id = 'reels');
