/* dd_spread.js — ALWAYS MAKE A SPREAD.
   One source image (or a video's still frame) → a variant styled NATIVE to each destination
   network: right aspect ratio, on-image text + emojis in that network's voice, and a QR baked in.
   TikTok looks like TikTok; Facebook like Facebook; Reddit is deliberately un-branded and plain.
   Data-driven: add a row to NETWORKS and it joins the spread. Render is browser-canvas; the PLAN
   (what each variant will say/look like) is pure + unit-tested. Needs qr.js (QRLite) for the code. */
(function (root) {
  // DeadDance mark for the center of the QR — start loading now (sw-cached, near-instant).
  var _mark = null;
  function markImg() { if (_mark) return _mark; try { _mark = root.document.createElement('img'); _mark.src = 'dd-512.png'; } catch (e) {} return _mark; }
  try { markImg(); } catch (e) {}
  // ---- the per-network style spec: the "look and feel", dreamt up per platform ----
  var NETWORKS = [
    { id: 'tiktok', name: 'TikTok', w: 1080, h: 1920, ratio: '9:16', tone: 'punchy, trend-native, loud',
      case: 'upper', align: 'center', headYFrac: 0.70, maxLines: 3,
      head: { font: '900 84px "Arial Black",Impact,sans-serif', fill: '#ffffff', stroke: '#000000', strokeW: 12 },
      sub:  { font: '700 42px sans-serif', fill: '#ffffff', stroke: '#000', strokeW: 7, yFrac: 0.80 },
      emojis: ['✨', '🔥', '🎵', '🕺', '🌹'], emojiN: 3, emojiYFrac: 0.865,
      accent: { style: 'tag', color: '#25F4EE', color2: '#FE2C55' }, brand: true, scrim: 0.55, qr: true },

    { id: 'reels', name: 'Instagram Reels', w: 1080, h: 1920, ratio: '9:16', tone: 'aesthetic, clean, kinetic',
      case: 'title', align: 'center', headYFrac: 0.72, maxLines: 3,
      head: { font: '800 78px "Helvetica Neue",sans-serif', fill: '#ffffff', stroke: '#000', strokeW: 4 },
      sub:  { font: '600 40px sans-serif', fill: '#ffffff', stroke: '#000', strokeW: 3, yFrac: 0.81 },
      emojis: ['🌹', '✨', '🎶', '💫'], emojiN: 2, emojiYFrac: 0.87,
      accent: { style: 'pill', color: '#ffffff' }, brand: true, scrim: 0.5, qr: true },

    { id: 'ig_feed', name: 'Instagram Feed', w: 1080, h: 1350, ratio: '4:5', tone: 'polished, editorial',
      case: 'title', align: 'left', headYFrac: 0.80, maxLines: 2,
      head: { font: '800 62px "Helvetica Neue",sans-serif', fill: '#ffffff', stroke: '#000', strokeW: 3 },
      sub:  { font: '600 34px sans-serif', fill: '#f2eafd', stroke: '#000', strokeW: 2, yFrac: 0.885 },
      emojis: ['🌹', '🎸'], emojiN: 1, emojiYFrac: 0.93,
      accent: { style: 'pill', color: '#ffffff' }, brand: true, scrim: 0.55, qr: true },

    { id: 'facebook', name: 'Facebook', w: 1080, h: 1080, ratio: '1:1', tone: 'warm, community, friendly',
      case: 'as-is', align: 'left', headYFrac: 0.82, maxLines: 2,
      head: { font: '800 58px "Segoe UI",Roboto,sans-serif', fill: '#ffffff', stroke: '#00000088', strokeW: 2 },
      sub:  { font: '600 34px sans-serif', fill: '#eafff2', stroke: '#0006', strokeW: 1, yFrac: 0.90 },
      emojis: ['🌹', '🙌', '🎸'], emojiN: 2, emojiYFrac: 0.955,
      accent: { style: 'bar', color: '#1877F2' }, brand: true, scrim: 0.6, qr: true },   // FB blue bar

    { id: 'x', name: 'X', w: 1600, h: 900, ratio: '16:9', tone: 'concise, dry, one-line',
      case: 'as-is', align: 'left', headYFrac: 0.80, maxLines: 1,
      head: { font: '700 56px "Helvetica Neue",Arial,sans-serif', fill: '#ffffff', stroke: '#000', strokeW: 3 },
      sub:  null, emojis: ['🎶'], emojiN: 1, emojiYFrac: 0.92,
      accent: { style: 'none' }, brand: true, scrim: 0.45, qr: true },

    { id: 'reddit', name: 'Reddit', w: 1200, h: 900, ratio: '4:3', tone: 'authentic, plain, un-marketed',
      case: 'as-is', align: 'left', headYFrac: 0.86, maxLines: 2,
      head: { font: '600 46px "IBM Plex Sans",Arial,sans-serif', fill: '#ffffff', stroke: '#000', strokeW: 3 },
      sub:  null, emojis: [], emojiN: 0, emojiYFrac: 0,                          // Reddit hates ads: no emoji, no gloss
      accent: { style: 'none' }, brand: false, scrim: 0.5, qr: true },           // no rose mark — looks like a real person posted it

    { id: 'youtube', name: 'YouTube', w: 1280, h: 720, ratio: '16:9', tone: 'bold thumbnail, high-contrast',
      case: 'upper', align: 'left', headYFrac: 0.30, maxLines: 3,
      head: { font: '900 76px "Arial Black",Impact,sans-serif', fill: '#ffdd00', stroke: '#000', strokeW: 12 },
      sub:  { font: '800 40px sans-serif', fill: '#ffffff', stroke: '#000', strokeW: 8, yFrac: 0.5 },
      emojis: ['🔥', '👉'], emojiN: 1, emojiYFrac: 0.9,
      accent: { style: 'none' }, brand: true, scrim: 0.35, qr: true },

    { id: 'snapchat', name: 'Snapchat', w: 1080, h: 1920, ratio: '9:16', tone: 'casual, sticker, playful',
      case: 'as-is', align: 'center', headYFrac: 0.5, maxLines: 2,
      head: { font: '800 66px "Helvetica Neue",sans-serif', fill: '#000000', stroke: '#FFFC00', strokeW: 0, bg: '#FFFC00' },
      sub:  null, emojis: ['👻', '🎶', '🌹'], emojiN: 2, emojiYFrac: 0.6,
      accent: { style: 'none' }, brand: true, scrim: 0.25, qr: true } // Snap yellow caption bar
  ];

  function byId(id) { for (var i = 0; i < NETWORKS.length; i++) if (NETWORKS[i].id === id) return NETWORKS[i]; return null; }
  function cased(s, mode) { s = String(s == null ? '' : s); return mode === 'upper' ? s.toUpperCase() : (mode === 'title' ? s.replace(/\w\S*/g, function (t) { return t.charAt(0).toUpperCase() + t.slice(1); }) : s); }
  function emojiStr(net) { return (net.emojis || []).slice(0, net.emojiN || 0).join(' '); }

  // ---- PLAN: what each variant will SAY and be sized as (pure, testable, no canvas) ----
  function planOne(net, meta) {
    meta = meta || {};
    return {
      id: net.id, name: net.name, w: net.w, h: net.h, ratio: net.ratio, tone: net.tone,
      headline: cased(meta.headline || meta.band || 'Live this weekend', net.case),
      sub: net.sub ? (meta.sub || meta.venue || '') : '',
      emojis: emojiStr(net),
      brand: !!net.brand, qr: !!net.qr, align: net.align
    };
  }
  function plan(meta) { return NETWORKS.map(function (n) { return planOne(n, meta); }); }

  // ---- RENDER (browser canvas) ----
  function coverDraw(ctx, img, W, H) {
    var iw = img.width || img.videoWidth || W, ih = img.height || img.videoHeight || H;
    var s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
    try { ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { ctx.fillStyle = '#140b22'; ctx.fillRect(0, 0, W, H); }
  }
  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) { var t = line ? line + ' ' + words[i] : words[i]; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = words[i]; } else line = t; }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
    return lines;
  }
  function stroked(ctx, text, x, y, f) {
    ctx.font = f.font; ctx.textAlign = ctx._al || 'center'; ctx.textBaseline = 'middle';
    if (f.bg) { var w = ctx.measureText(text).width, pad = 18, hh = parseInt(f.font, 10) || 60; ctx.fillStyle = f.bg; ctx.fillRect((ctx._al === 'left' ? x - pad : x - w / 2 - pad), y - hh / 2 - 8, w + pad * 2, hh + 16); }
    if (f.strokeW) { ctx.lineWidth = f.strokeW; ctx.strokeStyle = f.stroke; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); }
    ctx.fillStyle = f.fill; ctx.fillText(text, x, y);
  }
  function scrim(ctx, W, H, amt) {
    if (!amt) return; var g = ctx.createLinearGradient(0, H * (1 - Math.min(0.7, amt + 0.15)), 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + amt + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawQR(ctx, net, url) {
    if (!net.qr) return; try {
      var m = root.QRLite && root.QRLite.matrix(url || 'https://deaddance.app/'); if (!m) return;
      var n = m.length, size = Math.round(Math.min(net.w, net.h) * 0.15), cell = Math.floor(size / (n + 8)) || 1, dim = cell * (n + 8);
      var x = net.w - dim - Math.round(net.w * 0.03), y = net.h - dim - Math.round(net.h * 0.03);
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, dim, dim); ctx.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) ctx.fillRect(x + (c + 4) * cell, y + (r + 4) * cell, cell, cell);
      // the QR IS our logo — the DeadDance MARK sits in the center (conservative size for ECC-M scannability)
      var cx = x + dim / 2, cy = y + dim / 2, ls = Math.round(dim * 0.20), rr = Math.round(ls * 0.2);
      var mk = markImg();
      ctx.fillStyle = '#fff';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - ls / 2 - 2, cy - ls / 2 - 2, ls + 4, ls + 4, rr + 2); ctx.fill(); }
      else ctx.fillRect(cx - ls / 2 - 2, cy - ls / 2 - 2, ls + 4, ls + 4);
      if (mk && mk.complete && mk.naturalWidth) {
        ctx.save(); if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - ls / 2, cy - ls / 2, ls, ls, rr); ctx.clip(); }
        ctx.drawImage(mk, cx - ls / 2, cy - ls / 2, ls, ls); ctx.restore();
      } else { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = Math.round(ls * 0.82) + 'px serif'; ctx.fillText('🌹', cx, cy + Math.round(ls * 0.06)); }
    } catch (e) {}
  }
  function render(source, meta, netId) {
    meta = meta || {}; var net = byId(netId) || byId('tiktok');
    var cv = (root.document ? root.document.createElement('canvas') : null); if (!cv) return null;
    cv.width = net.w; cv.height = net.h; var ctx = cv.getContext('2d'); if (!ctx) return null;
    coverDraw(ctx, source, net.w, net.h);
    scrim(ctx, net.w, net.h, net.scrim);
    if (net.accent && net.accent.style === 'bar') { ctx.fillStyle = net.accent.color; ctx.fillRect(0, net.h - 10, net.w, 10); }
    if (net.accent && net.accent.style === 'tag') { ctx.fillStyle = net.accent.color2 || '#FE2C55'; ctx.fillRect(0, Math.round(net.h * (net.headYFrac - 0.11)), Math.round(net.w * 0.02), Math.round(net.h * 0.13)); }
    ctx._al = net.align; var x = net.align === 'left' ? Math.round(net.w * 0.06) : net.w / 2;
    ctx.font = net.head.font;
    var lines = wrap(ctx, cased(meta.headline || meta.band || 'Live this weekend', net.case), net.w * (net.align === 'left' ? 0.88 : 0.9), net.maxLines);
    var lh = (parseInt(net.head.font, 10) || 70) * 1.12, y0 = net.h * net.headYFrac - (lines.length - 1) * lh / 2;
    lines.forEach(function (ln, i) { stroked(ctx, ln, x, y0 + i * lh, net.head); });
    if (net.sub) { var sub = meta.sub || meta.venue || ''; if (sub) stroked(ctx, cased(sub, net.case === 'upper' ? 'as-is' : net.case), x, net.h * net.sub.yFrac, net.sub); }
    var em = emojiStr(net); if (em) { ctx._al = 'center'; stroked(ctx, em, net.w / 2, net.h * net.emojiYFrac, { font: '600 ' + Math.round(net.w * 0.06) + 'px sans-serif', fill: '#fff', stroke: '#000', strokeW: 0 }); }
    // EDICT: invisible layer. No dead.dance wordmark — the post must look native to the host network.
    // The only trace of us is the functional rose-QR (a link home, not a billboard).
    drawQR(ctx, net, (meta.url || 'https://deaddance.app/'));
    return cv;
  }
  // "oh man, give it 10 photos": pick the best-fitting source per network by aspect ratio, with variety.
  function aspect(img) { var w = (img && (img.width || img.videoWidth)) || 1, h = (img && (img.height || img.videoHeight)) || 1; return w / h; }
  function pickSource(sources, net, idx) {
    if (sources.length === 1) return sources[0];
    var target = net.w / net.h;
    var ranked = sources.map(function (s, i) { return { s: s, i: i, d: Math.abs(aspect(s) - target) }; }).sort(function (a, b) { return a.d - b.d; });
    var pool = ranked.slice(0, Math.max(2, Math.ceil(ranked.length / 2)));   // among the well-fitting half, rotate for variety
    return pool[idx % pool.length].s;
  }
  function spread(source, meta) {
    var sources = (typeof Array !== 'undefined' && Array.isArray(source)) ? source.filter(Boolean) : [source];
    if (!sources.length) return [];
    return NETWORKS.map(function (n, i) {
      var src = pickSource(sources, n, i), cv = render(src, meta, n.id);
      return { id: n.id, name: n.name, ratio: n.ratio, canvas: cv, dataURL: cv ? cv.toDataURL('image/png') : null };
    });
  }

  // ---- SPREAD AT SCALE: 10 images × 345 fans → give each fan a DIFFERENT one. Iterate (even usage) then
  //      randomize (shuffle) so no two neighbours match and nothing looks bulk-sent. Pure + tested. ----
  function assign(nSources, nRecipients) {
    nSources = Math.max(1, nSources | 0); nRecipients = Math.max(0, nRecipients | 0);
    var out = [], i, j, k, t;
    for (i = 0; i < nRecipients; i++) out.push(i % nSources);          // even round-robin — each image used ~equally
    for (j = out.length - 1; j > 0; j--) { k = Math.floor(Math.random() * (j + 1)); t = out[j]; out[j] = out[k]; out[k] = t; }  // shuffle
    return out;
  }
  // per recipient, vary BOTH the image and the styling — max "hand-made, not bulk" variety.
  function personalize(nSources, nStyles, nRecipients) {
    var s = assign(nSources, nRecipients), st = assign(Math.max(1, nStyles || NETWORKS.length), nRecipients);
    return s.map(function (src, i) { return { src: src, style: st[i] }; });
  }

  root.DDSpread = { NETWORKS: NETWORKS, byId: byId, plan: plan, planOne: planOne, render: render, spread: spread, assign: assign, personalize: personalize, _cased: cased, _emoji: emojiStr, _pick: pickSource, _aspect: aspect };
})(typeof window !== 'undefined' ? window : this);
