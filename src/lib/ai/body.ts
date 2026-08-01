import type { NextRequest } from 'next/server';

export class AiBodyTooLargeError extends Error {
  constructor() {
    super('AI request body is too large');
    this.name = 'AiBodyTooLargeError';
  }
}

export class AiInvalidJsonError extends Error {
  constructor() {
    super('AI request body is not valid JSON');
    this.name = 'AiInvalidJsonError';
  }
}

export async function readBoundedJson(request: NextRequest, maximumBytes: number): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > maximumBytes) throw new AiBodyTooLargeError();
  }

  if (!request.body) throw new AiInvalidJsonError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new AiBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AiInvalidJsonError();
  }
}
