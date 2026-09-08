# Frontend Roadmap

Future changes for the deploy dashboard, in no particular priority order.

## 1. Deployment history

A list of past deploys (slug, git URL, timestamp, status) so refreshing the page doesn't lose everything. Right now nothing is persisted; it'd need a backing store (even just `localStorage` for a quick version, or a small DB/table on the backend for something durable across devices).

## 2. Re-deploy button

Redeploy the same repo with a new build, using the `slug` param your API already accepts.

## 3. Environment variables input

A form section to pass env vars into the build (would need backend support in `script.js`/task overrides too).

## 4. Error/failure state handling

Currently the UI has no real "build failed" path; if `p.on('close')` exits non-zero in `script.js`, nothing signals that to the frontend.

## 5. Custom domain / project naming

Let the user pick their own slug instead of the random one, using the `slug` field the API already supports.

## 6. Dark/light toggle and empty states

A dark/light toggle, plus a proper 404/empty state page.
