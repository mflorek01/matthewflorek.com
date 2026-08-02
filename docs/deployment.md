# Portfolio deployment guide

For the shared-server procedure covering both applications, see
[Shared Hetzner deployment workflow](./dual-site-workflow.md). It explains the
separate release boundaries and the intentional Caddy state owned by
Metamorphysis.

This guide is the entry point for operating the portfolio application. It
describes the boundaries and links to the detailed runbooks; it does not grant
permission to modify the Hetzner server, DNS, or the root-owned Metamorphysis
deployment.

## Architecture boundary

The portfolio is a separate Docker Compose project with its own app,
PostgreSQL service, private network, volume, environment file, health checks,
resource limits, and backups. The app is loopback-bound on the host. The
existing Caddy edge remains the only public listener and routes by hostname.

PostgreSQL and the migrator stay solely on the internal
`portfolio_private` network. The application also joins
`portfolio_egress`, which permits the loopback publication and approved
outbound calls without placing the database on an externally routed network.

`metamorphysis.ai` remains unchanged. The portfolio route is
`matthewflorek.com -> portfolio:3000` through the shared Docker network;
the host-published `127.0.0.1:3101` port is reserved for direct operator
health checks. Optional Umami is `analytics.matthewflorek.com -> umami:3000`
through its separate shared Docker network.

## Normal release path

For ordinary production application releases, the guarded helper is the
preferred entry point:

```bash
cd /home/codexdiag/portfolio
bash scripts/deploy-prod.sh
```

It uses the published `origin/codex/portfolio-redesign` branch when available,
otherwise the current reviewed checkout; shows the release identity and changed
files; requires typing `DEPLOY`; creates a verified database backup; builds in
an isolated Git worktree; and verifies database readiness plus the immutable
image revision. It does not change the root-owned Caddy configuration or DNS.
Use `--with-migrations` only for a reviewed schema/migration change, and use
`--ref <commit-or-ref>` to deploy a specific release.

1. Complete the staging rehearsal in
   `ops/deployment/staging-rehearsal.md`.
2. Confirm a clean checkout and record the full immutable `RELEASE_SHA`.
3. Verify a recent backup and isolated restore proof using
   `ops/backup/backup-restore.md`.
4. Run `scripts/deploy/deploy.sh <RELEASE_SHA>` from the approved checkout.
5. Verify app liveness and database readiness on loopback.
6. Have the authorized operator apply and validate the Caddy change using
   `ops/edge/caddy-change-checklist.md`.
7. Perform DNS cutover only after public HTTPS checks pass, following
   `ops/deployment/dns-cutover.md`.
8. Complete `ops/deployment/release-checklist.md` and retain the evidence.

The deployment script performs Compose validation, application and dedicated
migrator image builds, PostgreSQL startup/readiness, `prisma migrate deploy`
from the migrator image, app startup, database-backed
health checking, and image-revision verification. It refuses to run until a
reviewed Prisma migration exists under `prisma/migrations`.
It does not perform Caddy changes, DNS changes, backup creation, or complete
browser verification.

The Next.js configuration uses standard output for local/Windows builds. The
Docker builder explicitly sets `NEXT_STANDALONE=true` so the Linux release
image produces `.next/standalone`, which is the artifact used by the runner.
If building the image manually, preserve that setting with
`--build-arg NEXT_STANDALONE=true`.

The runtime image intentionally does not contain the Prisma CLI. Database
operations use the Compose `portfolio-migrate` service, whose image is built
from the reviewed dependency lockfile. Initial content seeding and the
one-time admin bootstrap must also run through that service.

## Image reproducibility and analytics retention

The checked-in defaults use exact non-`latest` tags: Node
`20.20-bookworm-slim`, PostgreSQL `16.14-alpine`, and Umami
`ghcr.io/umami-software/umami:3.2.0`. Tags are still mutable registry references. Before a
release, resolve the actual platform-specific digests with the registry/Docker
tooling, record them in the release evidence, and use those digests in the
operator's production environment or approved build configuration. If a
digest cannot be resolved and recorded, the release is blocked; do not invent
or guess a digest.

Umami retention is manual at launch. The operator must perform and record a
quarterly review of the analytics site, delete data older than the documented
targets when the installed Umami controls support it, and record the next due
date. There is no scheduled deletion job in this release, so the retention
checkboxes in `ops/deployment/release-checklist.md` must remain open until a
real review record exists.

## Rollback map

- Application/image problem: `scripts/deploy/rollback.sh` and the application
  section of `ops/deployment/release-checklist.md`.
- Caddy/edge problem: restore the backed-up config using
  `ops/edge/caddy-change-checklist.md`.
- DNS/origin problem: restore the previous records using
  `ops/deployment/dns-cutover.md`.
- Data problem: follow the isolated-first recovery order in
  `ops/backup/backup-restore.md`.

Keep rollback boundaries separate and record which one was used. Never edit an
already-applied Prisma migration; create a new forward-only migration.

## Operations references

- `ops/checklists/desktop-return.md` — values and access Matthew must provide.
- `ops/checklists/monitoring-and-boundaries.md` — resource, log, permission,
  and secret expectations.
- `docs/analytics.md` — tracker behavior, event boundaries, and privacy notes.
- `compose.yml` — portfolio service topology and limits.
- `compose.umami.yml` — optional isolated Umami topology and limits.
- `scripts/backup/backup.sh` — custom-format database dump creation.
- `scripts/backup/restore-rehearsal.sh` — disposable network-isolated restore.
- `scripts/deploy/stage.sh` — candidate image/Compose staging checks.
- `scripts/deploy/deploy.sh` — reviewed SHA production application deployment.
- `scripts/deploy/rollback.sh` — immutable image rollback.

## Definition of done

Deployment is complete only when the release identity, migration result, health
checks, public journeys, unchanged Metamorphysis check, analytics behavior,
backup/restore evidence, resource/log observation, and rollback materials are
recorded. A successful image build alone is not a deployment.
