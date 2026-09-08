# Frontend Roadmap

Future changes for the deploy dashboard, in no particular priority order — except the item below, which is urgent.

## ⚠️ Rate limiting on `/project` (urgent — cost risk)

`api-server`'s `POST /project` has no rate limiting or auth, and every call spins up a real ECS Fargate task. Now that the landing page has a one-click example repo link, it's trivially easy — accidentally or maliciously — for someone to spam deploys and burn through the AWS free tier (or rack up real charges once it's exhausted).

Needs to happen in `services/api-server` before this is exposed anywhere public: some combination of per-IP rate limiting (e.g. `express-rate-limit`), a request cap per time window, and/or requiring auth to deploy at all.

## 1. ~~Deployment history~~ — done

Implemented via `localStorage` (`src/lib/history.ts`) — past deploys (slug, git URL, timestamp, status) persist across refreshes and are shown on the landing page.

## 2. ~~Re-deploy button~~ — done

Implemented — both in the history list and on the active project view, reusing the `slug` param so the same URL gets redeployed rather than a new one.

## 3. Environment variables input

A form section to pass env vars into the build (would need backend support in `script.js`/task overrides too).

## 4. Error/failure state handling

Currently the UI has no real "build failed" path; if `p.on('close')` exits non-zero in `script.js`, nothing signals that to the frontend.

## 5. Custom domain / project naming

Let the user pick their own slug instead of the random one, using the `slug` field the API already supports.

## 6. Dark/light toggle and empty states

A dark/light toggle, plus a proper 404/empty state page.
