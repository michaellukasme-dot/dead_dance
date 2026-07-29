-- dd_setlist_crowd — fan-crowdsourced setlist: the GAP filler when a band doesn't log its own set.
-- Band authority is enforced CLIENT-side (this layer NEVER overwrites a band setlist). Here we only
-- durably store fan contributions and return per-song consensus (distinct fans). Idempotent — safe to re-run.
-- Until this is run, the crowd layer works fully client-side (localStorage) and these calls silently no-op.

create table if not exists public.dd_setlist_crowd (
  id          bigint generated always as identity primary key,
  band_slug   text not null,
  show_date   text not null default '',
  song        text not null,
  song_norm   text not null,
  fan_id      text not null,
  created_at  timestamptz not null default now(),
  unique (band_slug, show_date, song_norm, fan_id)   -- one fan, one vote per song → real consensus, no stuffing
);
alter table public.dd_setlist_crowd enable row level security;   -- no direct table access; only the RPCs below

-- A fan adds a song (idempotent per fan+song). Returns the song's distinct-fan consensus count.
create or replace function public.dd_setlist_fan_add(p_band text, p_show text, p_song text, p_fan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_norm text; v_fans int;
begin
  p_show := coalesce(p_show, ''); p_fan := coalesce(nullif(p_fan, ''), 'anon');
  if coalesce(btrim(p_song), '') = '' then return jsonb_build_object('song', p_song, 'fans', 0); end if;
  v_norm := btrim(lower(regexp_replace(p_song, '[^a-z0-9]+', ' ', 'g')));
  insert into public.dd_setlist_crowd(band_slug, show_date, song, song_norm, fan_id)
    values (lower(btrim(p_band)), p_show, btrim(p_song), v_norm, p_fan)
    on conflict (band_slug, show_date, song_norm, fan_id) do nothing;
  select count(distinct fan_id) into v_fans from public.dd_setlist_crowd
    where band_slug = lower(btrim(p_band)) and show_date = p_show and song_norm = v_norm;
  return jsonb_build_object('song', btrim(p_song), 'fans', coalesce(v_fans, 0));
end $$;

-- The crowd setlist: each distinct song + its consensus (distinct fans), most-agreed first.
create or replace function public.dd_setlist_crowd_get(p_band text, p_show text)
returns table(song text, fans bigint) language sql security definer set search_path = public as $$
  select (array_agg(song order by created_at))[1] as song, count(distinct fan_id) as fans
  from public.dd_setlist_crowd
  where band_slug = lower(btrim(p_band)) and show_date = coalesce(p_show, '')
  group by song_norm
  order by count(distinct fan_id) desc, min(created_at) asc;
$$;

grant execute on function public.dd_setlist_fan_add(text, text, text, text) to anon, authenticated;
grant execute on function public.dd_setlist_crowd_get(text, text) to anon, authenticated;

-- smoke test (uncomment to run):
-- select public.dd_setlist_fan_add('rift','2026-07-30','Tweezer','fan-1');
-- select public.dd_setlist_fan_add('rift','2026-07-30','tweezer!','fan-2');   -- same song, 2nd fan → consensus 2
-- select * from public.dd_setlist_crowd_get('rift','2026-07-30');             -- Tweezer, fans = 2
