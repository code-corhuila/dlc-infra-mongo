#!/bin/sh
set -eu

direct='mongodb://mongo:27017/?directConnection=true'
replica='mongodb://mongo:27017/?replicaSet=rs0'

for _ in $(seq 1 60); do
  mongosh --quiet --norc "$direct" --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && break
  sleep 1
done
mongosh --quiet --norc "$direct" /scripts/init.js >/dev/null
mongosh --quiet --norc "$replica" /checks/backup-fixture.js
echo "ok: synthetic Clinical data, validator, index and Liquibase history in place"

sh /scripts/backup.sh
archive="$(ls /backups/clinical-*.archive.gz | head -n 1)"
echo "ok: backup taken by the read-only backup identity"

mongosh --quiet --norc "$replica" --eval 'load("/scripts/identities.js"); authenticateRoot(); db.getSiblingDB("clinical").dropDatabase()' >/dev/null
DLC_RESTORE_ARCHIVE="$archive" sh /scripts/restore.sh
mongosh --quiet --norc "$replica" /checks/backup-verify.js
echo "ok: restore brings back documents, indexes, validators and the Liquibase history"
