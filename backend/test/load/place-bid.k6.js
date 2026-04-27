/**
 * k6 load test: 1,000 concurrent virtual users hammering a single auction.
 *
 * Run: k6 run --vus 1000 --duration 2m test/load/place-bid.k6.js
 * Env:
 *   BASE_URL          - backend base (default http://localhost:4000/api/v1)
 *   AUCTION_ID        - target auction (must be live)
 *   AUTH_COOKIE       - raw Cookie header value (bb_access=<jwt>)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const accepted = new Counter('bids_accepted');
const rejected = new Counter('bids_rejected');
const latency = new Trend('bid_latency_ms');

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },
        { duration: '1m', target: 1000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'bid_latency_ms': ['p(99)<300', 'p(95)<150'],
    'http_req_failed': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const AUCTION_ID = __ENV.AUCTION_ID;
const COOKIE = __ENV.AUTH_COOKIE;

export default function () {
  const amount = 100000 + Math.floor(Math.random() * 1000) * 100; // paisa
  const t0 = Date.now();
  const res = http.post(
    `${BASE_URL}/auctions/${AUCTION_ID}/bids`,
    JSON.stringify({ amount }),
    { headers: { 'Content-Type': 'application/json', Cookie: COOKIE } },
  );
  latency.add(Date.now() - t0);
  if (res.status === 200 || res.status === 201) accepted.add(1);
  else rejected.add(1);
  check(res, {
    'status is 200/201/409': (r) => [200, 201, 409].includes(r.status),
  });
  sleep(0.05 + Math.random() * 0.2);
}
