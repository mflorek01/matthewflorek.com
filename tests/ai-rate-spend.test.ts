import { afterEach, describe, expect, it } from 'vitest';
import { acquireAiConcurrency, releaseAiConcurrency, resetAiConcurrencyForTests } from '@/lib/ai/rate-limit';
import { estimateAiCost, exceedsAiDailyLimits } from '@/lib/ai/spend';

afterEach(() => resetAiConcurrencyForTests());

describe('AI abuse and spend controls', () => {
  it('bounds concurrency and cleans up reservations at the caller boundary', () => {
    expect(acquireAiConcurrency(1)).toBe(true);
    expect(acquireAiConcurrency(1)).toBe(false);
    releaseAiConcurrency();
    expect(acquireAiConcurrency(1)).toBe(true);
  });

  it('estimates cost conservatively from configured rates', () => {
    expect(estimateAiCost(1_000_000, 100_000, {
      inputCostPerMillion: 5,
      outputCostPerMillion: 30
    } as never)).toBeCloseTo(8);
  });

  it('rejects exhausted daily call and spend ceilings before a model call', () => {
    const config = { dailyCallLimit: 2, dailyDollarLimit: 1 } as never;
    expect(exceedsAiDailyLimits({ usageCount: 2, usageSpend: 0, reservedSpend: 0, config }).calls).toBe(true);
    expect(exceedsAiDailyLimits({ usageCount: 1, usageSpend: 0.8, reservedSpend: 0.3, config }).spend).toBe(true);
  });
});
