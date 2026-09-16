// Standalone test for the Layer 1 (token bucket) and Layer 2 (concurrency cap
// + heartbeat) rate-limiting logic in services/api-server/index.js.
//
// Talks directly to the same Redis the app uses (via ../.env's REDIS_URL) but
// makes zero AWS/ECS calls, so it's free and safe to run anytime, including
// against the real dev Redis instance. Uses a TEST-NET-3 IP (203.0.113.0/24,
// reserved for documentation/testing, never a real visitor), a dedicated
// `ratelimit-test:deploy:active` key (never the real `deploy:active`), and
// slug names prefixed "ratelimit-test-" so it can never collide with real
// traffic. Cleans up every key it touches when done.
//
// The two Lua scripts below are copied from index.js. If you change the
// scripts there, update them here too, or these tests will silently test
// stale logic.
//
// Usage:
//   cd services/api-server && node scripts/test-rate-limit.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, { commandTimeout: 5000 });

let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}  ${detail}`); }
}

// --- exact copies of the two scripts from index.js ---
const TAKE_DEPLOY_TOKEN_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_interval_ms = tonumber(ARGV[3])
local refill_amount = tonumber(ARGV[4])
local cost = tonumber(ARGV[5])
local ttl_seconds = tonumber(ARGV[6])

local state = redis.call('HMGET', key, 'tokens', 'updatedAt')
local tokens = tonumber(state[1])
local updated_at = tonumber(state[2])

if tokens == nil then
  tokens = capacity
  updated_at = now
end

local elapsed = math.max(0, now - updated_at)
local refill = (elapsed / refill_interval_ms) * refill_amount
tokens = math.min(capacity, tokens + refill)

local allowed = 0
local retry_after_ms = 0

if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  retry_after_ms = math.ceil(((cost - tokens) / refill_amount) * refill_interval_ms)
end

redis.call('HMSET', key, 'tokens', tokens, 'updatedAt', now)
redis.call('EXPIRE', key, ttl_seconds)

return { allowed, retry_after_ms, tokens }
`;

const RESERVE_DEPLOY_SLOT_SCRIPT = `
local key = KEYS[1]
local slug = ARGV[1]
local now = tonumber(ARGV[2])
local max_active = tonumber(ARGV[3])
local ttl_ms = tonumber(ARGV[4])

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - ttl_ms)

if redis.call('ZSCORE', key, slug) then
  return { 0, 'duplicate', redis.call('ZCARD', key) }
end

local active = redis.call('ZCARD', key)
if active >= max_active then
  return { 0, 'full', active }
end

redis.call('ZADD', key, now, slug)
return { 1, 'reserved', active + 1 }
`;

async function takeToken(key, now, capacity, intervalMs, refillAmount, cost, ttlSeconds) {
  const r = await redis.eval(TAKE_DEPLOY_TOKEN_SCRIPT, 1, key, now, capacity, intervalMs, refillAmount, cost, ttlSeconds);
  return { allowed: Number(r[0]) === 1, retryAfterMs: Number(r[1]), tokens: Number(r[2]) };
}

async function reserve(key, slug, now, maxActive, ttlMs) {
  const r = await redis.eval(RESERVE_DEPLOY_SLOT_SCRIPT, 1, key, slug, now, maxActive, ttlMs);
  return { reserved: Number(r[0]) === 1, reason: r[1] };
}

async function touch(key, slug, now) {
  await redis.zadd(key, 'XX', 'GT', now, slug);
}

