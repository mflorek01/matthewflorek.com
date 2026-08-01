# DNS cutover and rollback playbook

This playbook covers moving the personal domain from GitHub Pages to the
Hetzner edge. It does not change DNS. A DNS operator with access to the
authoritative provider must perform the records change.

## Target state

| Name | Record | Target | Purpose |
| --- | --- | --- | --- |
| `matthewflorek.com` | A | `167.233.24.214` | Portfolio origin |
| `www.matthewflorek.com` | CNAME or provider redirect | Canonical root | Canonical redirect |
| `analytics.matthewflorek.com` | A | `167.233.24.214` | Optional Umami dashboard |
| `staging.matthewflorek.com` | A | `167.233.24.214` | Optional, temporary, authenticated staging |

Use the provider's existing IPv6 policy consistently. Do not add an AAAA
record unless the server is confirmed to have working IPv6, firewall policy,
and Caddy reachability. Remove stale GitHub Pages records only after the new
origin is serving successfully.

## Before the change

- [ ] Confirm the portfolio container is healthy on loopback `127.0.0.1:3101`.
- [ ] Complete the root-authorized Caddy checklist in
      `ops/edge/caddy-change-checklist.md`.
- [ ] Confirm Caddy has a valid certificate path for the new hostname.
- [ ] Lower the existing A/AAAA/CNAME TTL to 300 seconds at least one full
      prior TTL before cutover, when the DNS provider permits it.
- [ ] Record the current GitHub Pages records, TTLs, and timestamp.
- [ ] Confirm a rollback owner can restore the prior records immediately.
- [ ] Keep the GitHub Pages site available during propagation; do not delete or
      alter the repository as part of this cutover.

## Cutover sequence

1. Confirm the new Caddy route and direct-origin health evidence.
2. Change only the personal-domain records to the Hetzner target.
3. Leave `metamorphysis.ai` DNS and Caddy routing untouched.
4. Query from multiple resolvers and networks. Expect mixed results during
   propagation while old TTLs expire.
5. Verify the canonical root, `www` redirect, HTTPS certificate, page routes,
   analytics events, and resume download.
6. Keep the TTL at 300 seconds through the observation window.
7. After a clean observation window of at least 24 hours, raise TTL gradually
   if desired and document the final value.

## Rollback triggers

Roll back if the portfolio is unavailable from multiple networks, TLS is
invalid, the canonical redirect loops, the app health/readiness check fails,
analytics causes page errors, or the existing Metamorphysis domain is affected.

## Rollback sequence

1. Restore the exact recorded GitHub Pages records and prior TTLs.
2. Leave the Hetzner application and its data intact for diagnosis.
3. Verify the GitHub Pages origin and both domain variants.
4. If Metamorphysis was affected, use the Caddy rollback checklist as a
   separate incident and verify it independently.
5. Record resolver observations, timestamps, and the decision to retry or
   abandon the migration.

DNS rollback is not instantaneous when resolvers retain the old record. The
low-TTL preparation reduces, but cannot eliminate, that propagation window.
