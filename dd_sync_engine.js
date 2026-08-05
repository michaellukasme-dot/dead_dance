/* dd_sync_engine.js — DeadDance PHASE 2 durable offline SYNC ENGINE
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • The engine LOGIC here (tier gating, exponential backoff + jitter, dead-letter
       on max-retry, per-item idempotency, bounded queue with oldest-safe eviction,
       crash-safe delete-AFTER-confirm, flush-on-reconnect wiring) is deterministic
       and Node-tested — see dd_native/dd_sync_engine.test.js.
     • It persists through dd_durable_store.js. On WEB that store is REAL IndexedDB
       (works in the PWA today). On NATIVE it is @capacitor-community/sqlite, whose
       real force-quit/reboot durability is DEVICE-ONLY and NOT proven in this Linux
       sandbox — the SQLite path is guarded code, labeled not-device-proven.
     • The Supabase `sender` is INJECTED. Every real .rpc() the sender makes chains
       .then().catch() and returns the TRUE server result (see makeSupabaseSender).
       A queued write is NEVER reported "synced" until the server confirms it.

   THE CRASH-SAFETY CONTRACT (the thing the adversarial pass hunts):
     An item is deleted from the durable store ONLY AFTER its write is server-
     confirmed (sender resolves). If the app is killed between "sent" and "deleted",
     the item is STILL in the store on next boot → it is re-sent → the server's
     ON CONFLICT DO NOTHING upsert (dd_geo_ingest_fragment, keyed by
     contributor_token + client_frag_id) makes the re-send a no-op. At-least-once
     delivery + idempotent server write = effectively-once. We NEVER dequeue-before-
     confirm, and we NEVER use dd_durable_store.drain() on the send path.

   FAIL LOUD, NEVER SILENT:
     • Past maxAttempts → the item moves to a DURABLE dead-letter store, fires
       onDeadLetter, and is retrievable via deadletters(). Never a silent drop.
     • Over the bounded cap → the OLDEST item is evicted (oldest-safe policy),
       fires onEvict, and is retained in evicted(). Backpressure is surfaced, and
       the queue can NEVER grow unbounded.
     • Offline / tier T0 → flush returns status 📴 and does NOT hunt the radio.

   NO PII: this engine never logs payloads. The items are ids-only/de-identified by
     design (dd_geo_native.buildIngestItem). The durable store additionally REFUSES
     to persist PII-looking keys unencrypted (dd_durable_store.assertPiiFree).

   EXPORTS: module.exports (Node) AND window.DDSyncEngine (browser) — dual, guarded.
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") { if (!window.DDSyncEngine) window.DDSyncEngine = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Tiers that mean "do not attempt sync / do not hunt the radio" (dd_geo_native
  // vocabulary). "none" = dead zone (probe failed). Reused, not re-invented.
  var DEFAULT_OFFLINE_TIERS = { none: true };

  // Pure, exported so the harness can assert the schedule increases and caps.
  // attempts is 1-based (attempt #1 = first failure).
  function computeBackoff(attempts, cfg) {
    cfg = cfg || {};
    var base = cfg.backoffBaseMs != null ? cfg.backoffBaseMs : 1000;
    var max = cfg.backoffMaxMs != null ? cfg.backoffMaxMs : 60000;
    var jitterFrac = cfg.jitterFrac != null ? cfg.jitterFrac : 0.25;
    var rng = typeof cfg.rng === "function" ? cfg.rng : Math.random;
    var n = Math.max(1, attempts | 0);
    var raw = base * Math.pow(2, n - 1);
    var capped = Math.min(raw, max);               // caps — never grows past max
    var jitter = capped * jitterFrac * rng();      // full jitter in [0, jitterFrac*capped)
    return Math.round(capped + jitter);
  }

  // Build a House-Law-compliant Supabase sender: chains .then/.catch, returns the
  // REAL server result, throws on error so the engine retries/dead-letters. NEVER
  // logs the payload. Works with the on-conflict-do-nothing upsert (idempotent).
  //   supabase = a supabase-js v2 client; item.op = rpc function name; item.payload
  //   = the p_* args object (ids-only). The RPC returns { ok:boolean, err? }.
  function makeSupabaseSender(supabase, opts) {
    opts = opts || {};
    if (!supabase || typeof supabase.rpc !== "function") {
      throw new Error("makeSupabaseSender: a supabase-js v2 client with .rpc() is required");
    }
    return function (item) {
      // .rpc() MUST be chained or supabase-js never sends (House-Law Truth Audit).
      return Promise.resolve()
        .then(function () { return supabase.rpc(item.op, item.payload); })
        .then(function (res) {
          if (res && res.error) {
            // transport/RLS error → throw → engine retries then dead-letters (loud)
            throw new Error("rpc error: " + (res.error.message || "unknown"));
          }
          var data = res ? res.data : null;
          if (data && data.ok === false) {
            // server rejected the row on its merits → surface, do not pretend saved
            throw new Error("rpc rejected: " + (data.err || "unknown"));
          }
          return data; // confirmed
        });
      // NOTE: no .catch here that swallows — the engine's flush handles rejection
      // (retry/backoff/dead-letter). Swallowing would be a silent-drop lie.
    };
  }

  function create(opts) {
    opts = opts || {};
    var store = opts.store;                 // durable outbox (dd_durable_store)
    if (!store || typeof store.put !== "function") {
      throw new Error("dd_sync_engine.create: opts.store (a dd_durable_store) is required");
    }
    // dead-letters are ALSO durable so a rejected write survives restart and can be
    // inspected/requeued. Default: an in-memory store if the host provides the module.
    var deadStore = opts.deadStore || null;
    if (!deadStore && opts.durableStoreModule && typeof opts.durableStoreModule.create === "function") {
      deadStore = opts.durableStoreModule.create({ backend: "memory", name: (opts.name || "sync") + "_dead" });
    }

    var sender = typeof opts.sender === "function" ? opts.sender : null;
    var maxAttempts = opts.maxAttempts != null ? opts.maxAttempts : 5;
    var cap = opts.cap != null ? opts.cap : 500;         // bounded queue cap
    var now = typeof opts.now === "function" ? opts.now : function () { return Date.now(); };
    var offlineTiers = opts.offlineTiers || DEFAULT_OFFLINE_TIERS;
    var tierProvider = typeof opts.tierProvider === "function" ? opts.tierProvider : null;
    var onDeadLetter = typeof opts.onDeadLetter === "function" ? opts.onDeadLetter : null;
    var onEvict = typeof opts.onEvict === "function" ? opts.onEvict : null;
    var onStatus = typeof opts.onStatus === "function" ? opts.onStatus : null;
    var idKeyFn = typeof opts.idempotencyKeyFn === "function"
      ? opts.idempotencyKeyFn
      : function (it) { return it && it.key != null ? String(it.key) : (it && it.id != null ? String(it.id) : null); };

    var backoffCfg = {
      backoffBaseMs: opts.backoffBaseMs, backoffMaxMs: opts.backoffMaxMs,
      jitterFrac: opts.jitterFrac, rng: opts.rng
    };

    var evicted = [];          // surfaced backpressure drops (oldest-safe)
    var EVICTED_RETAIN = opts.evictedRetain != null ? opts.evictedRetain : 500; // cap the surface list itself → no unbounded growth
    var deadMem = [];          // last-resort dead-letter backstop when NO durable deadStore is configured (never a silent drop)
    var flushing = null;       // single-flight lock (Promise) — no concurrent flush

    function emit(status, detail) { if (onStatus) { try { onStatus(status, detail || {}); } catch (e) {} } }

    // Record a dead-letter DURABLY if a deadStore exists; otherwise fall back to an
    // in-memory backstop. ALWAYS resolves (never rejects the flush) and ALWAYS keeps
    // the item somewhere retrievable → past-max-retries is FAIL-LOUD, never a silent
    // drop, even with no durable deadStore and even if the durable put fails.
    function recordDeadLetter(item) {
      if (deadStore) {
        return Promise.resolve().then(function () { return deadStore.put(item); })
          .catch(function () { deadMem.push(item); }); // durable put failed → still surfaced in memory
      }
      deadMem.push(item);
      return Promise.resolve();
    }

    // ---- enqueue: persist + enforce the bounded cap (oldest-safe eviction) -----
    function enqueue(item) {
      if (item == null || typeof item !== "object") {
        return Promise.resolve({ ok: false, error: "item must be an object" });
      }
      var key = idKeyFn(item);
      if (key == null) return Promise.resolve({ ok: false, error: "item needs a key/id (idempotency)" });
      // record id = idempotency key ⇒ same key overwrites (dedupe / LWW), never a dup row.
      var record = {
        id: key, key: item.key != null ? item.key : key,
        op: item.op != null ? item.op : null,
        payload: item.payload,
        attempts: 0, enqueuedAt: now(), lastError: null, _nextRetryAt: 0
      };
      return store.put(record).then(function () {
        return enforceCap().then(function (ev) { return { ok: true, evicted: ev }; });
      });
    }

    // Bounded queue: if over cap, evict the OLDEST (by _seq) until at cap. Surfaced.
    function enforceCap() {
      return store.list().then(function (items) {
        if (items.length <= cap) return [];
        var overBy = items.length - cap;
        var toEvict = items.slice(0, overBy);   // list() is FIFO/oldest-first
        var chain = Promise.resolve(), dropped = [];
        toEvict.forEach(function (it) {
          chain = chain.then(function () {
            return store.delete(it.id).then(function () {
              evicted.push(it); dropped.push(it);
              if (evicted.length > EVICTED_RETAIN) evicted.splice(0, evicted.length - EVICTED_RETAIN); // cap surface → bounded
              emit("⚠️", { event: "evict", key: it.key });
              if (onEvict) { try { onEvict(it); } catch (e) {} }
            });
          });
        });
        return chain.then(function () { return dropped; });
      });
    }

    function currentTier() { try { return tierProvider ? tierProvider() : null; } catch (e) { return null; } }
    function isOffline() {
      var t = currentTier();
      if (t == null) return false;               // no tier info → allow attempt
      return !!offlineTiers[t];
    }

    // ---- flush: tier-gated, backoff-aware, crash-safe, single-flight ----------
    function flush(runSender) {
      var send = typeof runSender === "function" ? runSender : sender;
      if (typeof send !== "function") {
        return Promise.reject(new Error("flush: no sender (pass one or set opts.sender)"));
      }
      if (flushing) return flushing;             // single-flight: no double-send race

      // TIER GATE — T0/offline: buffer only, DO NOT hunt the radio. 📴, not a lie.
      if (isOffline()) {
        emit("📴", { event: "offline", tier: currentTier() });
        return Promise.resolve({ status: "📴", skipped: true, reason: "offline/T0 buffer-only",
          tier: currentTier(), sent: 0, failed: 0, deadlettered: 0 });
      }

      flushing = store.list().then(function (batch) {
        var results = [], sent = 0, failed = 0, deadlettered = 0, deferred = 0;
        var t0 = now();
        var chain = Promise.resolve();
        batch.forEach(function (item) {
          chain = chain.then(function () {
            // backoff gate — not yet due → leave it, count as deferred
            if (item._nextRetryAt && item._nextRetryAt > t0) { deferred++; results.push({ key: item.key, status: "deferred" }); return; }
            // idempotency key travels with the item; server upsert dedupes a re-send
            return Promise.resolve()
              .then(function () { return send(item); })
              .then(function () {
                // CONFIRMED → only now remove from the durable store (crash-safe).
                // If the delete ITSELF fails (or the app is killed) after the server
                // confirmed, we must NOT treat that as a send failure: the write
                // already landed. Leave the item; the next flush re-sends and the
                // server's ON CONFLICT DO NOTHING upsert dedupes it. Never dead-
                // letter a write the server accepted, never double-count attempts.
                return store.delete(item.id).then(function () {
                  sent++; results.push({ key: item.key, status: "sent" });
                  emit("✅", { event: "sent", key: item.key });
                }, function (delErr) {
                  sent++; results.push({ key: item.key, status: "sent-delete-deferred", note: (delErr && delErr.message) || "delete failed" });
                  emit("✅", { event: "sent-delete-deferred", key: item.key });
                });
              })
              .catch(function (err) {
                var msg = (err && err.message) ? err.message : String(err);
                item.attempts = (item.attempts || 0) + 1;
                item.lastError = msg;             // stored; NEVER the payload → no PII in logs
                if (item.attempts >= maxAttempts) {
                  // DEAD-LETTER (fail loud): record it (durable, or memory backstop)
                  // BEFORE removing from the outbox so a crash between the two leaves
                  // the item in the outbox (re-dead-letters on reboot) — never lost.
                  return recordDeadLetter(item).then(function () { return store.delete(item.id); }).then(function () {
                    deadlettered++;
                    results.push({ key: item.key, status: "deadletter", attempts: item.attempts, error: msg });
                    emit("⚠️", { event: "deadletter", key: item.key, attempts: item.attempts, error: msg });
                    if (onDeadLetter) { try { onDeadLetter(item); } catch (e) {} }
                  });
                }
                // RETRY LATER: schedule exponential backoff + jitter, persist attempts
                item._nextRetryAt = t0 + computeBackoff(item.attempts, backoffCfg);
                return store.put(item).then(function () {
                  failed++;
                  results.push({ key: item.key, status: "retry", attempts: item.attempts, error: msg, nextRetryAt: item._nextRetryAt });
                  emit("⚠️", { event: "retry", key: item.key, attempts: item.attempts });
                });
              });
          });
        });
        return chain.then(function () {
          return store.list().then(function (rem) {
            var status = deadlettered > 0 || failed > 0 ? "⚠️" : (sent > 0 ? "✅" : (deferred > 0 ? "⏳" : "✅"));
            return { status: status, sent: sent, failed: failed, deadlettered: deadlettered,
              deferred: deferred, remaining: rem.length, results: results };
          });
        });
      });

      return flushing.then(function (r) { flushing = null; return r; },
                           function (e) { flushing = null; throw e; });
    }

    // ---- reconnect wiring: flush when the OS/browser reports we're back online --
    // Wire to the `online` event (web) or a DDShell connectivity signal (native).
    // Returns a detach() function. Guarded: no-op if target has no addEventListener.
    function attachReconnect(target) {
      var tgt = target || (typeof window !== "undefined" ? window : null);
      if (!tgt || typeof tgt.addEventListener !== "function") return function () {};
      var handler = function () { flush().catch(function () {}); };
      tgt.addEventListener("online", handler);
      return function () { try { tgt.removeEventListener("online", handler); } catch (e) {} };
    }

    return {
      enqueue: enqueue,
      flush: flush,
      attachReconnect: attachReconnect,
      size: function () { return store.size(); },
      list: function () { return store.list(); },
      deadletters: function () {
        return deadStore ? deadStore.list().then(function (a) { return a.concat(deadMem); }) : Promise.resolve(deadMem.slice());
      },
      deadCount: function () {
        return deadStore ? deadStore.list().then(function (a) { return a.length + deadMem.length; }) : Promise.resolve(deadMem.length);
      },
      // requeue a dead-letter after the operator fixes the cause (e.g. re-auth).
      // Checks the durable dead store first, then the in-memory backstop.
      requeueDead: function (key) {
        var id = String(key);
        function fromMem() {
          for (var i = 0; i < deadMem.length; i++) {
            if (String(deadMem[i].id != null ? deadMem[i].id : deadMem[i].key) === id) {
              var it = deadMem.splice(i, 1)[0];
              it.attempts = 0; it.lastError = null; it._nextRetryAt = 0;
              return store.put(it).then(function () { return true; });
            }
          }
          return Promise.resolve(false);
        }
        if (!deadStore) return fromMem();
        return deadStore.get(id).then(function (it) {
          if (!it) return fromMem();
          it.attempts = 0; it.lastError = null; it._nextRetryAt = 0;
          return store.put(it).then(function () { return deadStore.delete(id); }).then(function () { return true; });
        });
      },
      evicted: function () { return evicted.slice(); },
      evictedCount: function () { return evicted.length; },
      isOffline: isOffline,
      currentTier: currentTier,
      store: store,
      deadStore: deadStore
    };
  }

  return {
    create: create,
    computeBackoff: computeBackoff,
    makeSupabaseSender: makeSupabaseSender,
    DEFAULT_OFFLINE_TIERS: DEFAULT_OFFLINE_TIERS,
    VERSION: "1.0.0-phase2"
  };
});
