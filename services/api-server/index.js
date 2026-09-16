const express = require('express');
const cors = require('cors');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const dotenv = require('dotenv');

const { Server } = require('socket.io');
const Redis = require('ioredis');

dotenv.config();

const app = express();
const PORT = 9000;

if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}

app.use(cors());

const subscriber = new Redis(process.env.REDIS_URL);

// Layer 1/2 read this connection on every request, so it must fail fast
// instead of queueing commands indefinitely while Redis is unreachable.
const rateLimitRedis = new Redis(process.env.REDIS_URL, {
    enableOfflineQueue: false,
    commandTimeout: 2000,
});
rateLimitRedis.on('error', (err) => console.error('rateLimitRedis error:', err.message));

const io = new Server({ cors: '*' });
io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel);
        socket.emit('subscribed', channel);
    })
})

io.listen(9001);
console.log('Socket server is running on port 9001');

const ecsClient = new ECSClient({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    region: 'eu-north-1'
})

const config = {
    CLUSTER: process.env.AWS_CLUSTER_NAME,
    TASK: process.env.AWS_TASK_DEFINITION
}

app.use(express.json());


// --- Layer 1: per-IP token bucket ---
// Lets normal users retry occasionally while keeping one IP from starting a
// sustained stream of expensive Fargate builds.
const DEPLOY_TOKEN_BUCKET_PREFIX = 'rl:deploy:token:';
const DEPLOY_TOKEN_BUCKET_CAPACITY = Number(process.env.DEPLOY_TOKEN_BUCKET_CAPACITY ?? 3);
const DEPLOY_TOKEN_REFILL_INTERVAL_MS = Number(process.env.DEPLOY_TOKEN_REFILL_INTERVAL_MS ?? 600_000);
const DEPLOY_TOKEN_REFILL_AMOUNT = Number(process.env.DEPLOY_TOKEN_REFILL_AMOUNT ?? 1);
const DEPLOY_TOKEN_COST = 1;
const DEPLOY_TOKEN_BUCKET_TTL_SECONDS = Math.ceil(
    (DEPLOY_TOKEN_BUCKET_CAPACITY / DEPLOY_TOKEN_REFILL_AMOUNT) *
    DEPLOY_TOKEN_REFILL_INTERVAL_MS /
    1000
) + 60;

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

function getClientIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function takeDeployToken(ip) {
    const result = await rateLimitRedis.eval(
        TAKE_DEPLOY_TOKEN_SCRIPT,
        1,
        `${DEPLOY_TOKEN_BUCKET_PREFIX}${ip}`,
        Date.now(),
        DEPLOY_TOKEN_BUCKET_CAPACITY,
        DEPLOY_TOKEN_REFILL_INTERVAL_MS,
        DEPLOY_TOKEN_REFILL_AMOUNT,
        DEPLOY_TOKEN_COST,
        DEPLOY_TOKEN_BUCKET_TTL_SECONDS
    );

    return {
        allowed: Number(result[0]) === 1,
        retryAfterSeconds: Math.max(1, Math.ceil(Number(result[1]) / 1000)),
    };
}

async function deployTokenBucket(req, res, next) {
    try {
        const token = await takeDeployToken(getClientIp(req));
        if (token.allowed) return next();

        res.set('Retry-After', String(token.retryAfterSeconds));
        return res.status(429).json({
            error: `Too many deployments. Please try again in ${token.retryAfterSeconds} seconds.`
        });
    } catch (err) {
        // Fail open: Layer 2 still protects the hard Fargate quota.
        console.error('Deploy token bucket unavailable, failing open:', err);
        return next();
    }
}

// --- Layer 2: global concurrent-build cap ---
// A Redis sorted set works as an atomic semaphore. Each member's score is a
// "last seen alive" timestamp, refreshed by touchDeploySlot() on every log
// line the build emits. Stale entries (no log line in DEPLOY_ACTIVE_TTL_SECONDS)
// are swept by timestamp on every reservation attempt, so a build that crashes
// without emitting a terminal log cannot leak its slot forever.
const MAX_CONCURRENT_DEPLOYS = Number(process.env.MAX_CONCURRENT_DEPLOYS ?? 3);
const DEPLOY_ACTIVE_TTL_SECONDS = Number(process.env.DEPLOY_ACTIVE_TTL_SECONDS ?? 300);
const DEPLOY_ACTIVE_KEY = 'deploy:active';

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

