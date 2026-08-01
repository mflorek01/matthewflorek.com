import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedPrisma = vi.hoisted(() => ({
  metamorphysisImportSnapshot: { findUnique: vi.fn() },
  metamorphysisSyncState: { upsert: vi.fn() },
  $transaction: vi.fn(),
  auditLog: { create: vi.fn() }
}));

vi.mock('../src/lib/db', () => ({ prisma: mockedPrisma }));

const { syncMetamorphysisExport } = await import('../src/lib/integrations/metamorphysis/service');

describe('Metamorphysis sync service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is idempotent and performs no project/snapshot write for the same source hash', async () => {
    mockedPrisma.metamorphysisImportSnapshot.findUnique.mockResolvedValue({ id: 'snapshot-existing', projectLinks: [] });
    mockedPrisma.metamorphysisSyncState.upsert.mockResolvedValue({});
    const result = await syncMetamorphysisExport({ sourceVersion: 'v1', projects: [] });
    expect(result.idempotent).toBe(true);
    expect(result.snapshotId).toBe('snapshot-existing');
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockedPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('never sends a mutation command to the source in the service contract', async () => {
    mockedPrisma.metamorphysisImportSnapshot.findUnique.mockResolvedValue({ id: 'snapshot-existing', projectLinks: [] });
    mockedPrisma.metamorphysisSyncState.upsert.mockResolvedValue({});
    await syncMetamorphysisExport({ sourceVersion: 'v1', projects: [] });
    expect(mockedPrisma).not.toHaveProperty('metamorphysisMutation');
  });
});
