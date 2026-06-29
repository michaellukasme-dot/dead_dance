-- ============================================================================
-- dead.dance — SYNTHETIC LOAD SEED  (up to 3,000,000 users + content)
-- ⚠️  THROWAWAY / BRANCH DATABASE ONLY.  NEVER run against production data.
--     Use a Supabase *branch* (or a disposable project) cloned from the real schema.
-- Tune the counts at the top. Runs as postgres in the SQL editor (bypasses RLS);
-- we temporarily disable the profile self-guard trigger for the bulk insert.
-- Cleanup at the bottom removes everything tagged 'lt_' / 'lt-'.
-- ============================================================================

-- ---- knobs -----------------------------------------------------------------
--   N_USERS  : synthetic registered identities (the headline number)
--   N_MSGS   : chat messages spread across existing rooms
--   N_SHOWS  : synthetic ticketed shows
-- Start small (e.g. 50k / 200k / 200) to validate, then scale to 3,000,000.
-- Edit these three literals, then run top-to-bottom.

begin;

-- 1) identities ----------------------------------------------------------------
insert into chat_identities (email_hash, display_name, age_attested)
select 'lt_'||g, 'head'||g, true
from generate_series(1, 3000000) g
on conflict (email_hash) do nothing;

-- 2) profiles (disable the per-row self-guard trigger for bulk load) -----------
alter table chat_profile disable trigger trg_chat_profile_guard;
insert into chat_profile (identity_id, display_name, shows_pre_1995, shows_post_1995)
select id, display_name, (random()*200)::int, (random()*300)::int
from chat_identities where email_hash like 'lt\_%'
on conflict (identity_id) do nothing;
alter table chat_profile enable trigger trg_chat_profile_guard;

-- 3) indexed temp maps for fast modulo fan-out --------------------------------
create temp table lt_ids on commit drop as
  select (row_number() over ())::bigint rn, id from chat_identities where email_hash like 'lt\_%';
create unique index on lt_ids(rn);
create temp table lt_rooms on commit drop as
  select (row_number() over ())::bigint rn, id from chat_rooms where app='dead_dance' and is_active;
create unique index on lt_rooms(rn);

-- 4) messages across existing rooms (bounded) ---------------------------------
with k as (select (select count(*) from lt_ids) nid, (select count(*) from lt_rooms) nr)
insert into chat_messages (room_id, sender_id, body)
select rm.id, idm.id, 'lt-post '||g
from generate_series(1, 5000000) g
cross join k
join lt_rooms rm on rm.rn = (g % nr) + 1
join lt_ids  idm on idm.rn = (g % nid) + 1;

-- 5) synthetic ticketed shows --------------------------------------------------
insert into chat_show (app, band, venue, city, state, region, show_date, is_ticketed, price_cents, tickets_total)
select 'dead_dance', 'LT Band '||g, 'LT Venue '||g, 'City'||g, 'PA',
       (array['midatl','bayarea','northeast','greatlakes','southeast','lonestar','pnw','rockies'])[(g%8)+1],
       current_date + (g % 60), true, ((g%6)+2)*1000, 200
from generate_series(1, 5000) g
on conflict (app, band, venue, show_date) do nothing;

commit;

-- quick counts (sanity)
select 'identities' t, count(*) n from chat_identities where email_hash like 'lt\_%'
union all select 'messages', count(*) from chat_messages where body like 'lt-post %'
union all select 'shows', count(*) from chat_show where band like 'LT Band %';

-- ============================================================================
-- CLEANUP (run after the load test to wipe the synthetic data):
-- delete from chat_messages where body like 'lt-post %';
-- delete from chat_show where band like 'LT Band %';
-- delete from chat_identities where email_hash like 'lt\_%';   -- cascades profiles
-- ============================================================================
