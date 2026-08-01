-- dd_cornerverify — the 4-corner GPS verification spine.
-- Crew phones submit corner readings (distributed); the organizer finalizes to a verified center.
-- Client (dd_cornerverify.js) is local-first + guarded. Idempotent — safe to re-run.

-- ---- raw corner readings (one row per pin+corner; resubmit updates) ----
create table if not exists public.dd_verify_corner (
  pin        text not null,
  corner     text not null,
  lat        double precision not null,
  lng        double precision not null,
  dwell_ms   bigint not null default 0,
  by_crew    text,
  updated_at timestamptz not null default now(),
  primary key (pin, corner)
);
alter table public.dd_verify_corner enable row level security;

-- ---- the finalized verified coordinate for a pin ----
create table if not exists public.dd_verify_result (
  pin         text primary key,
  lat         double precision not null,
  lng         double precision not null,
  spread_m    double precision,
  quality     text,
  verified_at timestamptz not null default now()
);
alter table public.dd_verify_result enable row level security;

-- Submit / update a corner reading (a phone standing on a corner).
create or replace function public.sf_verify_submit(p_pin text, p_corner text, p_lat double precision, p_lng double precision, p_dwell bigint, p_by text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.dd_verify_corner(pin, corner, lat, lng, dwell_ms, by_crew, updated_at)
    values (btrim(p_pin), btrim(p_corner), p_lat, p_lng, coalesce(p_dwell,0), nullif(p_by,''), now())
    on conflict (pin, corner) do update set lat=excluded.lat, lng=excluded.lng, dwell_ms=excluded.dwell_ms, by_crew=excluded.by_crew, updated_at=now();
  return jsonb_build_object('pin', btrim(p_pin), 'corner', btrim(p_corner), 'ok', true);
end $$;

-- List a pin's corners (organizer pulls crew submissions to finalize; also live cross-device status).
create or replace function public.sf_verify_corners(p_pin text)
returns table(corner text, lat double precision, lng double precision, dwell_ms bigint, by text, updated_at timestamptz)
language sql security definer set search_path=public as $$
  select corner, lat, lng, dwell_ms, by_crew as by, updated_at from public.dd_verify_corner where pin=btrim(p_pin) order by corner;
$$;

-- Write the finalized verified center for a pin (idempotent upsert).
create or replace function public.sf_verify_set(p_pin text, p_lat double precision, p_lng double precision, p_spread double precision, p_quality text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.dd_verify_result(pin, lat, lng, spread_m, quality, verified_at)
    values (btrim(p_pin), p_lat, p_lng, p_spread, p_quality, now())
    on conflict (pin) do update set lat=excluded.lat, lng=excluded.lng, spread_m=excluded.spread_m, quality=excluded.quality, verified_at=now();
  return jsonb_build_object('pin', btrim(p_pin), 'ok', true);
end $$;

grant execute on function public.sf_verify_submit(text, text, double precision, double precision, bigint, text) to anon, authenticated;
grant execute on function public.sf_verify_corners(text)                                                        to anon, authenticated;
grant execute on function public.sf_verify_set(text, double precision, double precision, double precision, text) to anon, authenticated;
