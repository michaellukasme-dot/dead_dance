/* stagefill_events.js — the national StageFill events directory (sample seed).
   Each event resolves to an event page: a custom `url` if it has its own map,
   otherwise event_page.html?ev=<slug>. Categories align with dd_categories.js (DDCats). */
(function (root) {
  var EVENTS = [
    { slug:'musikfest-2026', name:'Musikfest 2026', city:'Bethlehem', state:'PA', start:'2026-08-01', end:'2026-08-09', time:'12:00', cat:'festival', venue:'Historic Bethlehem · SteelStacks', lat:40.6187, lng:-75.3803, url:'artsquest_musikfest.html' },
    { slug:'red-rocks-jam-nights', name:'Red Rocks Jam Nights', city:'Morrison', state:'CO', start:'2026-07-18', time:'19:30', cat:'live_music', venue:'Red Rocks Amphitheatre', lat:39.6655, lng:-105.2053 },
    { slug:'french-quarter-fest', name:'French Quarter Fest', city:'New Orleans', state:'LA', start:'2026-04-16', end:'2026-04-19', time:'11:00', cat:'jazz_blues', venue:'French Quarter', lat:29.9584, lng:-90.0644 },
    { slug:'austin-americana', name:'Austin Americana Weekender', city:'Austin', state:'TX', start:'2026-10-03', end:'2026-10-04', time:'16:00', cat:'country', venue:'Zilker Park', lat:30.2669, lng:-97.7728 },
    { slug:'brooklyn-warehouse', name:'Brooklyn Warehouse Sessions', city:'Brooklyn', state:'NY', start:'2026-09-12', time:'21:00', cat:'dj', venue:'Williamsburg Warehouse', lat:40.7143, lng:-73.9613 },
    { slug:'nashville-round', name:'Nashville Songwriters Round', city:'Nashville', state:'TN', start:'2026-06-05', time:'19:00', cat:'acoustic', venue:'The Bluebird Cafe', lat:36.1017, lng:-86.8181 },
    { slug:'sf-comedy-vault', name:'SF Comedy Vault', city:'San Francisco', state:'CA', start:'2026-08-22', time:'20:00', cat:'comedy', venue:'Cobb’s Comedy Club', lat:37.8009, lng:-122.4103 },
    { slug:'chicago-hamlet', name:'Chicago Theater Nights: Hamlet', city:'Chicago', state:'IL', start:'2026-11-07', end:'2026-11-09', time:'19:30', cat:'theater', venue:'Chicago Shakespeare Theater', lat:41.8912, lng:-87.6106 },
    { slug:'portland-dance', name:'Portland Dance Collective', city:'Portland', state:'OR', start:'2026-05-30', time:'19:00', cat:'dance', venue:'Keller Auditorium', lat:45.5118, lng:-122.6817 },
    { slug:'seattle-open-mic', name:'Seattle Open Mic Mondays', city:'Seattle', state:'WA', start:'2026-07-06', time:'19:30', cat:'open_mic', venue:'The Crocodile', lat:47.6131, lng:-122.3445 },
    { slug:'miami-salsa-fest', name:'Miami Beach Salsa Fest', city:'Miami Beach', state:'FL', start:'2026-03-21', end:'2026-03-22', time:'17:00', cat:'dance', venue:'Lummus Park', lat:25.7823, lng:-80.1301 },
    { slug:'denver-shakedown', name:'Denver Dead Tribute Night', city:'Denver', state:'CO', start:'2026-07-25', time:'20:00', cat:'tribute', venue:'Cervantes’ Masterpiece', lat:39.7595, lng:-104.9784 },
    { slug:'atlanta-funfest', name:'Atlanta Family FunFest', city:'Atlanta', state:'GA', start:'2026-09-26', end:'2026-09-27', time:'11:00', cat:'family', venue:'Piedmont Park', lat:33.7851, lng:-84.3739 },
    { slug:'boston-jazz-common', name:'Boston Jazz on the Common', city:'Boston', state:'MA', start:'2026-08-15', time:'18:00', cat:'jazz_blues', venue:'Boston Common', lat:42.3551, lng:-71.0657 },
    { slug:'la-karaoke-champ', name:'LA Karaoke Championship', city:'Los Angeles', state:'CA', start:'2026-10-18', time:'20:00', cat:'karaoke', venue:'The Echo', lat:34.0781, lng:-118.2606 },
    { slug:'santa-fe-artwalk', name:'Santa Fe Art Walk', city:'Santa Fe', state:'NM', start:'2026-06-20', time:'17:00', cat:'arts', venue:'Canyon Road', lat:35.6836, lng:-105.9280 },
    { slug:'detroit-techno', name:'Detroit Techno Renaissance', city:'Detroit', state:'MI', start:'2026-09-05', time:'22:00', cat:'dj', venue:'Hart Plaza', lat:42.3277, lng:-83.0458 },
    { slug:'kc-bbq-blues', name:'Kansas City BBQ & Blues', city:'Kansas City', state:'MO', start:'2026-07-11', end:'2026-07-12', time:'12:00', cat:'jazz_blues', venue:'18th & Vine', lat:39.0916, lng:-94.5580 },
    { slug:'phoenix-country', name:'Phoenix Country Roundup', city:'Phoenix', state:'AZ', start:'2026-11-14', time:'18:00', cat:'country', venue:'Margaret T. Hance Park', lat:33.4640, lng:-112.0740 },
    { slug:'burlington-folk', name:'Burlington Folk Festival', city:'Burlington', state:'VT', start:'2026-08-08', end:'2026-08-09', time:'12:00', cat:'festival', venue:'Waterfront Park', lat:44.4830, lng:-73.2237 },
    { slug:'san-diego-reggae', name:'San Diego Beach Reggae', city:'San Diego', state:'CA', start:'2026-07-04', time:'15:00', cat:'live_music', venue:'Mission Beach', lat:32.7703, lng:-117.2521 },
    { slug:'minneapolis-improv', name:'Minneapolis Improv Fest', city:'Minneapolis', state:'MN', start:'2026-10-24', end:'2026-10-25', time:'19:00', cat:'comedy', venue:'Brave New Workshop', lat:44.9782, lng:-93.2757 }
  ];
  EVENTS.forEach(function (e) { e.sample = true; });   // seed = representative sample; real events come from sf_list (_live)
  root.STAGEFILL_EVENTS = EVENTS;
})(typeof window !== 'undefined' ? window : this);
