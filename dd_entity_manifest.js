/* dd_entity_manifest.js — per-entity installable-app identity.
   Any container (city, festival, record store, BAND) can call DDEntityManifest.apply({...})
   to make "Add to Home Screen" install with THAT entity's name + its ORIGINAL logo as the icon.
   Android/Chrome reads the injected <link rel="manifest">; iOS reads apple-touch-icon + the
   app-title meta. One flagship app, N entities — each addressable by link, each installable as its own.
   Zero dependencies. */
(function (root) {
  "use strict";
  function metaName(n, c) {
    if (c == null) return;
    var m = document.querySelector('meta[name="' + n + '"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', n); document.head.appendChild(m); }
    m.setAttribute('content', c);
  }
  function linkRel(rel, href) {
    if (!href) return;
    var l = document.querySelector('link[rel="' + rel + '"]');
    if (!l) { l = document.createElement('link'); l.setAttribute('rel', rel); document.head.appendChild(l); }
    l.setAttribute('href', href);
  }
  /* o = { name, short, icon, manifest, theme, title } */
  function apply(o) {
    o = o || {};
    if (o.manifestObj) {                                        // dynamic manifest (arbitrary entities, e.g. bands)
      try { var b = new Blob([JSON.stringify(o.manifestObj)], { type: 'application/manifest+json' });
            linkRel('manifest', URL.createObjectURL(b)); } catch (e) {}
    } else if (o.manifest) linkRel('manifest', o.manifest);     // static manifest file (Easton entities)
    if (o.icon) { linkRel('apple-touch-icon', o.icon);          // iOS home-screen icon (the original logo)
                  linkRel('apple-touch-icon-precomposed', o.icon); }
    if (o.title) { try { document.title = o.title; } catch (e) {} }
    metaName('apple-mobile-web-app-title', o.name);             // iOS app name
    metaName('application-name', o.name);
    metaName('apple-mobile-web-app-capable', 'yes');
    metaName('mobile-web-app-capable', 'yes');
    metaName('apple-mobile-web-app-status-bar-style', 'black-translucent');
    if (o.theme) metaName('theme-color', o.theme);
    return true;
  }
  var api = { apply: apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DDEntityManifest = api;
})(typeof window !== 'undefined' ? window : this);
