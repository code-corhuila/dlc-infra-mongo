# Clinical MongoDB backup and recovery (draft runbook)

Draft for `13-operations/backup-and-recovery.md` in `dlc-docs`
([dlc-docs#117](https://github.com/code-corhuila/dlc-docs/issues/117)). It records the mechanism verified
in this repository; the parameters marked **pending** need decision P-03 and are not approved.

## Scope

The logical database `clinical` of the dlc-infra-mongo engine: every Clinical collection, its documents,
indexes and validators, the domain roles' data and the Liquibase history (`databasechangelog_clinical`,
`databasechangeloglock_clinical`). PostgreSQL recovery never restores Clinical data, and this procedure
never touches another context.

## Mechanism

| Step | Command | Identity |
| --- | --- | --- |
| Backup | `docker compose --profile backup run --rm dlc-mongo-backup` | `clinical_backup` (`read` on `clinical` only) |
| Restore | `DLC_RESTORE_ARCHIVE=/backups/<file> docker compose --profile restore run --rm dlc-mongo-restore` | engine administrator (recovery operator) |

- The backup is one gzip archive per run (`mongodump --db clinical`), written to `DLC_MONGO_BACKUP_DIR` as
  `clinical-<UTC timestamp>.archive.gz`.
- The restore replaces the `clinical` database only (`mongorestore --nsInclude 'clinical.*' --drop`).
- Passwords are read from secret files into a private config file and never passed on a command line.
- In TLS stages, add `-f compose.tls.yml`.

## Dependencies

- The engine is healthy (writable primary) and reachable on the `clinical-data` network.
- The secrets `clinical-backup-password` and `root-password` of the stage are available.
- Restore: the archive is reachable under `DLC_MONGO_BACKUP_DIR`, and Clinical writers are stopped
  (API, outbox relay, inbox consumer, intent reconciler) so no write lands during the replacement.

## Validation after a restore

1. `dlc-mongo` is healthy.
2. The `clinical` collections, indexes and validators exist, and a document that breaks a validator is rejected.
3. `dlc-clinical-db` runs `update` and reports every changeset as previously run: the history stayed
   attributable to `dlc-clinical-db`.
4. The Clinical processes start with the runtime identity and `/health/ready` answers 200.
5. Pending ADR-017 write intents are left to `clinical-intent-reconciler`; nothing is released by time.

## Failure isolation

A MongoDB outage affects Clinical readiness only: `/health` stays 200 and `/health/ready` answers 503
until a primary is back, then recovers without a restart. Services backed by PostgreSQL have no MongoDB
dependency and start without it.

## Verified evidence (Local stage, synthetic data)

- Disposable test `tests/compose.backup.yml`: backup by the read-only identity (which cannot write),
  drop, restore; documents, unique index, validator (rejects an invalid document) and Liquibase history
  restored.
- Real chain: the dlc-clinical-db migrations (19 changesets), a backup, and a restore into a **new engine
  with an empty volume** gave 15 collections, 19 changesets, `strict` validators and indexes. A later
  `update` applied nothing (`Previously run: 19`).
- Outage: API `/health/ready` 200 → 503 with MongoDB stopped → 200 one second after it returned;
  `/health` 200 throughout.

## Pending decisions (P-03)

| Parameter | Status |
| --- | --- |
| Frequency per stage | Pending |
| Retention per stage | Pending |
| Storage location and its encryption | Pending (with P-01 hosting and P-04) |
| RTO and RPO per stage | Pending |
| Recovery operator | Pending |
| Point-in-time recovery (oplog) | Not provided: an archive restores the state at its own time only |
