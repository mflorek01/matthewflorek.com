import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { AiConfig } from './config';

export type SpendReservation = { id: string; amountUsd: number; periodStart: Date };
export type SettlementResult = { ok: true } | { ok: false; reason: 'settlement_failed' };

function dayStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function asNumber(value: Prisma.Decimal | number | null | undefined) {
  return value == null ? 0 : Number(value);
}

export function estimateAiCost(inputTokens: number, outputTokens: number, config: AiConfig) {
  return (inputTokens / 1_000_000) * config.inputCostPerMillion + (outputTokens / 1_000_000) * config.outputCostPerMillion;
}

export function exceedsAiDailyLimits({ usageCount, reservedCalls = 0, usageSpend, reservedSpend, config }: { usageCount: number; reservedCalls?: number; usageSpend: number; reservedSpend: number; config: AiConfig }) {
  return { calls: usageCount + reservedCalls >= config.dailyCallLimit, spend: usageSpend + reservedSpend > config.dailyDollarLimit };
}

export async function reserveAiSpend({ config, requestId, now = new Date() }: { config: AiConfig; requestId: string; now?: Date }): Promise<{ ok: true; reservation: SpendReservation } | { ok: false; reason: 'daily_calls' | 'daily_spend' | 'database' }> {
  void requestId;
  if (!process.env.DATABASE_URL) return { ok: false, reason: 'database' };
  const periodStart = dayStart(now);
  const amountUsd = estimateAiCost(config.maxPromptChars / 4, config.maxOutputTokens, config);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const lockKey = `public-chat:${periodStart.toISOString()}`;
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
        const [usageCount, usageSpend, activeReservations, activeReservationCount] = await Promise.all([
          tx.aiUsageRecord.count({ where: { feature: 'public-chat', createdAt: { gte: periodStart }, status: { not: 'FAILED' } } }),
          tx.aiUsageRecord.aggregate({ _sum: { estimatedCostUsd: true }, where: { feature: 'public-chat', createdAt: { gte: periodStart }, status: { not: 'FAILED' } } }),
          tx.aiSpendReservation.aggregate({ _sum: { amountUsd: true }, where: { scope: 'public-chat', periodStart, status: { in: ['RESERVED', 'SETTLEMENT_FAILED'] } } }),
          tx.aiSpendReservation.count({ where: { scope: 'public-chat', periodStart, status: { in: ['RESERVED', 'SETTLEMENT_FAILED'] } } })
        ]);
        const limits = exceedsAiDailyLimits({ usageCount, reservedCalls: activeReservationCount, usageSpend: asNumber(usageSpend._sum.estimatedCostUsd), reservedSpend: asNumber(activeReservations._sum.amountUsd), config });
        if (limits.calls) return { ok: false, reason: 'daily_calls' as const };
        if (limits.spend) return { ok: false, reason: 'daily_spend' as const };
        const reservation = await tx.aiSpendReservation.create({
          data: { scope: 'public-chat', periodStart, amountUsd: new Prisma.Decimal(amountUsd.toFixed(6)), status: 'RESERVED' },
          select: { id: true, amountUsd: true, periodStart: true }
        });
        return { ok: true as const, reservation: { id: reservation.id, amountUsd: asNumber(reservation.amountUsd), periodStart: reservation.periodStart } };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 0 && typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2034') continue;
      return { ok: false, reason: 'database' };
    }
  }
  return { ok: false, reason: 'database' };
}

export async function settleAiSpend({ reservation, requestId, model, inputTokens, outputTokens, config, status = 'SUCCEEDED' }: { reservation: SpendReservation; requestId: string; model: string; inputTokens: number; outputTokens: number; config: AiConfig; status?: 'SUCCEEDED' | 'FAILED' }): Promise<SettlementResult> {
  const estimatedCostUsd = estimateAiCost(inputTokens, outputTokens, config);
  if (!process.env.DATABASE_URL || reservation.id.startsWith('memory:')) return { ok: true };
  try {
    await prisma.$transaction([
      prisma.aiSpendReservation.update({ where: { id: reservation.id }, data: { amountUsd: new Prisma.Decimal(estimatedCostUsd.toFixed(6)), status: status === 'SUCCEEDED' ? 'SETTLED' : 'RELEASED' } }),
      prisma.aiUsageRecord.create({ data: { feature: 'public-chat', requestId, model, inputTokens, outputTokens, estimatedCostUsd: new Prisma.Decimal(estimatedCostUsd.toFixed(6)), status } })
    ]);
    return { ok: true };
  } catch {
    await recordAiSettlementFailure({ reservation, requestId, model, inputTokens, outputTokens });
    return { ok: false, reason: 'settlement_failed' };
  }
}

export async function recordAiSettlementFailure({ reservation, requestId, model, inputTokens = 0, outputTokens = 0 }: { reservation: SpendReservation; requestId: string; model: string; inputTokens?: number; outputTokens?: number }) {
  if (!process.env.DATABASE_URL || reservation.id.startsWith('memory:')) return false;
  try {
    await prisma.$transaction([
      prisma.aiSpendReservation.update({ where: { id: reservation.id }, data: { status: 'SETTLEMENT_FAILED' } }),
      prisma.aiUsageRecord.create({ data: { feature: 'public-chat', requestId, model, inputTokens, outputTokens, estimatedCostUsd: new Prisma.Decimal(reservation.amountUsd.toFixed(6)), status: 'SETTLEMENT_FAILED' } })
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function releaseAiSpend(reservationId: string) {
  if (!process.env.DATABASE_URL || reservationId.startsWith('memory:')) return;
  try { await prisma.aiSpendReservation.update({ where: { id: reservationId }, data: { status: 'RELEASED', amountUsd: new Prisma.Decimal(0) } }); } catch { /* best-effort cleanup */ }
}
