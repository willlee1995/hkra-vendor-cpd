#!/bin/bash

# Load .env file and set environment variables in Docker container
# Usage: ./scripts/load-env-to-docker.sh [CONTAINER_NAME]
#
# This script reads a .env file and sets environment variables in a Docker container.
# Note: For persistent environment variables, you should recreate the container with
# these variables set, or use Docker Compose with env_file directive.

set -e

CONTAINER_NAME="${1:-${DOCKER_CONTAINER:-supabase_functions}}"
ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found: $ENV_FILE"
    echo "   Create a .env file in the project root with your environment variables"
    exit 1
fi

if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "❌ Docker container '$CONTAINER_NAME' not found"
    echo ""
    echo "Available containers:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}"
    exit 1
fi

echo "📝 Loading environment variables from $ENV_FILE into container: $CONTAINER_NAME"
echo ""

# Read .env file and set variables
ENV_ARGS=()
while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue

    # Extract key and value
    key=$(echo "$line" | cut -d '=' -f1 | xargs)
    value=$(echo "$line" | cut -d '=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^"//;s/"$//')

    if [ -n "$key" ] && [ -n "$value" ]; then
        ENV_ARGS+=("-e" "$key=$value")
        echo "  ✓ $key"
    fi
done < "$ENV_FILE"

if [ ${#ENV_ARGS[@]} -eq 0 ]; then
    echo "⚠️  No environment variables found in $ENV_FILE"
    exit 1
fi

echo ""
echo "⚠️  Note: Setting environment variables in a running container is temporary."
echo "   For persistent environment variables, you should:"
echo ""
echo "   1. Use Docker Compose with env_file directive (recommended):"
echo "      env_file:"
echo "        - .env"
echo ""
echo "   2. Or recreate the container with environment variables:"
echo "      docker stop $CONTAINER_NAME"
echo "      docker rm $CONTAINER_NAME"
echo "      docker run ... ${ENV_ARGS[*]} ..."
echo ""
read -p "Continue anyway? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Note: docker exec doesn't support setting environment variables directly
# We need to use docker commit or recreate the container
echo ""
echo "❌ Cannot set environment variables in a running container."
echo ""
echo "To set environment variables, you need to:"
echo ""
echo "Option 1: Use Docker Compose (Recommended)"
echo "  Add to your docker-compose.yml:"
echo "    services:"
echo "      supabase_functions:"
echo "        env_file:"
echo "          - .env"
echo ""
echo "Option 2: Recreate container with environment variables"
echo "  Stop and remove the container, then recreate it with:"
echo "    docker run -d --name $CONTAINER_NAME \\"
for i in "${!ENV_ARGS[@]}"; do
    if [ $((i % 2)) -eq 0 ]; then
        echo "      ${ENV_ARGS[$i]} ${ENV_ARGS[$((i+1))]} \\"
    fi
done | head -n -1
echo "      your-image:tag"
echo ""
echo "Option 3: Export variables and restart (temporary)"
echo "  The variables will be lost on container restart"

