#!/usr/bin/env bash
# backup_gdrive.sh — Backup PostgreSQL to Google Drive
#
# Usage:
#   ./scripts/backup_gdrive.sh [gdrive_remote_folder]
#
# Requires:
#   - rclone configured with a remote named "gdrive"
#     Setup: rclone config  →  choose Google Drive  →  name it "gdrive"
#   - docker (if the database is running in a container)
#
# One-line setup for rclone:
#   curl https://rclone.org/install.sh | sudo bash
#   rclone config  # follow prompts to add gdrive remote
#
# Environment variables (override .env defaults):
#   POSTGRES_HOST     (default: localhost)
#   POSTGRES_PORT     (default: 5432)
#   POSTGRES_USER     (default: verdant)
#   POSTGRES_PASSWORD (default: verdant)
#   POSTGRES_DB       (default: verdant_search)
#   BACKUP_DIR        (default: /tmp/verdant_backups)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
GDRIVE_FOLDER="${1:-verdant_backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILENAME="verdant_db_${TIMESTAMP}.sql.gz"
BACKUP_DIR="${BACKUP_DIR:-/tmp/verdant_backups}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-verdant}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-verdant}"
POSTGRES_DB="${POSTGRES_DB:-verdant_search}"

# Load .env if present
if [ -f "$(dirname "$0")/../.env" ]; then
  # shellcheck disable=SC1091
  set -a; source "$(dirname "$0")/../.env"; set +a
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; exit 1; }

mkdir -p "${BACKUP_DIR}"

log "Starting PostgreSQL backup"
log "Target:  gdrive:${GDRIVE_FOLDER}/${BACKUP_FILENAME}"

# ── Dump ──────────────────────────────────────────────────────────────────────
# Detect whether DB is running inside a Docker container named *postgres* or *verdant*
DOCKER_CONTAINER=""
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  DOCKER_CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null \
    | grep -E '(verdant.*postgres|postgres.*verdant|^verdant_db|^verdant-db|^postgres)' \
    | head -1 || true)"
fi

if [ -n "${DOCKER_CONTAINER}" ]; then
  log "Using Docker container: ${DOCKER_CONTAINER}"
  docker exec "${DOCKER_CONTAINER}" \
    pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
    | gzip > "${BACKUP_PATH}"
else
  log "Using direct pg_dump (host: ${POSTGRES_HOST}:${POSTGRES_PORT})"
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    "${POSTGRES_DB}" \
    | gzip > "${BACKUP_PATH}"
fi

BACKUP_SIZE="$(du -sh "${BACKUP_PATH}" | cut -f1)"
log "Backup created: ${BACKUP_PATH}  (${BACKUP_SIZE})"

# ── Upload to Google Drive ─────────────────────────────────────────────────────
if ! command -v rclone &>/dev/null; then
  log "WARNING: rclone not found — backup saved locally only."
  log "Install rclone:  curl https://rclone.org/install.sh | sudo bash"
  log "Then configure:  rclone config  (create a remote named 'gdrive')"
  exit 0
fi

if ! rclone listremotes 2>/dev/null | grep -q "^gdrive:"; then
  log "WARNING: rclone remote 'gdrive' not configured."
  log "Run:  rclone config  (add Google Drive remote, name it 'gdrive')"
  log "Backup saved locally: ${BACKUP_PATH}"
  exit 0
fi

log "Uploading to Google Drive…"
rclone copy "${BACKUP_PATH}" "gdrive:${GDRIVE_FOLDER}/" \
  --progress \
  --stats-one-line

log "Upload complete → gdrive:${GDRIVE_FOLDER}/${BACKUP_FILENAME}"

# Remove local copy after successful upload
rm "${BACKUP_PATH}"
log "Local temp file removed."

# ── Keep only last 30 backups on Drive ────────────────────────────────────────
OLD_COUNT="$(rclone ls "gdrive:${GDRIVE_FOLDER}/" 2>/dev/null \
  | grep "verdant_db_" | wc -l || echo 0)"
if [ "${OLD_COUNT}" -gt 30 ]; then
  log "Pruning old backups (keeping 30, found ${OLD_COUNT})…"
  rclone ls "gdrive:${GDRIVE_FOLDER}/" \
    | grep "verdant_db_" \
    | sort \
    | head -n $(( OLD_COUNT - 30 )) \
    | awk '{print $2}' \
    | while read -r f; do
        rclone delete "gdrive:${GDRIVE_FOLDER}/${f}"
        log "  Deleted old backup: ${f}"
      done
fi

log "Done! ✓"
