/* dd_art.js — the REAL 3rd-party vendor art store (posters).
   An artist uploads a piece ONCE (dd_art_add) and it persists in a shared catalog
   that BOTH storefronts read (dd_art_list): fans buy prints, bands license for a
   show. One upload, two fronts. Images are resized before upload so they fit in a
   text column (no Storage bucket needed today). Best-effort: quiet reject/[]. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }

  // shrink art to <= maxDim px as JPEG (posters are photographic — jpeg keeps rows sane)
  function resize(dataUrl, maxDim, quality) {
    maxDim = maxDim || 900; quality = quality || 0.82;
    return new Promise(function (resolve) {
      try {
        if (!dataUrl || dataUrl.indexOf('data:image') !== 0) return resolve(dataUrl || null);
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.width, h = img.height, sc = Math.min(1, maxDim / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
            var c = document.createElement('canvas'); c.width = cw; c.height = ch;
            var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); ctx.drawImage(img, 0, 0, cw, ch);
            resolve(c.toDataURL('image/jpeg', quality));
          } catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl || null); }
    });
  }

  // o = {vendor_slug?, vendor_name, title, price_print, price_license, image(dataURL), open_originals}
  function add(o) {
    o = o || {}; var c = client();
    if (!c || !o.image) return Promise.reject('need image');
    var slug = o.vendor_slug || slugify(o.vendor_name || 'artist');
    return resize(o.image, 900, 0.82).then(function (img) {
      return c.rpc('dd_art_add', {
        p_vendor_slug: slug, p_vendor_name: o.vendor_name || null, p_title: o.title || null,
        p_price_print: (o.price_print != null ? +o.price_print : null),
        p_price_license: (o.price_license != null ? +o.price_license : null),
        p_image: img, p_open: (o.open_originals !== false), p_by: myId()
      }).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
    });
  }

  // vendorSlug set = one artist's shop; null = the whole catalog (bands + fans browse)
  function list(vendorSlug, limit) {
    var c = client(); if (!c) return Promise.resolve([]);
    return c.rpc('dd_art_list', { p_vendor_slug: vendorSlug || null, p_limit: limit || 300 })
      .then(function (r) { return (r && r.data) || []; })
      .catch(function () { return []; });
  }

  var chan = null;
  function subscribe(onChange) {
    var c = client(); if (!c || chan) return;
    try {
      chan = c.channel('dd_art_live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dd_art' },
          function (payload) { try { onChange && onChange(payload && (payload.new || payload.old)); } catch (e) {} })
        .subscribe();
    } catch (e) {}
  }

  root.DDArt = { add: add, list: list, slugify: slugify, resize: resize, subscribe: subscribe };
})(typeof window !== 'undefined' ? window : this);
