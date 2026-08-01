# Minimal-hassle desktop return checklist

This is the information Matthew must provide or complete before the final
operator-assisted deployment. The application can be developed and rehearsed
without these values; production cutover cannot.

## Access and ownership

- [ ] Confirm access to the authoritative DNS provider for `matthewflorek.com`.
- [ ] Confirm whether Matthew will perform the root-authorized Caddy change or
      provide an operator who can do it interactively.
- [ ] Provide the approved production SSH/deployment path for
      `/home/codexdiag/portfolio` (or confirm the final path).
- [ ] Confirm where production database backups must be stored and who can
      retrieve them.
- [ ] Confirm an emergency contact/rollback decision-maker during cutover.

## Values to generate or place on the server

- [ ] A strong `AUTH_SESSION_SECRET` (at least 32 characters).
- [ ] A unique portfolio PostgreSQL password and the final production
      `DATABASE_URL`.
- [ ] A unique Umami PostgreSQL password and `UMAMI_APP_SECRET`, if analytics
      dashboard hosting is enabled.
- [ ] The Umami website ID and public script URL after the site is registered.
- [ ] Choose `NEXT_PUBLIC_ANALYTICS_MODE`: `off`, `cookieless`, or
      `consent`. Leave it `off` until the selected behavior has been verified;
      an unrecognized value is fail-closed.
- [ ] `BACKUP_ROOT`, an explicit absolute path outside the repository.
- [ ] `PORTFOLIO_HOST_PORT`, retaining a free loopback port such as `3101`.
- [ ] Any approved Metamorphysis server-to-server token and endpoint, only when
      that integration is ready; do not provide personal login credentials.
- [ ] An OpenAI API key and approved model/budget, only if the visitor AI is
      enabled in this release. Keep `ENABLE_AI_FEATURES=false` otherwise.

Secrets should be supplied through the approved secret channel and written
only to the untracked server environment file. Do not paste them into issues,
commits, chat transcripts, or public `.env.example` files.

## DNS values to confirm

- [ ] Current authoritative records and TTLs for the root and `www` names.
- [ ] Whether `www` will be a CNAME, provider redirect, or A record; the final
      choice must match the Caddy redirect plan.
- [ ] Whether `analytics.matthewflorek.com` is wanted publicly or should remain
      operator-only.
- [ ] A quarterly Umami retention-review owner and evidence location. Retention
      is manual in this release; no scheduled deletion job is installed.
- [ ] Whether staging will remain loopback-only; public staging requires a
      hostname, authentication, and teardown date.

## Final desktop actions

1. Review the release SHA, image digest, staging evidence, backup checksum, and
   Caddy snippets.
2. Place the approved production env values on the server.
3. Run the existing deployment script from the clean reviewed checkout.
4. Perform the root-authorized Caddy validation/reload using
   `ops/edge/caddy-change-checklist.md`.
5. Change DNS using `ops/deployment/dns-cutover.md`.
6. Run the public verification list and observe logs/resources.
7. Keep the prior image, Caddy backup, and DNS record set until the observation
   window closes.

If any item is unknown, leave the corresponding optional feature disabled and
continue with the smallest safe release. Do not guess secret, DNS, backup, or
root-authorization values.
