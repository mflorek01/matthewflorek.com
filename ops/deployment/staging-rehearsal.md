# Staging and release rehearsal

The objective is to prove the exact release candidate, migration behavior,
backup path, proxy assumptions, and user journeys before production. No
production database or live Caddy route is used for this rehearsal.

## Candidate identity

- [ ] Start from a clean checkout.
- [ ] Record `RELEASE_SHA` as the full reviewed Git commit SHA.
- [ ] Build the image with the same Dockerfile and build arguments intended for
      production, tagging it with `RELEASE_SHA`.
- [ ] Record the image digest after build. A mutable tag such as `latest` is
      not release identity.
- [ ] Preserve the candidate image until production verification and rollback
      evidence are complete.

## Disposable staging environment

- [ ] Use a separate Compose project name, network, database volume, and env
      file. Never point staging at the production `DATABASE_URL`.
- [ ] Use a separate `PORTFOLIO_HOST_PORT` bound to loopback, such as `3201`,
      unless the operator has documented another free port.
- [ ] Use a staging-only `AUTH_SESSION_SECRET`, database password, and any
      integration tokens.
- [ ] Disable Metamorphysis sync, public AI, and production analytics unless
      the test explicitly requires them and their test credentials are isolated.
- [ ] Set `ANALYTICS_MODE=consent` for the consent test; do not
      use an unrecognized value as a substitute for an explicit mode.
- [ ] Run Prisma generation and migrations against the disposable database.
- [ ] Seed only approved fixture data; do not copy private production content.

## Rehearsal checks

- [ ] `GET /api/health?db=1` succeeds only after the disposable database is
      ready; this is the candidate readiness check.
- [ ] The public Overview, Work Projects, AI Projects, privacy page, and a
      project detail route render.
- [ ] Search/filter, tab navigation, outbound links, resume link, reduced
      motion, keyboard focus, and mobile layout behave as expected.
- [ ] The analytics disabled preference suppresses tracker/event dispatch.
- [ ] In consent mode, confirm the tracker is absent and no pre-consent event
      reaches Umami; opt-in then loads the tracker, and opt-out removes it for
      subsequent navigation.
- [ ] With analytics enabled, events contain only the bounded properties in
      `src/lib/analytics/events.ts`; no chat text, names, email, or resume text
      is emitted.
- [ ] Admin authentication and unauthorized access behavior are tested once
      the editor slice exists.
- [ ] Database migration is forward-only and can be applied to a clean
      database from the candidate image.
- [ ] The candidate survives a container restart and returns healthy.
- [ ] Logs contain no secrets, tokens, or raw visitor input.
- [ ] Exercise edge request-body limits for login, chat, integration, and asset
      upload routes and record the rejected status. Exercise application rate
      limits and record `429`/`Retry-After` behavior where applicable.

## Exact production rehearsal

Before cutover, run `scripts/deploy/stage.sh` against the reviewed checkout,
then perform the disposable-database checks above. The existing script builds
the `portfolio` service after validating `compose.yml`; it does not claim that
staging is complete by itself. Record the missing checks as evidence rather
than treating a successful image build as a release.

## Exit criteria

The release is eligible for production only when the candidate SHA, image
digest, migration result, health results, browser journey, backup/restore
result, and rollback image are recorded. Any failed check blocks DNS cutover.
