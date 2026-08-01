import { describe, expect, it } from 'vitest';
import { healthQuerySchema, healthResponseSchema } from '../src/lib/contracts';

describe('contracts', () => {
  it('parses health query', () => {
    expect(healthQuerySchema.parse({ db: '1' })).toEqual({ db: '1' });
  });

  it('validates health response shape', () => {
    expect(
      healthResponseSchema.parse({
        ok: true,
        status: 'ok',
        checks: { db: 'skip' }
      })
    ).toEqual({
      ok: true,
      status: 'ok',
      checks: { db: 'skip' }
    });
  });

  it('rejects unknown health query values', () => {
    expect(healthQuerySchema.safeParse({ db: 'yes' }).success).toBe(false);
  });
});
