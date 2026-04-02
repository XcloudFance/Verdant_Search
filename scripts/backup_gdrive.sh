#!/usr/bin/env bash
# backup_gdrive.sh — Backup PostgreSQL to Google Drive
#
# Usage:
#   ./scripts/backup_gdrive.sh [remote_folder]
#
# Configured remote: hongyigoogledrive
# Default folder:    searchengine_db
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
RCLONE_REMOTE="hongyigoogledrive"
GDRIVE_FOLDER="${1:-searchengine_db}"
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
  set -a; source "$(dirname "$0")/../.env"; set +a
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; exit 1; }

mkdir -p "${BACKUP_DIR}"

log "Starting PostgreSQL backup"
log "Target:  ${RCLONE_REMOTE}:${GDRIVE_FOLDER}/${BACKUP_FILENAME}"

# ── Dump ──────────────────────────────────────────────────────────────────────
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
  exit 0
fi

if ! rclone listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE}:"; then
  log "WARNING: rclone remote '${RCLONE_REMOTE}' not configured."
  log "Run:  rclone config"
  log "Backup saved locally: ${BACKUP_PATH}"
  exit 0
fi

log "Uploading to Google Drive…"
rclone copy "${BACKUP_PATH}" "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/" \
  --progress \
  --stats-one-line

log "Upload complete → ${RCLONE_REMOTE}:${GDRIVE_FOLDER}/${BACKUP_FILENAME}"

rm "${BACKUP_PATH}"
log "Local temp file removed."

# ── Keep only last 30 backups on Drive ────────────────────────────────────────
OLD_COUNT="$(rclone ls "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/" 2>/dev/null \
  | grep "verdant_db_" | wc -l || echo 0)"
if [ "${OLD_COUNT}" -gt 30 ]; then
  log "Pruning old backups (keeping 30, found ${OLD_COUNT})…"
  rclone ls "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/" \
    | grep "verdant_db_" \
    | sort \
    | head -n $(( OLD_COUNT - 30 )) \
    | awk '{print $2}' \
    | while read -r f; do
        rclone delete "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/${f}"
        log "  Deleted old backup: ${f}"
      done
fi

log "Done! ✓"
