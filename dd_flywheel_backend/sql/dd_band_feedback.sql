-- ============================================================================
-- dd_band_feedback.sql — FREE fan-feedback intelligence for the band.
--
-- Every fan's post-show rating, favorite part, and tip-intent (from Owsley on the ticket) flows here,
-- correlated to venue / festival / event. The band's agent (dd_bandagent.js → insights) reads the
-- aggregate: which venues & festivals rate highest, what fans loved, how much love (tips) each show drew.
-- We DON'T charge the band for this — it's the data exhaust of the ticket, handed back to help them book smarter.
--
-- No PII: a row is a rating + a favorite tag + a tip-intent amount, tied to band/venue/festival — never a fan id.
-- (Real tip MONEY stays on the counsel-gated payout rail; tip_cents here is engagement intent, not a charge.)
-- Idempotent, RLS on, SECURITY DEFINER RPCs. Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.dd_band_feedback (
  id          uuid primary key default gen_random_uuid(),
  band_slug   text not null,
  event_slug  text,
  venue       text,
  festival    text,
  rating      int,             -- 1..5, or null (a tip-only row)
  fav         text,            -- favorite-part tag, or null
  tip_cents   int not null default 0,   -- tip INTENT (engagement), not a real charge
  at          timestamptz not null default now()
);
create index if not exists dd_band_feedback_idx on public.dd_band_feedback (band_slug, at);
alter table public.dd_band_feedback enable row level security;   -- default-deny; access via the definer RPCs

-- a fan reports one datum (a tip, or a rating+favorite). Append-only. No fan identity is stored.
drop function if exists public.dd_band_feedback_log(text, text, text, text, int, text, int);
create or replace function public.dd_band_feedback_log(
  p_band text, p_event text, p_venue text, p_festival text, p_rating int, p_fav text, p_tip_cents int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_b text; v_r int;
begin
  v_b := btrim(lower(coalesce(p_band, ''))); if v_b = '' then return jsonb_build_object('ok', false); end if;
  v_r := case when p_rating between 1 and 5 then p_rating else null end;
  insert into public.dd_band_feedback(band_slug, event_slug, venue, festival, rating, fav, tip_cents)
  values (v_b, nullif(btrim(coalesce(p_event,'')),''), nullif(btrim(coalesce(p_venue,'')),''),
          nullif(btrim(coalesce(p_festival,'')),''), v_r, nullif(btrim(coalesce(p_fav,'')),''),
          greatest(0, coalesce(p_tip_cents, 0)));
  return jsonb_build_object('ok', true);
end $$;

-- the band's agent reads its intelligence: totals + best venues + best festivals + favorite-part tally.
drop function if exists public.dd_band_feedback_summary(text);
create or replace function public.dd_band_feedback_summary(p_band text)
returns jsonb language sql stable security definer set search_path = public as $$
  with f as (select * from public.dd_band_feedback where band_slug = btrim(lower(coalesce(p_band,''))))
  select jsonb_build_object(
    'shows',            (select count(*) from f),
    'avg_rating',       (select round(avg(rating)::numeric, 1) from f where rating is not null),
    'ratings',          (select count(*) from f where rating is not null),
    'tips_total_cents', (select coalesce(sum(tip_cents),0) from f),
    'best_venues',      (select coalesce(jsonb_agg(v order by v->>'avg' desc nulls last), '[]'::jsonb)
                           from (select jsonb_build_object('venue',venue,'n',count(*),
                                   'avg',round(avg(rating)::numeric,1),'tip_cents',sum(tip_cents)) v
                                 from f where venue is not null group by venue limit 10) t),
    'best_festivals',   (select coalesce(jsonb_agg(v order by v->>'avg' desc nulls last), '[]'::jsonb)
                           from (select jsonb_build_object('festival',festival,'n',count(*),
                                   'avg',round(avg(rating)::numeric,1),'tip_cents',sum(tip_cents)) v
                                 from f where festival is not null group by festival limit 10) t),
    'favorites',        (select coalesce(jsonb_agg(v order by v->>'n' desc), '[]'::jsonb)
                           from (select jsonb_build_object('fav',fav,'n',count(*)) v
                                 from f where fav is not null group by fav limit 8) t)
  );
$$;

grant execute on function public.dd_band_feedback_log(text, text, text, text, int, text, int) to anon, authenticated, service_role;
grant execute on function public.dd_band_feedback_summary(text)                                to anon, authenticated, service_role;

-- ============================================================================
-- SMOKE TEST:
--   select public.dd_band_feedback_log('grateful-dead','cornell-77','Barton Hall','', 5,'The jams 🎸', 500);
--   select public.dd_band_feedback_log('grateful-dead','cornell-77','Barton Hall','', 5,'A song 🎶', 0);
--   select public.dd_band_feedback_summary('grateful-dead');   -- avg 5.0, tips 500, best venue Barton Hall, favorites tally
-- ============================================================================
