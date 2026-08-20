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
