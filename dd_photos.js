/* dd_photos.js — DURABLE crowd photo/media for DeadDance / StageFill.
   THE RULE (Michael, T-14): the instant a user takes a photo it is SAFE. It survives:
     • closing the app        → stored in IndexedDB, not volatile memory
     • updating the app       → IndexedDB is NOT cleared by a service-worker cache bump
     • switching phones       → uploaded to Supabase Storage + a metadata row
   This is a social network. Photos/video/profile images are the clay for Surround collages
   and the blog river — nothing may vanish. Cell is not the constraint (1.5M were online in
   the same footprint last year), so we lean on the backend and only use the local store as
   the never-lose buffer + instant paint + offline queue.

   Frameworkless. Uses window.ddClient() (anon Supabase). Compresses before store/upload so
   the backend and the device store stay small while staying collage-grade.
   Public API on window.DDPhotos:
     save(file,{lat,lng,kind,day,cell}) -> Promise<{id,localUrl,rec}>   // safe the instant it resolves
     all() -> Promise<[rec]>            // everything persisted, to rebuild the strip after reload
     retry() -> Promise                 // re-upload anything still queued
     profile(file) -> Promise<{...}>    // persist + mirror to localStorage for instant avatar paint
     profileImg() -> dataURL|''         // instant avatar
     token() -> pseudonymous id string
*/
(function (w) {
  var DBN = "dd_media", STORE = "photos", VER = 1, BUCKET = "crowd";
  var _db = null;

  function tok() {
    try {
      try { if (w.DDMe && w.DDMe.signedIn && w.DDMe.signedIn() && w.DDMe.id()) return String(w.DDMe.id()); } catch (e) {}   // signed in → uploads tie to your ACCOUNT, not a device
      var t = localStorage.getItem("dd.token");
      if (!t) { t = (w.crypto && crypto.randomUUID) ? crypto.randomUUID() : ("t" + Date.now() + Math.random().toString(36).slice(2)); localStorage.setItem("dd.token", t); }
      return t;
    } catch (e) { return "anon"; }
  }
  function uid() { try { return crypto.randomUUID(); } catch (e) { return "p" + Date.now() + Math.random().toString(36).slice(2); } }
  function today() { return new Date().toISOString().slice(0, 10); }

  function openDB() {
    return new Promise(function (res, rej) {
      if (_db) return res(_db);
      var r = indexedDB.open(DBN, VER);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var s = db.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("uploaded", "uploaded", { unique: false });
          s.createIndex("ts", "ts", { unique: false });
        }
      };
      r.onsuccess = function () { _db = r.result; res(_db); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function put(rec) { return openDB().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(rec); t.oncomplete = function () { res(rec); }; t.onerror = function () { rej(t.error); }; }); }); }
  function getAll() { return openDB().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(STORE, "readonly"), q = t.objectStore(STORE).getAll(); q.onsuccess = function () { res((q.result || []).sort(function (a, b) { return a.ts - b.ts; })); }; q.onerror = function () { rej(q.error); }; }); }); }

  // compress to <=maxpx longest edge, jpeg — small enough to store many + upload on any 5G,
  // still sharp enough for a collage tile. EXIF GPS is read upstream (canvas strips it), so we
  // carry lat/lng in the record, not in the pixels.
  function compress(file, maxpx, q) {
    maxpx = maxpx || 1600; q = q || 0.82;
    return new Promise(function (res) {
      try {
        if (!/^image\//.test(file.type || "")) return res(file); // video/other: store/upload as-is
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
          var w0 = img.naturalWidth, h0 = img.naturalHeight, sc = Math.min(1, maxpx / Math.max(w0, h0));
          var cw = Math.max(1, Math.round(w0 * sc)), ch = Math.max(1, Math.round(h0 * sc));
          var c = document.createElement("canvas"); c.width = cw; c.height = ch;
          c.getContext("2d").drawImage(img, 0, 0, cw, ch);
          URL.revokeObjectURL(url);
          if (c.toBlob) c.toBlob(function (b) { res(b || file); }, "image/jpeg", q);
          else res(file);
        };
        img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} res(file); };
        img.src = url;
      } catch (e) { res(file); }
    });
  }

  function client() { try { return w.ddClient && w.ddClient(); } catch (e) { return null; } }

  // upload one record; on success mark uploaded + store the public URL. On failure leave it
  // queued (uploaded:0) — retry() and the 'online' handler will get it next time.
  function upload(rec) {
    var C = client();
    if (!C || !rec || !rec.blob) return Promise.resolve(rec);
    var ext = (rec.blob.type && rec.blob.type.indexOf("video") === 0) ? "mp4" : "jpg";
    var path = tok() + "/" + rec.id + "." + ext;
    return C.storage.from(BUCKET).upload(path, rec.blob, { contentType: rec.blob.type || "image/jpeg", upsert: true })
      .then(function (r) {
        if (r && r.error) throw r.error;
        var pub = C.storage.from(BUCKET).getPublicUrl(path);
        var url = (pub && pub.data && pub.data.publicUrl) || "";
        return C.rpc("dd_photo_add", { p_id: rec.id, p_url: url, p_lat: rec.lat, p_lng: rec.lng, p_kind: rec.kind, p_day: rec.day, p_cell: rec.cell || null, p_token: tok() })
          .then(function () { rec.uploaded = 1; rec.url = url; return put(rec).then(function () { return rec; }); });
      })
      .catch(function () { return rec; /* stays queued — never thrown away */ });
  }

  function retry() {
    return getAll().then(function (list) {
      var pend = list.filter(function (r) { return !r.uploaded && r.blob; });
      return pend.reduce(function (p, r) { return p.then(function () { return upload(r); }); }, Promise.resolve());
    }).catch(function () {});
  }

  var API = {
    save: function (file, opts) {
      opts = opts || {};
      var id = uid();
      return compress(file).then(function (blob) {
        var rec = {
          id: id, blob: blob,
          lat: (opts.lat == null ? null : opts.lat), lng: (opts.lng == null ? null : opts.lng),
          kind: opts.kind || "crowd", day: opts.day || today(), cell: opts.cell || null,
          exif: !!opts.exif, ts: Date.now(), uploaded: 0, url: null
        };
        return put(rec).then(function () {          // <-- photo is SAFE here, before we even try the network
          var localUrl; try { localUrl = URL.createObjectURL(blob); } catch (e) { localUrl = ""; }
          upload(rec);                               // fire-and-forget; queued + retried if offline
          return { id: id, localUrl: localUrl, rec: rec };
        });
      });
    },
    all: getAll,
    retry: retry,
    profile: function (file) {
      return API.save(file, { kind: "profile" }).then(function (r) {
        try { var fr = new FileReader(); fr.onload = function () { try { localStorage.setItem("dd.profile.img", fr.result); } catch (e) {} }; fr.readAsDataURL(r.rec.blob); } catch (e) {}
        return r;
      });
    },
    profileImg: function () { try { return localStorage.getItem("dd.profile.img") || ""; } catch (e) { return ""; } },
    token: tok
  };
  w.DDPhotos = API;

  // never-lose plumbing: drain the queue when the network returns and once on load
  try { w.addEventListener("online", function () { retry(); }); } catch (e) {}
  try { if (document.readyState !== "loading") retry(); else document.addEventListener("DOMContentLoaded", retry); } catch (e) {}
})(window);
