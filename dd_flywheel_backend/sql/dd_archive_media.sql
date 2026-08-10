-- ============================================================================
-- dd_archive_media.sql — Phase 6: ARCHIVE the setlist as permanent history + bind the night's
-- audio/photo media to the event, so the ticket becomes the permanent record of that show.
--
--   • dd_setlist_archive(band)         — lock the set as history. dd_setlist_set already refuses
--                                        to overwrite an archived set (see dd_roster_setlist.sql).
--   • dd_event_media (table + RPCs)    — audio/photo/video URLs bound to (band, event[, song]);
--                                        the permanent record every fan's ticket inherits, any device.
--
-- Clients: ticket.html (archiveShow, per-song audio) + dd_setlist.js (archive). PRESENTATION/record
-- data — NOT the secure ticket. The HMAC ticket security (19/20) is untouched. Idempotent, RLS on,
-- SECURITY DEFINER RPCs. Requires dd_roster_setlist.sql first. Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---- lock the setlist as permanent history --------------------------------
drop function if exists public.dd_setlist_archive(text);
create or replace function public.dd_setlist_archive(p_band_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text; r public.dd_setlist;
begin
  v_slug := btrim(lower(coalesce(p_band_slug, '')));
  if v_slug = '' then return jsonb_build_object('ok', false, 'reason', 'key'); end if;
  update public.dd_setlist set archived = true, updated_at = now()
     where band_slug = v_slug returning * into r;
  if r.band_slug is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'archived', true);
end $$;

-- ---- the night's media (audio / photos), bound to the event ---------------
create table if not exists public.dd_event_media (
  id          uuid primary key default gen_random_uuid(),
  band_slug   text not null,
  event_key   text not null,
  song        text,                            -- optional: ties an audio track to a specific song
  kind        text not null default 'audio',   -- 'audio' | 'photo' | 'video'
  url         text not null,                   -- a hosted URL (from the storage bucket), NOT a file blob
  caption     text,
  created_at  timestamptz not null default now()
);
create index if not exists dd_event_media_idx on public.dd_event_media (band_slug, event_key, created_at);
alter table public.dd_event_media enable row level security;   -- default-deny; access via the definer RPCs

-- bind a media URL. For per-song audio, replaces the prior track for that song. Returns the row.
drop function if exists public.dd_event_media_set(text, text, text, text, text, text);
create or replace function public.dd_event_media_set(
  p_band_slug text, p_event_key text, p_song text, p_kind text, p_url text, p_caption text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_b text; v_e text; v_song text; v_kind text; r public.dd_event_media;
begin
  v_b := btrim(lower(coalesce(p_band_slug, ''))); v_e := btrim(coalesce(p_event_key, ''));
  if v_b = '' or v_e = '' or btrim(coalesce(p_url, '')) = '' then return jsonb_build_object('ok', false, 'reason', 'key'); end if;
  if length(coalesce(p_url, '')) > 4000 then return jsonb_build_object('ok', false, 'reason', 'url_too_long'); end if;  -- a URL, not a blob
  v_song := nullif(btrim(coalesce(p_song, '')), '');
  v_kind := (case when lower(coalesce(p_kind, 'audio')) in ('photo', 'video') then lower(p_kind) else 'audio' end);
  if v_song is not null then   -- one track per (song, kind): replace the old one
    delete from public.dd_event_media where band_slug = v_b and event_key = v_e and song = v_song and kind = v_kind;
  end if;
  insert into public.dd_event_media(band_slug, event_key, song, kind, url, caption)
  values (v_b, v_e, v_song, v_kind, btrim(p_url), nullif(btrim(coalesce(p_caption, '')), ''))
  returning * into r;
  return to_jsonb(r);
end $$;

-- list an event's bound media (ordered) → jsonb array
drop function if exists public.dd_event_media_list(text, text);
create or replace function public.dd_event_media_list(p_band_slug text, p_event_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)
    from public.dd_event_media m
   where m.band_slug = btrim(lower(coalesce(p_band_slug, '')))
     and m.event_key = btrim(coalesce(p_event_key, ''));
$$;

grant execute on function public.dd_setlist_archive(text)                                 to anon, authenticated, service_role;
grant execute on function public.dd_event_media_set(text, text, text, text, text, text)   to anon, authenticated, service_role;
grant execute on function public.dd_event_media_list(text, text)                          to anon, authenticated, service_role;

-- ============================================================================
-- SMOKE TEST:
--   select public.dd_setlist_set('grateful-dead','Grateful Dead','["Ripple","Sugaree"]'::jsonb, null, null);
--   select public.dd_setlist_archive('grateful-dead');                 -- {ok:true, archived:true}
--   select public.dd_setlist_set('grateful-dead','Grateful Dead','["Changed"]'::jsonb, null, null);  -- refused (locked)
--   select public.dd_setlist_get('grateful-dead');                     -- still Ripple/Sugaree, archived:true
--   select public.dd_event_media_set('grateful-dead','cornell-77-05-08','Morning Dew','audio','https://cdn/x.mp3',null);
--   select public.dd_event_media_list('grateful-dead','cornell-77-05-08');
-- ============================================================================
