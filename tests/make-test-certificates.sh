#!/bin/sh
# Test-only CA, server certificate and passwords for one disposable run.
set -eu
cd /secrets
openssl rand -hex 24 > root
openssl rand -hex 24 > migrator
openssl rand -base64 756 > keyfile
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=dlc-test-ca" -keyout ca.key -out ca.pem 2>/dev/null
openssl req -newkey rsa:2048 -nodes -subj "/CN=$TLS_HOST" -keyout server.key -out server.csr 2>/dev/null
printf 'subjectAltName=DNS:%s,DNS:localhost\nextendedKeyUsage=serverAuth,clientAuth\n' "$TLS_HOST" > server.ext
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -days 1 -extfile server.ext -out server.crt 2>/dev/null
cat server.crt server.key > server.pem
rm -f ca.key ca.srl server.csr server.ext server.crt server.key
chown -R mongodb:mongodb /secrets
chmod 400 /secrets/*
