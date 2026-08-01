# Prisma migrations

The repository uses PostgreSQL and Prisma migrations. The initial migration is
`prisma/migrations/0001_initial/migration.sql`; `migration_lock.toml` pins the
provider so migration history cannot be applied with a different database
provider by accident.

## Initial migration verification

The initial SQL is generated from an empty database schema and must remain
deterministic with respect to `prisma/schema.prisma`. From the repository root,
run:

```powershell
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Compare that output with
`prisma/migrations/0001_initial/migration.sql`, ignoring only line-ending
differences. This check does not connect to a database.

The migration contains the application tables, enums, indexes, and foreign-key
constraints needed by the current schema. It intentionally contains no `DROP`,
`TRUNCATE`, or data-deletion statements. The migration-prefixed Vitest test
provides a lightweight offline guard for the lock file and representative
tables, indexes, foreign keys, and destructive-statement checks.

## Version-control prerequisite

Migration files are intentionally tracked. Keep `prisma/migrations` included
in release reviews and never use an ignore rule or force-add workaround for
future migrations.

## Applying migrations

Use `prisma migrate deploy` only during a reviewed release against the intended
private production database. Do not edit an applied migration. Schema changes
after `0001_initial` must be represented by a new forward-only migration and
reviewed against an isolated database or restored backup before production use.
