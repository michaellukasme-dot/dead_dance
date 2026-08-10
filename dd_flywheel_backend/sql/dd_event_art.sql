-- ============================================================================
-- dd_event_art.sql — server-persist the band's ticket ART (the hero image).
--
-- Closes the one honest gap in Phase 4: the poster/flyer a band uploads to its ticket used to
-- live only in one device's localStorage. Now it persists server-side, keyed to (band, event),
-- so EVERY fan's ticket for that show inherits the same art on any device.
--
-- Client: ticket.html (art upload + load). PRESENTATION data — NOT the secure ticket. The HMAC
-- ticket security (19/20) is untouched. House style: idempotent, RLS on, SECURITY DEFINER RPCs.
-- Safe to re-run.
-- ============================================================================

create table if not exists public.dd_event_art (
  band_slug   text not null,
  event_key   text not null,          -- the event slug, or the show date — matches ticket.html artKey()
  art         text,                   -- a data: URL (or a hosted URL). Capped in the setter below.
  updated_at  timestamptz not null default now(),
  primary key (band_slug, event_key)
);
alter table public.dd_event_art enable row level security;   -- default-deny; access via the definer RPCs

-- set / replace the art for (band, event). ~3MB cap guards against abuse. Upsert.
drop function if exists public.dd_event_art_set(text, text, text);
create or replace function public.dd_event_art_set(p_band_slug text, p_event_key text, p_art text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_b text; v_e text;
begin
  v_b := btrim(lower(coalesce(p_band_slug, ''))); v_e := btrim(coalesce(p_event_key, ''));
  if v_b = '' or v_e = '' then return jsonb_build_object('ok', false, 'reason', 'key'); end if;
  if length(coalesce(p_art, '')) > 3000000 then return jsonb_build_object('ok', false, 'reason', 'too_large'); end if;
  insert into public.dd_event_art(band_slug, event_key, art, updated_at)
  values (v_b, v_e, p_art, now())
  on conflict (band_slug, event_key) do update set art = excluded.art, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- get the art for (band, event) → the stored string, or null
drop function if exists public.dd_event_art_get(text, text);
create or replace function public.dd_event_art_get(p_band_slug text, p_event_key text)
returns text language sql stable security definer set search_path = public as $$
  select art from public.dd_event_art
   where band_slug = btrim(lower(coalesce(p_band_slug, '')))
     and event_key = btrim(coalesce(p_event_key, ''));
$$;

grant execute on function public.dd_event_art_set(text, text, text) to anon, authenticated, service_role;
grant execute on function public.dd_event_art_get(text, text)       to anon, authenticated, service_role;

-- ============================================================================
-- SMOKE TEST:
--   select public.dd_event_art_set('grateful-dead','karnival-of-the-arts-2026','data:image/png;base64,iVBORw0KGgo=');
--   select public.dd_event_art_get('grateful-dead','karnival-of-the-arts-2026');   -- → the data URL
-- ============================================================================
