-- dd_citymap — the CITY WALKING MAP spine.
-- A city claims its downtown corridor, sets active hours, and gets a QR/map link to post
-- on its own website. Merchants along the corridor buy proximity ad slots (ad revenue funds
-- the city's subscription). Mirrors the dd_festival / dd_fair claim rails. Idempotent, guarded.

-- 1) the city + its corridor + configured active hours ----------------------------
create table if not exists public.dd_city (
  slug         text primary key,
  name         text not null default 'Downtown',
  state        text,
  corridor     jsonb not null default '[]'::jsonb,   -- [[lat,lng],...] the ~1-mile Main St line/polygon
  center       jsonb,                                -- [lat,lng]
  open_min     integer not null default 540,         -- 09:00
  close_min    integer not null default 1380,        -- 23:00
  active_days  integer[] not null default '{0,1,2,3,4,5,6}',  -- 0=Sun … 6=Sat
  ads_enabled  boolean not null default true,
  owner_token  text,
  claim_code   text,
  claimed      boolean not null default false,
  claimed_email text,
  published    boolean not null default false,
  updated_at   timestamptz not null default now()
);
alter table public.dd_city enable row level security;

-- 2) merchant proximity ad slots along the corridor -------------------------------
create table if not exists public.dd_city_ad (
  id          bigserial primary key,
  city_slug   text not null references public.dd_city(slug) on delete cascade,
  merchant    text not null,
  lat         double precision, lng double precision,
  headline    text,
  cta_url     text,
  status      text not null default 'new',   -- new | live | paused
  at          timestamptz not null default now()
);
alter table public.dd_city_ad enable row level security;
create index if not exists dd_city_ad_slug on public.dd_city_ad(city_slug, status);

-- helper: centroid of a corridor jsonb array
create or replace function public.dd__corridor_center(p_corridor jsonb)
returns jsonb language sql immutable as $$
  select case when jsonb_array_length(coalesce(p_corridor,'[]'::jsonb))=0 then null
    else jsonb_build_array(
      (select avg((e->>0)::double precision) from jsonb_array_elements(p_corridor) e),
      (select avg((e->>1)::double precision) from jsonb_array_elements(p_corridor) e)) end;
$$;

-- create/claim a city → returns an owner token (mirrors dd_fair_claim)
-- First-come claim. If a city is ALREADY claimed, reject and NEVER return the existing token
-- (that was the takeover bug). Race-safe via a conditional on-conflict update.
create or replace function public.sf_city_claim(p_slug text, p_claim_code text, p_email text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_slug text; v_existing text; v_tok text;
begin
  v_slug := lower(btrim(coalesce(p_slug,'')));
  if v_slug='' then return jsonb_build_object('ok',false,'err','slug required'); end if;

  select owner_token into v_existing from public.dd_city where slug=v_slug;
  if v_existing is not null then
    return jsonb_build_object('ok', false, 'err', 'already claimed');   -- do NOT hand back the owner's token
  end if;

  v_tok := encode(gen_random_bytes(16),'hex');
  insert into public.dd_city(slug, name, owner_token, claimed, claimed_email, updated_at)
    values (v_slug, initcap(replace(v_slug,'-',' ')), v_tok, true, nullif(btrim(p_email),''), now())
    on conflict (slug) do update
       set owner_token=v_tok, claimed=true,
           claimed_email=coalesce(nullif(btrim(p_email),''), dd_city.claimed_email), updated_at=now()
     where dd_city.owner_token is null;                                 -- race guard: only if still unclaimed

  select owner_token into v_existing from public.dd_city where slug=v_slug;
  if v_existing is distinct from v_tok then
    return jsonb_build_object('ok', false, 'err', 'already claimed');   -- lost a claim race
  end if;
  return jsonb_build_object('ok', true, 'slug', v_slug, 'owner_token', v_tok);
end $$;

-- save the corridor + hours (token-gated write)
create or replace function public.sf_city_save(p_slug text, p_token text, p_name text, p_state text,
  p_corridor jsonb, p_open int, p_close int, p_days int[], p_ads boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_owner text;
begin
  select owner_token into v_owner from public.dd_city where slug=lower(btrim(p_slug));
  if v_owner is not null and (p_token is null or p_token <> v_owner) then
    return jsonb_build_object('ok', false, 'err', 'owner token required — this city is already claimed');
  end if;
  insert into public.dd_city(slug, name, state, corridor, center, open_min, close_min, active_days, ads_enabled, owner_token, updated_at)
    values (lower(btrim(p_slug)), coalesce(nullif(btrim(p_name),''),'Downtown'), nullif(btrim(p_state),''),
            coalesce(p_corridor,'[]'::jsonb), dd__corridor_center(p_corridor),
            coalesce(p_open,540), coalesce(p_close,1380), coalesce(p_days,'{0,1,2,3,4,5,6}'), coalesce(p_ads,true),
            coalesce(p_token, encode(gen_random_bytes(16),'hex')), now())
    on conflict (slug) do update set name=excluded.name, state=excluded.state, corridor=excluded.corridor,
      center=excluded.center, open_min=excluded.open_min, close_min=excluded.close_min,
      active_days=excluded.active_days, ads_enabled=excluded.ads_enabled, updated_at=now();
  return jsonb_build_object('ok', true, 'slug', lower(btrim(p_slug)));
end $$;

-- public read (the QR / website link resolves through this)
create or replace function public.sf_city_get(p_slug text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  select jsonb_build_object('slug',slug,'name',name,'state',state,'corridor',corridor,'center',center,
    'open_min',open_min,'close_min',close_min,'active_days',active_days,'ads_enabled',ads_enabled,'published',published)
    into v from public.dd_city where slug=lower(btrim(p_slug));
  return coalesce(v, jsonb_build_object('err','not found'));
end $$;

-- publish / unpublish (owner)
create or replace function public.sf_city_publish(p_slug text, p_token text, p_published boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_owner text;
begin
  select owner_token into v_owner from public.dd_city where slug=lower(btrim(p_slug));
  if v_owner is null or p_token is null or v_owner <> p_token then return jsonb_build_object('ok',false,'err','owner only'); end if;
  update public.dd_city set published=coalesce(p_published,true), updated_at=now() where slug=lower(btrim(p_slug));
  return jsonb_build_object('ok', true, 'published', coalesce(p_published,true));
end $$;

-- a merchant requests a proximity ad slot (Stripe parked → capture intent)
create or replace function public.sf_city_ad_buy(p_slug text, p_merchant text, p_headline text, p_url text, p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id bigint;
begin
  if coalesce(btrim(p_merchant),'')='' then return jsonb_build_object('ok',false,'err','merchant required'); end if;
  insert into public.dd_city_ad(city_slug, merchant, headline, cta_url, lat, lng)
    values (lower(btrim(p_slug)), btrim(p_merchant), nullif(btrim(p_headline),''), nullif(btrim(p_url),''), p_lat, p_lng)
    returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

grant execute on function public.sf_city_claim(text,text,text)                                            to anon, authenticated, service_role;
grant execute on function public.sf_city_save(text,text,text,text,jsonb,int,int,int[],boolean)            to anon, authenticated, service_role;
grant execute on function public.sf_city_get(text)                                                        to anon, authenticated, service_role;
grant execute on function public.sf_city_publish(text,text,boolean)                                       to anon, authenticated, service_role;
grant execute on function public.sf_city_ad_buy(text,text,text,text,double precision,double precision)    to anon, authenticated, service_role;
