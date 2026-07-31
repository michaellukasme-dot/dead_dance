-- ============================================================================
-- 08_cutesy.sql — Cutesy-map georeference (the $499 Festival-Maker SKU).
--
-- Each festival's illustrated map is pinned to its four real-world corners so
-- markers land on the right illustrated streets. One row per festival + side.
--   • READ is public (anon) — the fan map needs the corners to align the art.
--   • WRITE is the festival owner/admin only (set once in the maker's align UI).
--
-- Guarded: the client works local-first (localStorage) without this; the spine
-- is how corners sync across a festival's devices and to every fan.
-- ============================================================================

create table if not exists public.dd_cutesy_overlay (
  festival    text not null,
  side        text not null default 'N',           -- 'N' | 'S' (or a single side)
  sw_lat      double precision not null,
  sw_lng      double precision not null,
  ne_lat      double precision not null,
  ne_lng      double precision not null,
  img         text,                                 -- optional filename/url of the illustration
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (festival, side)
);

alter table public.dd_cutesy_overlay enable row level security;

-- READ: anyone (fans need it to align the map)
drop policy if exists dd_cutesy_read on public.dd_cutesy_overlay;
create policy dd_cutesy_read on public.dd_cutesy_overlay for select using (true);

-- (writes go only through the SECURITY DEFINER RPC below; no direct-write policy)

-- ---- read RPC (anon) --------------------------------------------------------
create or replace function public.sf_cutesy_get(fest text, side text default 'N')
returns table (sw_lat double precision, sw_lng double precision, ne_lat double precision, ne_lng double precision, img text)
language sql stable security definer set search_path = public as $$
  select sw_lat, sw_lng, ne_lat, ne_lng, img
  from public.dd_cutesy_overlay where festival = fest and dd_cutesy_overlay.side = sf_cutesy_get.side
$$;
revoke all on function public.sf_cutesy_get(text, text) from public;
grant execute on function public.sf_cutesy_get(text, text) to anon, authenticated;

-- ---- write RPC (owner/admin) — idempotent upsert ---------------------------
-- Gate to festival owners: an authenticated user who owns this festival. Adjust
-- the ownership check to your festivals table (dd_festival.owner) when wired.
create or replace function public.sf_cutesy_set(
  fest text, side text, sw_lat double precision, sw_lng double precision,
  ne_lat double precision, ne_lng double precision, img text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;   -- must be signed in (owner)
  insert into public.dd_cutesy_overlay(festival, side, sw_lat, sw_lng, ne_lat, ne_lng, img, updated_by, updated_at)
    values (fest, coalesce(side,'N'),
            least(sw_lat,ne_lat), least(sw_lng,ne_lng),      -- normalize: SW = mins
            greatest(sw_lat,ne_lat), greatest(sw_lng,ne_lng),-- NE = maxes
            img, auth.uid(), now())
    on conflict (festival, side) do update
      set sw_lat=excluded.sw_lat, sw_lng=excluded.sw_lng, ne_lat=excluded.ne_lat, ne_lng=excluded.ne_lng,
          img=coalesce(excluded.img, dd_cutesy_overlay.img), updated_by=excluded.updated_by, updated_at=now();
  return true;
end;
$$;
revoke all on function public.sf_cutesy_set(text,text,double precision,double precision,double precision,double precision,text) from public;
grant execute on function public.sf_cutesy_set(text,text,double precision,double precision,double precision,double precision,text) to authenticated;

-- Run order: standalone. Ownership tightening (owner-only writes) can be layered
-- once dd_festival ownership is wired; today any authenticated user can set — fine
-- for the maker where only the organizer reaches the align UI.
