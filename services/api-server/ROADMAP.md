# api-server Roadmap

## Check `RunTaskCommand` failures

`POST /project` calls `ecsClient.send(new RunTaskCommand(...))` and always returns a `"queued"` success response with a `projectSlug`/`url`, without inspecting the result.

`RunTaskCommand` can return an HTTP-level success while still failing to actually start the task — the response includes a `failures` array (e.g. quota exceeded, capacity, IAM issues) alongside `tasks`. Right now that's silently ignored, so a rejected task launch looks identical to a real one to the frontend: it gets a slug and URL and sits on "Queued" forever with no logs and no error, because no task ever ran.

This was hit for real: the account's Fargate On-Demand vCPU quota (4) was fully consumed by stuck tasks, a new deploy's `RunTaskCommand` was rejected, and the frontend had no way to tell — see the "stuck task" incident where 4 old tasks never exited the container due to an open Redis connection, which then blocked all quota.

**Fix:** after `await ecsClient.send(command)`, check `result.failures` — if non-empty, return an error response (e.g. `502`) with the failure reason instead of the fake `"queued"` success, so the frontend can surface it instead of hanging indefinitely.
