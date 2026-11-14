# Changelog

All notable changes of `dlc-infra-mongo` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/). A release is tagged `v<version>` once it is merged into `main`.

## [Unreleased]

## [3.0.0] - 2026-11-14

The changelog starts at this release.

### Added

- Provision the clinical mongodb 8.0 replica set.
- Enable authentication and create the clinical migration identity.
- Add the clinical runtime identity and restrict mongodb to the clinical network.
- Require tls 1.2 or higher in the shared stages.
- Back up and restore the clinical database with a draft runbook.
- Grant the clinical analytics projector role to the runtime identity.
