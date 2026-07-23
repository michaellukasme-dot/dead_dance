// ============================================================================
// dd-group-synth — Supabase Edge Function (Deno)
// The daily "Claude reads the group" job. For every group with real recent
// activity it writes ONE grounded recap into public.dd_group_synth:
//   { title, body, clips:[{s,by}] }
//
// HONESTY IS ENFORCED IN CODE, not trusted to the model:
//   • body/title come from the model, but are only kept if the group had ≥ MIN_POSTS real posts.
//   • every clip is validated server-side: clip.by must be a REAL author_name from the
//     posts, and clip.s must appear VERBATIM (case/space-insensitive) inside a REAL post
//     body. Any clip that fails is dropped. Nothing is ever fabricated or credited falsely.
//   • a group with too little to say is SKIPPED — its card keeps the honest empty state.
//
// TRIGGER:
//   • Daily cron (see dd_group_synth_cron.sql) POSTs here with the CRON_SECRET bearer.
//   • Manual/test: POST { "slug": "dead-lot" } (or omit slug to do all active groups).
//
// DEPLOY:
//   supabase functions deploy dd-group-synth --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
//   supabase secrets set DD_CRON_SECRET=<a-long-random-string>
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const CRON_SECRET   = Deno.env.get("DD_CRON_SECRET") || "";
const MODEL   = "claude-sonnet-5";  // richer prose for the daily recap
const WINDOW_HOURS = 48;
const MIN_POSTS    = 3;    // fewer than this → skip (honest empty state stays)
const MAX_POSTS    = 60;   // token cap per group

type Post = { author_name: string | null; body: string; created_at: string };
type Clip = { s: string; by: string };

// normalize for verbatim matching (lowercase, collapse whitespace, strip curly quotes)
function norm(t: string): string {
  return String(t || "").toLowerCase().replace(/[“”"'’‘]/g, "").replace(/\s+/g, " ").trim();
}

async function synthOne(slug: string): Promise<string> {
  const sinceIso = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data: rows, error } = await svc
    .from("dd_posts")
    .select("author_name, body, created_at")
    .eq("group_slug", slug)
    .neq("scope", "demo")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(MAX_POSTS);
  if (error) return `error:${error.message}`;
  const posts = (rows || []).filter((p: Post) => p && p.body && p.body.trim().length > 0);
  if (posts.length < MIN_POSTS) return "skip:too-few";

  // ---- ask the model for a grounded recap ----
  const list = posts.map((p: Post, i: number) =>
    `${i + 1}. ${(p.author_name || "a head").replace(/\n/g, " ")}: ${p.body.replace(/\n/g, " ").slice(0, 400)}`
  ).join("\n");

  const prompt =
    "You are writing a short DAILY RECAP of a Grateful Dead fan group's message thread. " +
    "Below are the ACTUAL posts from the last two days. Summarize what the group is really " +
    "talking about — warm, plain, specific to these posts.\n\n" +
    "Return ONLY minified JSON, no prose, in this exact shape:\n" +
    '{"title":"<= 8 words","body":"2-3 sentences","clips":[{"s":"an EXACT verbatim quote copied from one post","by":"that post\'s exact author name"}]}\n\n' +
    "HARD RULES:\n" +
    "- Use ONLY what is in the posts. Never invent quotes, names, shows, dates, topics, or events.\n" +
    "- Each clip.s must be copied word-for-word from a single post. Each clip.by must be that post's exact author.\n" +
    "- 0 to 3 clips. If nothing is quote-worthy, use an empty clips array.\n" +
    '- If the thread is too thin to summarize honestly, return {"skip":true}.\n\n' +
    "POSTS:\n" + list;

  let modelText = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json();
    modelText = (j?.content?.[0]?.text || "").trim();
  } catch (e) {
    return `error:anthropic:${(e as Error)?.message}`;
  }

  // ---- parse defensively ----
  let obj: any = null;
  try {
    const m = modelText.match(/\{[\s\S]*\}/);   // tolerate stray text around the JSON
    obj = JSON.parse(m ? m[0] : modelText);
  } catch { return "skip:unparseable"; }
  if (!obj || obj.skip === true) return "skip:model";

  const title = String(obj.title || "").slice(0, 90).trim();
  const body  = String(obj.body || "").slice(0, 600).trim();
  if (!body) return "skip:empty-body";

  // ---- VALIDATE clips against real posts (honesty gate) ----
  const realAuthors = new Set(posts.map((p: Post) => norm(p.author_name || "")).filter(Boolean));
  const normBodies = posts.map((p: Post) => ({ by: norm(p.author_name || ""), t: norm(p.body) }));
  const clips: Clip[] = [];
  for (const c of (Array.isArray(obj.clips) ? obj.clips : [])) {
    const s = String(c?.s || "").trim();
    const by = String(c?.by || "").trim();
    if (!s || !by) continue;
    const nby = norm(by), ns = norm(s);
    if (ns.length < 6) continue;                       // too short to be a real quote
    if (!realAuthors.has(nby)) continue;               // author must be real
    // the quote must actually appear in a real post BY THAT AUTHOR
    const ok = normBodies.some((p) => p.by === nby && p.t.includes(ns));
    if (ok) clips.push({ s, by });
    if (clips.length >= 3) break;
  }

  const { error: upErr } = await svc.from("dd_group_synth").upsert({
    group_slug: slug, title, body, clips, updated_at: new Date().toISOString(),
  });
  if (upErr) return `error:upsert:${upErr.message}`;
  return `ok:${clips.length}clips`;
}

Deno.serve(async (req) => {
  // shared-secret guard (the function is deployed --no-verify-jwt for cron)
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  }
  let slug = "";
  try { const b = await req.json(); slug = String(b?.slug || "").trim(); } catch { /* no body = all groups */ }

  try {
    let slugs: string[];
    if (slug) {
      slugs = [slug];
    } else {
      // data-driven: every group with recent, non-demo activity (band groups included)
      const sinceIso = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
      const { data } = await svc.from("dd_posts")
        .select("group_slug").not("group_slug", "is", null).neq("scope", "demo")
        .gte("created_at", sinceIso).limit(5000);
      slugs = [...new Set((data || []).map((r: any) => r.group_slug).filter(Boolean))];
    }
    const results: Record<string, string> = {};
    for (const s of slugs) results[s] = await synthOne(s);
    return new Response(JSON.stringify({ ran: slugs.length, results }, null, 2),
      { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(`handler error: ${(e as Error)?.message}`, { status: 500 });
  }
});
