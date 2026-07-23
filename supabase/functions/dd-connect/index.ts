// ============================================================================
// dd-connect — Supabase Edge Function (Deno)
// Stripe CONNECT onboarding for a merchant (band or chapter print partner).
//   POST { kind, name, slug }            → create/reuse an Express account, return the onboarding URL
//   POST { mode:"status", slug }         → refresh charges/payouts from Stripe, return {charges_enabled}
// The secret key lives ONLY here (env). The client never sees it. Requires the
// caller's Supabase JWT so a merchant can only set up its own payout account.
//
// DEPLOY:
//   supabase functions deploy dd-connect
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_… APP_URL=https://deaddance.app
//   (Enable Connect → Express in the Stripe dashboard first.)
// ============================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const APP_URL = Deno.env.get("APP_URL") ?? "https://deaddance.app";
const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": APP_URL,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    if (!jwt) return json({ error: "no_auth" }, 401);
    const { data: userData } = await svc.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "bad_session" }, 401);

    const body = await req.json();
    const slug = String(body.slug ?? "").toLowerCase().trim();
    if (!slug) return json({ error: "no_slug" }, 400);

    // current merchant row (if any)
    const { data: mrows } = await svc.rpc("dd_merchant_get", { p_slug: slug });
    let m = (mrows && mrows[0]) || null;

    // ── STATUS: refresh from Stripe, persist, return ──────────────────────
    if (body.mode === "status") {
      if (!m?.stripe_account_id) return json({ charges_enabled: false, onboarded: false });
      const acct = await stripe.accounts.retrieve(m.stripe_account_id);
      await svc.rpc("dd_merchant_set_stripe", {
        p_slug: slug, p_account: acct.id,
        p_charges: !!acct.charges_enabled, p_payouts: !!acct.payouts_enabled,
      });
      return json({ charges_enabled: !!acct.charges_enabled, payouts_enabled: !!acct.payouts_enabled, onboarded: true });
    }

    // ── ONBOARD: ensure a merchant row + an Express account, return a link ─
    await svc.rpc("dd_merchant_upsert", {
      p_member: uid, p_kind: String(body.kind ?? "band"), p_slug: slug,
      p_name: String(body.name ?? ""), p_fee_bps: null,
    });

    let acctId: string | undefined = m?.stripe_account_id;
    if (!acctId) {
      const account = await stripe.accounts.create({
        type: "express",
        business_profile: { name: String(body.name ?? slug) },
        metadata: { slug, kind: String(body.kind ?? "band"), supabase_uid: uid },
      });
      acctId = account.id;
      await svc.rpc("dd_merchant_set_stripe", { p_slug: slug, p_account: acctId, p_charges: false, p_payouts: false });
    }

    const link = await stripe.accountLinks.create({
      account: acctId!,
      refresh_url: `${APP_URL}/band.html?band=${encodeURIComponent(slug)}&connect=refresh`,
      return_url: `${APP_URL}/band.html?band=${encodeURIComponent(slug)}&connect=done`,
      type: "account_onboarding",
    });
    return json({ url: link.url });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
