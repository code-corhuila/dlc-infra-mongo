# dlc-infra-mongo

> MongoDB infrastructure for the Di Lucca Clinical context.

Part of **Di Lucca Dental Care & Technology**. Governance and architecture decisions live in
[`dlc-docs`](https://github.com/code-corhuila/dlc-docs).

## Responsibility

This repository provisions and operates the independent MongoDB engine used by Clinical
([ADR-002](https://github.com/code-corhuila/dlc-docs/blob/main/05-architecture/decisions/ADR-002-polyglot-persistence.md),
[ADR-009](https://github.com/code-corhuila/dlc-docs/blob/main/05-architecture/decisions/ADR-009-mongodb-infrastructure.md)).
It covers the engine, its replica set, persistent storage, readiness and, later, access, transport
security and recovery. It does **not** own Clinical collections, validators, indexes, seeds or
Liquibase change sets: those belong to
[`dlc-clinical-db`](https://github.com/code-corhuila/dlc-clinical-db), and runtime behavior to
[`dlc-clinical-api`](https://github.com/code-corhuila/dlc-clinical-api).

No database credentials or real environment files belong in Git.

## Structure

| Path | Purpose |
| --- | --- |
| `compose.yml` | Pinned MongoDB 8.0 engine as an authenticated replica set, persistent volumes, readiness check and a one-shot initializer. |
| `compose.tls.yml` | Override for the shared stages: TLS 1.2+ required for clients and members. |
| `scripts/init.js` | Idempotent initialization: replica set, writable primary, and the Clinical migration identity. |
| `scripts/runtime-identity.js` | Runtime identity of the Clinical processes, run after the `dlc-clinical-db` migrations. |
| `scripts/identities.js` | Helpers shared by the scripts; secrets are read from mounted files and never printed. |
| `env/.env.*.example` | Stage templates (`local`, `develop`, `qa`, `main`) with secret file paths and secret references by name; no values. |
| `tests/` | Disposable checks with generated test-only secrets: readiness, anonymous rejection, initialization, identities, network allow-list, a transaction, and TLS. |

## Engine

- Image: `mongo:8.0.32` (MongoDB Community 8.0.32), pinned by digest
  `sha256:4968f22d0c6c10ef29952f3e807f62872ba22b3312f25803564fbfc08255efc2`, the same image
  `dlc-clinical-db` verifies its migrations against.
- Replica set `rs0` (`DLC_MONGO_REPLICA_SET`). Clinical commits its state and outbox in
  multi-document transactions, which a standalone `mongod` rejects.
- Authentication is always on, including Local: anonymous clients are rejected, and members
  authenticate each other with a keyfile. The root account exists only to initialize the engine;
  never give it to a Clinical process.
- Reachable as `dlc-mongo:27017` only on the external `clinical-data` network
  (`CLINICAL_DATA_NETWORK_NAME`); it publishes no host port. That network is the allow-list: only the
  Clinical processes and the `dlc-clinical-db` migrator join it, while every other context stays on the
  platform network and cannot reach MongoDB.
- Named volumes `mongo_data` and `mongo_config` keep data across restarts.
- Readiness: the health check passes only while the member is a writable primary, so it fails
  until the set is initialized and whenever no primary is available. A MongoDB outage affects
  Clinical readiness only; PostgreSQL-backed services never depend on it.

## Transport and storage security

- **TLS.** Development, QA and Production start with `-f compose.yml -f compose.tls.yml`: `requireTLS`,
  TLS 1.0 and 1.1 disabled, the server certificate (PEM with key, SAN `dlc-mongo`) and its CA from the
  secret files named in the stage template. Members of the set use the same TLS settings. Clients add
  `tls=true&tlsCAFile=<CA file>` to their connection string. Local runs `compose.yml` alone, without TLS,
  on a developer machine with synthetic data only.
- **Encryption at rest.** Not in place: it depends on the hosting decision P-01 and the mechanism and key
  management decision P-04 (for example encrypted volumes or a provider option). It must be recorded
  and verified in a shared stage, not assumed.

## Identities

| Identity | Database | Roles | Used by |
| --- | --- | --- | --- |
| `clinical_migrator` | `clinical` | `dbAdmin`, `readWrite`, `userAdmin` on `clinical` only | `dlc-clinical-db` (Liquibase) |
| `clinical_runtime` | `clinical` | `clinical_application`, `clinical_outbox_publisher`, `clinical_inbox_consumer` | `dlc-clinical-api`: API, outbox relay, inbox consumer, intent reconciler |

`scripts/init.js` creates the identity, or re-applies its password and exact roles on every run, so a
rotated secret or a changed grant is corrected. The migrator cannot write to another database, create
users outside `clinical`, list every database or read the replica-set configuration (see `tests/`).
The runtime identity needs the roles that `dlc-clinical-db` creates, so it is ensured after the
migrations and refuses to run before them:

```sh
docker compose --env-file env/.env.local.example -f compose.yml --profile identities run --rm dlc-mongo-runtime-identity
```

The runtime identity reads and writes Clinical data through those roles and is `Unauthorized` to
create or drop collections, indexes, validators, roles or users, to delete Clinical data or to read
another database.

Connection string for the migrator on the platform network (its password comes from its secret):

```text
mongodb://clinical_migrator:<password>@dlc-mongo:27017/clinical?replicaSet=rs0&authSource=clinical
```

## Stages

| Stage | Branch | Status |
| --- | --- | --- |
| Local | — | Verified: single-member replica set from this repository. |
| Development | `develop` | Not deployed. Hosting and replica-set size pending decision P-01. |
| QA | `qa` | Not deployed. Pending P-01. |
| Production | `main` | Not deployed. Pending P-01. |

Still pending: encryption at rest ([#4](https://github.com/code-corhuila/dlc-infra-mongo/issues/4), P-04),
and backup and recovery
([#3](https://github.com/code-corhuila/dlc-infra-mongo/issues/3)). Until they are in place, use this
engine only on a developer machine with synthetic data. In shared stages each `*_FILE` is materialized
from the AWS Secrets Manager reference named in its env template; those bindings are pending.

## Handoff to dlc-clinical-db and dlc-clinical-api

| Item | Value |
| --- | --- |
| Engine | MongoDB Community 8.0.32 (`mongo:8.0.32` pinned by digest), replica set `rs0` |
| Network | external `clinical-data` (`CLINICAL_DATA_NETWORK_NAME`), host `dlc-mongo:27017` |
| Database | `clinical`; identities authenticate against it (`authSource=clinical`) |
| Migration access | `clinical_migrator`; `dlc-clinical-db` runs `deploy/compose.yml` with `deploy/compose.auth.yml`, `MONGO_HOST=dlc-mongo`, `PLATFORM_NETWORK_NAME=clinical-data` and `MONGO_MIGRATOR_PASSWORD_FILE` |
| Runtime access | `clinical_runtime`: `MONGO_URI=mongodb://clinical_runtime:<password>@dlc-mongo:27017/?replicaSet=rs0&authSource=clinical` with `MONGO_DATABASE=clinical`, on the `clinical-data` network |
| Secret references | `dlc/<stage>/clinical-mongo/{root-password,keyfile,migrator-password,runtime-password}` (names only; bindings pending P-01) |
| TLS stages | Clients add `tls=true&tlsCAFile=<CA file>` (Go driver). The Liquibase runner (Java driver) does not read `tlsCAFile`: it needs the CA in a JVM truststore, pending in `dlc-clinical-db` until a TLS stage exists. |
| Liquibase compatibility | Reported by `dlc-clinical-db`: Liquibase 4.31.1 with the `liquibase-mongodb` extension; change types `createCollection`, `runCommand`, `createIndex`, `dropIndex`; history and lock in `databasechangelog_clinical` and `databasechangeloglock_clinical`; empty-store and upgrade verified on 8.0.32 locally. Shared stages pending. |

## Run locally

Generate the local secrets once, inside a container so no value is typed or shown. `secrets/` is
ignored by Git:

```sh
mkdir -p secrets
docker run --rm -v "$PWD/secrets:/out" mongo:8.0.32 sh -c 'for f in mongo-root-password.txt clinical-migrator-password.txt clinical-runtime-password.txt; do [ -s /out/$f ] || openssl rand -hex 24 > /out/$f; done; [ -s /out/mongo-keyfile ] || openssl rand -base64 756 > /out/mongo-keyfile'
```

Then start the engine:

```sh
docker network create clinical-data
docker compose --env-file env/.env.local.example -f compose.yml up -d
docker compose --env-file env/.env.local.example -f compose.yml ps
```

`dlc-mongo-init` exits after the primary and the migration identity are ready; it is retried a
bounded number of times while `mongod` starts. Then apply the Clinical schema from `dlc-clinical-db` as `clinical_migrator` and ensure the runtime
identity (see Identities).

## Disposable check

The test project generates its own test-only secrets in a throwaway volume and stands in for the
`dlc-clinical-db` roles with synthetic ones:

```sh
docker compose -f tests/compose.yml run --rm replica-set-check
docker compose -f tests/compose.yml run --rm outsider-check
docker compose -f tests/compose.yml down -v
docker compose -f tests/compose.tls.yml run --rm tls-check
docker compose -f tests/compose.tls.yml down -v
```

## Branching

The permanent branches are `develop`, `qa`, and `main`. Changes enter each branch through a child
branch and a pull request; do not commit directly to a permanent branch.

```text
develop  <-- PR --  feat/... fix/... chore/...
qa       <-- PR --  qa/...
main     <-- PR --  release/... hotfix/...
```

Promotion re-applies validated commits with `git cherry-pick -x`; it does not merge one
permanent branch into another. Changes to `main` require approval from `ariel5253`.
See the [branching policy](https://github.com/code-corhuila/dlc-docs/blob/main/00-governance/branching-policy.md).
