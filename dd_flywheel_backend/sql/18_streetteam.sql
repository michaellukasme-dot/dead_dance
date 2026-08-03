-- ============================================================================
-- 18_streetteam.sql — the per-FESTIVAL STREET-TEAM spine.
--
-- A festival's Street Team is the crowdsourced recruiting layer: heads who opt in,
-- work the crowd (seed bands, phone-to-phone the free ticket, log their hours), and
-- earn COOKIES. A daily cookie contest ranks the top 3 each day — the whole point is
-- to make the recruiting fun and competitive, so the map grows on its own.
--
-- House style (matches 14_datamodule / 15_citymap / 17_truth_spine):
--   • create-or-replace, idempotent, safe to re-run.
--   • RLS ON on every table; NO direct table grants — all access via SECURITY DEFINER RPCs.
--   • set search_path = public; on-conflict upserts; grant execute to anon, authenticated, service_role.
--   • drop function if exists before each create (prod may still hold an older signature).
--   • NO PII — member ids only, never names/phones. lat/lng are optional activity context, not identity.
-- ============================================================================


-- 1) one row per (festival, member) — the roster + the cookie balance -----------
create table if not exists public.dd_st_member (
  festival_slug text not null,
  member_id     text not null,                     -- opaque local id (dd.st.me); NEVER a name/phone
  joined_at     timestamptz not null default now(),
  cookies       integer not null default 0,        -- lifetime cookies earned
  last_seen     timestamptz not null default now(),
  primary key (festival_slug, member_id)
);
alter table public.dd_st_member enable row level security;   -- no direct table access; only the RPCs below

-- 2) the full activity log — every move a member makes -------------------------
--    kind: join | stage | dwell | task | cookie | phoneshare | hours
create table if not exists public.dd_st_log (
  id            bigserial primary key,
  festival_slug text not null,
  member_id     text not null,
  kind          text not null,
  ref           text,                              -- stage name, task id, etc. (no PII)
  lat           double precision,
  lng           double precision,
  secs          integer,                           -- dwell seconds, hours*?, or cookie increment amount
  at            timestamptz not null default now()
);
alter table public.dd_st_log enable row level security;
create index if not exists dd_st_log_fest_member on public.dd_st_log(festival_slug, member_id, kind);
create index if not exists dd_st_log_fest_day    on public.dd_st_log(festival_slug, kind, at);


