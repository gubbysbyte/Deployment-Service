# Agent Instructions

## Project

This repository builds a Node.js 20 Docker service that clones a Git repository, runs its build, and uploads `output/dist` to Amazon S3.

- `Dockerfile`: Ubuntu-based Node.js 20 image and entrypoint.
- `main.sh`: clones `$GIT_REPOSITORY__URL` into `/home/app/output`.
- `script.js`: runs `npm install && npm run build`, then uploads files to S3.
- `README.md`: ECR build, login, tag, and push commands.

## Development

- Install dependencies: `npm install`
- Syntax check: `node --check script.js`
- Tests: `npm test` is currently a placeholder and intentionally exits with an error.
- Build the image: `docker build --platform linux/arm64 -t build-server .`

Required runtime environment variables:

- `GIT_REPOSITORY__URL`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `PROJECT_ID`
- `REDIS_URL`

AWS region and output bucket are currently fixed in `script.js` as `eu-north-1` and `deployment-service-outputs`.

## Change Rules

- Never hardcode AWS credentials or commit `.env` files; `.env` is ignored by Git.
- Preserve the `build-server` ECR repository name and `eu-north-1` registry commands unless the deployment target changes.
- Keep changes focused and use CommonJS style consistent with the existing Node.js code.
- After JavaScript changes, run `node --check script.js`. After Dockerfile changes, run a Docker build when Docker is available.
- Do not rewrite Git history or bypass GitHub push protection to publish secrets. Revoke any credential that has been committed, even if the push was blocked.
