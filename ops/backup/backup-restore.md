# Backup, retention, and isolated restore proof

The portfolio database and any future uploaded content require an independent
backup plan. Metamorphysis backups are outside this application boundary and
must not be overwritten or assumed to cover it.

## Backup policy

- [ ] Set `BACKUP_ROOT` to an explicit absolute directory outside the checkout
      and outside the live database volume.
- [ ] Run `scripts/backup/backup.sh` daily, with at least seven daily and four
      weekly retained database dumps.
- [ ] Keep one encrypted copy on a separate storage system when available.
- [ ] Retain the portfolio `.env` secret material through the approved secret
      backup process; never place it beside public source or dumps without
      access controls.
- [ ] Back up uploaded/admin-managed assets separately once that feature
      exists, preserving filenames, checksums, and restore instructions.
- [ ] Monitor backup age, size, checksum failure, and available backup disk.

The script writes a PostgreSQL custom-format dump and a `.sha256` checksum with
mode `600`. The backup directory must have restrictive ownership and
permissions. A successful dump is not proof of recoverability until the
restore rehearsal passes.

## Restore rehearsal

- [ ] Select a recent dump and verify its checksum before use.
- [ ] Run `scripts/backup/restore-rehearsal.sh /absolute/path/to/dump`.
- [ ] Confirm the script uses a disposable PostgreSQL container with
      `--network none`, a read-only dump mount, and no live volume.
- [ ] Confirm `pg_restore` completes with `--exit-on-error`.
- [ ] Record dump timestamp, checksum, container/image identifier, restore
      duration, and result.
- [ ] Optionally start the candidate app against the restored disposable
      database and verify `/api/health?db=1` plus one database-backed page.
- [ ] Remove the disposable restore container after proof; do not target the
      live `portfolio_postgres_data` volume.

Perform a restore rehearsal monthly and after schema changes, backup-tool
changes, or a production incident. The rehearsal is complete only when both
database integrity and application readability are demonstrated.

## Recovery order

1. Stop public cutover activity and identify the last known-good release SHA.
2. Preserve logs, current database state, and the failed release evidence.
3. Restore into a disposable isolated database first.
4. Validate the restored schema and a database-backed application page.
5. Obtain explicit operator approval before replacing the live database volume.
6. Deploy the known-good immutable application image and verify health.
7. Reconcile any writes made after the backup timestamp according to the
   incident decision; do not silently discard them.

## Retention and monitoring

Use a documented retention policy rather than unlimited dumps. Review raw
analytics retention separately in `docs/analytics.md`; analytics are stored by
Umami, not Prisma. Monitor the server's free disk and Docker log usage because
the host has limited capacity. A backup alert is actionable when the newest
successful dump is older than 25 hours or free disk crosses the agreed floor.
