#!/bin/bash

# Deploy Edge Functions to Self-Hosted Supabase (Docker Method)
# Usage: ./scripts/deploy-functions.sh
#
# Note: Self-hosted Supabase doesn't use project-ref.
# This script uses Docker to copy functions directly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
if [ -f "${REPO_ROOT}/.env.deploy" ]; then
  set -a
  # shellcheck source=/dev/null
  . "${REPO_ROOT}/.env.deploy"
  set +a
fi

# Configuration - Update these values for your self-hosted instance (or use .env.deploy)
SUPABASE_URL="${SUPABASE_URL:-https://your-supabase-instance.com}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-supabase_functions}"
FUNCTIONS_PATH="${FUNCTIONS_PATH:-/home/deno/functions}"

echo "🚀 Deploying Edge Functions to Self-Hosted Supabase"
echo "📍 URL: ${SUPABASE_URL}"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please use the Docker Compose method instead."
    echo "   See: docs/DEPLOY_EDGE_FUNCTIONS.md"
    exit 1
fi

# Check if functions directory exists
if [ ! -d "supabase/functions" ]; then
    echo "❌ Functions directory not found: supabase/functions"
    exit 1
fi

# Check if container exists
if ! docker ps -a | grep -q "${DOCKER_CONTAINER}"; then
    echo "❌ Docker container '${DOCKER_CONTAINER}' not found"
    echo ""
    echo "Available containers:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}"
    echo ""
    echo "Please set DOCKER_CONTAINER environment variable:"
    echo "   export DOCKER_CONTAINER=your-container-name"
    exit 1
fi

# Create functions directory if it doesn't exist
echo "📁 Preparing functions directory..."
docker exec "${DOCKER_CONTAINER}" mkdir -p "${FUNCTIONS_PATH}" || {
    echo "⚠️  Could not create directory, trying alternative path..."
    FUNCTIONS_PATH="/var/lib/docker/volumes/supabase_functions/_data"
}

# Shared Deno modules (vendor-requests, hkra-create-event)
echo ""
echo "📦 Deploying _shared modules..."
docker cp supabase/functions/_shared "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy _shared"
    exit 1
}

# Deploy hkra-create-event function
echo ""
echo "📦 Deploying hkra-create-event function..."
docker cp supabase/functions/hkra-create-event "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy hkra-create-event"
    exit 1
}

# Deploy zoom-create-webinar function
echo ""
echo "📦 Deploying zoom-create-webinar function..."
docker cp supabase/functions/zoom-create-webinar "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy zoom-create-webinar"
    exit 1
}

echo ""
echo "📦 Deploying zoom-list-webinars function..."
docker cp supabase/functions/zoom-list-webinars "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy zoom-list-webinars"
    exit 1
}

# Deploy vendor-requests function
echo ""
echo "📦 Deploying vendor-requests function..."
docker cp supabase/functions/vendor-requests "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy vendor-requests"
    exit 1
}

# Deploy vendor-upload function
echo ""
echo "📦 Deploying vendor-upload function..."
docker cp supabase/functions/vendor-upload "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy vendor-upload"
    exit 1
}

# Deploy vendor-upload-poster function
echo ""
echo "📦 Deploying vendor-upload-poster function..."
docker cp supabase/functions/vendor-upload-poster "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy vendor-upload-poster"
    exit 1
}

# Deploy vendor-info function
echo ""
echo "📦 Deploying vendor-info function..."
docker cp supabase/functions/vendor-info "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy vendor-info"
    exit 1
}

# Deploy vendor-reminders function
echo ""
echo "📦 Deploying vendor-reminders function..."
docker cp supabase/functions/vendor-reminders "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy vendor-reminders"
    exit 1
}

# Deploy manage-users function
echo ""
echo "📦 Deploying manage-users function..."
docker cp supabase/functions/manage-users "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy manage-users"
    exit 1
}

# Deploy campaign-proxy function
echo ""
echo "📦 Deploying campaign-proxy function..."
docker cp supabase/functions/campaign-proxy "${DOCKER_CONTAINER}:${FUNCTIONS_PATH}/" || {
    echo "❌ Failed to copy campaign-proxy"
    exit 1
}

# Restart the functions service
echo ""
echo "🔄 Restarting functions service..."
docker restart "${DOCKER_CONTAINER}" || {
    echo "⚠️  Could not restart container automatically"
    echo "   Please restart manually: docker restart ${DOCKER_CONTAINER}"
}

echo ""
echo "✅ All functions deployed successfully!"
echo ""
echo "🔗 Function URLs:"
echo "   - vendor-requests: ${SUPABASE_URL}/functions/v1/vendor-requests"
echo "   - vendor-upload: ${SUPABASE_URL}/functions/v1/vendor-upload"
echo "   - vendor-upload-poster: ${SUPABASE_URL}/functions/v1/vendor-upload-poster"
echo "   - vendor-info: ${SUPABASE_URL}/functions/v1/vendor-info"
echo "   - hkra-create-event: ${SUPABASE_URL}/functions/v1/hkra-create-event"
echo "   - zoom-create-webinar: ${SUPABASE_URL}/functions/v1/zoom-create-webinar"
echo "   - zoom-list-webinars: ${SUPABASE_URL}/functions/v1/zoom-list-webinars"
echo "   - campaign-proxy: ${SUPABASE_URL}/functions/v1/campaign-proxy"
echo ""
echo "💡 Check logs with: docker logs ${DOCKER_CONTAINER}"

