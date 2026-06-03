#!/usr/bin/env bash
# Apply pending SQL migrations on self-hosted Supabase Postgres (local docker exec psql).
#
# Usage (on VPS, from repo root or any cwd):
#   ./scripts/run-migrations.sh
#   ./scripts/run-migrations.sh --dry-run
#   ./scripts/run-migrations.sh --mark-version 20260603000000_zoom_webinar_auto_create
#   ./scripts/run-migrations.sh --baseline-through 20260522100000_email_campaign_jobs_missing_fields
#
# Loads .env.deploy from repo root. Requires docker access to POSTGRES_CONTAINER.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/supabase/migrations"
BOOTSTRAP_SQL="${SCRIPT_DIR}/sql/hkra_schema_migrations_bootstrap.sql"

DRY_RUN=false
MARK_VERSION=""
BASELINE_THROUGH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --mark-version)
      MARK_VERSION="${2:?--mark-version requires a version}"
      shift 2
      ;;
    --baseline-through)
      BASELINE_THROUGH="${2:?--baseline-through requires a version}"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--mark-version VERSION]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -f "${REPO_ROOT}/.env.deploy" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "${REPO_ROOT}/.env.deploy"
  set +a
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-supabase-db}"
POSTGRES_USER="${POSTGRES_USER:-supabase_admin}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"

psql_exec() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 "$@"
  else
    docker exec -i "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 "$@"
  fi
}

psql_query() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "${DATABASE_URL}" -tAc "$1"
  else
    docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "$1"
  fi
}

psql_file() {
  local file="$1"
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${file}"
  else
    docker exec -i "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 <"${file}"
  fi
}

register_migration() {
  local version="$1" name="$2"
  psql_exec -c "INSERT INTO public.hkra_schema_migrations (version, name) VALUES ('${version//\'/\'\'}', '${name//\'/\'\'}') ON CONFLICT (version) DO NOTHING;"
}

echo "Postgres: ${POSTGRES_CONTAINER} / ${POSTGRES_DB} (user ${POSTGRES_USER})"
[[ "${DRY_RUN}" == true ]] && echo "Dry run — no SQL executed"

mapfile -t MIGRATION_FILES < <(find "${MIGRATIONS_DIR}" -maxdepth 1 -name '*.sql' -type f | sort -u)

if [[ -n "${BASELINE_THROUGH}" ]]; then
  psql_file "${BOOTSTRAP_SQL}"
  found=false
  for f in "${MIGRATION_FILES[@]}"; do
    base="$(basename "${f}" .sql)"
    register_migration "${base}" "$(basename "${f}")"
    echo "  Marked: $(basename "${f}")"
    if [[ "${base}" == "${BASELINE_THROUGH}" ]]; then
      found=true
      break
    fi
  done
  if [[ "${found}" != true ]]; then
    echo "Baseline-through not found: ${BASELINE_THROUGH}" >&2
    exit 1
  fi
  echo "Baseline complete through ${BASELINE_THROUGH} (SQL not run)."
  exit 0
fi

if [[ -n "${MARK_VERSION}" ]]; then
  found=""
  for f in "${MIGRATION_FILES[@]}"; do
    base="$(basename "${f}" .sql)"
    if [[ "${base}" == "${MARK_VERSION}" ]]; then
      found="${f}"
      break
    fi
  done
  if [[ -z "${found}" ]]; then
    echo "No migration file named ${MARK_VERSION}.sql" >&2
    exit 1
  fi
  psql_file "${BOOTSTRAP_SQL}"
  register_migration "$(basename "${found}" .sql)" "$(basename "${found}")"
  echo "Marked as applied (SQL not run): $(basename "${found}")"
  exit 0
fi

if [[ "${DRY_RUN}" != true ]]; then
  echo "Bootstrap migration tracker..."
  psql_file "${BOOTSTRAP_SQL}"
fi

mapfile -t APPLIED < <(psql_query "SELECT version FROM public.hkra_schema_migrations ORDER BY version;" 2>/dev/null || true)

is_applied() {
  local v="$1"
  for a in "${APPLIED[@]}"; do
    [[ "${a}" == "${v}" ]] && return 0
  done
  return 1
}

PENDING=()
for f in "${MIGRATION_FILES[@]}"; do
  base="$(basename "${f}" .sql)"
  if ! is_applied "${base}"; then
    PENDING+=("${f}")
  fi
done

if [[ ${#PENDING[@]} -eq 0 ]]; then
  echo "No pending migrations."
  exit 0
fi

echo "Pending (${#PENDING[@]}):"
for f in "${PENDING[@]}"; do
  echo "  - $(basename "${f}")"
done

[[ "${DRY_RUN}" == true ]] && exit 0

for f in "${PENDING[@]}"; do
  echo ""
  echo "Applying $(basename "${f}")..."
  psql_file "${f}"
  register_migration "$(basename "${f}" .sql)" "$(basename "${f}")"
  echo "  OK"
done

echo ""
echo "All pending migrations applied."
