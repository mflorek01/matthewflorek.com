# Metamorphysis synchronization

This slice is intentionally one-way: the portfolio reads a narrow Metamorphysis export and never writes to Metamorphysis or accepts database credentials.

## Inputs

The MVP accepts a manual JSON document or a server-to-server `GET` from `METAMORPHYSIS_SYNC_URL` using the server-only `METAMORPHYSIS_SYNC_TOKEN`. The export shape is:

```json
{
  "sourceVersion": "2026-07-31T12:00:00Z",
  "sourceUpdatedAt": "2026-07-31T12:00:00Z",
  "projects": [
    {
      "id": "stable-source-id",
      "slug": "optional-local-shape",
      "title": "Project title",
      "summary": "Short public-safe summary",
      "category": "WORK",
      "tags": ["automation"],
      "links": [{ "label": "Repository", "url": "https://github.com/example/repo" }],
      "details": { "role": "Builder" }
    }
  ]
}
```

The importer rejects unknown fields, duplicate IDs, invalid URLs, more than 100 projects, or payloads over 1 MB. Remote fetches are `GET` only, use a configured exact endpoint, reject redirects, require HTTPS in production, reject credentials/fragments/private networks, and time out after eight seconds.

## Data and review behavior

- Every accepted payload is stored as an immutable `MetamorphysisImportSnapshot` keyed by source version and deterministic SHA-256 hash.
- Each source project gets a `MetamorphysisProjectLink` containing the source project plus the field diff, conflicts, and review-required flag.
- New projects are created as `NEEDS_REVIEW` and `PRIVATE`; nothing imported is published or included in AI context.
- Existing local projects keep their IDs. `ProjectOverride.fields` wins field-by-field over later source values.
- If a source field changes while a local override exists, the importer records a conflict and keeps the override.
- Re-importing the same source version/hash is idempotent and creates no duplicate snapshot or projects.
- `MetamorphysisSyncState.cursor` stores a bounded JSON summary of changed fields/conflicts; `AuditLog` records import, failure, approval, and override actions without tokens or raw payloads.
- Approving a project changes it to local `DRAFT`/`UNLISTED` editing state. A separate publishing workflow must make it public.

## Admin operation

Use `/admin/integrations/metamorphysis`. In production, set `METAMORPHYSIS_ADMIN_TOKEN` and send it as a bearer token. The page supports manual JSON and the configured remote export. Sync tokens are never accepted from the browser and are never included in responses or error messages.

## Future Metamorphysis endpoint

The server-to-server endpoint should expose only this export schema through a read-only authenticated route. It should not expose the Metamorphysis database, CMS mutation routes, arbitrary proxying, or credentials. A future diff/approval UI can use the stored link payloads without recontacting Metamorphysis.
