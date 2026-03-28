#!/usr/bin/env bash
set -euo pipefail

# Build and push Delve Docker images to Docker Hub.
# Usage: ./scripts/docker-publish.sh [TAG]
# Default tag: latest

TAG="${1:-latest}"
REPO_API="creative-software/delve-api"
REPO_WEB="creative-software/delve-web"
REPO_STANDALONE="creative-software/delve"

echo "==> Building API image: ${REPO_API}:${TAG}"
docker build --target api -t "${REPO_API}:${TAG}" .

echo "==> Building Web image: ${REPO_WEB}:${TAG}"
docker build --target web -t "${REPO_WEB}:${TAG}" .

echo "==> Building Standalone image: ${REPO_STANDALONE}:${TAG}"
docker build --target standalone -t "${REPO_STANDALONE}:${TAG}" .

echo "==> Pushing ${REPO_API}:${TAG}"
docker push "${REPO_API}:${TAG}"

echo "==> Pushing ${REPO_WEB}:${TAG}"
docker push "${REPO_WEB}:${TAG}"

echo "==> Pushing ${REPO_STANDALONE}:${TAG}"
docker push "${REPO_STANDALONE}:${TAG}"

echo "==> Done. Published:"
echo "    ${REPO_API}:${TAG}"
echo "    ${REPO_WEB}:${TAG}"
echo "    ${REPO_STANDALONE}:${TAG}"
echo ""
echo "Run the standalone image with:"
echo "    docker run -p 8080:8080 -v delve-data:/var/lib/postgresql/data ${REPO_STANDALONE}:${TAG}"
