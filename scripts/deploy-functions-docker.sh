#!/bin/bash

# Deploy Edge Functions to Self-Hosted Supabase (Docker Compose)
# Usage: ./scripts/deploy-functions-docker.sh

set -e

# Configuration - Update these paths for your Docker setup
SUPABASE_FUNCTIONS_PATH="${SUPABASE_FUNCTIONS_PATH:-/var/lib/docker/volumes/supabase_functions/_data}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-supabase_functions}"

echo "🚀 Deploying Edge Functions to Self-Hosted Supabase (Docker)"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

# Check if functions directory exists
if [ ! -d "supabase/functions" ]; then
    echo "❌ Functions directory not found: supabase/functions"
    exit 1
fi

# Method 1: Copy via Docker volume (if volume is accessible)
if [ -d "${SUPABASE_FUNCTIONS_PATH}" ]; then
    echo "📦 Copying functions to Docker volume..."
    cp -r supabase/functions/vendor-requests "${SUPABASE_FUNCTIONS_PATH}/"
    cp -r supabase/functions/vendor-upload "${SUPABASE_FUNCTIONS_PATH}/"
    echo "✅ Functions copied successfully"

    echo ""
    echo "🔄 Restarting Supabase functions service..."
    docker-compose restart supabase_functions || {
        echo "⚠️  Could not restart via docker-compose, trying docker restart..."
        docker restart "${DOCKER_CONTAINER}" || {
            echo "⚠️  Please restart the functions service manually"
        }
    }

# Method 2: Copy via Docker exec
elif docker ps | grep -q "${DOCKER_CONTAINER}"; then
    echo "📦 Copying functions via Docker container..."

    # Create functions directory if it doesn't exist
    docker exec "${DOCKER_CONTAINER}" mkdir -p /home/deno/functions || true

    # Copy vendor-requests
    docker cp supabase/functions/vendor-requests "${DOCKER_CONTAINER}:/home/deno/functions/"

    # Copy vendor-upload
    docker cp supabase/functions/vendor-upload "${DOCKER_CONTAINER}:/home/deno/functions/"

    echo "✅ Functions copied successfully"
    echo ""
    echo "🔄 Restarting container..."
    docker restart "${DOCKER_CONTAINER}"

else
    echo "❌ Could not find Docker container or volume path"
    echo ""
    echo "Please use one of these methods:"
    echo "1. Update SUPABASE_FUNCTIONS_PATH to your volume path"
    echo "2. Update DOCKER_CONTAINER to your container name"
    echo "3. Use volume mount in docker-compose.yml (see docs/DEPLOY_EDGE_FUNCTIONS.md)"
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "💡 Tip: Check function logs with:"
echo "   docker logs ${DOCKER_CONTAINER}"

