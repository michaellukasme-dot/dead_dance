/* dd_pay.js — the store of stores (window.DDPay).
   A thin client over the edge functions. Cards + the Stripe secret NEVER touch here.
     onboard(kind,name,slug) → Stripe Connect onboarding (band/partner gets paid direct)
     status(slug)            → can this merchant receive money yet? { charges_enabled }
     buy(orderId)            → hosted Stripe Checkout for a server-priced order
   Degrades gracefully if the client/functions aren't wired — never throws to the page. */
(function (root) {
  'use strict';
  function C() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function invoke(fn, body) {
    var c = C(); if (!c || !c.functions) return Promise.reject(new Error('payments not connected'));
    return c.functions.invoke(fn, { body: body || {} }).then(function (r) { if (r.error) throw r.error; return r.data || {}; });
  }

  // Band/partner connects their payout account → redirect to Stripe's hosted onboarding.
  function onboard(kind, name, slug) {
    slug = slug || slugify(name);
    return invoke('dd-connect', { kind: kind || 'band', name: name || '', slug: slug }).then(function (d) {
      if (d && d.url) { root.location.href = d.url; return true; }
      throw new Error((d && d.error) || 'onboard_failed');
    });
  }
  // Are they able to receive money yet?
  function status(slug) {
    return invoke('dd-connect', { mode: 'status', slug: slugify(slug) }).catch(function () { return { charges_enabled: false }; });
  }
  // Pay for a server-priced order (create the order first). Redirects to hosted Checkout.
  function buy(orderId) {
    return invoke('dd-checkout', { order_id: orderId }).then(function (d) {
      if (d && d.url) { root.location.href = d.url; return true; }
      throw new Error((d && d.error) || 'checkout_failed');
    });
  }
  root.DDPay = { onboard: onboard, status: status, buy: buy, slugify: slugify };
})(typeof window !== 'undefined' ? window : this);
