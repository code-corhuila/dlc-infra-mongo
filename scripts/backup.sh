#!/bin/sh
# Dumps the clinical database as the read-only backup identity into one gzip
# archive. The password is passed through a private config file, never argv.
set -eu
: "${DLC_MONGO_URI:?DLC_MONGO_URI is required}"
: "${DLC_BACKUP_PASSWORD_FILE:?DLC_BACKUP_PASSWORD_FILE is required}"
: "${DLC_BACKUP_DIR:?DLC_BACKUP_DIR is required}"
user="${DLC_BACKUP_USER:-clinical_backup}"

umask 077
config="$(mktemp)"
trap 'rm -f "$config"' EXIT
printf 'password: "%s"\n' "$(cat "$DLC_BACKUP_PASSWORD_FILE")" > "$config"

archive="$DLC_BACKUP_DIR/clinical-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"
mongodump --uri "$DLC_MONGO_URI" --username "$user" --authenticationDatabase clinical --config "$config" \
  --db clinical --archive="$archive" --gzip --quiet
echo "backup written: $archive"