async function reserveDeploySlot(slug) {
    const result = await rateLimitRedis.eval(
        RESERVE_DEPLOY_SLOT_SCRIPT,
        1,
        DEPLOY_ACTIVE_KEY,
        slug,
        Date.now(),
        MAX_CONCURRENT_DEPLOYS,
        DEPLOY_ACTIVE_TTL_SECONDS * 1000
    );

    return {
        reserved: Number(result[0]) === 1,
        reason: result[1],
    };
}

async function releaseDeploySlot(slug) {
    await rateLimitRedis.zrem(DEPLOY_ACTIVE_KEY, slug);
}

// Pushes a slot's "last seen alive" timestamp forward. Called on every log
// line a running build emits, so a build that simply takes a while to finish
// is never mistaken for a dead one.
//   XX - only touch a slug that's already reserved; a straggling log line
//        arriving after release can't resurrect a slot.
//   GT - only move the score forward, never backward, so an out-of-order or
//        delayed message can't rewind a fresher timestamp.
async function touchDeploySlot(slug) {
    await rateLimitRedis.zadd(DEPLOY_ACTIVE_KEY, 'XX', 'GT', Date.now(), slug);
}

async function registerRoutes() {
    app.post('/project', deployTokenBucket, async (req, res) => {
        const { gitURL, slug } = req.body;

        if(!gitURL){
            return res.status(400).json({error: 'gitURL is required'});
        }

        const projectSlug = slug ? slug : generateSlug();

        let slot;
        try {
            slot = await reserveDeploySlot(projectSlug);
        } catch (err) {
            console.error('Redis unavailable while checking deploy capacity, failing closed:', err);
            return res.status(503).json({ error: 'Deployment service is temporarily unavailable. Please try again shortly.' });
        }

        if (!slot.reserved && slot.reason === 'duplicate') {
            return res.status(409).json({ error: 'This project is already deploying.' });
        }

        if (!slot.reserved) {
            return res.status(429).json({ error: 'The build queue is full. Please try again shortly.' });
        }

        // Spin the container
        const command = new RunTaskCommand({
            cluster: config.CLUSTER,
            taskDefinition: config.TASK,
            launchType: 'FARGATE',
            count: 1,
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: ['subnet-09c1ff3728d9fea8b', 'subnet-0b6344ef630e29386', 'subnet-006cc7e851537ec93'],
                    assignPublicIp: 'ENABLED',
                    securityGroups: ['sg-0bf218826fcfa545e']
                }
            },
            overrides: {
                containerOverrides: [
                    {
                        name: 'builder-image-88',
                        environment: [
                            {
                                name: 'GIT_REPOSITORY__URL',
                                value: gitURL
                            },
                            {
                                name: 'PROJECT_ID',
                                value: projectSlug
                            },
                            {
                                name: 'REDIS_URL',
                                value: process.env.REDIS_URL
                            }
                        ]
                    }
                ]
            }
        })

        try {
            const result = await ecsClient.send(command);
            if (result.failures?.length) {
                await releaseDeploySlot(projectSlug).catch(() => {});
                return res.status(502).json({
                    error: `Failed to start build: ${result.failures[0].reason || 'ECS rejected the task'}`
                });
            }
        } catch (err) {
            await releaseDeploySlot(projectSlug).catch(() => {});
            console.error('Failed to start ECS task:', err);
            return res.status(502).json({ error: 'Failed to start build. Please try again.' });
        }

        return res.json({
            status: 'queued',
            data: {
                projectSlug,
                url: `http://${projectSlug}.localhost:8000`
            }
        })
    })

    app.listen(PORT, () => {
        console.log(`API server is running on port ${PORT}`);
    })
}

function isTerminalLog(message) {
    try {
        const { log } = JSON.parse(message);
        return typeof log === 'string' && (log.includes('Upload Complete') || log.includes('Build failed'));
    } catch {
        return false; // not JSON, or no log field
    }
}

async function initRedisSubscribe(){
    console.log('Subscribing to Redis channel logs:*');
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message);

        const slug = channel.replace(/^logs:/, '');
        if (!slug) return;

        if (isTerminalLog(message)) {
            releaseDeploySlot(slug).catch((err) => console.error('Failed to release deploy slot:', err));
            return;
        }

        // Any other line is proof the build is still alive - push its lease
        // forward instead of leaving the reservation timestamp stuck at start time.
        touchDeploySlot(slug).catch((err) => console.error('Failed to touch deploy slot:', err));
    })
}

initRedisSubscribe();
registerRoutes();
