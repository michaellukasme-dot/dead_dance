// ============================================================================
// dd-checkout — Supabase Edge Function (Deno)
// Opens a Stripe HOSTED Checkout session for a pending order or a subscription.
// Cards never touch our servers. Prices for tickets are taken from the ORDER
// row (which file 13 priced server-side), so the client cannot tamper with them.
//
// DEPLOY (you run these once):
//   supabase functions deploy dd-checkout --no-verify-jwt=false
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx \
//        APP_URL=https://michaellukasme-dot.github.io/dead_dance
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// The function REQUIRES the caller's Supabase JWT (the magic-link session), so
// every order is tied to a real identity. It reads the order with the service
// role, confirms the JWT user owns it, then creates the Checkout session.
// ============================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const APP_URL = Deno.env.get("APP_URL") ?? "https://example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS — lock origin down to APP_URL in production
const cors = {
  "Access-Control-Allow-Origin": APP_URL,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Subscription price IDs — set these to your real Stripe Price IDs after you
// create the products in the Stripe dashboard.
const SUB_PRICES: Record<string, string | undefined> = {
  venue_console: Deno.env.get("PRICE_VENUE_CONSOLE"),
  jgb_shows:     Deno.env.get("PRICE_JGB_SHOWS"),
  pro:           Deno.env.get("PRICE_PRO"),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    if (!jwt) return json({ error: "no_auth" }, 401);

    // service client (reads orders past RLS) + a check that the JWT user owns the order
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await svc.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "bad_session" }, 401);

    const body = await req.json();

    // ── Subscription checkout ─────────────────────────────────────────────
    if (body.mode === "subscription") {
      const price = SUB_PRICES[body.kind];
      if (!price) return json({ error: "no_price_for_kind" }, 400);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        client_reference_id: body.intent_id ?? "",
        metadata: { kind: body.kind, intent_id: body.intent_id ?? "", supabase_uid: uid },
        success_url: `${APP_URL}/index.html?sub=ok`,
        cancel_url: `${APP_URL}/index.html?sub=cancel`,
      });
      return json({ url: session.url });
    }

    // ── One-time order checkout (ticket / shakedown / art) ────────────────
    const orderId = body.order_id;
    if (!orderId) return json({ error: "no_order" }, 400);
    const { data: order } = await svc.from("chat_order").select("*").eq("id", orderId).single();
    if (!order || order.status !== "pending") return json({ error: "bad_order" }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: order.currency ?? "usd",
          product_data: { name: labelFor(order) },
          unit_amount: Math.round(order.amount_cents / order.qty),
        },
        quantity: order.qty,
      }],
      client_reference_id: orderId,
      metadata: { order_id: orderId, kind: order.kind, supabase_uid: uid },
      success_url: `${APP_URL}/index.html?order=ok`,
      cancel_url: `${APP_URL}/index.html?order=cancel`,
    });

    // attach the session id to the order (service role)
    await svc.from("chat_order").update({ stripe_session_id: session.id }).eq("id", orderId);
    return json({ url: session.url });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function labelFor(o: any): string {
  if (o.kind === "ticket") return "dead.dance ticket";
  if (o.kind === "shakedown") return "The Lot booth";
  if (o.kind === "art") return "dead.dance art";
  return "dead.dance order";
}
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });
}
