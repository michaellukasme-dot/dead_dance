/* dd_qrmark.js — a unique, branded QR for every entity (band, act, venue, show).
   QR is EVERYTHING: each entity's QR encodes its own vanity URL, so one scan opens
   exactly that page. Built on the house encoder (QRLite, qr.js) — self-contained,
   offline, decode-verified — with a small centered mark for brand:
     • mark:'dd' → the DeadDance mark (dd-512.png)     [deaddance.app/<band>]
     • mark:'sf' → the StageFill badge (teal ◢)         [stagefill.app/<act>]
   The mark is ~20% width → ~4% of area, well inside QR level-M's ~15% recovery, so it
   always scans. DeadDance and StageFill get the identical treatment — one white-label
   face, two coats. */
(function (root) {
  function rr(ctx, x, y, w, h, r) { ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawMark(canvas, mark) {
    var ctx = canvas.getContext('2d'), W = canvas.width, m = Math.round(W * 0.15),
        x = (W - m) / 2, y = (W - m) / 2, pad = Math.round(m * 0.10);   // knockout ≈3% area (was ~7%) → more ECC margin
    ctx.fillStyle = '#fff'; rr(ctx, x - pad, y - pad, m + 2 * pad, m + 2 * pad, Math.round(m * 0.22)); ctx.fill();
    if (mark === 'sf') {
      ctx.fillStyle = '#0fa3a0'; rr(ctx, x, y, m, m, Math.round(m * 0.24)); ctx.fill();
      ctx.fillStyle = '#04201f'; ctx.font = 'bold ' + Math.round(m * 0.60) + 'px -apple-system,Segoe UI,Roboto,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('◢', W / 2, W / 2 + Math.round(m * 0.03));
      return Promise.resolve();
    }
    return new Promise(function (res) { var img = new Image();
      img.onload = function () { try { ctx.drawImage(img, x, y, m, m); } catch (e) {} res(); };
      img.onerror = function () { res(); }; img.src = 'dd-512.png'; });
  }

  // draw into an existing <canvas>; returns a promise resolving to the canvas
  function draw(canvas, text, opts) {
    opts = opts || {};
    if (!root.QRLite) { try { canvas.dataset.qrOk = '0'; } catch (e) {} return Promise.resolve(canvas); }
    try { root.QRLite.drawCanvas(text, canvas, { size: opts.size || 200, dark: opts.dark || '#1a1320', light: '#ffffff', quiet: 4 }); try { canvas.dataset.qrOk = '1'; } catch (e) {} }
    catch (e) { try { console.error('DDQR: QR encode FAILED for payload:', text, e); canvas.dataset.qrOk = '0'; } catch (_) {} return Promise.resolve(canvas); }   // fail LOUD — never a silent blank
    return drawMark(canvas, opts.mark || 'dd').then(function () { return canvas; });
  }

  // render into a container element (creates the canvas)
  // DUAL-DOOR QR: you can't scan a QR that's on your OWN screen (e.g. one texted to you), so every
  // QR we draw for a URL is ALSO a tappable link. Tap on your phone → opens it. Scan from another
  // phone / print → the camera door. One change here makes EVERY DeadDance QR clickable + scannable.
  function into(container, text, opts) {
    opts = opts || {};
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return Promise.resolve(null);
    var cv = container.querySelector('canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.style.width = (opts.css || 150) + 'px'; cv.style.height = cv.style.width; cv.style.borderRadius = '10px';
      var isUrl = /^https?:\/\//i.test(String(text || ''));
      if (isUrl && opts.link !== false) {
        var a = document.createElement('a');
        a.href = text; a.target = '_blank'; a.rel = 'noopener';
        a.title = 'Tap to open — or scan with another phone';
        a.style.cssText = 'display:inline-block;line-height:0;cursor:pointer';
        container.innerHTML = ''; a.appendChild(cv); container.appendChild(a);
        if (opts.caption) {
          var cap = document.createElement('div');
          cap.style.cssText = 'font-size:11px;color:#7a7285;font-weight:700;text-align:center;margin-top:5px';
          cap.textContent = '👆 Tap to open · 📷 or scan';
          container.appendChild(cap);
        }
      } else { container.innerHTML = ''; container.appendChild(cv); }
    }
    return draw(cv, text, opts);
  }

  // download a high-res PNG of the branded QR
  function save(text, opts, filename) {
    opts = opts || {}; var cv = document.createElement('canvas');
    return draw(cv, text, { size: opts.size || 620, mark: opts.mark || 'dd', dark: opts.dark || '#1a1320' }).then(function () {
      if (cv.dataset && cv.dataset.qrOk === '0') { try { console.error('DDQR: refusing to save a failed QR for', text); } catch (e) {} return false; }   // never download a blank
      try { var a = document.createElement('a'); a.download = filename || 'deaddance-qr.png'; a.href = cv.toDataURL('image/png'); a.click(); return true; } catch (e) { return false; }
    });
  }

  root.DDQR = { draw: draw, into: into, save: save };
})(typeof window !== 'undefined' ? window : this);
