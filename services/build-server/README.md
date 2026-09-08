# build-server

The Docker image that ECS Fargate runs per deployment: clones the target repo, builds it, and uploads `dist/` to S3, publishing progress to Redis along the way.

## Build and Push to Amazon ECR

```bash
cd services/build-server

docker build --platform linux/arm64 -t build-server .

aws ecr get-login-password --region eu-north-1 | \
docker login --username AWS --password-stdin \
332053469179.dkr.ecr.eu-north-1.amazonaws.com

docker tag build-server:latest \
332053469179.dkr.ecr.eu-north-1.amazonaws.com/build-server:latest

docker push \
332053469179.dkr.ecr.eu-north-1.amazonaws.com/build-server:latest
```

Any change to `script.js` or `main.sh` requires rebuilding and pushing this image — ECS pulls the image, it doesn't see local file changes.

## Run Locally

Store `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `REDIS_URL` in `.env` (gitignored), then run:

```bash
docker build --platform linux/arm64 -t build-server .

docker run -it \
    --env-file .env \
    -e GIT_REPOSITORY__URL=https://github.com/gubbysbyte/new-aws-test-app \
    -e PROJECT_ID=p10 \
    build-server
```

Required runtime environment variables:

- `GIT_REPOSITORY__URL`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `PROJECT_ID`
- `REDIS_URL`

AWS region and output bucket are currently fixed in `script.js` as `eu-north-1` and `deployment-service-outputs`.
