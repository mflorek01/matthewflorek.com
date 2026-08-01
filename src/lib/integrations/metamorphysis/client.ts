import https from 'node:https';
import { FETCH_TIMEOUT_MS, MAX_IMPORT_BYTES, parseMetamorphysisJson, type MetamorphysisExport } from './schema';
import { resolveSafeMetamorphysisTarget } from './security';

function requestPinnedExport(target: Awaited<ReturnType<typeof resolveSafeMetamorphysisTarget>>, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hostname = target.url.hostname.replace(/^\[|\]$/g, '');
    const request = https.request(target.url, {
      method: 'GET',
      hostname,
      port: target.url.port || 443,
      path: `${target.url.pathname}${target.url.search}`,
      servername: hostname,
      rejectUnauthorized: true,
      lookup: (_hostname, _options, callback) => callback(null, target.address.address, target.address.family),
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
        response.resume();
        reject(new Error('Metamorphysis export redirects are not allowed'));
        return;
      }
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`Metamorphysis export returned HTTP ${response.statusCode ?? 0}`));
        return;
      }
      const declaredLength = Number(response.headers['content-length'] ?? '0');
      if (declaredLength > MAX_IMPORT_BYTES) {
        response.resume();
        reject(new Error('Metamorphysis export exceeds the 1 MB limit'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.byteLength;
        if (size > MAX_IMPORT_BYTES) {
          request.destroy(new Error('Metamorphysis export exceeds the 1 MB limit'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    request.setTimeout(FETCH_TIMEOUT_MS, () => request.destroy(new Error('Metamorphysis export request timed out')));
    request.on('error', reject);
    request.end();
  });
}

export async function fetchMetamorphysisExport(url = process.env.METAMORPHYSIS_SYNC_URL, token = process.env.METAMORPHYSIS_SYNC_TOKEN): Promise<MetamorphysisExport> {
  if (!url || !token) throw new Error('Metamorphysis sync URL and token must be configured');
  const target = await resolveSafeMetamorphysisTarget(url);
  return parseMetamorphysisJson(await requestPinnedExport(target, token));
}
