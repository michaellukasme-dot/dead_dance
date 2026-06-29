// ============================================================================
// dd-webhook — Supabase Edge Function (Deno)
// Receives Stripe events, VERIFIES the signature, and fulfils orders:
//   checkout.session.completed (payment)      → chat_order_mark_paid
//   checkout.session.completed (subscription) → chat_subscription_set_status(active)
//   customer.subscription.updated/deleted     → chat_subscription_set_status
// Only Stripe can call this meaningfully (signature-verified). It uses the
// SERVICE ROLE key, which is the only principal allowed to run the *_set_status
// / mark_paid functions (execute was revoked from users in files 13/14).
//
// DEPLOY:
//   supabase functions deploy dd-webhook --no-verify-jwt    (Stripe sends no JWT)
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
//   Then add the function URL as a webhook endpoint in the Stripe dashboard,
//   subscribed to: checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted, charge.refunded.
// ============================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const WHSEC = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig!, WHSEC);  // rejects forged calls
  } catch (e) {
    return new Response(`bad signature: ${e?.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription") {
          await svc.rpc("chat_subscription_set_status", {
            p_stripe_sub: s.subscription as string,
            p_customer: s.customer as string,
            p_status: "active",
            p_period_end: null,
            p_intent_id: s.metadata?.intent_id || null,
          });
        } else {
          await svc.rpc("chat_order_mark_paid", {
            p_session: s.id,
            p_intent: (s.payment_intent as string) ?? null,
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await svc.rpc("chat_subscription_set_status", {
          p_stripe_sub: sub.id,
          p_customer: sub.customer as string,
          p_status: event.type.endsWith("deleted") ? "canceled"
                    : (sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled"),
          p_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          p_intent_id: null,
        });
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        await svc.from("chat_order").update({ status: "refunded" })
          .eq("stripe_payment_intent", ch.payment_intent as string);
        break;
      }
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`handler error: ${e?.message}`, { status: 500 });
  }
});
