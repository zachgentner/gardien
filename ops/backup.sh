#!/bin/sh
# Automated Postgres backup: pg_dump (custom format) + retention pruning.
# Invoked by the docker-compose `backup` service on BACKUP_CRON, or manually:
#   docker compose run --rm backup sh /usr/local/bin/backup.sh
set -eu

DB_HOST="${DB_HOST:-db}"
DB_NAME="${POSTGRES_DB:-gardien}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
OUT_DIR="/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_DIR}/gardien-${DB_NAME}-${STAMP}.dump"

mkdir -p "$OUT_DIR"

echo "[backup] dumping ${DB_NAME} from ${DB_HOST} -> ${OUT_FILE}"
pg_dump --host="$DB_HOST" --dbname="$DB_NAME" --format=custom --file="$OUT_FILE"

echo "[backup] pruning backups older than ${KEEP_DAYS} days"
find "$OUT_DIR" -name 'gardien-*.dump' -type f -mtime "+${KEEP_DAYS}" -delete

echo "[backup] done. Current backups:"
ls -lh "$OUT_DIR" | grep 'gardien-' || true
