-- dd_genrepack — the GENRE CONTENT-PACK spine (Karaokeplatz schedule + play telemetry).
-- Client (dd_genrepack.js) is local-first + guarded; content packs live in the client.
-- The spine only persists (a) the Karaokeplatz nightly-genre SCHEDULE and (b) an ids-only
-- play log. Idempotent — safe to re-run. Matches the house guard pattern (security definer).

-- ---- Karaokeplatz schedule: one row per festival+stage+night → the night's genre ----
create table if not exists public.dd_genre_night (
  festival    text not null,
  stage       text not null default 'Karaokeplatz',
  night_date  date not null,
  genre       text not null,
  updated_at  timestamptz not null default now(),
  primary key (festival, stage, night_date)
);
alter table public.dd_genre_night enable row level security;
create index if not exists dd_genre_night_fest on public.dd_genre_night(festival, stage);

-- ---- play log: ids + counts only, NO PII (which genre/game got played) ----
create table if not exists public.dd_genre_play (
  id      bigserial primary key,
  fan_id  text,
  genre   text,
  game    text,          -- 'karaoke' | 'trivia' | 'games'
  at      timestamptz not null default now()
);
alter table public.dd_genre_play enable row level security;
create index if not exists dd_genre_play_g on public.dd_genre_play(genre, game);

-- Set (upsert) one night of the schedule. Owner-driven; guarded client only calls when signed.
create or replace function public.sf_genre_schedule_set(p_festival text, p_stage text, p_date date, p_genre text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if coalesce(btrim(p_festival),'')='' or p_date is null or coalesce(btrim(p_genre),'')='' then
    return jsonb_build_object('ok', false, 'err', 'festival, date, genre required');
  end if;
  insert into public.dd_genre_night(festival, stage, night_date, genre, updated_at)
    values (btrim(p_festival), coalesce(nullif(btrim(p_stage),''),'Karaokeplatz'), p_date, lower(btrim(p_genre)), now())
    on conflict (festival, stage, night_date) do update set genre=excluded.genre, updated_at=now();
  return jsonb_build_object('ok', true, 'festival', btrim(p_festival), 'date', p_date, 'genre', lower(btrim(p_genre)));
end $$;

-- Read a stage's schedule (public read; fans see tonight's genre).
create or replace function public.sf_genre_schedule_get(p_festival text, p_stage text)
returns table(night_date date, genre text) language sql security definer set search_path=public as $$
  select night_date, genre from public.dd_genre_night
   where festival = btrim(p_festival)
     and stage = coalesce(nullif(btrim(p_stage),''),'Karaokeplatz')
   order by night_date;
$$;

-- Log a play (ids only; NO PII). Fire-and-forget from the tent page.
create or replace function public.sf_genre_play_log(p_fan text, p_genre text, p_game text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.dd_genre_play(fan_id, genre, game, at)
    values (nullif(btrim(p_fan),''), lower(nullif(btrim(p_genre),'')), nullif(btrim(p_game),''), now());
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.sf_genre_schedule_set(text,text,date,text) to anon, authenticated, service_role;
grant execute on function public.sf_genre_schedule_get(text,text)            to anon, authenticated, service_role;
grant execute on function public.sf_genre_play_log(text,text,text)           to anon, authenticated, service_role;
