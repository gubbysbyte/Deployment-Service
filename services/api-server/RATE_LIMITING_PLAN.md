# Rate Limiting — Implementation Plan

Scope: protect `POST /project` from spam and from exhausting the AWS Fargate
quota. This service intentionally has no login wall, so the protection is based
on IP-level request throttling plus a global build cap.

The selected design is a **hybrid**:

1. **Per-IP token bucket** for deploy-start requests.
2. **Global Redis semaphore** for concurrent Fargate builds.
3. Optional future fixed-window daily quota if the public demo needs a product
   limit such as "20 deploys per day".

This is better for this service than pure fixed windows because deployments are
expensive, long-running operations. The token bucket allows a small natural
burst, while the semaphore protects the real cost boundary.

---

## Layer 1 — Per-IP Token Bucket

Endpoint: `POST /project`

Purpose: stop one client from repeatedly starting builds while keeping normal
demo usage smooth.

### Algorithm

Each IP gets a bucket stored in Redis:

```txt
key: rl:deploy:token:<ip>
hash fields:
  tokens
  updatedAt
```

On every deploy request:

1. Refill tokens according to elapsed time.
2. Cap tokens at bucket capacity.
3. If at least one token is available, consume one and continue.
4. If no token is available, return `429` with `Retry-After`.

The refill and consume operation is a single Redis Lua script, so two requests
from the same IP cannot both spend the same token.

### Defaults

```txt
DEPLOY_TOKEN_BUCKET_CAPACITY=3
DEPLOY_TOKEN_REFILL_INTERVAL_MS=600000
DEPLOY_TOKEN_REFILL_AMOUNT=1
```

Interpretation: an IP can start up to 3 deploys quickly, then earns 1 deploy
token every 10 minutes.

### Response on limit hit

Status:

```txt
429
```

Headers:

```txt
Retry-After: <seconds>
```

Body:

```json
{
  "error": "Too many deployments. Please try again in <seconds> seconds."
}
```

### Failure Mode

The token bucket **fails open**. If Redis has a temporary problem, the request is
allowed through and an error is logged.

Reason: this layer protects fairness and casual abuse, but it is not the hard
cost ceiling. Layer 2 still protects the Fargate quota.

---

## Layer 2 — Global Concurrent Build Cap

Endpoint: `POST /project`

Purpose: prevent the service from starting more Fargate builds than the AWS
quota/cost envelope can tolerate, regardless of IP rotation.

### Algorithm

Use one Redis sorted set as an atomic semaphore:

```txt
key: deploy:active
member: <projectSlug>
score: reservation timestamp in ms
```

On launch, before `RunTaskCommand`:

1. Remove stale members older than `DEPLOY_ACTIVE_TTL_SECONDS`.
2. If the slug is already present, return `409`.
3. If active count is at or above `MAX_CONCURRENT_DEPLOYS`, return `429`.
4. Add the slug to the set and start the ECS task.

The check and reservation happen in one Lua script, so concurrent API requests
cannot race past the global cap.

On completion:

- The build task publishes terminal logs to `logs:<slug>`.
- The API server sees `"Upload Complete"` or `"Build failed"`.
- The slug is removed from `deploy:active`.

Safety net:

- If a task crashes and never publishes a terminal log, stale sorted-set members
  are removed during the next reservation attempt.

### Defaults

```txt
MAX_CONCURRENT_DEPLOYS=3
DEPLOY_ACTIVE_TTL_SECONDS=900
```

The default cap of 3 leaves headroom under a 4 vCPU Fargate quota.

### Failure Mode

The concurrent build cap **fails closed**. If Redis is unavailable while checking
capacity, the endpoint returns:

```json
{
  "error": "Deployment service is temporarily unavailable. Please try again shortly."
}
```

Reason: this layer protects the hard cost/quota ceiling and has no safe
fallback.

---

## ECS Launch Failure Handling

After reserving a slot, `RunTaskCommand` can still fail or return ECS failures.
The route releases the reserved slot before returning an error:

```json
{
  "error": "Failed to start build. Please try again."
}
```

or:

```json
{
  "error": "Failed to start build: <ecs reason>"
}
```

This prevents a rejected ECS task from leaking a build slot and leaving the
frontend stuck in `queued`.

---

## Proxy/IP Handling

Local development uses `req.ip` from the socket address.

When running behind a trusted proxy, set:

```txt
TRUST_PROXY=1
```

This enables Express `trust proxy` so rate-limit keys use the client IP from
`X-Forwarded-For`.

---

## Changes By File

| File | Change |
|---|---|
| `services/api-server/index.js` | Redis Lua token bucket middleware on `POST /project`; atomic `deploy:active` semaphore; slot release on terminal logs; ECS failure cleanup; optional `TRUST_PROXY` |
| `services/api-server/package.json` | no rate-limit library required; implementation uses existing `ioredis` |
| `services/api-server/.env` | optional config vars listed above |
| `services/frontend` | no required change; it already shows the backend `error` body |

---

## Test Plan

Use local env overrides to make verification fast.

1. **Token bucket allows burst**  
   Set `DEPLOY_TOKEN_BUCKET_CAPACITY=3`. Send 3 deploy requests from one IP.
   They should pass the token layer.

2. **Token bucket rejects after capacity**  
   Send a 4th request before refill. It should return `429`, JSON error, and
   `Retry-After`.

3. **Token refill works**  
   Set `DEPLOY_TOKEN_REFILL_INTERVAL_MS=5000`. Exhaust tokens, wait 5 seconds,
   then confirm one more request is accepted.

4. **Global cap is enforced across IPs**  
   Set `MAX_CONCURRENT_DEPLOYS=1`, start one deploy, then start another before
   terminal logs arrive. The second should return queue-full `429`.

5. **Duplicate slug is blocked**  
   Start a deploy with a fixed slug, then immediately start the same slug again.
   The second should return `409`.

6. **Slot release works**  
   Publish a terminal message on `logs:<slug>` containing `Upload Complete` or
   `Build failed`, then confirm a new deploy can reserve capacity.

7. **Stale slot cleanup works**  
   Set `DEPLOY_ACTIVE_TTL_SECONDS=5`, reserve a slot, wait longer than 5
   seconds, then confirm the next reservation cleans the stale member.

8. **Redis down behavior**  
   Token bucket errors should fail open, but the global cap should fail closed
   with `503`.

9. **ECS rejection cleanup**  
   Point `AWS_TASK_DEFINITION` at a bad task definition. The endpoint should
   return `502` and the slug should not remain in `deploy:active`.

---

## Known Limitations

- IP-based limits punish shared networks and are bypassable by IP rotation.
- Without auth, there is no per-user fairness model.
- The worker still assumes `npm install && npm run build` and `dist/`.
- The active-build TTL is a cleanup safety net, not real task supervision.
