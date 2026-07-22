/* dd_providers.js — chapter print/merch partners (window.DDProviders).
   A band's store offers the LOCAL chapter partner's LESS/MORE/MOST bundles; the partner
   fulfills. forRegion() finds the chapter's printer (falls back to the newest active one so
   there's always a printer during launch). Degrades to [] if the backend (dd_providers.sql)
   isn't run yet — never throws. */
(function (root) {
  'use strict';
  function C() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var u = (root.DDMe && root.DDMe.id && root.DDMe.id()); if (u) return String(u); var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  // the chapter's print partner (region match, else newest active). Resolves {} if none.
  function forRegion(region) {
    var c = C(); if (!c) return Promise.resolve(null);
    return c.rpc('dd_provider_for_region', { p_region: region || '' })
      .then(function (r) { var a = (r && r.data) || []; return a[0] || null; }).catch(function () { return null; });
  }
  function get(slug) {
    var c = C(); if (!c || !slug) return Promise.resolve(null);
    return c.rpc('dd_provider_get', { p_slug: String(slug) })
      .then(function (r) { var a = (r && r.data) || []; return a[0] || null; }).catch(function () { return null; });
  }
  function bundles(providerId) {
    var c = C(); if (!c || !providerId) return Promise.resolve([]);
    return c.rpc('dd_bundles_list', { p_provider_id: providerId })
      .then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  }
  // a band store asks: who prints for my chapter, and what are their bundles?
  function forRegionWithBundles(region) {
    return forRegion(region).then(function (p) {
      if (!p) return null;
      return bundles(p.id).then(function (b) { p.bundles = b || []; return p; });
    });
  }
  function upsert(p) {
    var c = C(); p = p || {}; if (!c) return Promise.resolve(null);
    return c.rpc('dd_provider_upsert', { p_member: myId(), p_slug: p.slug || slugify(p.name), p_name: p.name || null,
      p_kind: p.kind || 'print', p_region: p.region || null, p_phone: p.phone || null, p_site: p.site || null,
      p_address: p.address || null, p_blurb: p.blurb || null, p_logo: p.logo || null })
      .then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; }).catch(function () { return null; });
  }
  function addBundle(providerId, b) {
    var c = C(); b = b || {}; if (!c || !providerId) return Promise.resolve(null);
    return c.rpc('dd_bundle_add', { p_provider_id: providerId, p_tier: b.tier || null, p_name: b.name || null,
      p_descr: b.descr || null, p_price: (b.price != null ? +b.price : null), p_sort: b.sort || 0 })
      .then(function (r) { return (r && r.data) || null; }).catch(function () { return null; });
  }

  root.DDProviders = { forRegion: forRegion, get: get, bundles: bundles, forRegionWithBundles: forRegionWithBundles,
    upsert: upsert, addBundle: addBundle, slugify: slugify };
})(typeof window !== 'undefined' ? window : this);
