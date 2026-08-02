# yt-match — the YouTube Data API connector (RUNBOOK)

Correlates Grateful Dead **Archive.org shows → YouTube videos** and drops candidates into `dd_gd_video` (spine `16_gd_video.sql`) as **verified=false**. You (or counsel) approve the keepers. Nothing is hosted — we store a **link + provenance**.

## What's what (Triple Protocol — full wire)
- **SPINE** — `dd_flywheel_backend/sql/16_gd_video.sql` → `dd_gd_video` + `sf_gd_video_set` (already live).
- **SKELETAL/BRAIN** — `dd_ytmatch.js` (+ `dd_ytmatch.test.js`, 23 green) — the pure, tested match/score/classify logic.
- **NERVOUS (this)** — `functions/yt-match/index.ts` — the Supabase Edge Function that holds `YT_API_KEY`, calls YouTube, and upserts candidates.

## Parked on one thing: a YouTube Data API key
Like Twilio/Stripe on the EIN, this is inert until you add a key. **It's free.**
1. Google Cloud Console → **APIs & Services → Enable "YouTube Data API v3"**.
2. **Credentials → Create credentials → API key.** Copy it.
3. Put it in `.env` (from `.env.example`) as `YT_API_KEY`. **Never** paste it in chat or the shipped client.

## Deploy + run
```bash
# from this folder, with the Supabase CLI
supabase functions deploy yt-match
supabase secrets set YT_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... MATCH_SECRET=...

# match one show
curl -X POST "$SUPABASE_URL/functions/v1/yt-match" \
  -H "x-match-secret: $MATCH_SECRET" -H "content-type: application/json" \
  -d '{"show_key":"gd1977-05-08","date":"1977-05-08","venue":"Barton Hall","city":"Ithaca"}'

# bulk: loop your show list and call once per show (mind the free-tier quota: ~100 searches/day per key)
```

## Legal doctrine (baked in)
- Candidates always land **`verified=false`** and carry **`channel_type`** (official / authorized / fan / unknown) — the hinge for the how/if decision.
- We store a **pointer + facts**, never the video. Prefer **official/authorized** channels if you ever surface them. Link out / official-embed only. **Counsel signs off before any commercial, band-branded use.**

## Quota note
Free tier ≈ 10,000 units/day; a search costs 100 units → ~100 shows/day per key. For the full catalog, spread the run or request a quota bump. Coverage so far: `select public.sf_gd_video_coverage();`
