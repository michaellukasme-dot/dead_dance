// ============================================================================
// sf-webhook — Supabase Edge Function (Deno)
// Stripe webhook for StageFill. Two things happen here, verified by signature:
//   • checkout.session.completed (kind=sf_ticket) → mark sf_order PAID + bump qty_sold.
//   • customer.subscription.created/updated (metadata.slug) → sf_mark_subscribed(slug, until)
//     so the festival's map unlocks (freemium gate opens).
//
// DEPLOY (you run once):
//   supabase functions deploy sf-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx
//   Then add the endpoint in the Stripe dashboard → Webhooks:
//     https://<project>.functions.supabase.co/sf-webhook
//     events: checkout.session.completed, customer.subscription.created,
//             customer.subscription.updated, customer.subscription.deleted
// ============================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
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
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.kind === "sf_ticket" && s.metadata?.order_id && s.payment_status === "paid") {
        const orderId = s.metadata.order_id;
        const { data: order } = await svc.from("sf_order")
          .select("id, ticket_type_id, qty, status").eq("id", orderId).single();
        if (order && order.status !== "paid") {
          await svc.from("sf_order").update({ status: "paid" }).eq("id", orderId);
          if (order.ticket_type_id) {
            const { data: tt } = await svc.from("sf_ticket_type")
              .select("qty_sold").eq("id", order.ticket_type_id).single();
            await svc.from("sf_ticket_type")
              .update({ qty_sold: (tt?.qty_sold ?? 0) + (order.qty ?? 1) })
              .eq("id", order.ticket_type_id);
          }
        }
      }
    }

    if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      const slug = (sub.metadata?.slug as string) || "";
      if (slug) {
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
    }
  } catch (e) {
    return new Response(`handler error: ${(e as Error).message}`, { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "content-type": "application/json" } });
});
