// ============================================================================
// dd-synthesize — Supabase Edge Function (Deno).  "This is YOU, Claude."
// Reads the last 24h of posts in every dead.dance group, and writes:
//   • a per-group "clippings for the day" synthesis (one row per group), and
//   • the master DAILY SYNTHESIS (scope='ALL') across every group.
// Re-runnable through the day (idempotent upsert per date) → the master group
// "changes daily, perhaps in real time" as new posts come in.
//
// Uses the service role (reads messages past RLS, writes chat_synthesis) + the
// Anthropic API (Claude Haiku — cheap, fast) for the synthesis itself.
//
// DEPLOY:
//   supabase functions deploy dd-synthesize --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
// SCHEDULE (hourly for near-real-time; or daily). In Supabase SQL editor, with
// pg_cron + pg_net enabled:
//   select cron.schedule('dd-synthesize','0 * * * *', $$
//     select net.http_post('https://<project>.functions.supabase.co/dd-synthesize',
//       '{}'::jsonb, headers:='{"Authorization":"Bearer <anon-or-cron-secret>"}'::jsonb) $$);
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const AKEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-haiku-4-5-20251001";

async function claude(system: string, user: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": AKEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json();
  return (j?.content?.[0]?.text ?? "").trim();
}

// ask Claude for {title, body, clippings:[{snippet,by,n}]} as JSON
async function synthGroup(label: string, posts: { body: string; by: string }[]) {
  const sys = "You are the dead.dance house voice — warm, literate, Grateful-Dead-family fluent. " +
    "Synthesize a day's group posts into a short digest. Reply ONLY as compact JSON: " +
    '{"title":"…","body":"2-3 sentence digest","clippings":[{"snippet":"≤120 chars quote/paraphrase","by":"first name or handle"}]}. ' +
    "Max 5 clippings. Credit people. No invented facts — only what the posts say.";
  const user = "Group: " + label + "\nPosts:\n" + posts.slice(0, 60).map((p, i) => (i + 1) + ". (" + p.by + ") " + p.body).join("\n");
  try { return JSON.parse(await claude(sys, user)); } catch { return null; }
}

Deno.serve(async () => {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: rooms } = await svc.from("chat_rooms").select("id,scope,label").eq("app", "dead_dance").eq("is_active", true);
    const groupSummaries: { label: string; title: string; body: string }[] = [];

    for (const room of rooms ?? []) {
      const { data: msgs } = await svc.from("chat_messages")
        .select("body,created_at").eq("room_id", room.id).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(60);
      if (!msgs || msgs.length === 0) continue;
      const posts = msgs.map((m: any) => ({ body: m.body, by: "a head" }));   // sender names omitted (privacy)
      const s = await synthGroup(room.label, posts);
      if (!s) continue;
      const clippings = (s.clippings ?? []).map((c: any) => ({ group: room.scope, label: room.label, snippet: c.snippet, by: c.by, n: 1 }));
      await svc.rpc("chat_synthesis_put", { p_scope: room.scope, p_label: room.label,
        p_title: s.title, p_body: s.body, p_clippings: clippings, p_items: msgs.length });
      groupSummaries.push({ label: room.label, title: s.title, body: s.body });
    }

    // master DAILY SYNTHESIS across all groups
    if (groupSummaries.length) {
      const sys = "You are the dead.dance house voice. Write the master 'Daily Synthesis' across ALL groups — " +
        "what the whole family is talking about today. Reply ONLY as JSON {\"title\":\"…\",\"body\":\"4-6 sentence digest\"}. Warm, vivid, honest.";
      const user = groupSummaries.map((g) => "• " + g.label + ": " + g.title + " — " + g.body).join("\n");
      let m: any = null; try { m = JSON.parse(await claude(sys, user)); } catch { /* ignore */ }
      const clips = groupSummaries.slice(0, 12).map((g) => ({ group: "ALL", label: g.label, snippet: g.title, by: "Claude", n: 1 }));
      await svc.rpc("chat_synthesis_put", { p_scope: "ALL", p_label: "All Groups · the whole bus",
        p_title: m?.title ?? "Today on dead.dance", p_body: m?.body ?? "", p_clippings: clips, p_items: groupSummaries.length });
    }
    return new Response(JSON.stringify({ ok: true, groups: groupSummaries.length }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