-- 3) sf_st_join — opt in (or refresh) a member; log the join; return the balance
drop function if exists public.sf_st_join(text, text);
create or replace function public.sf_st_join(p_festival text, p_member text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_fest text; v_mem text; v_cookies integer;
begin
  v_fest := lower(btrim(coalesce(p_festival, '')));
  v_mem  := btrim(coalesce(p_member, ''));
  if v_fest = '' or v_mem = '' then
    return jsonb_build_object('ok', false, 'err', 'festival and member required');
  end if;

  insert into public.dd_st_member(festival_slug, member_id, joined_at, last_seen)
    values (v_fest, v_mem, now(), now())
    on conflict (festival_slug, member_id) do update
      set last_seen = now();

  insert into public.dd_st_log(festival_slug, member_id, kind, ref)
    values (v_fest, v_mem, 'join', null);

  select cookies into v_cookies from public.dd_st_member
    where festival_slug = v_fest and member_id = v_mem;

  return jsonb_build_object('ok', true, 'festival', v_fest, 'member', v_mem,
                            'cookies', coalesce(v_cookies, 0));
end $$;


-- 4) sf_st_log — record one activity row. kind='cookie' also increments the balance.
drop function if exists public.sf_st_log(text, text, text, text, double precision, double precision, integer);
create or replace function public.sf_st_log(
  p_festival text, p_member text, p_kind text, p_ref text,
  p_lat double precision, p_lng double precision, p_secs integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_fest text; v_mem text; v_kind text; v_inc integer; v_cookies integer;
begin
  v_fest := lower(btrim(coalesce(p_festival, '')));
  v_mem  := btrim(coalesce(p_member, ''));
  v_kind := lower(btrim(coalesce(p_kind, '')));
  if v_fest = '' or v_mem = '' or v_kind = '' then
    return jsonb_build_object('ok', false, 'err', 'festival, member, kind required');
  end if;

  -- ensure the member exists (a log can arrive before an explicit join)
  insert into public.dd_st_member(festival_slug, member_id, joined_at, last_seen)
    values (v_fest, v_mem, now(), now())
    on conflict (festival_slug, member_id) do update set last_seen = now();

  insert into public.dd_st_log(festival_slug, member_id, kind, ref, lat, lng, secs)
    values (v_fest, v_mem, v_kind, nullif(btrim(coalesce(p_ref,'')),''), p_lat, p_lng, p_secs);

  if v_kind = 'cookie' then
    v_inc := coalesce(p_secs, 1);
    update public.dd_st_member
      set cookies = cookies + v_inc, last_seen = now()
      where festival_slug = v_fest and member_id = v_mem
      returning cookies into v_cookies;
  else
    select cookies into v_cookies from public.dd_st_member
      where festival_slug = v_fest and member_id = v_mem;
  end if;

  return jsonb_build_object('ok', true, 'cookies', coalesce(v_cookies, 0));
end $$;


-- 5) sf_st_me — one member's live stats (cookies, joined, phone-shares, stages, dwell, today's rank)
drop function if exists public.sf_st_me(text, text);
create or replace function public.sf_st_me(p_festival text, p_member text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_fest text; v_mem text;
  v_cookies integer; v_joined timestamptz;
  v_phones integer; v_stages integer; v_dwell integer;
  v_today integer; v_rank integer;
begin
  v_fest := lower(btrim(coalesce(p_festival, '')));
  v_mem  := btrim(coalesce(p_member, ''));
  if v_fest = '' or v_mem = '' then
    return jsonb_build_object('ok', false, 'err', 'festival and member required');
  end if;

  select cookies, joined_at into v_cookies, v_joined
    from public.dd_st_member where festival_slug = v_fest and member_id = v_mem;
  if v_joined is null then
    return jsonb_build_object('ok', false, 'err', 'not a member');
  end if;

  select count(*) into v_phones from public.dd_st_log
    where festival_slug = v_fest and member_id = v_mem and kind = 'phoneshare';
  select count(distinct ref) into v_stages from public.dd_st_log
    where festival_slug = v_fest and member_id = v_mem and kind = 'stage' and ref is not null;
  select coalesce(sum(secs),0) into v_dwell from public.dd_st_log
    where festival_slug = v_fest and member_id = v_mem and kind = 'dwell';

  -- today's cookies for THIS member (the contest metric)
  select coalesce(sum(coalesce(secs,1)),0) into v_today from public.dd_st_log
    where festival_slug = v_fest and member_id = v_mem
      and kind = 'cookie' and at::date = current_date;

  -- today's rank = 1 + number of members who earned MORE cookies today
  select 1 + count(*) into v_rank from (
    select member_id, sum(coalesce(secs,1)) as c
      from public.dd_st_log
      where festival_slug = v_fest and kind = 'cookie' and at::date = current_date
      group by member_id
      having sum(coalesce(secs,1)) > v_today
  ) more;

  return jsonb_build_object(
    'ok', true,
    'cookies', coalesce(v_cookies, 0),
    'joined_at', v_joined,
    'phones_shared', coalesce(v_phones, 0),
    'stages', coalesce(v_stages, 0),
    'dwell_secs', coalesce(v_dwell, 0),
    'today_cookies', coalesce(v_today, 0),
    'rank', v_rank
  );
end $$;


-- 6) sf_st_leaderboard — top 3 members BY cookies earned TODAY (member ids only)
drop function if exists public.sf_st_leaderboard(text);
create or replace function public.sf_st_leaderboard(p_festival text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_fest text; v_out jsonb;
begin
  v_fest := lower(btrim(coalesce(p_festival, '')));
  if v_fest = '' then return jsonb_build_array(); end if;

  select coalesce(jsonb_agg(jsonb_build_object('member', member_id, 'cookies', c) order by c desc, member_id asc), '[]'::jsonb)
    into v_out
  from (
    select member_id, sum(coalesce(secs,1)) as c
      from public.dd_st_log
      where festival_slug = v_fest and kind = 'cookie' and at::date = current_date
      group by member_id
      order by c desc, member_id asc
      limit 3
  ) top;

  return coalesce(v_out, '[]'::jsonb);
end $$;


grant execute on function public.sf_st_join(text, text)                                                            to anon, authenticated, service_role;
grant execute on function public.sf_st_log(text, text, text, text, double precision, double precision, integer)    to anon, authenticated, service_role;
grant execute on function public.sf_st_me(text, text)                                                              to anon, authenticated, service_role;
grant execute on function public.sf_st_leaderboard(text)                                                           to anon, authenticated, service_role;


-- ============================================================================
-- SMOKE TEST (commented — paste into the SQL editor after running the file above)
-- ============================================================================
-- select public.sf_st_join('musikfest-2026', 'st-abc123');                          -- {ok, festival, member, cookies:0}
-- select public.sf_st_log('musikfest-2026','st-abc123','stage','Volksplatz',40.61,-75.38,null);
-- select public.sf_st_log('musikfest-2026','st-abc123','phoneshare',null,null,null,null);
-- select public.sf_st_log('musikfest-2026','st-abc123','dwell','Volksplatz',null,null,120);
-- select public.sf_st_log('musikfest-2026','st-abc123','cookie','seed',null,null,10);  -- +10 cookies
-- select public.sf_st_log('musikfest-2026','st-abc123','cookie','share',null,null,null); -- +1 cookie
-- select public.sf_st_me('musikfest-2026','st-abc123');   -- cookies:11, stages:1, phones_shared:1, dwell_secs:120, today_cookies:11, rank:1
-- select public.sf_st_leaderboard('musikfest-2026');      -- [{member:'st-abc123', cookies:11}]
-- ============================================================================
