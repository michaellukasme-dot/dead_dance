-- dd_recurring — the RECURRING EVENT container spine.
-- One row per SERIES (Joe's Tuesday Karaoke, MusikFest annual, a monthly market). The client
-- (dd_recurring.js) spawns each edition's INSTANCE locally from these fields — the spine just
-- persists the series so it survives devices and feeds CRM Venue Sales + the Data Module.
-- Idempotent, guarded, security-definer (house pattern).

create table if not exists public.dd_recurring_series (
  id            text primary key,
  title         text not null default 'Recurring Night',
  venue         text,
  city          text,
  cadence       text not null default 'weekly',    -- weekly | monthly | annual
  weekday       smallint,                          -- 0..6 (weekly)
  anchor        text,                              -- 'MM-DD' (annual)
  day_of_month  smallint,                          -- 1..28 (monthly)
  start_time    text,
  kind          text,                              -- karaoke | trivia | band | festival …
  genre         text,
  cover         integer not null default 0,        -- 0 = free
  days          smallint not null default 1,       -- multi-day span (festivals)
  updated_at    timestamptz not null default now()
);
alter table public.dd_recurring_series enable row level security;
create index if not exists dd_recurring_venue on public.dd_recurring_series(city, kind);

-- Upsert a series (owner-driven; guarded client only calls when appropriate).
create or replace function public.sf_recurring_set(
  p_id text, p_title text, p_venue text, p_city text, p_cadence text, p_weekday int,
  p_anchor text, p_day_of_month int, p_time text, p_kind text, p_genre text, p_cover int, p_days int)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if coalesce(btrim(p_id),'')='' then return jsonb_build_object('ok', false, 'err', 'id required'); end if;
  insert into public.dd_recurring_series(id,title,venue,city,cadence,weekday,anchor,day_of_month,start_time,kind,genre,cover,days,updated_at)
    values (btrim(p_id), coalesce(nullif(btrim(p_title),''),'Recurring Night'), nullif(btrim(p_venue),''), nullif(btrim(p_city),''),
            coalesce(nullif(btrim(p_cadence),''),'weekly'), p_weekday, nullif(btrim(p_anchor),''), p_day_of_month,
            nullif(btrim(p_time),''), nullif(btrim(p_kind),''), nullif(btrim(p_genre),''), coalesce(p_cover,0), greatest(1,coalesce(p_days,1)), now())
    on conflict (id) do update set title=excluded.title, venue=excluded.venue, city=excluded.city, cadence=excluded.cadence,
      weekday=excluded.weekday, anchor=excluded.anchor, day_of_month=excluded.day_of_month, start_time=excluded.start_time,
      kind=excluded.kind, genre=excluded.genre, cover=excluded.cover, days=excluded.days, updated_at=now();
  return jsonb_build_object('ok', true, 'id', btrim(p_id));
end $$;

-- Read series (by city — the local chapter's recurring nights; the Venue Sales CRM view).
create or replace function public.sf_recurring_get(p_city text)
returns setof public.dd_recurring_series language sql security definer set search_path=public as $$
  select * from public.dd_recurring_series
   where p_city is null or lower(city)=lower(btrim(p_city))
   order by cadence, kind, title;
$$;

grant execute on function public.sf_recurring_set(text,text,text,text,text,int,text,int,text,text,text,int,int) to anon, authenticated, service_role;
grant execute on function public.sf_recurring_get(text)                                                        to anon, authenticated, service_role;
