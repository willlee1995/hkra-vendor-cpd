#!/bin/bash

# Find Supabase Functions Container
# Usage: ./scripts/find-functions-container.sh

echo "🔍 Searching for Supabase Functions containers..."
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found"
    exit 1
fi

# Search for functions containers
CONTAINERS=$(docker ps -a --format "{{.Names}}" | grep -iE "function|deno|edge")

if [ -n "$CONTAINERS" ]; then
    echo "Found potential functions containers:"
    echo ""
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep -iE "function|deno|edge|NAMES"
    echo ""
    echo "💡 Use one of these container names with the deploy script:"
    echo "   export DOCKER_CONTAINER=CONTAINER_NAME"
    echo "   ./scripts/deploy-functions.sh"
else
    echo "⚠️  No functions containers found. Listing all containers:"
    echo ""
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    echo ""
    echo "💡 Look for containers with names like:"
    echo "   - supabase_functions"
    echo "   - supabase-edge-functions"
    echo "   - supabase-functions"
fi

