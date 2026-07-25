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

    // RESERVE stock atomically (row-locked; counts holds against capacity). Server-computed price —
    // the client can't tamper, and concurrent buyers for the last seat are serialized here.
    const { data: rz, error: rErr } = await svc.rpc("sf_reserve", { p_tt: ttId, p_qty: qty, p_buyer: body.buyer ?? null });
    if (rErr) return json({ error: "reserve_failed" }, 500);
    if (rz?.error) return json({ error: rz.error, available: rz.available }, 400);   // sold_out / unavailable / free

    const order = { id: rz.order_id as string };
    const reservedSecs = Number(rz.reserved_secs ?? 1800);

    // co-promotion attribution: who drove this buyer (band fan-link vs venue patron-link). Side-write only —
    // does not touch the reservation/capacity path.
    const ref = ["band", "venue", "door"].includes(String(body.ref)) ? String(body.ref) : "direct";
    if (ref !== "direct") { try { await svc.from("sf_order").update({ ref_src: ref }).eq("id", order.id); } catch (_e) { /* attribution is best-effort */ } }

    const { data: ev } = await svc.from("sf_event")
      .select("id, slug, name, stripe_account").eq("id", rz.event_id).single();
    if (!ev) return json({ error: "event_missing" }, 400);

    const fee = Number(rz.fee_cents);

    // build the session — Connect transfer if the owner has connected; else platform charge
    const line = {
      quantity: Number(rz.qty),
      price_data: {
        currency: rz.currency || "usd",
        unit_amount: Number(rz.price_cents),
        product_data: { name: `${ev.name} — ${rz.name}` },
      },
    };
    const params: Record<string, unknown> = {
      mode: "payment",
      line_items: [line],
      customer_email: body.buyer_email ?? undefined,
      // expire the Stripe session on the SAME clock as the reservation hold, so a stale session
      // can't be paid after the stock is released back to the pool (no late-payment oversell).
      expires_at: Math.floor(Date.now() / 1000) + reservedSecs,
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
