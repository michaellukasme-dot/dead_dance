-- dd_gd_video — the Grateful Dead SHOW ↔ VIDEO correlation table.
-- Purpose: store a LINK to a YouTube (or other) video that matches an Archive.org show.
-- We store FACTS ONLY — show identity + a URL + provenance. Nothing is hosted or copied.
-- "DATA DATA DATA / legal legal legal": capture the correlation now; decide HOW/IF to use it
-- later, with counsel. The provenance columns (channel_type / official / verified) are exactly
-- what that legal decision will turn on.
--
-- Show identity keys on the app's existing `show_key` (e.g. 'gd1977-05-08', from cornell77.js).
-- A show can have MANY videos → unique on (show_key, video_url).
-- Idempotent · RLS on · reads/writes via SECURITY DEFINER RPCs · no PII. (per SOP_POST_DEV_AUDITS)

create table if not exists public.dd_gd_video (
  id            bigserial primary key,
  show_key      text not null,                 -- 'gd1977-05-08' — the date-based show identity
  show_date     date,
  venue         text,
  city          text,
  video_url     text not null,                 -- the YouTube (or other) link — a POINTER, never a copy
  provider      text not null default 'youtube',
  video_id      text,                          -- parsed 11-char YouTube id (optional)
  channel_type  text default 'unknown',        -- official | authorized | fan | unknown  ← the legal hinge
  official      boolean not null default false,-- from the band / Rhino / an authorized channel
  verified      boolean not null default false,-- a human confirmed this video IS this show
  duration_sec  integer,
  note          text,
  added_by      text,
  at            timestamptz not null default now(),
  unique (show_key, video_url)
);
alter table public.dd_gd_video enable row level security;
create index if not exists dd_gd_video_showkey on public.dd_gd_video(show_key);
create index if not exists dd_gd_video_date on public.dd_gd_video(show_date);

-- Upsert one correlation (manual entry now; the YouTube Data API can feed this when wired).
create or replace function public.sf_gd_video_set(
  p_show_key text, p_video_url text, p_show_date date, p_venue text, p_city text,
  p_channel_type text, p_official boolean, p_verified boolean, p_note text, p_added_by text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id bigint; v_vid text;
begin
  if coalesce(btrim(p_show_key),'')='' or coalesce(btrim(p_video_url),'')='' then
    return jsonb_build_object('ok', false, 'err', 'show_key and video_url required');
  end if;
  -- best-effort parse of the 11-char YouTube id from common URL shapes
  v_vid := substring(p_video_url from '(?:v=|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})');
  insert into public.dd_gd_video(show_key, video_url, show_date, venue, city, provider, video_id,
      channel_type, official, verified, note, added_by, at)
    values (btrim(p_show_key), btrim(p_video_url), p_show_date, nullif(btrim(p_venue),''), nullif(btrim(p_city),''),
      'youtube', v_vid, coalesce(nullif(btrim(p_channel_type),''),'unknown'),
      coalesce(p_official,false), coalesce(p_verified,false), nullif(btrim(p_note),''), nullif(btrim(p_added_by),''), now())
    on conflict (show_key, video_url) do update set show_date=excluded.show_date, venue=excluded.venue, city=excluded.city,
      video_id=excluded.video_id, channel_type=excluded.channel_type, official=excluded.official,
      verified=excluded.verified, note=excluded.note, at=now()
    returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'show_key', btrim(p_show_key), 'video_id', v_vid);
end $$;

-- Read every video correlated to a show (public read of the FACTS).
create or replace function public.sf_gd_video_get(p_show_key text)
returns setof public.dd_gd_video language sql security definer set search_path=public as $$
  select * from public.dd_gd_video where show_key = btrim(p_show_key) order by official desc, verified desc, at;
$$;

-- How much of the catalog has video (the "which shows have video" map — a saleable asset by itself).
create or replace function public.sf_gd_video_coverage()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'videos', (select count(*) from public.dd_gd_video),
    'shows_with_video', (select count(distinct show_key) from public.dd_gd_video),
    'verified', (select count(*) from public.dd_gd_video where verified),
    'official', (select count(*) from public.dd_gd_video where official));
$$;

-- PRIVATE by default. This is an UNRESOLVED-LEGAL dataset: keep it admin-only (service_role) until
-- the how/if decision is made with counsel. The edge function (yt-match) uses the service role, so it
-- still writes. When you decide to surface it publicly, add a dedicated public read RPC then — not before.
revoke execute on function public.sf_gd_video_set(text,text,date,text,text,text,boolean,boolean,text,text) from public;
revoke execute on function public.sf_gd_video_get(text)  from public;
revoke execute on function public.sf_gd_video_coverage() from public;
grant  execute on function public.sf_gd_video_set(text,text,date,text,text,text,boolean,boolean,text,text) to service_role;
grant  execute on function public.sf_gd_video_get(text)  to service_role;
grant  execute on function public.sf_gd_video_coverage() to service_role;
