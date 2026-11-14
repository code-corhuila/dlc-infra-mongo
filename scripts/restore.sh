#!/bin/sh
# Restores one clinical archive, replacing the clinical database only. It is an
# operator action (engine administrator) in a controlled stage: collections,
# documents, indexes, validators and the Liquibase history come back together.
set -eu
: "${DLC_MONGO_URI:?DLC_MONGO_URI is required}"
: "${DLC_MONGO_ROOT_PASSWORD_FILE:?DLC_MONGO_ROOT_PASSWORD_FILE is required}"
: "${DLC_RESTORE_ARCHIVE:?DLC_RESTORE_ARCHIVE is required}"
user="${DLC_MONGO_ROOT_USER:-root}"

[ -s "$DLC_RESTORE_ARCHIVE" ] || { echo "archive not found: $DLC_RESTORE_ARCHIVE" >&2; exit 1; }
umask 077
config="$(mktemp)"
trap 'rm -f "$config"' EXIT
printf 'password: "%s"\n' "$(cat "$DLC_MONGO_ROOT_PASSWORD_FILE")" > "$config"

mongorestore --uri "$DLC_MONGO_URI" --username "$user" --authenticationDatabase admin --config "$config" \
  --nsInclude 'clinical.*' --drop --archive="$DLC_RESTORE_ARCHIVE" --gzip --quiet
echo "restored: $DLC_RESTORE_ARCHIVE"
