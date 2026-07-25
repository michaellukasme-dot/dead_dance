// ============================================================================
// sf-checkout — Supabase Edge Function (Deno)
// Opens a Stripe HOSTED Checkout session for a StageFill event ticket.
// Cards never touch our servers. The PRICE is read server-side from
// public.sf_ticket_type, so the client cannot tamper with it. 15% of the sale
// is the ArtsQuest / StageFill platform fee (Stripe application_fee_amount);
// the remainder transfers to the event owner's connected Stripe account.
//
// REQUEST (POST):  { ticket_type_id, qty, buyer_email?, buyer? }
// RESPONSE:        { url }  — redirect the browser here.
//
// DEPLOY (you run once):
//   supabase functions deploy sf-checkout --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx APP_URL=https://deaddance.app
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ============================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const APP_URL = Deno.env.get("APP_URL") ?? "https://deaddance.app";
const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FEE_BPS = 1500; // 15.00%

const cors = {
  "Access-Control-Allow-Origin": APP_URL,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const ttId = String(body.ticket_type_id ?? "");
    const qty = Math.max(1, Math.min(20, parseInt(body.qty ?? "1", 10) || 1));
    if (!ttId) return json({ error: "no_ticket_type" }, 400);

    // price + availability, server-side (client cannot tamper)
    const { data: tt } = await svc.from("sf_ticket_type")
      .select("id, event_id, name, price_cents, currency, qty_total, qty_sold, active").eq("id", ttId).single();
    if (!tt || !tt.active) return json({ error: "ticket_unavailable" }, 400);
    if (tt.qty_total != null && (tt.qty_sold + qty) > tt.qty_total) return json({ error: "sold_out" }, 400);

    const { data: ev } = await svc.from("sf_event")
      .select("id, slug, name, stripe_account").eq("id", tt.event_id).single();
    if (!ev) return json({ error: "event_missing" }, 400);

    const amount = tt.price_cents * qty;
    const fee = Math.round((amount * FEE_BPS) / 10000);

    // pending order (service role; RLS bypassed)
    const { data: order, error: oErr } = await svc.from("sf_order").insert({
      event_id: ev.id, ticket_type_id: tt.id, buyer: body.buyer ?? null,
      qty, amount_cents: amount, fee_cents: fee, status: "pending",
    }).select("id").single();
    if (oErr || !order) return json({ error: "order_failed" }, 500);

    // build the session — Connect transfer if the owner has connected; else platform charge
    const line = {
      quantity: qty,
      price_data: {
        currency: tt.currency || "usd",
        unit_amount: tt.price_cents,
        product_data: { name: `${ev.name} — ${tt.name}` },
      },
    };
    const params: Record<string, unknown> = {
      mode: "payment",
      line_items: [line],
      customer_email: body.buyer_email ?? undefined,
      success_url: `${APP_URL}/event_page.html?ev=${encodeURIComponent(ev.slug)}&paid=1`,
      cancel_url: `${APP_URL}/event_page.html?ev=${encodeURIComponent(ev.slug)}`,
      metadata: { order_id: order.id, kind: "sf_ticket" },
    };
    if (ev.stripe_account) {
      params.payment_intent_data = {
        application_fee_amount: fee,
        transfer_data: { destination: ev.stripe_account },
      };
    }
    const session = await stripe.checkout.sessions.create(params as any);
    await svc.from("sf_order").update({ stripe_session: session.id }).eq("id", order.id);

    return json({ url: session.url });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
