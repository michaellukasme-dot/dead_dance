-- sf_streetteam_v2.sql — P0 FESTIVAL HARDENING (from the load test). Run ONCE, AFTER sf_streetteam.sql. Re-runnable.
-- Kills the two things that broke at scale:
--   1) the leaderboard was a GROUP BY aggregate over sf_referral, polled every 4.5s → now an INDEXED COUNTER.
--   2) the street page fired 3 RPCs every 4.5s → one cheap sf_street_snapshot(), polled slower on the client.

-- ── 1. counters on sf_streeter (all-time + MusikFest-window), maintained incrementally ──
alter table public.sf_streeter add column if not exists signups    int not null default 0;
alter table public.sf_streeter add column if not exists mf_signups  int not null default 0;
-- backfill from existing referrals. MONOTONIC (greatest) so it can NEVER clobber a concurrent live
-- increment below its true value — safe to re-run at any time, even during live traffic (self-healing).
-- Window anchored to festival-LOCAL time (Eastern), not UTC, so midnight-boundary days can't drift.
update public.sf_streeter s set
  signups    = greatest(s.signups, coalesce((select count(*) from public.sf_referral r where r.referrer = s.member), 0)),
  mf_signups = greatest(s.mf_signups, coalesce((select count(*) from public.sf_referral r where r.referrer = s.member
                          and (r.created_at at time zone 'America/New_York')::date between date '2026-07-31' and date '2026-08-09'), 0));
create index if not exists sf_streeter_signups_idx on public.sf_streeter (signups desc);
create index if not exists sf_streeter_mf_idx      on public.sf_streeter (mf_signups desc);

-- ── join: increment the counters in the same statement (no more read-time COUNT/GROUP BY) ──
create or replace function public.sf_street_join(p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_new boolean := false; v_a text; v_b text; v_reward int;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  insert into public.sf_streeter(member) values (v_me) on conflict (member) do nothing;
  if p_ref is not null and p_ref <> '' and p_ref <> v_me then
    insert into public.sf_referral(referee, referrer) values (v_me, p_ref) on conflict (referee) do nothing;
    if found then
      v_new := true;
      insert into public.sf_streeter(member) values (p_ref) on conflict (member) do nothing;
      -- cookie cap: 100 rewarded referrals/day per referrer (counter uses the recent-window count, cheap enough at insert time)
      v_reward := case when (select count(*) from public.sf_referral
                             where referrer = p_ref and created_at > now() - interval '1 day') <= 100 then 25 else 0 end;
      update public.sf_streeter set
        signups    = signups + 1,
        mf_signups = mf_signups + (case when (now() at time zone 'America/New_York')::date
                                        between date '2026-07-31' and date '2026-08-09' then 1 else 0 end),
        cookies    = cookies + v_reward
      where member = p_ref;
      v_a := least(v_me, p_ref); v_b := greatest(v_me, p_ref);
      insert into public.sf_friend(a, b) values (v_a, v_b) on conflict (a, b) do nothing;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'credited', v_new, 'inviter', case when v_new then p_ref else null end);
end $$;
grant execute on function public.sf_street_join(text) to anon, authenticated;

-- ── me: read the counter, not an aggregate ──
create or replace function public.sf_street_me()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_sign int; v_cookies int; v_free boolean; v_handle text; v_pend int;
        v_code text; v_status text;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  select coalesce(signups,0), coalesce(cookies,0), coalesce(free_claimed,false), handle
    from public.sf_streeter where member = v_me into v_sign, v_cookies, v_free, v_handle;
  select count(*)::int from public.sf_friend f where (f.a=v_me and not f.a_ok) or (f.b=v_me and not f.b_ok) into v_pend;
  select code, status into v_code, v_status from public.sf_shirt_order
    where member = v_me and kind = 'musikfest_free' order by created_at desc limit 1;
  return jsonb_build_object('member', v_me, 'signups', coalesce(v_sign,0), 'cookies', coalesce(v_cookies,0),
    'free_at', 20, 'cookie_goal', 250, 'free_ready', coalesce(v_sign,0) >= 20, 'free_claimed', coalesce(v_free,false),
    'handle', v_handle, 'friends_pending', coalesce(v_pend,0), 'shirt_code', v_code, 'shirt_status', v_status);
end $$;
grant execute on function public.sf_street_me() to anon, authenticated;

-- ── board / contest: INDEXED top-10 from the counter (no scan) ──
create or replace function public.sf_street_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,'');
begin
  return jsonb_build_object('board', coalesce((
    select jsonb_agg(row_to_json(t)) from (
      select coalesce(s.handle, 'Head #' || upper(substr(s.member,1,4))) as name, s.signups, (s.member = v_me) as me
        from public.sf_streeter s where s.signups > 0
       order by s.signups desc, s.joined asc limit 10
    ) t), '[]'::jsonb));
end $$;
grant execute on function public.sf_street_board() to anon, authenticated;

create or replace function public.sf_street_contest()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,'');
begin
  return jsonb_build_object('starts','2026-07-31','ends','2026-08-09','board', coalesce((
    select jsonb_agg(row_to_json(t)) from (
      select coalesce(s.handle, 'Head #' || upper(substr(s.member,1,4))) as name, s.mf_signups as signups, (s.member = v_me) as me
        from public.sf_streeter s where s.mf_signups > 0
       order by s.mf_signups desc, s.joined asc limit 10
    ) t), '[]'::jsonb));
end $$;
grant execute on function public.sf_street_contest() to anon, authenticated;

-- ── claim: use the counter for the >=20 check ──
create or replace function public.sf_shirt_claim_free(p_size text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,''); v_sign int; v_claimed text; v_code text; v_id uuid;
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  if current_date not between date '2026-07-30' and date '2026-08-10' then return jsonb_build_object('error','mf_only'); end if;
  if (select count(*) from public.sf_shirt_order where kind = 'musikfest_free') >= 1000 then
    return jsonb_build_object('error','shirts_gone');
  end if;
  select coalesce(signups,0) from public.sf_streeter where member = v_me into v_sign;
  if coalesce(v_sign,0) < 20 then return jsonb_build_object('error','need_more','have',coalesce(v_sign,0),'need',20); end if;
  insert into public.sf_streeter(member) values (v_me) on conflict (member) do nothing;
  update public.sf_streeter set free_claimed = true where member = v_me and free_claimed = false returning member into v_claimed;
  if not found then return jsonb_build_object('error','already_claimed'); end if;
  v_code := 'MF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.sf_shirt_order(member, kind, size, name, dest, status, code)
    values (v_me, 'musikfest_free', p_size, p_name, 'street_team', 'pickup_ready', v_code)
    returning id into v_id;
  return jsonb_build_object('ok', true, 'code', v_code, 'order', v_id);
end $$;
grant execute on function public.sf_shirt_claim_free(text, text) to anon, authenticated;

-- ── ONE combined poll: me + contest board + pending friends in a single cheap call ──
create or replace function public.sf_street_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me text := nullif(auth.uid()::text,'');
begin
  if v_me is null then return jsonb_build_object('error','no_session'); end if;
  return jsonb_build_object(
    'me',      public.sf_street_me(),
    'contest', public.sf_street_contest(),
    'pending', (public.sf_friend_pending() -> 'pending')
  );
end $$;
grant execute on function public.sf_street_snapshot() to anon, authenticated;
