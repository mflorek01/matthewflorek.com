import { describe, expect, it } from 'vitest';
import { MAX_ASSET_BYTES, validateAssetBytes } from '@/lib/cms';

describe('CMS asset validation', () => {
  it('accepts matching signatures', () => {
    expect(validateAssetBytes('image/png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]))).toMatchObject({ ext: 'png' });
    expect(validateAssetBytes('application/pdf', new TextEncoder().encode('%PDF-1.7'))).toMatchObject({ ext: 'pdf' });
  });

  it('rejects spoofed, unsupported, and oversized files', () => {
    expect(() => validateAssetBytes('image/png', new TextEncoder().encode('<script>'))).toThrow('does not match');
    expect(() => validateAssetBytes('application/x-msdownload', new Uint8Array([1, 2]))).toThrow('Unsupported');
    expect(() => validateAssetBytes('image/png', new Uint8Array(MAX_ASSET_BYTES + 1))).toThrow('10 MB');
  });
});

