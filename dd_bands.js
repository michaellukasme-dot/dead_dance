/* dd_bands.js — the REAL bands directory client.
   A band a person claims/creates PERSISTS (dd_band_upsert) with its logo, and the
   Bands tab / directory reads it back (dd_bands_list) so it shows for everyone.
   Logos are resized to a small PNG data URL before upload (keeps rows sane; no
   Storage bucket required). Best-effort: quiet reject/[]. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }

  // shrink a logo data URL to <= maxDim px (PNG, keeps transparency) so it fits in a text column
  function resizeLogo(dataUrl, maxDim) {
    maxDim = maxDim || 384;
    return new Promise(function (resolve) {
      try {
        if (!dataUrl || dataUrl.indexOf('data:image') !== 0) return resolve(dataUrl || null);
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.width, h = img.height, sc = Math.min(1, maxDim / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
            var c = document.createElement('canvas'); c.width = cw; c.height = ch;
            c.getContext('2d').drawImage(img, 0, 0, cw, ch);
            resolve(c.toDataURL('image/png'));
          } catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl || null); }
    });
  }

  // o = {slug?, name, city, state, region, about, links, scene, logo(dataURL)}
  function upsert(o) {
    o = o || {}; var c = client();
    if (!c || !o.name) return Promise.reject('need name');
    var slug = o.slug || slugify(o.name);
    return resizeLogo(o.logo, 384).then(function (logo) {
      return c.rpc('dd_band_upsert', {
        p_slug: slug, p_name: o.name, p_city: o.city || null, p_state: o.state || null,
        p_region: o.region || null, p_about: o.about || null, p_links: o.links || null,
        p_scene: o.scene || 'grateful_dead', p_logo: logo || null, p_claimed_by: myId()
      }).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
    });
  }

  function list(region, limit) {
    var c = client(); if (!c) return Promise.resolve([]);
    return c.rpc('dd_bands_list', { p_limit: limit || 500, p_region: region || null })
      .then(function (r) { return (r && r.data) || []; })
      .catch(function () { return []; });
  }

  var chan = null;
  function subscribe(onChange) {
    var c = client(); if (!c || chan) return;
    try {
      chan = c.channel('dd_bands_live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dd_bands' },
          function (payload) { try { onChange && onChange(payload && (payload.new || payload.old)); } catch (e) {} })
        .subscribe();
    } catch (e) {}
  }

  root.DDBands = { upsert: upsert, list: list, slugify: slugify, resizeLogo: resizeLogo, subscribe: subscribe };
})(typeof window !== 'undefined' ? window : this);
