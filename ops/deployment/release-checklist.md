# Deployment and verification checklist

## Release record

- [ ] `RELEASE_SHA` is the full SHA of the reviewed, clean checkout.
- [ ] The image tag includes `RELEASE_SHA` and the immutable image digest is
      recorded.
- [ ] Node, PostgreSQL, and Umami base image tags are exact non-`latest`
      versions, and their release-time registry digests are recorded. If any
      digest cannot be safely resolved, stop the release.
- [ ] The staging rehearsal in `ops/deployment/staging-rehearsal.md` passed.
- [ ] The backup and isolated restore proof in
      `ops/backup/backup-restore.md` passed.
- [ ] The previous known-good image digest and Caddy config backup are recorded
      for rollback.

## Pre-deploy

- [ ] Confirm the target host path is the approved user-owned portfolio
      checkout, not `/root/repo`.
- [ ] Confirm the production `.env` is untracked, readable only by the
      deployment owner, and contains no values copied into source or logs.
- [ ] Confirm `DATABASE_URL` points to the separate portfolio database and not
      Metamorphysis.
- [ ] Confirm the app port is loopback-bound and ports 80/443 remain owned by
      the existing Caddy edge.
- [ ] Confirm resource limits in `compose.yml` fit the server budget.
- [ ] Confirm a release operator is available for the root-authorized Caddy
      change; do not improvise an alternate public proxy.

## Application deployment

Run the existing `scripts/deploy/deploy.sh <RELEASE_SHA>` only after the
pre-deploy checks and rehearsal have passed. That script refuses a dirty
checkout, verifies the SHA, validates Compose, builds the app, starts
PostgreSQL, applies `prisma migrate deploy`, starts the portfolio, and checks
the loopback health endpoint. It does not perform Caddy, DNS, backup, or
browser verification.

- [ ] Capture the script output and Compose service status.
- [ ] Confirm the migration completed without modifying an applied migration.
- [ ] Confirm `GET http://127.0.0.1:${PORTFOLIO_HOST_PORT}/api/health?db=1`
      succeeds; this is the deployment readiness check.
- [ ] Confirm the running container label
      `org.opencontainers.image.revision` equals the reviewed release SHA.

## Edge and public verification

Complete `ops/edge/caddy-change-checklist.md`, then verify:

- [ ] `https://matthewflorek.com` loads the expected release.
- [ ] `/work`, `/ai`, `/privacy`, and project detail routes load directly.
- [ ] `www` redirects once to the canonical root and preserves path/query.
- [ ] HTTPS certificate and security headers are valid.
- [ ] Resume and approved external links work.
- [ ] Umami receives a safe page view and selected interaction event, if
      enabled; the page remains usable when Umami is unavailable.
- [ ] In consent-required mode, verify the tracker is absent and no event is
      sent before opt-in; verify the visible preference control can opt in and
      out without emitting a preference event.
- [ ] Record the quarterly Umami retention review: review date, site, data
      range checked, deletion action, next due date, and operator. Do not mark
      this complete based on documentation alone; no automated retention job is
      included.
- [ ] `metamorphysis.ai` continues to serve the unchanged application.

## Post-deploy observation

- [ ] Watch app, database, and Caddy logs for at least the agreed observation
      window.
- [ ] Check disk, memory, CPU, container restarts, and database health.
- [ ] Confirm no health checks or internal jobs pollute analytics.
- [ ] Record the release SHA, image digest, migration status, public checks,
      and any deviations in the release record.

## Rollback decision

Application failure: use `scripts/deploy/rollback.sh <previous-release-id>`
with the previously retained immutable image, then recheck both health
endpoints and public routes. Edge failure: restore the backed-up Caddy
configuration using `ops/edge/caddy-change-checklist.md`. DNS failure: use
`ops/deployment/dns-cutover.md`. Do not combine rollback types without noting
which boundary failed.
