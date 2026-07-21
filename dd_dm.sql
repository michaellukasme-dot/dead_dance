-- dd_dm.sql — DeadDance friend-to-friend DIRECT MESSAGES (PRODUCTION / auth.uid()).
-- Run this ONCE in the Supabase SQL editor (same project as dd_friends / dd_posts). Safe to re-run.
--
-- SHIP POSTURE — DARK: the client (dd_dm.js) defaults window.DD_DM_ENABLED=false, so nothing
-- user-facing goes live until age verification is wired. This SQL is the backend spine so the
-- gate can be flipped later without a schema change.
--
-- IDENTITY: Supabase Auth (auth.uid()). DMs are DeadDance-native on the auth.uid spine — they do
-- NOT reuse chat_identities / chat_messages (that's rooms-only LukasChat). The server derives "me"
-- from the signed JWT; the client can never spoof an id. RLS is tight on every table.
--
-- GATE (three locks, enforced in RLS *and* re-checked inside every RPC):
--   1. auth.uid()::text must be a party to the thread (a_id or b_id)
--   2. the two parties must be ACCEPTED friends, either direction (mirrors dd_friends_list)
--   3. the sender must have age_verified = true in dd_age_verify
--
-- RETENTION: retain-with-report. Unlike the rooms chat's 30-day purge, DM history is RETAINED
-- (kept for the two friends, and preserved if reported for moderation). DMs stay gated on
-- age_verified + accepted-friends for the life of the thread.
-- ============================================================================

-- ---- age-verification gate (standalone; the DM gate reads age_verified) ------
-- Standalone table keyed on member_id (= auth.uid()::text). Age-verification integration
-- (the actual verifier) lands later; until a member has a row with age_verified=true, they
-- cannot open a thread or send a message. Read-your-own-row only; writes are admin/verifier-side.
create table if not exists public.dd_age_verify (
  member_id    text primary key,                 -- auth.uid()::text
  age_verified boolean not null default false,
  verified_at  timestamptz,
  method       text
);
alter table public.dd_age_verify enable row level security;
drop policy if exists dd_age_verify_read_self on public.dd_age_verify;
create policy dd_age_verify_read_self on public.dd_age_verify
  for select to authenticated
  using (member_id = auth.uid()::text);
-- No client INSERT/UPDATE/DELETE — verification is written by the (later) verifier with elevated rights.

-- ---- threads: one canonical row per friend pair -----------------------------
-- a_id/b_id are stored canonically sorted (least/greatest), so unique(a_id,b_id) is a stable
-- key for the pair regardless of who opened it. check (a_id < b_id) enforces the canonical order
-- and rules out self-threads.
create table if not exists public.dd_dm_threads (
  id         uuid primary key default gen_random_uuid(),
  a_id       text not null,
  b_id       text not null,
  created_at timestamptz not null default now(),
  unique (a_id, b_id),
  check (a_id < b_id)
);

-- ---- messages ---------------------------------------------------------------
create table if not exists public.dd_dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.dd_dm_threads(id) on delete cascade,
  sender_id  text not null,                       -- auth.uid()::text of the sender
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists dd_dm_messages_thread_idx on public.dd_dm_messages(thread_id, created_at);

-- ---- gate helpers (used by RLS and RPCs) ------------------------------------
-- accepted friends in either direction (mirrors dd_friends_list's accepted check)
create or replace function public.dd_dm_are_friends(p_a text, p_b text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dd_friend_requests
    where status = 'accepted'
      and ((from_id = p_a and to_id = p_b) or (from_id = p_b and to_id = p_a))
  );
$$;

-- age-verified?
create or replace function public.dd_dm_is_adult(p_member text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select age_verified from public.dd_age_verify where member_id = p_member), false);
$$;

-- ---- RLS: threads (read only if you're a party) -----------------------------
alter table public.dd_dm_threads enable row level security;
drop policy if exists dd_dm_threads_read on public.dd_dm_threads;
create policy dd_dm_threads_read on public.dd_dm_threads
  for select to authenticated
  using (auth.uid()::text in (a_id, b_id));
-- No direct client INSERT — threads are opened via the RPC below.

-- ---- RLS: messages (read + insert only when party AND friends AND age-verified) --
alter table public.dd_dm_messages enable row level security;

drop policy if exists dd_dm_messages_read on public.dd_dm_messages;
create policy dd_dm_messages_read on public.dd_dm_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.dd_dm_threads t
      where t.id = thread_id
        and auth.uid()::text in (t.a_id, t.b_id)
        and public.dd_dm_are_friends(t.a_id, t.b_id)
        and public.dd_dm_is_adult(auth.uid()::text)
    )
  );

