/* dd_baconfest.js — PA BACON FEST (Easton, PA) seed for DeadDance / StageFill.
   Presented by the Greater Easton Development Partnership (GEDP). Free street festival.
   2026 dates: Nov 7–8. Lineup below = the most recently published schedule (2025) as a
   placeholder until GEDP announces 2026 — swap in the new grid when it drops.

   Stage coordinates are APPROXIMATE (downtown Easton, from the published street-corner
   locations) and flagged approx:true — they get locked exact by the 4-Corner Verify routine
   (dd_cornerverify.js) with the set-up crew on site. Source: pabaconfest.com/schedule (crawled 2026-07-31). */
(function (root) {
  var STAGES = [
    { n:"IBEW Local 102 Stage",           corner:"S. Third St. & Ferry St.",        lat:40.68960, lng:-75.22010, approx:true },
    { n:"Tito's Vodka Stage",             corner:"Northampton St. & Larry Holmes Dr.", lat:40.69175, lng:-75.21790, approx:true },
    { n:"LV International Airport Stage",  corner:"Centre Square Circle",            lat:40.69168, lng:-75.21990, approx:true },
    { n:"Montage Mountain Stage",         corner:"N. Third St. & Spring Garden St.", lat:40.69340, lng:-75.22060, approx:true },
    { n:"Easton Farmers' Market Stage",   corner:"N. Second St. & Northampton St.",  lat:40.69150, lng:-75.22090, approx:true }
  ];
  // schedule rows mirror DD_MUSIKFEST shape: {d, t, st, b, sc}. sc:'sf' (StageFill) default; 'dd' = jam/Dead.
  var D1="2026-11-07", D2="2026-11-08";
  var LINEUP = [
    // ---- Saturday ----
    {d:D1,t:"10:00 AM",st:"IBEW Local 102 Stage",b:"Sean Marshall & The Conversation",sc:"sf"},
    {d:D1,t:"11:00 AM",st:"IBEW Local 102 Stage",b:"Kief Shuvel",sc:"sf"},
    {d:D1,t:"12:15 PM",st:"IBEW Local 102 Stage",b:"ROI & The Secret People",sc:"sf"},
    {d:D1,t:"1:15 PM", st:"IBEW Local 102 Stage",b:"Deal",sc:"dd"},
    {d:D1,t:"2:30 PM", st:"IBEW Local 102 Stage",b:"Lilly Moss & The Steel Ponies",sc:"sf"},
    {d:D1,t:"3:45 PM", st:"IBEW Local 102 Stage",b:"Joe Cirotti (Electric Set)",sc:"sf"},
    {d:D1,t:"11:00 AM",st:"Tito's Vodka Stage",b:"Bren",sc:"sf"},
    {d:D1,t:"12:15 PM",st:"Tito's Vodka Stage",b:"Polaroid Fade",sc:"sf"},
    {d:D1,t:"1:30 PM", st:"Tito's Vodka Stage",b:"The Tisburys",sc:"sf"},
    {d:D1,t:"2:45 PM", st:"Tito's Vodka Stage",b:"SKORTS",sc:"sf"},
    {d:D1,t:"4:00 PM", st:"Tito's Vodka Stage",b:"Francie Moon",sc:"sf"},
    {d:D1,t:"11:00 AM",st:"LV International Airport Stage",b:"Nite Liters",sc:"sf"},
    {d:D1,t:"1:00 PM", st:"LV International Airport Stage",b:"Galen Deery",sc:"sf"},
    {d:D1,t:"2:00 PM", st:"LV International Airport Stage",b:"Matt Harrison",sc:"sf"},
    {d:D1,t:"3:00 PM", st:"LV International Airport Stage",b:"Nite Liters",sc:"sf"},
    {d:D1,t:"11:00 AM",st:"Montage Mountain Stage",b:"School of Rock Seasonal Showcase",sc:"sf"},
    {d:D1,t:"12:00 PM",st:"Easton Farmers' Market Stage",b:"Hog-O-Ween Costume Contest",sc:"sf"},
    {d:D1,t:"2:00 PM", st:"Easton Farmers' Market Stage",b:"Bacon Eating Contest (Godshall's)",sc:"sf"},
    {d:D1,t:"4:00 PM", st:"Easton Farmers' Market Stage",b:"Swine Holding Competition",sc:"sf"},
    // ---- Sunday ----
    {d:D2,t:"11:00 AM",st:"IBEW Local 102 Stage",b:"Zaire",sc:"sf"},
    {d:D2,t:"12:15 PM",st:"IBEW Local 102 Stage",b:"Joe Cirotti Trio",sc:"sf"},
    {d:D2,t:"1:30 PM", st:"IBEW Local 102 Stage",b:"Littlebird & The Bad Eggs",sc:"sf"},
    {d:D2,t:"2:45 PM", st:"IBEW Local 102 Stage",b:"Joey Lannigan & The Spirits",sc:"sf"},
    {d:D2,t:"4:00 PM", st:"IBEW Local 102 Stage",b:"A Few Good Men",sc:"sf"},
    {d:D2,t:"11:00 AM",st:"Tito's Vodka Stage",b:"The BC Combo",sc:"sf"},
    {d:D2,t:"12:00 PM",st:"Tito's Vodka Stage",b:"Galen Deery & The Reason Why",sc:"sf"},
    {d:D2,t:"1:15 PM", st:"Tito's Vodka Stage",b:"The Further",sc:"dd"},
    {d:D2,t:"2:30 PM", st:"Tito's Vodka Stage",b:"Jerron Paxton & Dennis Lichtman",sc:"sf"},
    {d:D2,t:"3:45 PM", st:"Tito's Vodka Stage",b:"The Hazmats",sc:"sf"},
    {d:D2,t:"11:00 AM",st:"LV International Airport Stage",b:"Nite Liters",sc:"sf"},
    {d:D2,t:"1:00 PM", st:"LV International Airport Stage",b:"Lilly Moss Duo",sc:"sf"},
    {d:D2,t:"2:00 PM", st:"LV International Airport Stage",b:"Fermenters Trio",sc:"sf"},
    {d:D2,t:"3:00 PM", st:"LV International Airport Stage",b:"Nite Liters",sc:"sf"},
    {d:D2,t:"4:00 PM", st:"LV International Airport Stage",b:"Jerron Paxton & Dennis Lichtman",sc:"sf"},
    {d:D2,t:"11:00 AM",st:"Montage Mountain Stage",b:"School Of Rock House Band Showcase",sc:"sf"},
    {d:D2,t:"12:00 PM",st:"Easton Farmers' Market Stage",b:"Dog-O-Ween Dog Costume Contest",sc:"sf"},
    {d:D2,t:"2:00 PM", st:"Easton Farmers' Market Stage",b:"Bacon Bingo",sc:"sf"},
    {d:D2,t:"4:00 PM", st:"Easton Farmers' Market Stage",b:"Swine Holding Competition",sc:"sf"}
  ];
  root.DD_BACONFEST = {
    name:"PA Bacon Fest", org:"Greater Easton Development Partnership", city:"Easton", state:"PA",
    dates:[D1,D2], free:true, ownStages:true, center:{lat:40.69168,lng:-75.21990},  // Centre Square — own footprint (Easton)
    contact:{ ed:"Jared Mast", site:"pabaconfest.com", org_site:"eastonpartnership.org" },
    stages:STAGES, lineup:LINEUP,
    note:"Stage coords APPROX — verify on-site with the 4-Corner routine. Lineup = last published (2025) until 2026 grid announced."
  };
  if (typeof module!=='undefined' && module.exports) module.exports = root.DD_BACONFEST;
})(typeof window!=='undefined' ? window : (typeof global!=='undefined' ? global : this));
