/* dd_logoguess_vip.js — curated logo/photo overrides for the marquee artists Michael
   reaches out to directly. Merges OVER the generated dd_logoguess.js. Only confident,
   official Facebook handles are listed; anyone omitted falls back to clean initials
   (a right monogram beats a wrong photo). Their FB profile picture is the photo. */
(function (root) {
  var VIP = {
    // ① the crown (living founders — Bob has passed; the outreach starts with the drummers)
    'bill-kreutzmann':     'https://graph.facebook.com/billkreutzmann/picture?type=large&width=240',
    'mickey-hart':         'https://graph.facebook.com/mickeyhart/picture?type=large&width=240',
    // ② successor chairs
    'john-mayer':          'https://graph.facebook.com/johnmayer/picture?type=large&width=240',
    'oteil-burbridge':     'https://graph.facebook.com/OteilBurbridge/picture?type=large&width=240',
    // ③ tribute tier (also present in dd_logoguess; pinned here for certainty)
    'melvin-seals-and-jgb':'https://graph.facebook.com/MelvinSealsandJGB/picture?type=large&width=240',
    'dark-star-orchestra': 'https://graph.facebook.com/darkstarorchestra/picture?type=large&width=240',
    'sages-and-spirits':   'https://graph.facebook.com/SagesandSpirits/picture?type=large&width=240'
    // (Steve Kimock, John Kimock, Jeff Chimenti, John Kadlecik intentionally omitted
    //  until the exact official handle is confirmed — they show a clean monogram.)
  };
  root.DDLogoGuess = root.DDLogoGuess || {};
  for (var k in VIP) if (VIP.hasOwnProperty(k)) root.DDLogoGuess[k] = VIP[k];
})(typeof window !== 'undefined' ? window : this);
