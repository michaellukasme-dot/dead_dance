/* dd_wallet.js — DeadDance PHASE 3 Wallet PASS BUILDERS (pure, dual-export, guarded)
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • These builders are PURE and REAL: given a ticket, they return the pass.json /
       Google EventTicketObject / JWT-claim STRUCTURES. That part is proven by the
       Node harness (dd_wallet.test.js).
     • They do NOT sign anything. A usable Apple pass MUST be assembled + SIGNED on a
       SERVER with Michael's Apple Pass Type ID certificate + key; Google passes are
       signed with a service-account key. NO signing key ever lives in the client.
       → NOTHING here produces a "shipped" / installable pass. See dd_flywheel_backend/
         functions/sign_pass/ for the server skeleton and RUNBOOK.md §Phase-3.
     • The barcode message is the EXISTING single-use signed provenance token
       (TIX:<ticket_id>:<sig>) from dd_ticketsec — NOT a raw secret, NOT new secret
       material. The HMAC sig is a signature over a SERVER-ONLY secret; the sig itself
       is safe to display (it is exactly what today's QR carries). We reuse it; we do
       not reinvent it. passTypeIdentifier / teamIdentifier / issuerId are PLACEHOLDERS
       until Michael provisions the real cert / account (labeled below).

   EXPORTS: module.exports (Node) AND window.DDWallet (browser) — dual, guarded.
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") { if (!window.DDWallet) window.DDWallet = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- reuse the EXISTING token format from dd_ticketsec (do not reinvent) -----
  function ticketSec() {
    try { if (typeof window !== "undefined" && window.DDTicketSec) return window.DDTicketSec; } catch (e) {}
    try { return require("./dd_ticketsec.js"); } catch (e) {}
    return null;
  }
  // Fallback that produces the SAME TIX:<id>:<sig> shape if the module isn't loadable.
  function localEncode(id, sig) {
    id = String(id == null ? "" : id).trim();
    sig = String(sig == null ? "" : sig).trim();
    if (!id || !sig) return "";
    return "TIX:" + id + ":" + sig;
  }
  function encodeToken(id, sig, ts) {
    ts = ts || ticketSec();
    if (ts && typeof ts.encodeToken === "function") return ts.encodeToken(id, sig);
    return localEncode(id, sig);
  }

  // ---- small helpers -----------------------------------------------------------
  function pick(obj, keys, dflt) {
    for (var i = 0; i < keys.length; i++) {
      var v = obj ? obj[keys[i]] : undefined;
      if (v != null && v !== "") return v;
    }
    return dflt;
  }
  function ticketId(t) { return pick(t, ["ticket_id", "ticketId", "id"], ""); }
  function isoDate(v) {
    if (!v) return null;
    try { var d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString(); } catch (e) {}
    return null;
  }

  // Resolve the barcode MESSAGE = the single-use signed token. Throws if we can't
  // build a real token (House Law: never emit a pass with a blank/meaningless barcode
  // that would imply validity it doesn't have).
  function barcodeMessage(ticket, opts) {
    opts = opts || {};
    var t = ticket || {};
    if (typeof t.token === "string" && t.token.indexOf("TIX:") === 0) return t.token;
    var id = ticketId(t), sig = t.sig;
    var tok = encodeToken(id, sig, opts.ticketsec);
    if (tok) return tok;
    if (typeof t.token === "string" && t.token) return t.token; // last resort: caller-supplied opaque token
    throw new Error("dd_wallet: cannot build barcode — need ticket.token (TIX:...) or ticket_id + sig. " +
      "Refusing to emit a pass with no secure token.");
  }

  // ==========================================================================
  // APPLE — buildPkpassJson(ticket, opts) → the pass.json OBJECT (not signed, not zipped).
  //   opts.passTypeIdentifier / opts.teamIdentifier — PLACEHOLDERS until Michael
  //   provisions the Apple Pass Type ID cert (RUNBOOK §Phase-3). The server signer
  //   overrides these with the real values from its cert before signing.
  // ==========================================================================
  function buildPkpassJson(ticket, opts) {
    opts = opts || {};
    var t = ticket || {};
    var msg = barcodeMessage(t, opts);                 // throws if no secure token
    var id = ticketId(t);

    var eventName = pick(t, ["eventName", "event_name", "event", "event_slug"], "DeadDance Event");
    var stage     = pick(t, ["stage", "stage_name", "venue"], null);
    var seat      = pick(t, ["seat", "seat_label"], null);
    var section   = pick(t, ["section"], null);
    var tier      = pick(t, ["tier"], "ga");
    var holder    = pick(t, ["holder", "holder_name", "owner", "owner_id"], null); // optional; only if caller provides
    var relevant  = isoDate(pick(t, ["relevantDate", "doorsAt", "doors_at", "date", "issued_at"], null));
    var gaOrSeat  = seat ? ("Seat " + seat + (section ? (" · " + section) : "")) : String(tier || "ga").toUpperCase();

    var barcode = {
      format: "PKBarcodeFormatQR",
      message: msg,                                    // == the dd_ticketsec token (TIX:id:sig)
      messageEncoding: "iso-8859-1",
      altText: id || undefined
    };

    var secondary = [];
    if (stage) secondary.push({ key: "stage", label: "STAGE", value: String(stage) });
    if (relevant) secondary.push({ key: "date", label: "DATE", value: relevant, dateStyle: "PKDateStyleMedium", timeStyle: "PKDateStyleShort" });

    var auxiliary = [{ key: "admission", label: seat ? "SEAT" : "ADMISSION", value: gaOrSeat }];
    if (holder) auxiliary.push({ key: "holder", label: "TICKET HOLDER", value: String(holder) });

    return {
      formatVersion: 1,
      // ── PLACEHOLDERS — cert required (server signer supplies the real values) ──
      passTypeIdentifier: opts.passTypeIdentifier || "pass.app.deaddance.ticket.PLACEHOLDER",
      teamIdentifier: opts.teamIdentifier || "TEAMID_PLACEHOLDER",
      organizationName: opts.organizationName || "DeadDance",
      description: eventName + " ticket",
      serialNumber: id || msg,
      relevantDate: relevant || undefined,
      foregroundColor: opts.foregroundColor || "rgb(255,255,255)",
      backgroundColor: opts.backgroundColor || "rgb(20,20,24)",
      labelColor: opts.labelColor || "rgb(190,190,200)",
      // barcode (single) + barcodes (array) — Apple reads `barcodes` on iOS 9+, keeps `barcode` for back-compat.
      barcode: barcode,
      barcodes: [barcode],
      eventTicket: {
        primaryFields: [{ key: "event", label: "EVENT", value: String(eventName) }],
        secondaryFields: secondary,
        auxiliaryFields: auxiliary,
        headerFields: relevant ? [{ key: "when", label: "", value: relevant, dateStyle: "PKDateStyleShort" }] : []
      },
      // truthful marker so nothing downstream mistakes an unsigned structure for a real pass
      _unsigned: true,
      _note: "pass.json STRUCTURE only — must be signed server-side with the Apple Pass Type ID cert"
    };
  }

  // ==========================================================================
  // GOOGLE — buildGoogleWalletObject(ticket, opts) → an EventTicketObject shape.
  //   opts.issuerId — PLACEHOLDER until Michael creates a Google Wallet API issuer
  //   + service account (RUNBOOK §Phase-3). classSuffix groups tickets to a class.
  // ==========================================================================
  function buildGoogleWalletObject(ticket, opts) {
    opts = opts || {};
    var t = ticket || {};
    var msg = barcodeMessage(t, opts);                 // throws if no secure token
    var id = ticketId(t);
    var issuerId = opts.issuerId || "ISSUER_ID_PLACEHOLDER";
    var classSuffix = opts.classSuffix || pick(t, ["event_slug", "event"], "deaddance_event");
    // Google object/class ids must be `${issuerId}.${suffix}` and match [a-zA-Z0-9._-].
    var safe = function (s) { return String(s == null ? "" : s).replace(/[^a-zA-Z0-9._-]/g, "_"); };
    var seat = pick(t, ["seat", "seat_label"], null);
    var section = pick(t, ["section"], null);
    var row = pick(t, ["row"], null);
    var holder = pick(t, ["holder", "holder_name", "owner", "owner_id"], null);

    var obj = {
      id: issuerId + "." + safe(id || msg),
      classId: issuerId + "." + safe(classSuffix),
      state: "ACTIVE",
      // barcode.value == the SAME single-use signed token as Apple / the door scanner.
      barcode: { type: "QR_CODE", value: msg, alternateText: id || undefined },
      ticketNumber: id || undefined,
      textModulesData: [
        { id: "tier", header: "Admission", body: String(pick(t, ["tier"], "ga")).toUpperCase() }
      ],
      _unsigned: true,
      _note: "EventTicketObject STRUCTURE only — signed into a JWT server-side with the Google service-account key"
    };
    if (holder) obj.ticketHolderName = String(holder);
    if (seat || section || row) {
      obj.seatInfo = {};
      if (seat) obj.seatInfo.seat = { defaultValue: { language: "en-US", value: String(seat) } };
      if (row) obj.seatInfo.row = { defaultValue: { language: "en-US", value: String(row) } };
      if (section) obj.seatInfo.section = { defaultValue: { language: "en-US", value: String(section) } };
    }
    return obj;
  }

  // The "Save to Google Wallet" JWT CLAIMS (unsigned). The server signs this with the
  // service-account private key (RS256) → the save link/button. NO key here.
  function buildGoogleWalletJwtClaims(ticket, opts) {
    opts = opts || {};
    var obj = buildGoogleWalletObject(ticket, opts);
    return {
      iss: opts.serviceAccountEmail || "SERVICE_ACCOUNT_EMAIL_PLACEHOLDER",
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: opts.origins || [],
      payload: { eventTicketObjects: [obj] },
      _unsigned: true,
      _note: "sign RS256 with the Google service-account private key ON THE SERVER — never in the client"
    };
  }

  return {
    VERSION: "1.0.0-phase3",
    encodeToken: encodeToken,
    barcodeMessage: barcodeMessage,
    buildPkpassJson: buildPkpassJson,
    buildGoogleWalletObject: buildGoogleWalletObject,
    buildGoogleWalletJwtClaims: buildGoogleWalletJwtClaims
  };
});
