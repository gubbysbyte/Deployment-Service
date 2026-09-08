# Agent Instructions

## Project

This is a pnpm workspace with four independently-run services under `services/`:

- `services/frontend` — Next.js dashboard
- `services/api-server` — REST API + socket.io log relay
- `services/build-server` — Docker image ECS runs per deployment
- `services/s3-reverse-proxy` — serves deployed sites from S3

See the root `README.md` for the architecture overview, and each service's own `AGENTS.md`/`README.md` for service-specific setup, commands, and change rules.

## Change Rules

- Never hardcode AWS credentials or commit `.env` files; `.env` is ignored by Git at any depth.
- Keep changes scoped to the relevant service unless a change genuinely spans services (e.g. an API contract change between `api-server` and `frontend`).
- Do not rewrite Git history or bypass GitHub push protection to publish secrets. Revoke any credential that has been committed, even if the push was blocked.
