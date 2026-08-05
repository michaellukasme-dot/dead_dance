/* dd_durable_store.js — DeadDance PHASE 2 durable persistence adapter (the "store" seam)
   ============================================================================
   HONEST STATUS (House Law, first lines):
     • WEB backend (IndexedDB, with a localStorage fallback) is REAL and works in
       the PWA today — it survives tab close / app reopen within the browser's
       storage lifetime. That path is exercised by the browser and is not faked.
     • NODE backend (in-memory, over an INJECTABLE backing map) is REAL for tests
       and is what the Node harness proves — "durability across restart" is
       simulated by making a NEW store instance over the SAME backing map.
     • NATIVE backend (@capacitor-community/sqlite) is DESIGN + GUARDED CODE. It is
       NOT device-proven here: this Linux sandbox cannot bind real SQLite. Without
       an injected plugin it NO-OPS (resolves empty), and it NEVER pretends to have
       persisted. Real force-quit/reboot durability is a DEVICE test on Michael's
       Mac — see the boundaries note in dd_sync_engine.js.

   ONE INTERFACE, THREE BACKENDS. Every method returns a Promise and never throws
   on normal use. Methods:  put(record) · get(id) · list() · delete(id) · drain()
   plus clear(), size(), ready(), backend (the resolved backend name).

     put(record)   record MUST carry an `id` (string). Idempotent upsert (same id
                   overwrites). Stamps a monotonic `_seq` for FIFO/oldest ordering
                   if absent. Resolves the stored record.
     get(id)       → the record or null.
     list()        → array of records, FIFO order (by _seq asc). Read-only; does
                   NOT delete. This is what a crash-safe drainer uses (list, then
                   delete each ONLY after its write is confirmed).
     delete(id)    → removes one record. Resolves true/false.
     drain()       → returns ALL records AND removes them in one step. ⚠️ At-least-
                   once semantics with a crash window: use ONLY for teardown or
                   where redelivery is safe. The sync engine deliberately does NOT
                   use drain() on the send path — see dd_sync_engine.js §crash-safety.

   AT-REST SAFETY (House Law + panel security note):
     The queue this store holds is geo-ingest items that are IDS-ONLY / de-identified
     by design (dd_geo_native.buildIngestItem: venue/corridor ids + a ROTATING token
     + decimated points — NO lat/lng-as-identity, NO email, NO user id, NO name).
     Therefore this store holds NO PII and at-rest encryption is not required for it.
     ⚠️ SEAM + TODO: if a FUTURE item type carries PII (e.g. a ticket with a name),
     it MUST be encrypted at rest (SQLCipher / @capacitor-community/sqlite encryption
     on native; do NOT put raw PII in IndexedDB/localStorage). This file leaves the
     `encryptAtRest` option as the seam; it is NOT implemented now and MUST be built
     before any PII-bearing item type is stored. See assertPiiFree() below.

   EXPORTS: module.exports (Node) AND window.DDDurableStore (browser) — dual, guarded.
   The SQLite plugin is INJECTED (opts.sqlite / opts.sqlitePlugin), never imported.
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") { if (!window.DDDurableStore) window.DDDurableStore = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // A tiny monotonic sequence source so FIFO/oldest ordering survives even when a
  // fresh store instance is created over an existing backing store (restart): new
  // records get a _seq strictly greater than any wall-clock-stamped older record.
  function nextSeq(state) {
    var t = Date.now();
    state._seqHi = Math.max((state._seqHi || 0) + 1, t);
    return state._seqHi;
  }

  function normalizeRecord(record, state) {
    if (record == null || typeof record !== "object") {
      throw new Error("dd_durable_store: record must be an object with an id");
    }
    var id = record.id != null ? String(record.id)
           : (record.key != null ? String(record.key) : null);
    if (id == null || id === "") {
      throw new Error("dd_durable_store: record.id (or .key) is required");
    }
    // shallow clone so callers can't mutate what we persisted out from under us
    var rec = {};
    for (var k in record) { if (Object.prototype.hasOwnProperty.call(record, k)) rec[k] = record[k]; }
    rec.id = id;
    if (rec._seq == null) rec._seq = nextSeq(state);
    return rec;
  }

  function bySeq(a, b) { return (a._seq || 0) - (b._seq || 0); }

  // Optional guard: refuse to store anything that looks like raw PII when the caller
  // has NOT explicitly opted into encryption-at-rest (which is not built yet). This
  // makes the "no PII unencrypted" rule enforceable, not just documented.
  var PII_KEYS = ["email", "phone", "name", "full_name", "user_id", "userId", "auth_uid", "ssn", "dob", "address"];
  function assertPiiFree(record, allowPii) {
    if (allowPii) return; // caller asserted an encrypted-at-rest path exists (future)
    var payload = record && record.payload ? record.payload : record;
    for (var i = 0; i < PII_KEYS.length; i++) {
      if (payload && Object.prototype.hasOwnProperty.call(payload, PII_KEYS[i]) && payload[PII_KEYS[i]] != null) {
        throw new Error("dd_durable_store: refusing to persist PII-looking key '" + PII_KEYS[i] +
          "' unencrypted. Build encrypt-at-rest (opts.encryptAtRest) first. TODO seam in header.");
      }
    }
  }

  // ==========================================================================
  // BACKEND: in-memory (Node/tests). Durable across a simulated restart when the
  // SAME backing map object is injected into a new store instance.
  // ==========================================================================
  function memoryBackend(opts, state) {
    // opts.memory (or opts.backing) = a shared Map to survive "restart"; else new.
    var map = (opts.memory instanceof Map) ? opts.memory
            : (opts.backing instanceof Map) ? opts.backing
            : new Map();
    return {
      name: "memory",
      ready: function () { return Promise.resolve(); },
      put: function (rec) { map.set(rec.id, rec); return Promise.resolve(rec); },
      get: function (id) { return Promise.resolve(map.has(String(id)) ? map.get(String(id)) : null); },
      list: function () { var a = []; map.forEach(function (v) { a.push(v); }); a.sort(bySeq); return Promise.resolve(a); },
      del: function (id) { return Promise.resolve(map.delete(String(id))); },
      clear: function () { map.clear(); return Promise.resolve(); },
      _map: map
    };
  }

  // ==========================================================================
  // BACKEND: IndexedDB (browser, REAL). Durable to disk within the browser's
  // storage lifetime. One object store keyed by `id`.
  // ==========================================================================
  function idbBackend(opts, state) {
    var idb = (typeof indexedDB !== "undefined") ? indexedDB
            : (typeof window !== "undefined" && window.indexedDB) ? window.indexedDB : null;
    if (!idb) return null; // caller falls back to localStorage
    var dbName = "dd_durable__" + (opts.name || "default");
    var storeName = "items";
    var dbP = null;

    function open() {
      if (dbP) return dbP;
      dbP = new Promise(function (resolve, reject) {
        var req;
        try { req = idb.open(dbName, 1); } catch (e) { reject(e); return; }
        req.onupgradeneeded = function () {
          try {
            var db = req.result;
            if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "id" });
          } catch (e) { reject(e); }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error("indexedDB open failed")); };
      });
      return dbP;
    }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t, os, box = {};
          try { t = db.transaction(storeName, mode); os = t.objectStore(storeName); }
          catch (e) { reject(e); return; }
          try { fn(os, box); } catch (e) { reject(e); return; }
          t.oncomplete = function () { resolve(box._result); };
          t.onerror = function () { reject(t.error || new Error("indexedDB tx error")); };
          t.onabort = function () { reject(t.error || new Error("indexedDB tx abort")); };
        });
      });
    }
    return {
      name: "indexeddb",
      ready: function () { return open().then(function () {}); },
      put: function (rec) { return tx("readwrite", function (os) { os.put(rec); }).then(function () { return rec; }); },
      get: function (id) {
        return tx("readonly", function (os, box) { var r = os.get(String(id)); r.onsuccess = function () { box._result = r.result || null; }; });
      },
      list: function () {
        return tx("readonly", function (os, box) { var r = os.getAll(); r.onsuccess = function () { box._result = r.result || []; }; })
          .then(function (arr) { arr = arr || []; arr.sort(bySeq); return arr; });
      },
      del: function (id) { return tx("readwrite", function (os, box) { os.delete(String(id)); box._result = true; }); },
      clear: function () { return tx("readwrite", function (os) { os.clear(); }).then(function () {}); }
    };
  }

  // ==========================================================================
  // BACKEND: localStorage (browser fallback when IndexedDB is unavailable, e.g.
  // private mode on some engines). One JSON blob under a namespaced key.
  // ==========================================================================
  function lsBackend(opts, state) {
    var ls = (typeof localStorage !== "undefined") ? localStorage
           : (typeof window !== "undefined" && window.localStorage) ? window.localStorage : null;
    if (!ls) return null;
    var key = "dd_durable__" + (opts.name || "default");
    function read() { try { var s = ls.getItem(key); return s ? JSON.parse(s) : {}; } catch (e) { return {}; } }
    function write(obj) { try { ls.setItem(key, JSON.stringify(obj)); } catch (e) {} }
    return {
      name: "localstorage",
      ready: function () { return Promise.resolve(); },
      put: function (rec) { var o = read(); o[rec.id] = rec; write(o); return Promise.resolve(rec); },
      get: function (id) { var o = read(); return Promise.resolve(Object.prototype.hasOwnProperty.call(o, String(id)) ? o[String(id)] : null); },
      list: function () { var o = read(), a = []; for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) a.push(o[k]); } a.sort(bySeq); return Promise.resolve(a); },
      del: function (id) { var o = read(); var had = Object.prototype.hasOwnProperty.call(o, String(id)); delete o[String(id)]; write(o); return Promise.resolve(had); },
      clear: function () { write({}); return Promise.resolve(); }
    };
  }

  // ==========================================================================
  // BACKEND: native SQLite (@capacitor-community/sqlite) — DESIGN + GUARDED.
  //   NOT device-proven here. The plugin is INJECTED (opts.sqlite). Without it,
  //   every method NO-OPS honestly (resolves empty / false) and reports backend
  //   "sqlite-noop" so callers/tests can SEE it did not persist. On a real device
  //   the injected connection runs the schema + queries below.
  //
  //   SCHEMA (one table; the queue is small structured rows):
  //     CREATE TABLE IF NOT EXISTS dd_durable_queue (
  //       id     TEXT PRIMARY KEY,   -- record id / idempotency key
  //       ns     TEXT NOT NULL,      -- store namespace (outbox / deadletter)
  //       seq    INTEGER NOT NULL,   -- FIFO / oldest ordering
  //       body   TEXT NOT NULL       -- JSON.stringify(record)
  //     );
  //     CREATE INDEX IF NOT EXISTS dd_durable_queue_ns_seq ON dd_durable_queue(ns, seq);
  //   QUERIES:
  //     put    : INSERT OR REPLACE INTO dd_durable_queue(id,ns,seq,body) VALUES(?,?,?,?)
  //     get    : SELECT body FROM dd_durable_queue WHERE ns=? AND id=?
  //     list   : SELECT body FROM dd_durable_queue WHERE ns=? ORDER BY seq ASC
  //     delete : DELETE FROM dd_durable_queue WHERE ns=? AND id=?
  //     clear  : DELETE FROM dd_durable_queue WHERE ns=?
  //   The plugin object is expected to expose an open connection with an async
  //   `.run(sql, values)` and `.query(sql, values)` (the @capacitor-community/sqlite
  //   SQLiteDBConnection shape). We NEVER import it; the native entrypoint injects it.
  // ==========================================================================
  function sqliteBackend(opts, state) {
    var db = opts.sqlite || opts.sqlitePlugin || null; // an OPEN SQLiteDBConnection, injected
    var ns = opts.name || "default";
    var TABLE = "dd_durable_queue";

    // Guarded no-op: no injected connection → we CANNOT persist. Say so honestly.
    var usable = !!(db && typeof db.run === "function" && typeof db.query === "function");
    if (!usable) {
      return {
        name: "sqlite-noop",
        _noop: true,
        ready: function () { return Promise.resolve(); },
        put: function (rec) { return Promise.resolve(rec); },   // did NOT persist — backend name shows it
        get: function () { return Promise.resolve(null); },
        list: function () { return Promise.resolve([]); },
        del: function () { return Promise.resolve(false); },
        clear: function () { return Promise.resolve(); }
      };
    }

    var ddl =
      "CREATE TABLE IF NOT EXISTS " + TABLE + " (id TEXT PRIMARY KEY, ns TEXT NOT NULL, seq INTEGER NOT NULL, body TEXT NOT NULL);" +
      "CREATE INDEX IF NOT EXISTS " + TABLE + "_ns_seq ON " + TABLE + "(ns, seq);";
    var readyP = Promise.resolve().then(function () { return db.execute ? db.execute(ddl) : db.run(ddl); });

    function rows(res) {
      // @capacitor-community/sqlite query returns { values: [ {body:...}, ... ] }
      var vals = (res && res.values) ? res.values : [];
      var out = [];
      for (var i = 0; i < vals.length; i++) {
        try { out.push(JSON.parse(vals[i].body)); } catch (e) { /* skip corrupt row, never throw */ }
      }
      return out;
    }
    return {
      name: "sqlite",
      ready: function () { return readyP.then(function () {}); },
      put: function (rec) {
        return readyP.then(function () {
          return db.run("INSERT OR REPLACE INTO " + TABLE + "(id,ns,seq,body) VALUES(?,?,?,?)",
            [rec.id, ns, rec._seq || 0, JSON.stringify(rec)]);
        }).then(function () { return rec; });
      },
      get: function (id) {
        return readyP.then(function () { return db.query("SELECT body FROM " + TABLE + " WHERE ns=? AND id=?", [ns, String(id)]); })
          .then(function (res) { var r = rows(res); return r.length ? r[0] : null; });
      },
      list: function () {
        return readyP.then(function () { return db.query("SELECT body FROM " + TABLE + " WHERE ns=? ORDER BY seq ASC", [ns]); })
          .then(function (res) { return rows(res); });
      },
      del: function (id) {
        return readyP.then(function () { return db.run("DELETE FROM " + TABLE + " WHERE ns=? AND id=?", [ns, String(id)]); })
          .then(function () { return true; });
      },
      clear: function () {
        return readyP.then(function () { return db.run("DELETE FROM " + TABLE + " WHERE ns=?", [ns]); }).then(function () {});
      }
    };
  }

  // ==========================================================================
  // FACTORY — pick the backend. Explicit opts.backend wins; else auto-detect:
  //   native (sqlite injected) → indexeddb → localstorage → memory.
  // ==========================================================================
  function pickBackend(opts, state) {
    var want = opts.backend || "auto";
    if (want === "memory") return memoryBackend(opts, state);
    if (want === "sqlite" || want === "native") return sqliteBackend(opts, state);
    if (want === "indexeddb") return idbBackend(opts, state) || lsBackend(opts, state) || memoryBackend(opts, state);
    if (want === "localstorage") return lsBackend(opts, state) || memoryBackend(opts, state);
    // auto
    if (opts.sqlite || opts.sqlitePlugin) return sqliteBackend(opts, state);
    var idb = idbBackend(opts, state); if (idb) return idb;
    var ls = lsBackend(opts, state); if (ls) return ls;
    return memoryBackend(opts, state);
  }

  function create(opts) {
    opts = opts || {};
    var state = { _seqHi: 0 };
    var allowPii = !!opts.encryptAtRest;   // SEAM: not implemented; asserting it unlocks PII persistence (future)
    var be = pickBackend(opts, state);

    return {
      backend: be.name,
      ready: function () { return be.ready(); },
      put: function (record) {
        try {
          var rec = normalizeRecord(record, state);
          assertPiiFree(rec, allowPii);          // fail LOUD before any PII touches disk
          return be.put(rec);
        } catch (e) { return Promise.reject(e); }
      },
      get: function (id) { return be.get(id); },
      list: function () { return be.list(); },
      delete: function (id) { return be.del(id); },
      // drain(): read-all + clear in one step. ⚠️ crash window (see header). Not used
      // by the sync send path. Provided for teardown / safe-redelivery consumers.
      drain: function () {
        return be.list().then(function (arr) { return be.clear().then(function () { return arr; }); });
      },
      clear: function () { return be.clear(); },
      size: function () { return be.list().then(function (a) { return a.length; }); },
      // test/debug: expose backing map for the memory backend only
      _backing: be._map || null
    };
  }

  return { create: create, VERSION: "1.0.0-phase2", _assertPiiFree: assertPiiFree };
});
