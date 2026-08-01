# Monitoring, logs, resources, and permissions

## Resource guardrails

The portfolio Compose file currently limits the portfolio app to `1.0` CPU
and `768m` memory, and PostgreSQL to `0.75` CPU and `768m` memory. Umami has
the same memory/CPU class in `compose.umami.yml`. These limits are intentional
on a small shared host and must be reviewed before adding the public AI
assistant.

- [ ] Alert on container restarts and failed health checks.
- [ ] Alert before host disk exhaustion; include Docker images, volumes, and
      JSON logs in the review.
- [ ] Review CPU/memory pressure after enabling Umami or AI.
- [ ] Keep application and database ports private/loopback-bound.
- [ ] Keep Caddy as the only public listener on 80/443.
- [ ] Do not remove old release images until the observation and rollback
      windows expire.

## Logs

The app and portfolio PostgreSQL service use capped Docker JSON logs in
`compose.yml`. Caddy logs remain owned by the existing edge deployment. Do not
assume a capped container log is a durable audit record; export incident
evidence before cleanup when needed.

- [ ] Logs contain no API keys, session secrets, database passwords, chat text,
      resume content, or uploaded private content.
- [ ] Access logs and Umami analytics have separate retention policies.
- [ ] Review unusual 4xx/5xx spikes, restart loops, referrer spikes, and AI
      rate-limit events.
- [ ] Exclude health checks, internal jobs, and development traffic from
      engagement reporting where possible.
- [ ] Keep the quarterly Umami retention review record with release evidence;
      do not describe retention as automated.
- [ ] Review the recorded Node/PostgreSQL/Umami registry digests whenever a
      base image changes; exact tags alone do not prove immutable provenance.

## Permissions and secrets

- Source checkout and Compose files may be owned by the unprivileged
  deployment account under the approved portfolio path.
- Production `.env`, database passwords, session secrets, Umami `APP_SECRET`,
  and OpenAI keys remain server-side and untracked.
- Browser-visible `NEXT_PUBLIC_UMAMI_*` values are identifiers/URLs, not
  secrets. They must not be used to hold credentials.
- The diagnostic account must not read or modify the root-owned Metamorphysis
  checkout or Caddy configuration without operator authorization.
- The portfolio must use its own Compose project, network, database, volumes,
  and credentials.
- Metamorphysis sync must remain one-way and must never receive portfolio
  editor writes.

## Minimal incident evidence

For each release or incident, retain the release SHA, image digest, Compose
status, migration output, health results, Caddy config checksum, relevant log
window, backup checksum, and rollback decision. Redact secret values before
sharing evidence.
