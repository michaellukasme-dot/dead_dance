/* dd_shows.js — the REAL calendar client.
   A date posted with "Add a date" PERSISTS (dd_show_submit) and every calendar
   reads it back (dd_shows_upcoming) + gets it live. Was: the button called a
   function that didn't exist and the calendar rendered from a seed, so a posted
   date saved nowhere and showed nowhere. Best-effort: if backend/identity isn't
   ready, submit() rejects quietly and upcoming() resolves []. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }

  // post a date. o = {band_name, band_id, venue, city, state, region, date, time, gig_info, scene}
  function submit(o) {
    o = o || {}; var c = client();
    if (!c) return Promise.reject('no-backend');
    if (!(o.band_name || o.band) || !o.venue || !o.date) return Promise.reject('need band, venue, date');
    return c.rpc('dd_show_submit', {
      p_band_id: o.band_id || null, p_band_name: o.band_name || o.band || '', p_venue: o.venue,
      p_city: o.city || null, p_state: o.state || null, p_region: o.region || null,
      p_date: o.date, p_time: o.time || null, p_gig_info: o.gig_info || null,
      p_scene: o.scene || 'grateful_dead', p_submitter: myId()
    }).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || null; });
  }

  // upcoming shows (today forward). region optional (null = whole board).
  function upcoming(limit, region) {
    var c = client(); if (!c) return Promise.resolve([]);
    return c.rpc('dd_shows_upcoming', { p_limit: limit || 300, p_region: region || null })
      .then(function (r) { return (r && r.data) || []; })
      .catch(function () { return []; });
  }

  var chan = null;
  function subscribe(onChange) {
    var c = client(); if (!c || chan) return;
    try {
      chan = c.channel('dd_shows_live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dd_shows' },
          function (payload) { try { onChange && onChange(payload && payload.new); } catch (e) {} })
        .subscribe();
    } catch (e) {}
  }

  root.DDShows = { submit: submit, upcoming: upcoming, subscribe: subscribe };
})(typeof window !== 'undefined' ? window : this);
