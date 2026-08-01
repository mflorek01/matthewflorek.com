# Operator-assisted Caddy change checklist

Scope: add the portfolio hostname at the existing root-owned Caddy edge. This
is intentionally an operator-assisted procedure. The `codexdiag` account may
prepare and review the change, but it must not bypass the root-owned boundary.

## Before editing

- [ ] Confirm the reviewed commit and the intended portfolio upstream: Docker
      service `portfolio:3000` on the externally named `portfolio_private`
      network. The host loopback port `127.0.0.1:3101` is for direct operator
      checks only.
- [ ] Confirm the portfolio Compose project is healthy independently of Caddy.
- [ ] Read the active Caddy configuration and identify the existing
      `metamorphysis.ai` block.
- [ ] Confirm the proposed change leaves that block byte-for-byte unchanged.
- [ ] Record the current Caddy image/container identifier and active config
      checksum in the release notes.
- [ ] Create a timestamped backup outside the repository with restrictive
      permissions. Record its absolute path and checksum.
- [ ] Confirm the DNS changes, if any, have not been made prematurely.
- [ ] Confirm the exact base-image tags and release-time image digests are
      recorded; if a registry digest cannot be resolved, stop the release.

## Apply with root authorization

- [ ] Add the reviewed blocks from `ops/edge/caddy-snippets.md` to the
      root-owned configuration, preserving the existing Metamorphysis route.
- [ ] Use the existing Caddy deployment mechanism; do not start a second
      reverse proxy on ports 80 or 443.
- [ ] Validate the complete configuration using the Caddy command appropriate
      to the installed image/version.
- [ ] If validation fails, restore the backup and stop. Do not reload a failed
      configuration.
- [ ] Reload or replace the Caddy container using the existing production
      procedure.

## Verify immediately

- [ ] Confirm the Caddy container is running and healthy.
- [ ] From the Caddy container, resolve and reach `portfolio:3000`; if Umami
      is enabled, resolve and reach `umami:3000` through
      `portfolio_umami_private`.
- [ ] Confirm `https://matthewflorek.com/api/health` returns success and does
      not expose secrets or database error details.
- [ ] Confirm the portfolio homepage, `/work`, `/ai`, `/privacy`, and a project
      detail route return expected content.
- [ ] Confirm `https://www.matthewflorek.com/...` redirects to the canonical
      non-`www` URL with the original path/query.
- [ ] Confirm `https://metamorphysis.ai` and `https://www.metamorphysis.ai`
      (if configured) still serve the existing application.
- [ ] Confirm certificates are valid and there are no Caddy errors in recent
      logs.
- [ ] Confirm the portfolio response includes CSP, HSTS, Referrer-Policy,
      Permissions-Policy, nosniff, and frame-deny headers.
- [ ] Confirm oversized requests are rejected at the edge for login (32 KB),
      chat (64 KB), integration (256 KB), and asset upload (12 MB) paths.
- [ ] Confirm application rate limits remain enabled for login, chat, upload,
      and integration paths. If an approved edge limiter exists, verify 429
      and Retry-After behavior; otherwise record that Caddy is enforcing body
      limits while the application owns rate limiting.
- [ ] If Umami was enabled, confirm `/script.js` and `/api/send` work while
      the dashboard and administrative API remain unavailable publicly.

## Rollback

- [ ] If any existing Metamorphysis check fails, stop portfolio verification
      and restore the backed-up Caddy configuration.
- [ ] Validate the restored configuration before reload.
- [ ] Reload the restored configuration.
- [ ] Recheck `metamorphysis.ai` and record the failure, restoration time, and
      backup checksum.
- [ ] Keep the portfolio app running or stop it according to the incident
      decision; Caddy rollback must not delete its data or images.

## Ownership boundary

The operator performing the root-authorized step owns the active Caddy backup,
validation output, reload result, and rollback decision. The application
checkout owner owns the portfolio release image, database migrations, and
application health evidence. Neither party should rotate or copy the other
party's secrets.