async function main() {
  const TOKEN_KEY = 'rl:deploy:token:203.0.113.77';
  const ACTIVE_KEY = 'ratelimit-test:deploy:active';
  await redis.del(TOKEN_KEY);
  await redis.del(ACTIVE_KEY);

  console.log('\n== Layer 1: token bucket burst + limit ==');
  let now = Date.now();
  const CAP = 3, INTERVAL = 10_000, REFILL = 1, COST = 1, TTL = 100;
  for (let i = 1; i <= 3; i++) {
    const r = await takeToken(TOKEN_KEY, now, CAP, INTERVAL, REFILL, COST, TTL);
    check(`request ${i}/3 within capacity is allowed`, r.allowed, JSON.stringify(r));
  }
  const r4 = await takeToken(TOKEN_KEY, now, CAP, INTERVAL, REFILL, COST, TTL);
  check('4th request over capacity is rejected', !r4.allowed, JSON.stringify(r4));
  check('rejection carries a positive retryAfterMs', r4.retryAfterMs > 0, JSON.stringify(r4));

  console.log('\n== Layer 1: refill after the interval (simulated via a later "now", no real waiting) ==');
  const later = now + INTERVAL + 1;
  const r5 = await takeToken(TOKEN_KEY, later, CAP, INTERVAL, REFILL, COST, TTL);
  check('request after one refill interval is allowed again', r5.allowed, JSON.stringify(r5));
  await redis.del(TOKEN_KEY);

  console.log('\n== Layer 2: reserve / duplicate / full / release ==');
  const t0 = Date.now();
  const MAX_ACTIVE = 2, ACTIVE_TTL_MS = 5000;
  const a = await reserve(ACTIVE_KEY, 'ratelimit-test-a', t0, MAX_ACTIVE, ACTIVE_TTL_MS);
  check('first reservation succeeds', a.reserved, JSON.stringify(a));
  const aDup = await reserve(ACTIVE_KEY, 'ratelimit-test-a', t0, MAX_ACTIVE, ACTIVE_TTL_MS);
  check('reserving the same slug again is a duplicate', !aDup.reserved && aDup.reason === 'duplicate', JSON.stringify(aDup));
  const b = await reserve(ACTIVE_KEY, 'ratelimit-test-b', t0, MAX_ACTIVE, ACTIVE_TTL_MS);
  check('second distinct reservation succeeds (fills cap of 2)', b.reserved, JSON.stringify(b));
  const c = await reserve(ACTIVE_KEY, 'ratelimit-test-c', t0, MAX_ACTIVE, ACTIVE_TTL_MS);
  check('third reservation is rejected as full', !c.reserved && c.reason === 'full', JSON.stringify(c));
  await redis.zrem(ACTIVE_KEY, 'ratelimit-test-a');
  const c2 = await reserve(ACTIVE_KEY, 'ratelimit-test-c', t0, MAX_ACTIVE, ACTIVE_TTL_MS);
  check('after releasing a slot, a new reservation succeeds', c2.reserved, JSON.stringify(c2));

  console.log('\n== Layer 2: heartbeat (XX GT) ==');
  const hbSlug = 'ratelimit-test-heartbeat';
  await reserve(ACTIVE_KEY, hbSlug, t0, 10, ACTIVE_TTL_MS);
  await touch(ACTIVE_KEY, hbSlug, t0 + 2000);
  let score = Number(await redis.zscore(ACTIVE_KEY, hbSlug));
  check('touch (GT) moves the score forward', score === t0 + 2000, `score=${score}`);
  await touch(ACTIVE_KEY, hbSlug, t0 + 500); // older than current score
  score = Number(await redis.zscore(ACTIVE_KEY, hbSlug));
  check('an out-of-order/older touch cannot rewind the score (GT)', score === t0 + 2000, `score=${score}`);
  await redis.zrem(ACTIVE_KEY, hbSlug);
  await touch(ACTIVE_KEY, hbSlug, t0 + 9000); // slug no longer reserved
  const resurrected = await redis.zscore(ACTIVE_KEY, hbSlug);
  check('touching a released slug does not resurrect it (XX)', resurrected === null, `zscore=${resurrected}`);

  console.log('\n== Layer 2: stale slot is swept on the next reservation ==');
  await redis.zrem(ACTIVE_KEY, 'ratelimit-test-b'); // clear leftovers from earlier block
  await redis.zrem(ACTIVE_KEY, 'ratelimit-test-c');
  const staleSlug = 'ratelimit-test-stale';
  const staleAt = t0;
  await redis.zadd(ACTIVE_KEY, staleAt, staleSlug); // simulate an old reservation, no heartbeats
  const sweepTtlMs = 5000;
  const afterTtl = staleAt + sweepTtlMs + 1000; // well past the TTL
  await reserve(ACTIVE_KEY, 'ratelimit-test-fresh', afterTtl, 10, sweepTtlMs);
  const staleScore = await redis.zscore(ACTIVE_KEY, staleSlug);
  check('a slot with no heartbeat for longer than the TTL is swept away', staleScore === null, `zscore=${staleScore}`);

  // cleanup
  await redis.del(TOKEN_KEY);
  await redis.del(ACTIVE_KEY);
  await redis.quit();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