drop policy if exists dd_dm_messages_send on public.dd_dm_messages;
create policy dd_dm_messages_send on public.dd_dm_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()::text
    and exists (
      select 1 from public.dd_dm_threads t
      where t.id = thread_id
        and auth.uid()::text in (t.a_id, t.b_id)
        and public.dd_dm_are_friends(t.a_id, t.b_id)
        and public.dd_dm_is_adult(sender_id)
    )
  );

-- ---- RPCs (SECURITY DEFINER; each re-checks the full gate) -------------------

-- open (or find) the canonical thread with another friend → returns thread id
create or replace function public.dd_dm_open(p_other text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me text := auth.uid()::text; v_a text; v_b text; v_id uuid;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if p_other is null or btrim(p_other) = '' or p_other = v_me then
    raise exception 'invalid recipient';
  end if;
  if not public.dd_dm_are_friends(v_me, p_other) then
    raise exception 'you can only message accepted friends';
  end if;
  if not public.dd_dm_is_adult(v_me) then
    raise exception 'age verification required to message';
  end if;
  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);
  insert into public.dd_dm_threads (a_id, b_id) values (v_a, v_b)
    on conflict (a_id, b_id) do update set a_id = excluded.a_id   -- no-op update so RETURNING has a row
  returning id into v_id;
  return v_id;
end $$;

-- a thread's messages, oldest → newest
create or replace function public.dd_dm_thread_messages(p_thread uuid, p_limit int)
returns setof public.dd_dm_messages language plpgsql stable security definer set search_path = public as $$
declare v_me text := auth.uid()::text;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if not exists (
    select 1 from public.dd_dm_threads t
    where t.id = p_thread and v_me in (t.a_id, t.b_id)
  ) then
    raise exception 'not a member of this thread';
  end if;
  return query
    select * from public.dd_dm_messages
    where thread_id = p_thread
    order by created_at asc
    limit coalesce(p_limit, 200);
end $$;

-- send a message (re-checks membership + friends + age)
create or replace function public.dd_dm_send(p_thread uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me text := auth.uid()::text; v_a text; v_b text; v_id uuid;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'empty message'; end if;
  if char_length(btrim(p_body)) > 1000 then raise exception 'message too long'; end if;
  select a_id, b_id into v_a, v_b from public.dd_dm_threads where id = p_thread;
  if v_a is null then raise exception 'thread not found'; end if;
  if v_me not in (v_a, v_b) then raise exception 'not a member of this thread'; end if;
  if not public.dd_dm_are_friends(v_a, v_b) then
    raise exception 'you can only message accepted friends';
  end if;
  if not public.dd_dm_is_adult(v_me) then
    raise exception 'age verification required to message';
  end if;
  insert into public.dd_dm_messages (thread_id, sender_id, body)
  values (p_thread, v_me, btrim(p_body))
  returning id into v_id;
  return v_id;
end $$;

-- ---- grants -----------------------------------------------------------------
grant execute on function public.dd_dm_are_friends(text,text)      to anon, authenticated;
grant execute on function public.dd_dm_is_adult(text)              to anon, authenticated;
grant execute on function public.dd_dm_open(text)                  to anon, authenticated;
grant execute on function public.dd_dm_thread_messages(uuid,int)   to anon, authenticated;
grant execute on function public.dd_dm_send(uuid,text)             to anon, authenticated;

-- ---- Realtime (safe to re-run) ----------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.dd_dm_messages;
exception when duplicate_object then null; end $$;

-- ---- to flip the gate ON later:
--   1. wire real age verification → upsert dd_age_verify(member_id, age_verified=true, verified_at, method)
--   2. add a block/mute layer (dd_dm should refuse threads with a blocked party)
--   3. set window.DD_DM_ENABLED = true in the client
-- ---- OPTIONAL smoke test (run signed-in from the app, not the SQL editor):
--   -- (first: insert dd_age_verify rows for BOTH parties with age_verified=true)
--   select public.dd_dm_open('<friend-auth-uid>');
--   select public.dd_dm_send('<thread-uuid>', 'first note 🌹');
--   select * from public.dd_dm_thread_messages('<thread-uuid>', 100);
