# Deployment Service

A small Vercel-style deployment platform: paste a public git repo URL, it gets built on AWS Fargate, the output is uploaded to S3, and it's served back at `<slug>.localhost:8000` (or your real domain in production).

## Architecture

```
services/frontend        (:3000)  --POST /project-->  services/api-server (:9000)
services/api-server       --RunTask-->  ECS Fargate running services/build-server's image
services/build-server (in the container)  --clone, build, upload-->  S3
services/build-server (in the container)  --publish progress-->      Redis
services/api-server        <--pub/sub--  Redis  --socket.io-->  services/frontend (live logs)
services/s3-reverse-proxy (:8000)  --serves-->  <slug>.localhost:8000  (proxies to the uploaded S3 files)
```

## Services

| Service | What it does |
|---|---|
| [`services/frontend`](services/frontend) | Next.js dashboard — trigger deploys, watch live build logs |
| [`services/api-server`](services/api-server) | REST API that spins up ECS tasks, plus a socket.io relay for build logs |
| [`services/build-server`](services/build-server) | The Docker image ECS runs per deploy — clones, builds, uploads to S3 |
| [`services/s3-reverse-proxy`](services/s3-reverse-proxy) | Serves deployed sites from S3 at `<slug>.localhost:8000` |

Each service has its own `README.md` with setup/run details.

## Running everything locally

```bash
# 1. api-server — REST API + socket.io log relay (:9000, :9001)
cd services/api-server && node index.js

# 2. s3-reverse-proxy — serves deployed sites (:8000)
cd services/s3-reverse-proxy && node index.js

# 3. frontend — the dashboard (:3000)
cd services/frontend && npm run dev
```

`services/build-server` isn't run directly — ECS pulls its built Docker image per deployment (see its README for build/push commands).

## Progress notes

first we are able to store the files in s3 bucket manually
    what changed
1. Set up the ECS, with new cluster and the task definitions and then pasting the image URL into the ECS
2.
