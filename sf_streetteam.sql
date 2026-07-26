-- sf_streetteam.sql — the MusikFest STREET TEAM viral loop. Run ONCE. Re-runnable.
-- Loop: a street-teamer shows their QR → a new phone scans it → that person JOINS (credited to the teamer)
-- AND becomes a teamer themselves (self-propagating). 10 signups = free shirt (MusikFest pickup). After the
-- fest the program lives on as COOKIES: earn on every signup, redeem a shirt that routes to Jay to print+ship.

-- one credited signup per NEW device (referee is the PK → can only be credited once, to the first teamer).
create table if not exists public.sf_referral (
  referee    text primary key,               -- the new user's auth.uid()
  referrer   text not null,                   -- the teamer who brought them
  event      text default 'musikfest',
  created_at timestamptz not null default now()
);
create index if not exists sf_referral_by_referrer on public.sf_referral (referrer);

-- a teamer's running Cookie balance + free-shirt claim state.
create table if not exists public.sf_streeter (
  member       text primary key,             -- auth.uid()
  cookies      int  not null default 0,
  free_claimed boolean not null default false,
  handle       text,                          -- optional street name for the contest board
  joined       timestamptz not null default now()
);
alter table public.sf_streeter add column if not exists handle text;

-- shirt orders. kind: 'musikfest_free' (pickup) | 'cookies_ship' (Jay prints + ships).
create table if not exists public.sf_shirt_order (
  id         uuid primary key default gen_random_uuid(),
  member     text not null,
  kind       text not null,
  size       text,
  name       text,
  addr       text,
  dest       text not null default 'jay',
  status     text not null default 'requested',
  code       text,                             -- pickup code (free)
  created_at timestamptz not null default now()
);
alter table public.sf_shirt_order add column if not exists fulfilled_by text;
alter table public.sf_shirt_order add column if not exists fulfilled_at timestamptz;

-- a friendship between inviter and invitee — BOTH sides must confirm (a<b canonical).
create table if not exists public.sf_friend (
  a          text not null,
  b          text not null,
  a_ok       boolean not null default false,
  b_ok       boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (a, b)
);

alter table public.sf_referral    enable row level security;
alter table public.sf_streeter     enable row level security;
alter table public.sf_shirt_order  enable row level security;
alter table public.sf_friend       enable row level security;
-- reads go through the security-definer RPCs; no direct table policies (deny-by-default).

-- tuning
--   COOKIES_PER_SIGNUP = 25 ; FREE_SHIRT_AT = 10 signups ; COOKIE_SHIRT_GOAL = 250 cookies
create or replace function public.sf_street_join(p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_new boolean := false; v_a text; v_b text;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  insert into public.sf_streeter(member) values (v_me) on conflict (member) do nothing;   -- everyone is a teamer
  if p_ref is not null and p_ref <> '' and p_ref <> v_me then
    insert into public.sf_referral(referee, referrer) values (v_me, p_ref) on conflict (referee) do nothing;
    if found then
      v_new := true;
      insert into public.sf_streeter(member) values (p_ref) on conflict (member) do nothing;
      -- reward the referrer, but CAP cookie accrual at 100/day per referrer to bound anonymous-session farming
      -- (physical fulfillment is also human-gated: shipped=review, free=MusikFest street-team pickup).
      if (select count(*) from public.sf_referral
            where referrer = p_ref and created_at > now() - interval '1 day') <= 100 then
        update public.sf_streeter set cookies = cookies + 25 where member = p_ref;
      end if;
      -- log the friendship for BOTH to confirm (original inviter is preserved by the referee PK above).
      v_a := least(v_me, p_ref); v_b := greatest(v_me, p_ref);
      insert into public.sf_friend(a, b) values (v_a, v_b) on conflict (a, b) do nothing;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'credited', v_new, 'inviter', case when v_new then p_ref else null end);
end $$;
grant execute on function public.sf_street_join(text) to anon, authenticated;

create or replace function public.sf_street_me()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_sign int; v_cookies int; v_free boolean; v_handle text; v_pend int;
        v_code text; v_status text;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  select count(*)::int from public.sf_referral where referrer = v_me into v_sign;
  select coalesce(cookies,0), coalesce(free_claimed,false), handle from public.sf_streeter where member = v_me
    into v_cookies, v_free, v_handle;
  select count(*)::int from public.sf_friend f where (f.a=v_me and not f.a_ok) or (f.b=v_me and not f.b_ok) into v_pend;
  select code, status into v_code, v_status from public.sf_shirt_order
    where member = v_me and kind = 'musikfest_free' order by created_at desc limit 1;
  return jsonb_build_object('member', v_me, 'signups', coalesce(v_sign,0), 'cookies', coalesce(v_cookies,0),
    'free_at', 20, 'cookie_goal', 250, 'free_ready', coalesce(v_sign,0) >= 20, 'free_claimed', coalesce(v_free,false),
    'handle', v_handle, 'friends_pending', coalesce(v_pend,0), 'shirt_code', v_code, 'shirt_status', v_status);
