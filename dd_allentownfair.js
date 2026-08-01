/* dd_allentownfair.js — The Great Allentown Fair seed for the DeadDance multi-festival engine.
   Sept 2-7, 2026 · Allentown Fairgrounds (302 N 17th St). OWN footprint (Allentown) — brings its own
   stages + coords + center, so it renders on the same map engine as MusikFest via ?fest=allentownfair.
   Stage coords + daily grid lifted from the existing allentownfair.html seed (official Map & Directory).
   Grandstand = ticketed headliners; the free stages recur daily. */
(function (root) {
  var CENTER = { lat:40.60130, lng:-75.49790 };
  var STAGES = [
    { n:"Service Electric Grandstand", lat:40.60153894, lng:-75.49747434, ticket:1, where:"The ticketed Grandstand show venue." },
    { n:"Red Barn Stage",              lat:40.60146742, lng:-75.49738329, where:"Market Building — indoor shopping + the Red Barn Stage." },
    { n:"Astound Farmerama Theater",   lat:40.60195843, lng:-75.50170134, where:"Butterfly Kingdom / Farmerama Theater." },
    { n:"Agri-Plex Square",            lat:40.60098515, lng:-75.50039598, where:"Harvest Patio — Dan, Dan The Farmer Man." },
    { n:"Machinery Ave Court",         lat:40.60115490, lng:-75.50060065, where:"Robinson's Pig Paddling Porkers." },
    { n:"Weyerbacher Courtyard",       lat:40.60120000, lng:-75.49980000, approx:true, where:"Food court — Hog Diggity Dog / The Cup Guy. (approx — 4-corner verify)" },
    { n:"Main Entrance Plaza",         lat:40.60108000, lng:-75.49500000, approx:true, where:"Near Gate 1 (17th & Chew) — Mighty Mike / Steve Goodtime. (approx — verify)" }
  ];
  // Grandstand headliners (one ticketed show per night)
  var HEAD = [
    {d:"2026-09-02",t:"7:30 PM",b:"The Four Tops with the Allentown Symphony Orchestra"},
    {d:"2026-09-03",t:"7:00 PM",b:"Stars Stripes Slams Wrestling"},
    {d:"2026-09-04",t:"7:00 PM",b:"Warren Zeiders"},
    {d:"2026-09-05",t:"7:00 PM",b:"All Time Low"},
    {d:"2026-09-06",t:"2:00 PM",b:"Local Legends Live"},
    {d:"2026-09-07",t:"5:00 PM",b:"J & J Demolition Derby"}
  ];
  // Free-stage acts that recur EVERY day (st must match a STAGES name)
  var RECUR = [
    {t:"12:00 PM",b:"Butterfly Exhibit (open until 8 PM)",st:"Astound Farmerama Theater"},
    {t:"1:30 PM", b:"Dan, Dan The Farmer Man",           st:"Agri-Plex Square"},
    {t:"1:30 PM", b:"Hog Diggity Dog",                   st:"Weyerbacher Courtyard"},
    {t:"2:00 PM", b:"Mighty Mike",                       st:"Main Entrance Plaza"},
    {t:"2:30 PM", b:"Robinson's Pig Paddling Porkers",   st:"Machinery Ave Court"},
    {t:"3:00 PM", b:"Victoria Circus",                   st:"Red Barn Stage"},
    {t:"3:00 PM", b:"Steve Goodtime",                    st:"Main Entrance Plaza"},
    {t:"3:30 PM", b:"The Cup Guy",                       st:"Weyerbacher Courtyard"},
    {t:"4:00 PM", b:"Mighty Mike",                       st:"Main Entrance Plaza"},
    {t:"4:30 PM", b:"Dan, Dan The Farmer Man",           st:"Agri-Plex Square"},
    {t:"4:30 PM", b:"Hog Diggity Dog",                   st:"Weyerbacher Courtyard"},
    {t:"5:00 PM", b:"Steve Goodtime",                    st:"Main Entrance Plaza"},
    {t:"5:30 PM", b:"Robinson's Pig Paddling Porkers",   st:"Machinery Ave Court"},
    {t:"5:30 PM", b:"Victoria Circus",                   st:"Red Barn Stage"},
    {t:"7:00 PM", b:"Dan, Dan The Farmer Man",           st:"Agri-Plex Square"},
    {t:"7:30 PM", b:"Victoria Circus",                   st:"Red Barn Stage"},
    {t:"8:30 PM", b:"Hog Diggity Dog",                   st:"Weyerbacher Courtyard"}
  ];
  var DATES = HEAD.map(function(h){ return h.d; });
  var LINEUP = [];
  HEAD.forEach(function(h){ LINEUP.push({d:h.d, t:h.t, st:"Service Electric Grandstand", b:h.b, sc:"sf"});
    RECUR.forEach(function(r){ LINEUP.push({d:h.d, t:r.t, st:r.st, b:r.b, sc:"sf"}); }); });

  root.DD_ALLENTOWNFAIR = {
    name:"The Great Allentown Fair", org:"Allentown Fair", city:"Allentown", state:"PA",
    dates:DATES, ownStages:true, center:CENTER, stages:STAGES, lineup:LINEUP,
    note:"Sept 2-7 2026. Own footprint (Allentown Fairgrounds). Grandstand headliners are TICKETED; free stages recur daily. 2 stage coords are approx → 4-corner verify."
  };
  if (typeof module!=='undefined' && module.exports) module.exports = root.DD_ALLENTOWNFAIR;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
