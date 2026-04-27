/**
 * Direct Redis EVAL tests for the place-bid Lua script.
 * Uses ioredis against a real Redis (dockerized) — no Postgres needed.
 * Run: npm run test:lua
 */
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

const LUA = fs.readFileSync(path.join(__dirname, '../../src/modules/bidding/lua/place-bid.lua'), 'utf8');
const AUCTION = 'test-auction-id';

describe('place-bid.lua', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis({ host: process.env.REDIS_HOST ?? '127.0.0.1', port: parseInt(process.env.REDIS_PORT ?? '6379', 10) });
  });

  beforeEach(async () => {
    await redis.del(`auction:${AUCTION}`);
    // prime live state: startingPrice=100000 paisa, minIncrement=10000, endsAt=now+60s
    await redis.hset(`auction:${AUCTION}`, {
      status: 'live',
      startingPrice: 100000,
      minIncrement: 10000,
      currentHigh: 0,
      currentHighBidder: '',
      endsAt: Date.now() + 60_000,
      bidCount: 0,
    });
  });

  afterAll(async () => { await redis.quit(); });

  const eval_ = (args: string[]) => redis.eval(LUA, 1, `auction:${AUCTION}`, ...args) as Promise<any>;

  it('accepts first valid bid', async () => {
    const [code, high, bidder] = await eval_(['user-A', '110000', String(Date.now())]);
    expect(code).toBe('OK');
    expect(Number(high)).toBe(110000);
    expect(bidder).toBe('user-A');
  });

  it('rejects bid below min-increment', async () => {
    await eval_(['user-A', '110000', String(Date.now())]);
    const [code] = await eval_(['user-B', '115000', String(Date.now())]);
    expect(code).toBe('BID_TOO_LOW');
  });

  it('rejects same-user bid when already highest', async () => {
    await eval_(['user-A', '110000', String(Date.now())]);
    const [code] = await eval_(['user-A', '125000', String(Date.now())]);
    expect(code).toBe('ALREADY_HIGHEST_BIDDER');
  });

  it('extends end time on late bid (anti-sniping)', async () => {
    await redis.hset(`auction:${AUCTION}`, { endsAt: Date.now() + 10_000 }); // 10s left
    await eval_(['user-A', '110000', String(Date.now())]);
    const ends = parseInt((await redis.hget(`auction:${AUCTION}`, 'endsAt')) as string, 10);
    expect(ends - Date.now()).toBeGreaterThan(25_000);
  });

  it('rejects bid after auction ended', async () => {
    await redis.hset(`auction:${AUCTION}`, { endsAt: Date.now() - 1000, status: 'ended' });
    const [code] = await eval_(['user-A', '110000', String(Date.now())]);
    expect(['AUCTION_NOT_LIVE', 'AUCTION_ENDED']).toContain(code);
  });
});
