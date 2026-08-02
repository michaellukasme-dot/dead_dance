// yt-match — the YouTube Data API connector (SERVER-SIDE; holds the key).
// Given a show, it searches YouTube, scores each result against the show, and upserts the
// top candidates into dd_gd_video as verified=false (a human/counsel blesses the keepers).
// The KEY lives here in env — never in the shipped client (per SOP_POST_DEV_AUDITS).
// Deploy as a Supabase Edge Function. Logic mirrors dd_ytmatch.js (the tested source of truth).
//
// POST body: { show_key, date, venue?, city?, top?, minScore? }   (header: x-match-secret)

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const YT_API_KEY   = Deno.env.get("YT_API_KEY")!;                 // Google Cloud → YouTube Data API v3 → API key (free tier)
const SB_URL       = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;  // to call sf_gd_video_set
const MATCH_SECRET = Deno.env.get("MATCH_SECRET") || "";

function isoToVariants(iso: string): string[] {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/); if (!m) return [];
  const [_, y, mo, d] = m; const yy = y.slice(2); const mn = (+mo), dn = (+d);
  const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"][mn-1] || "";
  return [`${y}-${mo}-${d}`, `${mo}/${d}/${y}`, `${mn}/${dn}/${y}`, `${mn}/${dn}/${yy}`, `${mn}-${dn}-${yy}`,
          `${MON} ${dn}, ${y}`, `${MON} ${dn} ${y}`].map(s => s.toLowerCase());
}
function classify(ch: string): string { const c = (ch||"").toLowerCase();
  if (!c) return "unknown";
  if (/grateful dead|rhino|dead\.net|gratefuldeadtv/.test(c)) return "official";
  if (/nugs|relix|owsley stanley foundation/.test(c)) return "authorized";
  return "fan"; }
function score(title: string, durationSec: number, channel: string, iso: string, venue?: string): number {
  const t = (title||"").toLowerCase(); let s = 0;
  if (isoToVariants(iso).some(v => v && t.includes(v))) s += 0.45;
  if (venue && t.includes(venue.toLowerCase())) s += 0.2;
  if (/\bfull (show|concert|set)\b|complete (show|concert)/.test(t)) s += 0.15;
  if (durationSec >= 2400) s += 0.15; else if (durationSec > 0 && durationSec < 600) s -= 0.15;
  const ch = classify(channel); if (ch === "official" || ch === "authorized") s += 0.1;
  if (/\bgrateful dead\b/.test(t)) s += 0.05;
  return Math.max(0, Math.min(1, Math.round(s*100)/100));
}
function parseDuration(iso8601: string): number { // PT1H2M3S → seconds
  const m = (iso8601||"").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if (!m) return 0;
  return (+(m[1]||0))*3600 + (+(m[2]||0))*60 + (+(m[3]||0)); }

serve(async (req) => {
  try {
    if (MATCH_SECRET && req.headers.get("x-match-secret") !== MATCH_SECRET)
      return new Response(JSON.stringify({ ok:false, err:"unauthorized" }), { status: 401 });
    const body = await req.json();
    const show_key = String(body.show_key||""); const date = String(body.date || show_key.replace(/^gd/,""));
    const venue = body.venue || null, city = body.city || null;
    const top = Math.max(1, body.top || 3); const minScore = body.minScore != null ? body.minScore : 0.4;
    if (!show_key) return new Response(JSON.stringify({ ok:false, err:"show_key required" }), { status: 400 });

    const q = ["Grateful Dead", date, venue||"", "full concert"].filter(Boolean).join(" ").trim();
    // 1) search.list → candidate video ids
    const su = new URL("https://www.googleapis.com/youtube/v3/search");
    su.search = new URLSearchParams({ key:YT_API_KEY, part:"snippet", q, type:"video", maxResults:"10" }).toString();
    const sr = await fetch(su); const sj = await sr.json();
    const items = (sj.items||[]).map((it:any)=>({ id:it.id?.videoId, title:it.snippet?.title, channel:it.snippet?.channelTitle }))
                    .filter((x:any)=>x.id);
    if (!items.length) return new Response(JSON.stringify({ ok:true, show_key, candidates:0 }), { headers:{ "content-type":"application/json" } });

    // 2) videos.list → durations
    const vu = new URL("https://www.googleapis.com/youtube/v3/videos");
    vu.search = new URLSearchParams({ key:YT_API_KEY, part:"contentDetails", id: items.map((i:any)=>i.id).join(",") }).toString();
    const vr = await fetch(vu); const vj = await vr.json();
    const durById: Record<string,number> = {};
    (vj.items||[]).forEach((it:any)=>{ durById[it.id] = parseDuration(it.contentDetails?.duration||""); });

    // 3) score + rank + keep top
    const ranked = items.map((it:any)=>{ const dur = durById[it.id]||0;
      return { ...it, durationSec:dur, url:`https://www.youtube.com/watch?v=${it.id}`,
               channelType:classify(it.channel), score:score(it.title, dur, it.channel, date, venue||undefined) }; })
      .filter((r:any)=>r.score>=minScore).sort((a:any,b:any)=>b.score-a.score).slice(0, top);

    // 4) upsert as verified=false via the RPC (candidates only — a human confirms)
    let saved = 0;
    for (const r of ranked) {
      const resp = await fetch(`${SB_URL}/rest/v1/rpc/sf_gd_video_set`, { method:"POST",
        headers:{ "content-type":"application/json", "apikey":SB_SERVICE, "authorization":`Bearer ${SB_SERVICE}` },
        body: JSON.stringify({ p_show_key:show_key, p_video_url:r.url, p_show_date:date, p_venue:venue, p_city:city,
          p_channel_type:r.channelType, p_official:r.channelType==="official", p_verified:false,
          p_note:`auto-match ${r.score}`, p_added_by:"yt-match" }) });
      if (resp.ok) saved++;
    }
    return new Response(JSON.stringify({ ok:true, show_key, searched:items.length, kept:ranked.length, saved,
      candidates: ranked.map((r:any)=>({ url:r.url, score:r.score, channelType:r.channelType })) }),
      { headers:{ "content-type":"application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, err:String(e) }), { status: 500 });
  }
});
