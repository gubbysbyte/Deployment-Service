# Deployment Service

## Build and Push to Amazon ECR

```bash
docker build -t build-server .

aws ecr get-login-password --region eu-north-1 | \
docker login --username AWS --password-stdin \
332053469179.dkr.ecr.eu-north-1.amazonaws.com

docker tag build-server:latest \
332053469179.dkr.ecr.eu-north-1.amazonaws.com/build-server:latest

docker push \
332053469179.dkr.ecr.eu-north-1.amazonaws.com/build-server:latest
```

## Run Locally

Store `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`, then run:

```bash
docker build -t build-server .

docker run -it \
    --env-file .env \
    -e GIT_REPOSITORY__URL=https://github.com/gubbysbyte/new-aws-test-app \
    -e PROJECT_ID=p10 \
    build-server
```

okay what next we did

first we are able to store the files in s3 bucket manually
    what changed
1. Set up the ECS, with new cluster and the task definitions and then pasting the image URL into the ECS
2. 