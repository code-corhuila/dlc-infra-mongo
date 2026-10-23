#!/bin/sh
set -eu

tls='mongodb://mongo:27017/?directConnection=true&tls=true&tlsCAFile=/secrets/ca.pem'
plain='mongodb://mongo:27017/?directConnection=true&serverSelectionTimeoutMS=3000'

for _ in $(seq 1 60); do
  mongosh --quiet --norc "$tls" --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && break
  sleep 1
done

if mongosh --quiet --norc "$plain" --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then
  echo "A plain connection was accepted" >&2
  exit 1
fi
echo "ok: plain connection refused"

if echo | openssl s_client -connect mongo:27017 -tls1_1 >/dev/null 2>&1; then
  echo "TLS 1.1 was accepted" >&2
  exit 1
fi
echo | openssl s_client -connect mongo:27017 -tls1_2 -CAfile /secrets/ca.pem -verify_return_error 2>/dev/null | grep -q 'Verify return code: 0'
echo "ok: TLS 1.1 refused, TLS 1.2 accepted with a verified certificate"

mongosh --quiet --norc "$tls" /scripts/init.js
mongosh --quiet --norc "$tls" --eval 'quit(db.hello().isWritablePrimary ? 0 : 1)'
echo "ok: initialization and readiness over TLS"
