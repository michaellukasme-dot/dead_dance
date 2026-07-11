/* dd_refer.js — a claimed band refers OTHER bands. Two channels, two rules:
   EMAIL → staged as referrals that feed the invite campaign (CAN-SPAM: unsubscribe + real address).
   TEXT  → we NEVER auto-send (TCPA). We compose each message and LINE IT UP for Michael to send
           BY HAND from the dedicated responder line (his Android): number + message + an sms: tap-link.
   Referred bands land on onboarding attributed to the referrer:  ?src=refer&ref=<bandId>.
   Client-aware: submits via ddClient rpc when present; else stages locally (honest-state) until sync. */
(function (root) {
  var LINK_BASE = 'https://deaddance.app/band_onboard.html';
  var CUR = { band: '', id: '' };

  function client() {
    try { if (root.ddClient) { var c = root.ddClient(); if (c) return c; } } catch (e) {}
    return null;
  }
  function refLink(bandId) { return LINK_BASE + '?src=refer&ref=' + encodeURIComponent(bandId || ''); }
  function composeText(referrer, bandId) {
    return 'Hey — Michael here, from dead.dance. ' + (referrer ? (referrer + ' ') : 'A friend ') +
      'thought your band should have its own page — calendar, store, karaoke — all free, no charge ever. ' +
      'Claim it in a minute: ' + refLink(bandId);
  }
  function parseEmails(t) {
    return String(t || '').split(/[\n,;]+/).map(function (s) { return s.trim(); })
      .filter(function (e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
  }
  function parseTexts(t) {
    return String(t || '').split(/\n+/).map(function (l) {
      l = l.trim(); if (!l) return null;
      var m = l.match(/(\+?\d[\d\-.\s()]{6,}\d)/); if (!m) return null;
      var phone = m[1].replace(/[^\d+]/g, '');
      var name = l.replace(m[1], '').replace(/[,\-–—|]+\s*$/, '').replace(/^\s*[,\-–—|]+/, '').trim();
      return { name: name, phone: phone };
    }).filter(Boolean);
  }
  function smsLink(phone, body) { return 'sms:' + phone + '?&body=' + encodeURIComponent(body); }
  function stash(key, arr) { try { var cur = JSON.parse(root.localStorage.getItem(key) || '[]'); cur = cur.concat(arr); root.localStorage.setItem(key, JSON.stringify(cur.slice(-500))); } catch (e) {} }

  function doSubmit() {
    var eT = document.getElementById('rfEmails'), tT = document.getElementById('rfTexts');
    var emails = parseEmails(eT && eT.value), texts = parseTexts(tT && tT.value);
    var c = client(), out = { emails: 0, texts: 0 };
    var by = CUR.band, byId = CUR.id;

    emails.forEach(function (em) {
      stash('dd.refer.emails', [{ type: 'email', to: em, by: by, byId: byId, at: Date.now() }]);
      if (c) { try { c.rpc('chat_qa_submit', { p_task: 'refer', p_note: '[REFER-EMAIL] ' + em + '  ← referred by ' + (by || 'a band'), p_tester: (by || null), p_console: 'refer', p_shot: null }).catch(function () {}); } catch (e) {} }
      out.emails++;
    });

    texts.forEach(function (t) {
      var msg = composeText(by, byId);
      stash('dd.refer.texts', [{ type: 'text', name: t.name, phone: t.phone, msg: msg, sms: smsLink(t.phone, msg), by: by, byId: byId, at: Date.now() }]);
      if (c) { try { c.rpc('chat_qa_submit', { p_task: 'refer', p_note: '[REFER-TEXT] send to ' + t.phone + (t.name ? (' (' + t.name + ')') : '') + ': ' + msg, p_tester: (by || null), p_console: 'refer', p_shot: null }).catch(function () {}); } catch (e) {} }
      out.texts++;
    });
    return out;
  }

  root.DDRefer = {
    card: function (referrerBand, bandId) {
      CUR = { band: referrerBand || '', id: bandId || '' };
      return '<div class="refer" style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px;text-align:left">' +
        '<h3 style="margin:4px 0 2px">🎸 Know other bands? Refer them.</h3>' +
        '<div class="sub">Every band you bring gets their own page — and you planted it.</div>' +
        '<label for="rfEmails">Their emails <span style="font-weight:400">(one per line)</span></label>' +
        '<textarea id="rfEmails" rows="3" placeholder="booking@otherband.com"></textarea>' +
        '<label for="rfTexts">Their cell numbers <span style="font-weight:400">(Band, 215-555-1212 — one per line)</span></label>' +
        '<textarea id="rfTexts" rows="3" placeholder="The Other Band, 215-555-1212"></textarea>' +
        '<button class="btn go" style="width:100%;margin-top:8px" onclick="DDRefer.submit()">Refer these bands →</button>' +
        '<div id="rfDone" style="text-align:center;font-weight:700;color:#1f7a4d;margin-top:6px"></div>' +
        '<div class="honest">Emails join our invite list — every message has an unsubscribe and a real address. ' +
        '<b>Texts are never sent automatically</b> (that’s the law). We line each one up for <b>Michael to send by hand from the responder line</b> — a real human, one at a time.</div>' +
        '</div>';
    },
    submit: function () {
      var r = doSubmit(), m = [];
      if (r.emails) m.push(r.emails + ' email' + (r.emails === 1 ? '' : 's') + ' queued');
      if (r.texts) m.push(r.texts + ' text' + (r.texts === 1 ? '' : 's') + ' lined up for Michael');
      var msg = m.length ? ('🌹 Thanks — ' + m.join(' · ') + '.') : 'Add an email or a number first 🌹';
      if (root.toast) { try { root.toast(msg); } catch (e) {} }
      var el = document.getElementById('rfDone'); if (el) el.textContent = msg;
      var eT = document.getElementById('rfEmails'), tT = document.getElementById('rfTexts');
      if (r.emails && eT) eT.value = ''; if (r.texts && tT) tT.value = '';
      return r;
    },
    // exposed for tests
    _parseEmails: parseEmails, _parseTexts: parseTexts, _sms: smsLink, _compose: composeText, _refLink: refLink
  };
})(typeof window !== 'undefined' ? window : this);
