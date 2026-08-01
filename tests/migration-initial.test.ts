import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = join(repoRoot, "prisma", "migrations");
const migrationSql = readFileSync(
  join(migrationDir, "0001_initial", "migration.sql"),
  "utf8",
);
const migrationLock = readFileSync(join(migrationDir, "migration_lock.toml"), "utf8");

describe("initial Prisma migration", () => {
  it("pins PostgreSQL and contains the expected core tables, indexes, and foreign keys", () => {
    expect(migrationLock).toContain('provider = "postgresql"');

    for (const table of [
      "AdminUser",
      "AdminSession",
      "CmsPage",
      "CmsBlock",
      "CmsPageRevision",
      "ProjectCategory",
      "Project",
      "ProjectLink",
      "ProjectAsset",
      "ProjectRevision",
      "ProjectOverride",
      "MetamorphysisImportSnapshot",
      "MetamorphysisProjectLink",
      "MetamorphysisSyncState",
      "AuditLog",
      "AiKnowledgeDocument",
      "AiUsageRecord",
      "AiSpendReservation",
      "AiRateLimitRecord",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE "${table}"`);
    }

    for (const index of [
      '"AdminUser_email_key"',
      '"CmsBlock_pageId_sortOrder_idx"',
      '"Project_visibility_publicationStatus_idx"',
      '"ProjectOverride_projectId_key"',
      '"MetamorphysisImportSnapshot_sourceVersion_sourceHash_key"',
      '"AiRateLimitRecord_subjectHash_bucketStart_key"',
    ]) {
      expect(migrationSql).toContain(`CREATE ${index.endsWith("_key\"") ? "UNIQUE " : ""}INDEX ${index}`);
    }

    for (const foreignKey of [
      '"AdminSession_adminUserId_fkey"',
      '"CmsBlock_pageId_fkey"',
      '"Project_categoryId_fkey"',
      '"ProjectOverride_projectId_fkey"',
      '"MetamorphysisProjectLink_snapshotId_fkey"',
      '"AiSpendReservation_createdById_fkey"',
    ]) {
      expect(migrationSql).toContain(`CONSTRAINT ${foreignKey}`);
    }
  });

  it("contains no unexplained destructive SQL", () => {
    expect(migrationSql).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM)\b/i);
    expect(migrationSql).not.toMatch(/\bALTER TABLE\b(?![^;]*ADD CONSTRAINT)/i);
  });
});
