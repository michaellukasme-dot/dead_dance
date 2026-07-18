/* dd_roses.js — the Bloodline rose.
   A colored rose marks an act whose members played WITH the original Grateful Dead.
   Red stays with Kimock. Others earn their own color. White is reserved for the next one.
   Use: DDRoses.img(actName, px) → an <img> badge (or '' if the act isn't an originals-player). */
(function (w) {
  var MAP = {
    "Steve Kimock": "red",              // 🔴 played with Phil, Bob (RatDog / Phil & Friends)
    "John Mayer": "yellow",             // 🟡 Dead & Company, with Bob, Mickey, Bill
    "Melvin Seals and JGB": "pink",     // 🩷 Jerry Garcia Band, with Jerry himself
    "Melvin Seals": "pink"
    // "white": reserved for the next act with an original-member bloodline
  };
  function colorFor(name) {
    if (!name) return null;
    var n = String(name);
    if (MAP[n]) return MAP[n];
    for (var k in MAP) { if (n.toLowerCase().indexOf(k.toLowerCase()) >= 0) return MAP[k]; }
    return null;
  }
  w.DDRoses = {
    color: colorFor,
    map: MAP,
    img: function (name, px) {
      var c = colorFor(name); if (!c) return "";
      px = px || 16;
      return '<img src="rose_' + c + '.png" alt="rose" title="Played with the originals" ' +
             'style="width:' + px + 'px;height:' + px + 'px;vertical-align:-3px;margin-right:4px">';
    }
  };
})(window);
