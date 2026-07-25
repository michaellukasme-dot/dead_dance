// ============================================================================
// sf-webhook — Supabase Edge Function (Deno). HARDENED per review.
//   • Signature-verified (raw body).
//   • Idempotent: every Stripe event.id is recorded via sf_webhook_seen(); replays are no-ops.
//   • checkout.session.completed (kind=sf_ticket) → mark sf_order PAID (only from 'pending') +
//     ATOMIC qty_sold bump via sf_ticket_sold_inc() (no read-modify-write race).
//   • customer.subscription.* → unlock a festival ONLY if the sub carries the festival plan price
//     (PRICE_FESTIVAL); never trusts metadata.slug alone.
//
// DEPLOY (you run once):
//   supabase functions deploy sf-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx PRICE_FESTIVAL=price_xxx
//   Stripe dashboard → Webhooks → add https://<project>.functions.supabase.co/sf-webhook
//     events: checkout.session.completed, customer.subscription.created/updated/deleted
// ============================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const PRICE_FESTIVAL = Deno.env.get("PRICE_FESTIVAL") || "";
const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WH_SECRET);
  } catch (e) {
    return new Response(`bad signature: ${(e as Error).message}`, { status: 400 });
  }

  try {
    // idempotency: first delivery returns true; replays return false → skip.
    const { data: first } = await svc.rpc("sf_webhook_seen", { p_id: event.id });
    if (first === false) return ok();

    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.kind === "sf_ticket" && s.metadata?.order_id && s.payment_status === "paid") {
        const orderId = s.metadata.order_id;
        // flip to paid only if still pending (belt) and read qty/ticket for the atomic bump
        const { data: order } = await svc.from("sf_order")
          .select("id, ticket_type_id, qty, status").eq("id", orderId).single();
        if (order && order.status !== "paid") {
          await svc.from("sf_order").update({ status: "paid" }).eq("id", orderId).eq("status", "pending");
          if (order.ticket_type_id) {
            await svc.rpc("sf_ticket_sold_inc", { p_tt: order.ticket_type_id, p_qty: order.qty ?? 1 });
          }
        }
      }
    }

    if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      const slug = (sub.metadata?.slug as string) || "";
      const isFestivalPlan = PRICE_FESTIVAL &&
        (sub.items?.data ?? []).some((i) => i.price?.id === PRICE_FESTIVAL);
      if (slug && isFestivalPlan) {
        const active = sub.status === "active" || sub.status === "trialing";
        if (event.type === "customer.subscription.deleted" || !active) {
          await svc.from("sf_event").update({ subscribed: false }).eq("slug", slug);
        } else {
          const until = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)
            : null;
          await svc.rpc("sf_mark_subscribed", { p_slug: slug, p_until: until });
        }
      }
      // subs without the festival price (e.g. a $20/mo band plan) are ignored here by design.
    }
  } catch (e) {
    return new Response(`handler error: ${(e as Error).message}`, { status: 500 });
  }
  return ok();
});

function ok() {
  return new Response(JSON.stringify({ received: true }), { headers: { "content-type": "application/json" } });
}
