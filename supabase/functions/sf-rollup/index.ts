// ============================================================================
// sf-rollup — Supabase Edge Function (Deno)
// Cron job: rolls raw device pings (public.sf_ping) into hourly occupancy
// (public.sf_occupancy) for every LIVE event, for today (and yesterday, to catch
// the midnight boundary). The occupancy report + admin Console read the result.
//
// Counts are DISTINCT DEVICES, never identities — the SQL function sf_rollup()
// does the aggregation; this function just fans it out over active events.
//
// TRIGGER:
//   • Cron (pg_cron / a scheduler) POSTs here every ~15 min with the DD_CRON_SECRET bearer.
//   • Manual/test: POST { "slug": "musikfest-2026" } to roll a single event.
//
// DEPLOY (you run once):
//   supabase functions deploy sf-rollup --no-verify-jwt
//   supabase secrets set DD_CRON_SECRET=<the same long random string you use elsewhere>
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CRON_SECRET = Deno.env.get("DD_CRON_SECRET") || "";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
}
function ymd(d: Date) { return d.toISOString().slice(0, 10); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  // cron-secret gate (bearer or ?key=)
  const auth = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const url = new URL(req.url);
  if (CRON_SECRET && auth !== CRON_SECRET && url.searchParams.get("key") !== CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }

  let slug: string | null = null;
  try { slug = (await req.json())?.slug ?? null; } catch { /* no body → all events */ }

  const today = new Date();
  const yest = new Date(today.getTime() - 864e5);
  const days = [ymd(today), ymd(yest)];

  // which events to roll
  let q = svc.from("sf_event").select("id, slug").eq("status", "live");
  if (slug) q = q.eq("slug", slug);
  const { data: events, error } = await q;
  if (error) return json({ error: error.message }, 500);

  let rolled = 0, rows = 0;
  for (const ev of events ?? []) {
    for (const day of days) {
      const { data, error: e2 } = await svc.rpc("sf_rollup", { p_event: ev.id, p_day: day });
      if (!e2) { rolled++; rows += Number(data ?? 0); }
    }
  }
  return json({ ok: true, events: events?.length ?? 0, rollups: rolled, occupancy_rows: rows });
});
