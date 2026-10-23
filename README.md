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
| `compose.yml` | Pinned MongoDB 8.0 engine as a replica set, persistent volumes, readiness check and a one-shot replica-set initializer. |
| `scripts/init-replica-set.js` | Idempotent initialization of the single-member set; waits for a writable primary. |
| `env/.env.*.example` | Stage templates (`local`, `develop`, `qa`, `main`); no credentials. |
| `tests/` | Disposable check: readiness without a primary, initialization, idempotency and a multi-document transaction. |

## Engine

- Image: `mongo:8.0.32` (MongoDB Community 8.0.32), pinned by digest
  `sha256:4968f22d0c6c10ef29952f3e807f62872ba22b3312f25803564fbfc08255efc2`, the same image
  `dlc-clinical-db` verifies its migrations against.
- Replica set `rs0` (`DLC_MONGO_REPLICA_SET`). Clinical commits its state and outbox in
  multi-document transactions, which a standalone `mongod` rejects.
- Reachable as `dlc-mongo:27017` by containers on the external platform network
  (`PLATFORM_NETWORK_NAME`, default `platform`); it publishes no host port.
- Named volumes `mongo_data` and `mongo_config` keep data across restarts.
- Readiness: the health check passes only while the member is a writable primary, so it fails
  until the set is initialized and whenever no primary is available. A MongoDB outage affects
  Clinical readiness only; PostgreSQL-backed services never depend on it.

Connection string for Clinical clients on the platform network:

```text
mongodb://dlc-mongo:27017/clinical?replicaSet=rs0
```

## Stages

| Stage | Branch | Status |
| --- | --- | --- |
| Local | — | Verified: single-member replica set from this repository. |
| Development | `develop` | Not deployed. Hosting and replica-set size pending decision P-01. |
| QA | `qa` | Not deployed. Pending P-01. |
| Production | `main` | Not deployed. Pending P-01. |

Authentication and identities ([#2](https://github.com/code-corhuila/dlc-infra-mongo/issues/2)), TLS and
encryption at rest ([#4](https://github.com/code-corhuila/dlc-infra-mongo/issues/4)), and backup and
recovery ([#3](https://github.com/code-corhuila/dlc-infra-mongo/issues/3)) are not in place yet. Until
they are, use this engine only on a developer machine with synthetic data.

## Run locally

```sh
docker network create platform
docker compose --env-file env/.env.local.example -f compose.yml up -d
docker compose --env-file env/.env.local.example -f compose.yml ps
```

`dlc-mongo-init` exits after the primary is ready; it is retried a bounded number of times while
`mongod` starts. Then apply the Clinical schema from `dlc-clinical-db` with `MONGO_HOST=dlc-mongo`.

## Disposable check

```sh
docker compose -f tests/compose.yml up --abort-on-container-exit --exit-code-from replica-set-check
docker compose -f tests/compose.yml down -v
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