end $$;
grant execute on function public.sf_street_me() to anon, authenticated;

-- claim the free MusikFest shirt (>=10 signups, once). Returns a pickup code.
create or replace function public.sf_shirt_claim_free(p_size text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_sign int; v_claimed text; v_code text; v_id uuid;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  -- free shirt is a MusikFest-ONLY perk, picked up from the street team.
  -- MusikFest 2026: Preview Night Jul 30 → last day Aug 9 (+1 day pickup grace).
  if current_date not between date '2026-07-30' and date '2026-08-10' then
    return jsonb_build_object('error','mf_only');
  end if;
  -- HARD BUDGET CAP: only the FIRST 1000 recruiters get a free shirt (1000 × $18.50 = $18,500 max).
  -- Scarcity drives the loop; after the cap, recruiting continues on Cookies only.
  if (select count(*) from public.sf_shirt_order where kind = 'musikfest_free') >= 1000 then
    return jsonb_build_object('error','shirts_gone');
  end if;
  select count(*)::int from public.sf_referral where referrer = v_me into v_sign;
  if coalesce(v_sign,0) < 20 then return jsonb_build_object('error','need_more','have',coalesce(v_sign,0),'need',20); end if;
  insert into public.sf_streeter(member) values (v_me) on conflict (member) do nothing;
  -- ATOMIC single-claim: the guarded UPDATE is the invariant, not a prior SELECT (no double free shirt).
  update public.sf_streeter set free_claimed = true
    where member = v_me and free_claimed = false
    returning member into v_claimed;
  if not found then return jsonb_build_object('error','already_claimed'); end if;
  v_code := 'MF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.sf_shirt_order(member, kind, size, name, dest, status, code)
    values (v_me, 'musikfest_free', p_size, p_name, 'street_team', 'pickup_ready', v_code)
    returning id into v_id;
  return jsonb_build_object('ok', true, 'code', v_code, 'order', v_id);
end $$;
grant execute on function public.sf_shirt_claim_free(text, text) to anon, authenticated;

-- redeem cookies for a shirt shipped by Jay (>= goal; deducts).
create or replace function public.sf_shirt_redeem_cookies(p_size text, p_name text, p_addr text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_cookies int; v_goal int := 250; v_id uuid;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  if coalesce(trim(p_addr),'') = '' then return jsonb_build_object('error','need_address'); end if;
  -- ATOMIC: the decrement IS the guard — one statement, no check-then-act race (no double-ship / negative).
  update public.sf_streeter set cookies = cookies - v_goal
    where member = v_me and cookies >= v_goal
    returning cookies into v_cookies;
  if not found then
    select coalesce(cookies,0) from public.sf_streeter where member = v_me into v_cookies;
    return jsonb_build_object('error','need_cookies','have',coalesce(v_cookies,0),'need',v_goal);
  end if;
  -- status 'review': a human approves before Jay prints + ships (blocks costless anon-farm fulfillment).
  insert into public.sf_shirt_order(member, kind, size, name, addr, dest, status)
    values (v_me, 'cookies_ship', p_size, p_name, p_addr, 'jay', 'review')
    returning id into v_id;
  return jsonb_build_object('ok', true, 'order', v_id, 'remaining', v_cookies);
end $$;
grant execute on function public.sf_shirt_redeem_cookies(text, text, text) to anon, authenticated;

-- ── friends: BOTH inviter and invitee confirm ──
create or replace function public.sf_friend_confirm(p_other text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_a text; v_b text; v_ao boolean; v_bo boolean;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  if p_other is null or p_other = '' or p_other = v_me then return jsonb_build_object('error','bad'); end if;
  v_a := least(v_me, p_other); v_b := greatest(v_me, p_other);
  insert into public.sf_friend(a, b, a_ok, b_ok) values (v_a, v_b, (v_a = v_me), (v_b = v_me))
    on conflict (a, b) do update set a_ok = public.sf_friend.a_ok or (v_a = v_me),
                                     b_ok = public.sf_friend.b_ok or (v_b = v_me)
    returning a_ok, b_ok into v_ao, v_bo;
  return jsonb_build_object('ok', true, 'friends', v_ao and v_bo);
end $$;
grant execute on function public.sf_friend_confirm(text) to anon, authenticated;

-- pending confirmations for me (the other side + whether I was the inviter)
create or replace function public.sf_friend_pending()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,'');
begin
  if v_me is null then return jsonb_build_object('pending', '[]'::jsonb); end if;
  return jsonb_build_object('pending', coalesce((
    select jsonb_agg(jsonb_build_object(
        'other', o,
        'handle', (select handle from public.sf_streeter s where s.member = o),
        'i_invited', exists(select 1 from public.sf_referral r where r.referrer = v_me and r.referee = o)))
    from (select case when f.a = v_me then f.b else f.a end as o
            from public.sf_friend f
           where (f.a = v_me and not f.a_ok) or (f.b = v_me and not f.b_ok)) q
  ), '[]'::jsonb));
end $$;
grant execute on function public.sf_friend_pending() to anon, authenticated;

-- ── MusikFest Recruiter Cup: set your street name, see the top recruiters ──
create or replace function public.sf_street_set_handle(p_handle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_h text;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  v_h := nullif(btrim(substr(p_handle, 1, 24)), '');
  insert into public.sf_streeter(member, handle) values (v_me, v_h)
    on conflict (member) do update set handle = v_h;
  return jsonb_build_object('ok', true, 'handle', v_h);
end $$;
grant execute on function public.sf_street_set_handle(text) to anon, authenticated;

-- top recruiters by REGISTERED invitees (the contest). Anonymized: a handle or 'Head #abcd'. Marks 'me'.
create or replace function public.sf_street_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,'');
begin
  return jsonb_build_object('board', coalesce((
    select jsonb_agg(row_to_json(t)) from (
      select coalesce(s.handle, 'Head #' || upper(substr(r.referrer, 1, 4))) as name,
             count(*)::int as signups,
             (r.referrer = v_me) as me
        from public.sf_referral r
        left join public.sf_streeter s on s.member = r.referrer
       group by r.referrer, s.handle
       order by count(*) desc, min(r.created_at) asc
       limit 10
    ) t
  ), '[]'::jsonb));
end $$;
grant execute on function public.sf_street_board() to anon, authenticated;

-- ── close the loop: a street-teamer scans a winner's pickup code → shirt marked delivered (atomic; no double handoff) ──
create or replace function public.sf_shirt_fulfill(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_size text; v_name text; v_status text; v_id uuid;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  select id, size, name, status into v_id, v_size, v_name, v_status
    from public.sf_shirt_order where code = p_code and kind = 'musikfest_free';
  if v_id is null then return jsonb_build_object('error','invalid'); end if;
  if v_status = 'fulfilled' then return jsonb_build_object('error','already','size',v_size,'name',v_name); end if;
  update public.sf_shirt_order set status = 'fulfilled', fulfilled_by = v_me, fulfilled_at = now()
    where id = v_id and status = 'pickup_ready';
  if not found then return jsonb_build_object('error','already','size',v_size,'name',v_name); end if;  -- someone just handed it off
  return jsonb_build_object('ok', true, 'size', v_size, 'name', v_name);
end $$;
grant execute on function public.sf_shirt_fulfill(text) to anon, authenticated;

-- ── MusikFest Recruiter Cup — CONTEST scoped to the full festival window (Jul 31 – Aug 9, 2026) ──
-- Top recruiters by registrations DURING MusikFest. Winners 1/2/3 are decided from this board.
create or replace function public.sf_street_contest()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,'');
begin
  return jsonb_build_object(
    'starts', '2026-07-31', 'ends', '2026-08-09',
    'board', coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select coalesce(s.handle, 'Head #' || upper(substr(r.referrer, 1, 4))) as name,
               count(*)::int as signups,
               (r.referrer = v_me) as me
          from public.sf_referral r
          left join public.sf_streeter s on s.member = r.referrer
         where r.created_at::date between date '2026-07-31' and date '2026-08-09'
         group by r.referrer, s.handle
         order by count(*) desc, min(r.created_at) asc
         limit 10
      ) t
    ), '[]'::jsonb));
end $$;
grant execute on function public.sf_street_contest() to anon, authenticated;

-- admin/Jay/booth read queue (fail-closed: non-admins get nothing). PII (name/addr) exposed to admins only.
create or replace function public.sf_shirt_queue()
returns setof public.sf_shirt_order language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sf_admin a where a.uid = nullif(auth.uid()::text,'')) then return; end if;
  return query select * from public.sf_shirt_order order by created_at desc;
end $$;
grant execute on function public.sf_shirt_queue() to anon, authenticated;
