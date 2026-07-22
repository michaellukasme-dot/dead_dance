/* dd_bday.js — REAL birthdays client (window.DDBday). FRIENDS-ONLY.
   Talks to the dd_birthday_* RPCs (see dd_birthday.sql) on the auth.uid() spine.
     DDBday.set(m,d,y)  -> upsert the caller's own birthday (year optional)
     DDBday.mine()      -> resolves the caller's row {member_id,month,day,year} or null
     DDBday.friends()   -> resolves {today:[...], upcoming:[...]} — the caller's ACCEPTED
                           friends who have a birthday, split in JS: today (month+day match)
                           and upcoming (next ~45 days, nearest first). Each item:
                           {id,name,month,day,year, ageTurning?}.
   Best-effort: never throws; guarded when signed out. friends() resolves {today:[],upcoming:[]}
   on any failure so the UI degrades to its honest empty state. */
(function (root) {
  function client() { try { return root.ddClient && root.ddClient(); } catch (e) { return null; } }
  function myId() { try { var u = (root.DDMe && root.DDMe.id && root.DDMe.id()); if (u) return String(u); var i = root.ddId && root.ddId(); return (i && i.id) ? String(i.id) : null; } catch (e) { return null; } }

  function set(m, d, y) {
    var c = client(); if (!c) return Promise.reject('no-backend');
    var pm = parseInt(m, 10), pd = parseInt(d, 10), py = (y === 0 || y === '0' || y == null || y === '') ? null : parseInt(y, 10);
    if (!pm || pm < 1 || pm > 12) return Promise.reject('invalid month');
    if (!pd || pd < 1 || pd > 31) return Promise.reject('invalid day');
    if (py != null && (isNaN(py) || py < 1900 || py > 2025)) py = null;   // ignore nonsense years
    return c.rpc('dd_birthday_set', { p_month: pm, p_day: pd, p_year: py })
      .then(function (r) { if (r && r.error) throw r.error; return true; });
  }

  function mine() {
    var c = client(), id = myId(); if (!c || !id) return Promise.resolve(null);
    return c.rpc('dd_birthday_mine', {})
      .then(function (r) { if (r && r.error) return null; var rows = (r && r.data) || []; return (rows && rows.length) ? rows[0] : null; })
      .catch(function () { return null; });
  }

  function friends() {
    var c = client(), id = myId();
    if (!c || !id) return Promise.resolve({ today: [], upcoming: [] });
    return c.rpc('dd_birthdays_friends', {})
      .then(function (r) { if (r && r.error) return { today: [], upcoming: [] }; return split((r && r.data) || []); })
      .catch(function () { return { today: [], upcoming: [] }; });
  }

  // split rows into today + upcoming(next ~45 days), each carrying ageTurning when a year is known
  function split(rows) {
    var today = [], upcoming = [];
    try {
      var now = new Date();
      var nm = now.getMonth() + 1, nd = now.getDate(), yr = now.getFullYear();
      var t0 = new Date(yr, nm - 1, nd);   // midnight today (local)
      (rows || []).forEach(function (row) {
        var m = parseInt(row.month, 10), d = parseInt(row.day, 10);
        if (!m || !d) return;
        var y = row.year ? parseInt(row.year, 10) : null;
        var item = { id: String(row.member_id || ''), name: String(row.name || 'A head'), month: m, day: d, year: (y || null) };
        if (m === nm && d === nd) {
          if (y) item.ageTurning = yr - y;
          today.push(item);
        } else {
          var next = new Date(yr, m - 1, d);
          if (next < t0) next = new Date(yr + 1, m - 1, d);      // already passed this year → next year
          var days = Math.round((next - t0) / 86400000);
          if (days > 0 && days <= 45) {
            if (y) item.ageTurning = next.getFullYear() - y;
            item._days = days;
            upcoming.push(item);
          }
        }
      });
      upcoming.sort(function (a, b) { return a._days - b._days; });
    } catch (e) { return { today: today, upcoming: upcoming }; }
    return { today: today, upcoming: upcoming };
  }

  root.DDBday = { set: set, mine: mine, friends: friends };
})(typeof window !== 'undefined' ? window : this);
