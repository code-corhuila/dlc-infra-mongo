#!/bin/sh
set -eu

direct='mongodb://mongo:27017/?directConnection=true'
replica='mongodb://mongo:27017/?replicaSet=rs0'
ready='quit(db.hello().isWritablePrimary ? 0 : 1)'

# The engine answers before the set exists; readiness must still fail.
for _ in $(seq 1 60); do
  mongosh --quiet --norc "$direct" --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && break
  sleep 1
done
if mongosh --quiet --norc "$direct" --eval "$ready" >/dev/null 2>&1; then
  echo "Readiness passed without a primary" >&2
  exit 1
fi
echo "ok: not ready without a primary"

if mongosh --quiet --norc "$direct" --eval 'db.adminCommand({listDatabases:1})' >/dev/null 2>&1; then
  echo "An anonymous client listed databases" >&2
  exit 1
fi
echo "ok: anonymous access rejected"

mongosh --quiet --norc "$direct" /scripts/init.js
mongosh --quiet --norc "$direct" --eval "$ready"
echo "ok: ready with a writable primary"

mongosh --quiet --norc "$direct" /scripts/init.js | grep -q 'already initialized'
echo "ok: initialization is idempotent"

mongosh --quiet --norc "$replica" /checks/migrator-check.js
echo "ok: migration identity limited to the clinical database"

mongosh --quiet --norc "$replica" /checks/transaction-check.js
echo "ok: multi-document transactions commit and abort"
