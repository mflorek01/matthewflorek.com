import https from 'node:https';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMetamorphysisExport } from '../src/lib/integrations/metamorphysis/client';

function mockHttpsResponse(statusCode: number, body: string) {
  const response = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string>; resume: () => void };
  response.statusCode = statusCode;
  response.headers = { 'content-length': String(Buffer.byteLength(body)), 'content-type': 'application/json' };
  response.resume = () => undefined;
  return response;
}

describe('Metamorphysis read-only client', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('uses pinned GET, bearer auth, no redirects, and validates the returned export', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('METAMORPHYSIS_SYNC_URL', 'https://meta.example.test/api/export');
    vi.stubEnv('METAMORPHYSIS_SYNC_TOKEN', 'server-secret');
    vi.spyOn((await import('node:dns/promises')).default, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    const body = JSON.stringify({ sourceVersion: 'v1', projects: [] });
    const response = mockHttpsResponse(200, body);
    type MockResponse = ReturnType<typeof mockHttpsResponse>;
    const request = new EventEmitter() as EventEmitter & { setTimeout: (ms: number, callback: () => void) => void; destroy: (error?: Error) => void; end: () => void };
    request.setTimeout = () => undefined;
    request.destroy = (error) => { if (error) request.emit('error', error); };
    request.end = () => { queueMicrotask(() => { response.emit('data', body); response.emit('end'); }); };
    const requestMock = vi.spyOn(https, 'request').mockImplementation(((url: unknown, options: https.RequestOptions, callback: (response: MockResponse) => void) => {
      expect(url).toBeInstanceOf(URL);
      expect(options).toMatchObject({ method: 'GET', hostname: 'meta.example.test', path: '/api/export', servername: 'meta.example.test', headers: { Accept: 'application/json', Authorization: 'Bearer server-secret' } });
      callback(response);
      return request;
    }) as never);
    await expect(fetchMetamorphysisExport()).resolves.toMatchObject({ sourceVersion: 'v1', projects: [] });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('never falls back to a mutation method on an error response', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('METAMORPHYSIS_SYNC_URL', 'https://meta.example.test/api/export');
    vi.stubEnv('METAMORPHYSIS_SYNC_TOKEN', 'server-secret');
    vi.spyOn((await import('node:dns/promises')).default, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    const response = mockHttpsResponse(405, 'nope');
    const request = new EventEmitter() as EventEmitter & { setTimeout: (ms: number, callback: () => void) => void; destroy: (error?: Error) => void; end: () => void };
    request.setTimeout = () => undefined;
    request.destroy = () => undefined;
    request.end = () => queueMicrotask(() => response.emit('end'));
    type MockResponse = ReturnType<typeof mockHttpsResponse>;
    const requestMock = vi.spyOn(https, 'request').mockImplementation(((_url: unknown, _options: https.RequestOptions, callback: (response: MockResponse) => void) => { callback(response); return request; }) as never);
    await expect(fetchMetamorphysisExport()).rejects.toThrow(/HTTP 405/);
    expect(requestMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });
});
