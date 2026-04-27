#!/bin/bash

set -e  # stop on error

echo "🚀 Starting deployment..."

# ========================
# CONFIG
# ========================
CONTAINER_NAME="viteezy_backend"
IMAGE_NAME="viteezy-backend"
PORT="8050"
BRANCH="dev_vishwa_phase_2"
DOCKERFILE="Dockerfile.node"   # ✅ IMPORTANT (change if needed)

# ========================
# GIT SYNC
# ========================
echo "📥 Syncing latest code from $BRANCH..."

if [ ! -d ".git" ]; then
  echo "❌ Not a git repository!"
  exit 1
fi

echo "🧹 Cleaning untracked files (keeping .env)..."
git clean -fd -e .env

echo "🔄 Fetching latest changes..."
git fetch origin

echo "⏬ Resetting to origin/$BRANCH..."
git reset --hard origin/$BRANCH

echo "✅ Code updated successfully!"

# ========================
# DOCKER CLEANUP
# ========================
echo "🛑 Stopping old container (if exists)..."
docker stop $CONTAINER_NAME 2>/dev/null || true

echo "🗑 Removing old container..."
docker rm $CONTAINER_NAME 2>/dev/null || true

echo "🧹 Removing old image..."
docker rmi $IMAGE_NAME 2>/dev/null || true

# ========================
# BUILD IMAGE
# ========================
echo "🔨 Building new Docker image using $DOCKERFILE..."

if [ ! -f "$DOCKERFILE" ]; then
  echo "❌ $DOCKERFILE not found!"
  exit 1
fi

docker build -t $IMAGE_NAME -f $DOCKERFILE .

# ========================
# RUN CONTAINER
# ========================
echo "🚀 Running new container..."

docker run -d \
  --name $CONTAINER_NAME \
  --restart always \
  -p $PORT:$PORT \
  --env-file .env \
  $IMAGE_NAME

# ========================
# STATUS
# ========================
echo "✅ Deployment complete!"

echo "📦 Running containers:"
docker ps

echo "📜 Logs (last 20 lines):"
docker logs --tail 20 $CONTAINER_NAME