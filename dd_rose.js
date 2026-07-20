/* dd_rose.js — THE rose. Canonical, permanent. DO NOT REDRAW, EVER.
   Sader's rose = the 🌹 emoji. Nothing hand-drawn substitutes for it. Family & succession members get a
   UNIQUE color: the emoji's red BUD is remapped by a color matrix while the GREEN STEM passes through
   untouched. A color, once assigned to a member, is that member's forever — never reused. window.DDRose. */
(function (root) {
  "use strict";
  var MATRICES = {
    bWhite: "1 0 0 0 0  1 1 0 0 0  1 0 1 0 0  0 0 0 1 0",
    bIvory: "1 0 0 0 0  0.97 1 0 0 0  0.85 0 1 0 0  0 0 0 1 0",
    bGold: "1 0 0 0 0  0.72 1 0 0 0  0 0 1 0 0  0 0 0 1 0",
    bYellow: "1 0 0 0 0  1 1 0 0 0  0 0 1 0 0  0 0 0 1 0",
    bAmber: "1 0 0 0 0  0.55 1 0 0 0  0.05 0 1 0 0  0 0 0 1 0",
    bPeach: "1 0 0 0 0  0.75 1 0 0 0  0.55 0 1 0 0  0 0 0 1 0",
    bCoralpink: "1 0 0 0 0  0.5 1 0 0 0  0.45 0 1 0 0  0 0 0 1 0",
    bPink: "1 0 0 0 0  0.4 1 0 0 0  0.7 0 1 0 0  0 0 0 1 0",
    bRose: "1 0 0 0 0  0.5 1 0 0 0  0.62 0 1 0 0  0 0 0 1 0",
    bMagenta: "1 0 0 0 0  0.1 1 0 0 0  0.55 0 1 0 0  0 0 0 1 0",
    bFuchsia: "0.9 0 0 0 0  0 1 0 0 0  0.6 0 1 0 0  0 0 0 1 0",
    bMauve: "0.72 0 0 0 0  0.42 1 0 0 0  0.6 0 1 0 0  0 0 0 1 0",
    bPlum: "0.55 0 0 0 0  0.2 1 0 0 0  0.55 0 1 0 0  0 0 0 1 0",
    bWine: "0.55 0 0 0 0  0 1 0 0 0  0.2 0 1 0 0  0 0 0 1 0",
    bPurple: "0.6 0 0 0 0  0 1 0 0 0  1 0 1 0 0  0 0 0 1 0",
    bViolet: "0.5 0 0 0 0  0 1 0 0 0  0.92 0 1 0 0  0 0 0 1 0",
    bAmethyst: "0.62 0 0 0 0  0.2 1 0 0 0  0.92 0 1 0 0  0 0 0 1 0",
    bLavender: "0.8 0 0 0 0  0.6 1 0 0 0  1 0 1 0 0  0 0 0 1 0",
    bPeriwinkle: "0.6 0 0 0 0  0.6 1 0 0 0  1 0 1 0 0  0 0 0 1 0",
    bIndigo: "0.29 0 0 0 0  0 1 0 0 0  0.8 0 1 0 0  0 0 0 1 0",
    bCobalt: "0.1 0 0 0 0  0.2 1 0 0 0  0.92 0 1 0 0  0 0 0 1 0",
    bBlue: "0 0 0 0 0  0 1 0 0 0  1 0 1 0 0  0 0 0 1 0",
    bSky: "0 0 0 0 0  0.75 1 0 0 0  1 0 1 0 0  0 0 0 1 0",
    bCyan: "0 0 0 0 0  1 1 0 0 0  1 0 1 0 0  0 0 0 1 0",
    bTeal: "0 0 0 0 0  0.7 1 0 0 0  0.65 0 1 0 0  0 0 0 1 0",
    bTurquoise: "0.15 0 0 0 0  0.85 1 0 0 0  0.8 0 1 0 0  0 0 0 1 0",
    bSteel: "0.72 0 0 0 0  0.72 1 0 0 0  0.78 0 1 0 0  0 0 0 1 0",
    bSlate: "0.42 0 0 0 0  0.47 1 0 0 0  0.57 0 1 0 0  0 0 0 1 0",
    bBronze: "0.62 0 0 0 0  0.42 1 0 0 0  0.2 0 1 0 0  0 0 0 1 0",
    bCopper: "0.75 0 0 0 0  0.46 1 0 0 0  0.22 0 1 0 0  0 0 0 1 0",
    bCharcoal: "0.24 0 0 0 0  0.24 1 0 0 0  0.28 0 1 0 0  0 0 0 1 0",
    bOnyx: "0.12 0 0 0 0  0.12 1 0 0 0  0.14 0 1 0 0  0 0 0 1 0"
  };
  var COLOR = {
    red: "",
    white: "bWhite",
    ivory: "bIvory",
    gold: "bGold",
    yellow: "bYellow",
    amber: "bAmber",
    peach: "bPeach",
    coralpink: "bCoralpink",
    pink: "bPink",
    rose: "bRose",
    magenta: "bMagenta",
    fuchsia: "bFuchsia",
    mauve: "bMauve",
    plum: "bPlum",
    wine: "bWine",
    purple: "bPurple",
    violet: "bViolet",
    amethyst: "bAmethyst",
    lavender: "bLavender",
    periwinkle: "bPeriwinkle",
    indigo: "bIndigo",
    cobalt: "bCobalt",
    blue: "bBlue",
    sky: "bSky",
    cyan: "bCyan",
    teal: "bTeal",
    turquoise: "bTurquoise",
    steel: "bSteel",
    slate: "bSlate",
    bronze: "bBronze",
    copper: "bCopper",
    charcoal: "bCharcoal",
    onyx: "bOnyx"
  };
  // === THE REGISTRY — one color, one member, forever. (red = shared base, not a unique claim.) ===
  var ASSIGN = {
    white: "john mayer",
    gold:  "jeff chimenti"
    // add here as Issa assigns — a taken color can NEVER be reassigned.
  };
  function norm(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
  function styleFor(color){ var id = COLOR[color]; return id ? ("filter:url(#"+id+")") : ""; }
  function colorOf(member){ var m = norm(member); for (var c in ASSIGN){ if (ASSIGN.hasOwnProperty(c) && norm(ASSIGN[c]) === m) return c; } return "red"; }
  function styleOf(member){ return styleFor(colorOf(member)); }
  function roseHTML(member){ var s = styleOf(member); return '<span class="ddrose"'+(s?(' style="'+s+'"'):'')+'>\uD83C\uDF39</span>'; }
  function injectDefs(){
    try {
      if (document.getElementById("ddRoseDefs")) return;
      var ns = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(ns,"svg"); svg.setAttribute("id","ddRoseDefs"); svg.setAttribute("width","0"); svg.setAttribute("height","0"); svg.setAttribute("aria-hidden","true"); svg.style.position="absolute";
      var defs = document.createElementNS(ns,"defs");
      Object.keys(MATRICES).forEach(function(id){ var f=document.createElementNS(ns,"filter"); f.setAttribute("id",id); f.setAttribute("color-interpolation-filters","sRGB"); var m=document.createElementNS(ns,"feColorMatrix"); m.setAttribute("type","matrix"); m.setAttribute("values",MATRICES[id]); f.appendChild(m); defs.appendChild(f); });
      svg.appendChild(defs); (document.body||document.documentElement).appendChild(svg);
    } catch (e) {}
  }
  root.DDRose = {
    colors: function(){ return Object.keys(COLOR); },
    styleFor: styleFor, colorOf: colorOf, styleOf: styleOf, roseHTML: roseHTML,
    registry: function(){ var o={}; for (var c in ASSIGN) if (ASSIGN.hasOwnProperty(c)) o[c]=ASSIGN[c]; return o; },
    isTaken: function(color){ return !!ASSIGN[color]; },
    assign: function(color, member){ if (!COLOR.hasOwnProperty(color)) return false; if (ASSIGN[color]) return false; ASSIGN[color]=norm(member); return true; }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectDefs); else injectDefs();
})(typeof window !== "undefined" ? window : this);
