import { describe, expect, it } from 'vitest';
import { defaultVisualDocument, parseVisualPageDocument, visualPageDocumentSchema } from '@/lib/visual-editor';

describe('visual page documents', () => {
  it.each(['overview', 'work', 'ai'])('creates a valid default for %s', (slug) => {
    expect(visualPageDocumentSchema.safeParse(defaultVisualDocument(slug)).success).toBe(true);
  });

  it('rejects scriptable colors and unknown content fields', () => {
    const document = defaultVisualDocument('work');
    const unsafe = structuredClone(document);
    unsafe.blocks[0].style.background = 'url(javascript:alert(1))';
    expect(parseVisualPageDocument(unsafe)).toBeNull();
  });
});
