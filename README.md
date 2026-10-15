# dlc-infra-mongo

> MongoDB infrastructure for the Di Lucca Clinical context.

Part of **Di Lucca Dental Care & Technology**. Governance and architecture decisions live in
[`ods-docs`](https://github.com/code-corhuila/ods-docs).

## Responsibility

This repository provisions and operates the independent MongoDB engine used by Clinical.
It covers infrastructure configuration and operations, including availability, backup and
recovery. It does **not** own Clinical collections, validators, indexes, seeds, or Liquibase
change sets. Those domain artifacts and their migration execution belong to
[`dlc-clinical-db`](https://github.com/code-corhuila/dlc-clinical-db), as defined by
[ADR-009](https://github.com/code-corhuila/ods-docs/blob/main/05-architecture/decisions/ADR-009-mongodb-infrastructure.md).

No database credentials or real environment files belong in Git. Runtime configuration and
verified deployment instructions must be recorded before this repository claims a working
MongoDB deployment.

## Branching

The permanent branches are `develop`, `qa`, and `main`. After this initial repository seed,
changes enter each branch through a child branch and a pull request; do not commit directly
to a permanent branch.

```text
develop  <-- PR --  feat/... fix/... chore/...
qa       <-- PR --  qa/...
main     <-- PR --  release/... hotfix/...
```

Promotion re-applies validated commits with `git cherry-pick -x`; it does not merge one
permanent branch into another. Changes to `main` require approval from `ariel5253`.
See the [branching policy](https://github.com/code-corhuila/ods-docs/blob/main/00-governance/branching-policy.md).
