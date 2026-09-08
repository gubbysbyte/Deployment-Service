# Deployment Service — Frontend

A small Vercel-style dashboard for the deployment pipeline in this repo: paste a public Git repo URL, watch it build in real time, and get a live URL when it's done.

## Stack

- Next.js 16 (App Router, Turbopack, TypeScript)
- Tailwind CSS
- `socket.io-client` for live build logs

## How it works

1. The form on [`src/app/page.tsx`](src/app/page.tsx) `POST`s `{ gitURL }` to `api-server`'s `/project` endpoint.
2. `api-server` returns a `projectSlug` and the eventual site `url`, and kicks off an ECS Fargate task that clones, builds, and uploads the repo to S3.
3. The page opens a `socket.io` connection to `api-server`'s socket port and subscribes to `logs:<projectSlug>`, which `api-server` relays from a Redis pub/sub channel that the build task publishes to as it runs.
4. Log lines stream into the terminal panel; once a line contains `Upload Complete`, the status flips to **Ready** and the site link becomes clickable.

```
frontend (:3000)  --POST /project-->  api-server (:9000)  --RunTask-->  ECS Fargate (build + upload to S3)
frontend (:3000)  <--socket.io-->     api-server (:9001)  <--pub/sub--  Redis (logs:<slug>)
```

## Project structure

```
src/
  app/
    page.tsx          # the whole deploy flow: form -> status -> live logs
    layout.tsx
    globals.css
  components/
    Terminal.tsx       # log panel
    StatusBadge.tsx     # queued / building / ready / error pill
  lib/
    api.ts             # fetch wrapper + env-driven URLs
```

## Environment variables

Set in `.env.local` (gitignored):

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:9000` | `api-server` REST endpoint (`POST /project`) |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:9001` | `api-server`'s socket.io server for live logs |

## Running locally

This app is one piece of a three-process local setup — all three need to be running for a deploy to actually work end to end:

```bash
# 1. api-server — REST API + socket.io log relay (:9000, :9001)
cd api-server && node index.js

# 2. s3-reverse-proxy — serves deployed sites at <slug>.localhost:8000
cd s3-reverse-proxy && node index.js

# 3. this app — the dashboard (:3000)
cd frontend && npm run dev
```

Then open [http://localhost:3000](http://localhost:3000), paste a repo URL, and deploy.

## Known gaps / not yet implemented

See [ROADMAP.md](ROADMAP.md).
