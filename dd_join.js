/* dd_join.js — the REAL invite/join loop client.
   On app open this records the member server-side WITH first-touch attribution
   (which band/group invited them), so a band can see who actually joined from
   its invite. Reads/writes go through the dd_member_* / dd_band_* RPCs
   (see 00_Admin/read_side/dd_join.sql). Best-effort: if identity/backend isn't
   ready nothing throws; it retries a couple of times on boot.
   No PII leaves the device here beyond the member's own display name + the
   attribution already in the URL they arrived on. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }
  function myName() { try { return (root.ME && root.ME.name && root.ME.name !== 'You') ? root.ME.name : null; } catch (e) { return null; } }
  function attrib() { try { return (root.DDAttrib && root.DDAttrib.stamp && root.DDAttrib.stamp()) || {}; } catch (e) { return {}; } }
  function chapter() { try { return (root.ME && root.ME.chapter) || (root.localStorage && (localStorage.getItem('dd.chapterName') || localStorage.getItem('dd.chapter'))) || null; } catch (e) { return null; } }
  function ready() { return !!(client() && myId()); }

  var DONE = false;
  function track() {
    if (DONE) return Promise.resolve(false);
    var c = client(), id = myId();
    if (!c || !id) return Promise.resolve(false);
    var a = attrib();
    DONE = true;
    try {
      return c.rpc('dd_member_upsert', {
        p_id: id,
        p_name: myName(),
        p_ref_band: a.ref_band || null,
        p_ref_group: a.claim_band || null,     // hop-1 group/band the invite pointed at
        p_src: a.src || 'organic',
        p_chapter: chapter()
      }).then(function (r) { if (r && r.error) { DONE = false; return false; } return true; })
        .catch(function () { DONE = false; return false; });
    } catch (e) { DONE = false; return Promise.resolve(false); }
  }

  // a band's real joins: { total:Number, recent:[{name,at}] }
  function bandJoins(band) {
    var c = client(); if (!c || !band) return Promise.resolve({ total: 0, recent: [] });
    return c.rpc('dd_band_joins', { p_band: band }).then(function (r) {
      var rows = (r && r.data) || [];
      return { total: rows.length ? Number(rows[0].joined_total || 0) : 0,
               recent: rows.filter(function (x) { return x.name || x.first_seen; })
                           .map(function (x) { return { name: x.name || 'A head', at: x.first_seen }; }) };
    }).catch(function () { return { total: 0, recent: [] }; });
  }
  function bandJoinCount(band) {
    var c = client(); if (!c || !band) return Promise.resolve(0);
    return c.rpc('dd_band_join_count', { p_band: band }).then(function (r) { return Number((r && r.data) || 0); }).catch(function () { return 0; });
  }

  // persist a band claim (private CRM). Returns the new claim id or null.
  function claimBand(o) {
    o = o || {}; var c = client();
    if (!c) return Promise.resolve(null);
    var a = attrib();
    return c.rpc('dd_band_claim', {
      p_member_id: myId(),
      p_band_name: o.band || o.name || '',
      p_ref: o.ref || a.ref_band || null,
      p_src: o.src || a.src || 'claim',
      p_region: o.region || chapter(),
      p_contact_name: o.contactName || null,
      p_contact_email: o.contactEmail || null,
      p_contact_phone: o.contactPhone || null,
      p_note: o.note || null
    }).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }

  // boot: try now, then a couple of retries as identity/client warm up
  function boot() { track(); setTimeout(track, 1800); setTimeout(track, 4500); }
  if (root.addEventListener) root.addEventListener('load', boot); else boot();

  root.DDJoin = { ready: ready, track: track, bandJoins: bandJoins, bandJoinCount: bandJoinCount, claimBand: claimBand, myId: myId };
})(typeof window !== 'undefined' ? window : this);
