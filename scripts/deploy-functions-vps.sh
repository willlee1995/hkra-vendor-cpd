#!/usr/bin/env bash
# Deploy Edge Functions to a self-hosted Supabase VPS over SSH (no local Docker required).
#
# Usage:
#   export SSH_TARGET=deploy@203.0.113.10
#   ./scripts/deploy-functions-vps.sh
#
# Optional:
#   SSH_KEY=~/.ssh/id_ed25519
#   REMOTE_EDGE_FUNCTIONS_DIR=/tmp/hkra-edge-functions
#   DOCKER_CONTAINER=supabase_functions
#   FUNCTIONS_PATH=/home/deno/functions
#
# Requires: ssh, scp, tar (OpenSSH client). Run from repo root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNC_ROOT="$REPO_ROOT/supabase/functions"

SSH_TARGET="${SSH_TARGET:-}"
if [[ -z "$SSH_TARGET" && -n "${VPS_USER:-}" && -n "${VPS_HOST:-}" ]]; then
  SSH_TARGET="${VPS_USER}@${VPS_HOST}"
fi
if [[ -z "$SSH_TARGET" ]]; then
  echo "Set SSH_TARGET (e.g. deploy@your.vps.ip) or VPS_USER + VPS_HOST" >&2
  exit 1
fi

REMOTE_DIR="${REMOTE_EDGE_FUNCTIONS_DIR:-/tmp/hkra-edge-functions}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-supabase_functions}"
FUNCTIONS_PATH="${FUNCTIONS_PATH:-/home/deno/functions}"

# Keep in sync with scripts/deploy-functions.sh
FUNCTION_DIRS=(
  _shared
  hkra-create-event
  vendor-requests
  vendor-upload
  vendor-upload-poster
  vendor-info
)

SSH=(ssh)
if [[ -n "${SSH_KEY:-}" ]]; then
  SSH+=( -i "$SSH_KEY" )
fi
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

for d in "${FUNCTION_DIRS[@]}"; do
  if [[ ! -d "$FUNC_ROOT/$d" ]]; then
    echo "❌ Missing directory: $FUNC_ROOT/$d" >&2
    exit 1
  fi
done

echo "🚀 Deploying Edge Functions → ${SSH_TARGET}"
echo "   Remote staging: ${REMOTE_DIR}"
echo "   Container: ${DOCKER_CONTAINER}:${FUNCTIONS_PATH}"
echo ""

echo "📁 Creating remote staging directory..."
"${SSH[@]}" "${SSH_OPTS[@]}" "$SSH_TARGET" "rm -rf '${REMOTE_DIR}' && mkdir -p '${REMOTE_DIR}'"

echo "📦 Uploading function bundles (tar over SSH)..."
(
  cd "$FUNC_ROOT"
  tar czf - "${FUNCTION_DIRS[@]}"
) | "${SSH[@]}" "${SSH_OPTS[@]}" "$SSH_TARGET" "tar xzf - -C '${REMOTE_DIR}'"

echo "🐳 docker cp + restart on VPS..."
"${SSH[@]}" "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
REMOTE_DIR='${REMOTE_DIR}'
DOCKER_CONTAINER='${DOCKER_CONTAINER}'
FUNCTIONS_PATH='${FUNCTIONS_PATH}'
docker exec "\$DOCKER_CONTAINER" mkdir -p "\$FUNCTIONS_PATH" 2>/dev/null || true
for d in ${FUNCTION_DIRS[*]}; do
  if [ ! -d "\$REMOTE_DIR/\$d" ]; then
    echo "Missing \$d under \$REMOTE_DIR" >&2
    exit 1
  fi
  echo "  → docker cp \$d"
  docker cp "\$REMOTE_DIR/\$d" "\$DOCKER_CONTAINER:\$FUNCTIONS_PATH/"
done
echo "🔄 docker restart \$DOCKER_CONTAINER"
docker restart "\$DOCKER_CONTAINER"
REMOTE

echo ""
echo "✅ Remote deploy finished."
echo "💡 Logs: ssh ${SSH_TARGET} 'docker logs -f ${DOCKER_CONTAINER}'"
