// ============================================================================
// dead.dance — k6 load test (hot-path RPCs). Run from a dedicated VM, NOT the app.
//   1) install k6 (https://k6.io)
//   2) seed a throwaway Supabase branch with seed_synthetic.sql
//   3) export SUPA_URL, ANON_KEY (and optional USER_JWT for authed writes)
//   4) k6 run loadtest.k6.js     (ramps smoke→peak→spike→soak; FAILS on SLO breach)
//
// Concurrency note: 3MM is the REGISTERED base; we drive a realistic concurrent
// fraction. Set TARGET_VUS to your peak (e.g. 30000 = ~1% of 3MM concurrent).
// ============================================================================
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const SUPA = __ENV.SUPA_URL;            // https://vmbqfzxhrqxpwgidogfm.supabase.co
const ANON = __ENV.ANON_KEY;            // anon public key
const JWT  = __ENV.USER_JWT || ANON;    // a test session JWT for authed writes (else reads only)
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '2000', 10);

const rpc = (fn) => `${SUPA}/rest/v1/rpc/${fn}`;
const Hread  = { 'apikey': ANON, 'Authorization': `Bearer ${ANON}`, 'Content-Type': 'application/json' };
const Hwrite = { 'apikey': ANON, 'Authorization': `Bearer ${JWT}`,  'Content-Type': 'application/json' };
const errors = new Rate('app_errors');

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus', startVUs: 0,
      stages: [
        { duration: '1m',  target: Math.round(TARGET_VUS*0.05) },  // smoke
        { duration: '3m',  target: Math.round(TARGET_VUS*0.40) },  // average
        { duration: '5m',  target: TARGET_VUS },                   // peak
        { duration: '1m',  target: Math.round(TARGET_VUS*1.5) },   // spike (on-sale)
        { duration: '10m', target: TARGET_VUS },                   // soak
        { duration: '1m',  target: 0 },
      ],
    },
  },
  thresholds: {                                   // ← the SLOs; a breach FAILS the run
    'http_req_duration{kind:read}':  ['p(95)<300'],
    'http_req_duration{kind:write}': ['p(95)<600'],
    'app_errors':                    ['rate<0.001'],
    'http_req_failed':               ['rate<0.001'],
  },
};

function post(url, headers, body, kind) {
  const r = http.post(url, JSON.stringify(body || {}), { headers, tags: { kind } });
  const ok = check(r, { 'status 2xx': (x) => x.status >= 200 && x.status < 300 });
  errors.add(!ok);
  return r;
}

export default function () {
  // ---- reads (the 90% case) ----
  post(rpc('chat_synthesis_today'), Hread, {}, 'read');
  post(rpc('chat_miracle_pool'), Hread, { p_region: 'midatl' }, 'read');
  post(rpc('chat_ad_feed'), Hread, { p_level: 'local', p_region: 'midatl' }, 'read');
  // a feed/listing read against a table view
  http.get(`${SUPA}/rest/v1/chat_show?select=band,venue,show_date&app=eq.dead_dance&limit=20`,
           { headers: Hread, tags: { kind: 'read' } });

  // ---- writes (only if a real USER_JWT is provided) ----
  if (__ENV.USER_JWT) {
    post(rpc('chat_ad_vote'), Hwrite, { p_ad: __ENV.AD_ID || null }, 'write');
    // add chat_game_submit / chat_miracle_grab / message-insert as desired
  }
  sleep(Math.random() * 2 + 0.5);   // think time
}
