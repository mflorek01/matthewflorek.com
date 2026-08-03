import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

function resumeRoot() {
  return path.resolve(process.env.PORTFOLIO_UPLOAD_DIR ?? path.join(process.cwd(), '.data', 'portfolio-assets'));
}

function safeResumeName(name: string) {
  if (!/^resume-[a-f0-9]{36}\.pdf$/.test(name)) throw new Error('Invalid portfolio asset name');
  return path.join(resumeRoot(), name);
}

function isPdf(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
}

export async function storeResume(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RESUME_BYTES) throw new Error('The resume must be between 1 byte and 10 MB');
  if (!isPdf(bytes)) throw new Error('The resume must be a valid PDF file');
  const name = `resume-${randomBytes(18).toString('hex')}.pdf`;
  const root = resumeRoot();
  await mkdir(root, { recursive: true });
  await writeFile(safeResumeName(name), bytes, { flag: 'wx', mode: 0o640 });
  return { name, path: `/api/portfolio-assets/${name}`, bytes: bytes.byteLength };
}

export async function readResume(name: string) {
  return readFile(safeResumeName(name));
}
