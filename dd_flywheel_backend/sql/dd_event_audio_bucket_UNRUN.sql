-- ============================================================================
-- dd_event_audio_bucket_UNRUN.sql  —  ⛔ DO NOT RUN UNTIL THE GATE IS MET ⛔
--
-- This turns ON permanent, cross-device show AUDIO by granting Storage policies on the
-- 'event-audio' bucket. It is intentionally STAGED and dark, exactly like the crowd engine.
--
-- THE GATE (all must be true before running this file):
--   1) AUDIO RIGHTS cleared — the operator has the right to RECORD and HOST the live
--      performance audio being uploaded (artist/venue permission or a mechanical/sync license).
--      Hosting others' performance recordings without rights is an IP exposure. Counsel-gated.
--   2) The 'event-audio' bucket exists (it does) and is set appropriately (public read, or the
--      read policy below).
--
-- TO TURN ON (when the gate is met):
--   a) Run this file in the Supabase SQL editor.
--   b) Flip the client flag: set  window.AUDIO_RIGHTS_GATE = true  in ticket.html, bump sw.js, deploy.
--   Until BOTH are done, audio stays LOCAL-ONLY (plays on the uploading device; nothing is uploaded).
--
-- Idempotent (drop-if-exists then create). Storage RLS is already enabled by Supabase.
-- ============================================================================

-- PUBLIC READ — anyone can play a hosted track (the ticket's ▶). Only if the bucket isn't already public.
drop policy if exists "event-audio public read" on storage.objects;
create policy "event-audio public read"
  on storage.objects for select
  to public
  using ( bucket_id = 'event-audio' );

-- UPLOAD — a signed-in client (incl. anonymous sessions) may add a track to this bucket.
-- Single-use secure TICKETS are unaffected; this is only the audio bucket.
drop policy if exists "event-audio insert" on storage.objects;
create policy "event-audio insert"
  on storage.objects for insert
  to authenticated, anon
  with check ( bucket_id = 'event-audio' );

-- (No UPDATE/DELETE policies on purpose — uploads are append-only from the client; curation/removal
--  is an operator action via the dashboard or a future admin RPC.)

-- ============================================================================
-- ROLLBACK (turn it back off):
--   drop policy if exists "event-audio public read" on storage.objects;
--   drop policy if exists "event-audio insert"      on storage.objects;
--   and set window.AUDIO_RIGHTS_GATE = false.
-- ============================================================================
