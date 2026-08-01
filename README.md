# Matthew Florek portfolio foundation

This branch contains the application foundation for the portfolio redesign. The public experience, visual editor, Metamorphysis import, external Umami analytics, and visitor AI assistant will layer on top of these contracts.

## Local setup

1. Install Node.js 20+ and PostgreSQL 15+ (or use the project container setup when it is added).
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` for database-backed checks. Production additionally requires a random `AUTH_SESSION_SECRET` of at least 32 characters. The `NEXT_PUBLIC_UMAMI_*` values are browser-visible configuration, not secrets.
4. Run `npm run prisma:generate`.
5. Apply the schema with `npx prisma migrate dev --name foundation` in a disposable local database, then run `npm run prisma:seed`.
6. Start the app with `npm run dev`.

The seed reads `content/portfolio-source.json`. Only records marked `PUBLIC` are made public and eligible for AI inclusion. `DRAFT` and `NEEDS_REVIEW` records remain private/unpublished even when their source record requests AI inclusion. Project links are limited to HTTP(S) URLs, unknown project categories are skipped with a warning, and the seed is idempotent for the foundation records. Initial revision rows are preserved on later seed runs so an editor's revision history is not silently overwritten. The seed does not create admin credentials.

## Checks

- `npm run prisma:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Data boundaries

- `DATABASE_URL` and `AUTH_SESSION_SECRET` are required in production.
- Optional integrations are disabled by default and are validated only when their feature flag is enabled. When `ENABLE_UMAMI=true`, the public `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_UMAMI_SCRIPT_URL` values are required.
- The health route never returns secrets or database error details.
- CMS, project, import, audit, and AI accounting records are stored in PostgreSQL.
- Visitor analytics are intentionally not stored in Prisma; the planned Umami deployment remains an external analytics system with its own data store. The portfolio sends only bounded, non-personal event properties to Umami and exposes a local opt-out preference.
- Metamorphysis imports are one-way snapshots. Local project overrides are separate records and must never write back to Metamorphysis.

## Health endpoints

- `GET /api/health` is a liveness check and does not require a database connection.
- `GET /api/health?db=1` is a readiness check and returns `503` when the database cannot answer `SELECT 1`.
- Responses are marked `Cache-Control: no-store`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run prisma:generate`
- `npm run prisma:migrate`

The production Dockerfile uses Next.js standalone output and starts the traced
server with node server.js. The image includes the checked-in content/ source,
generated Prisma client, public assets, and the /api/health readiness check; it
does not require a second reverse proxy inside the container.

## Deployment boundary

This foundation is not deployed by this branch. Production deployment will require a reviewed migration rehearsal, a separate portfolio Compose project/database, a backup and restore rehearsal, and a root-authorized Caddy route for `matthewflorek.com`. The current diagnostic SSH account can operate an unprivileged application checkout but cannot edit the root-owned Caddy configuration without interactive sudo authorization.
