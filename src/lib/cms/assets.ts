import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AssetKind } from '@prisma/client';
import { prisma } from '@/lib/db';
import { recordAudit } from './audit';

export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BODY_BYTES = MAX_ASSET_BYTES + 128 * 1024;
const allowed = new Map([
  ['image/png', { kind: AssetKind.IMAGE, ext: 'png' }],
  ['image/jpeg', { kind: AssetKind.IMAGE, ext: 'jpg' }],
  ['image/gif', { kind: AssetKind.IMAGE, ext: 'gif' }],
  ['image/webp', { kind: AssetKind.IMAGE, ext: 'webp' }],
  ['application/pdf', { kind: AssetKind.DOCUMENT, ext: 'pdf' }]
]);

export function validateAssetBytes(contentType: string, bytes: Uint8Array) {
  const rule = allowed.get(contentType);
  if (!rule) throw new Error('Unsupported asset MIME type');
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) throw new Error('Asset exceeds the 10 MB limit or is empty');
  const signature = Array.from(bytes.slice(0, 12));
  const valid = contentType === 'image/png' && signature.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
    || contentType === 'image/jpeg' && signature.slice(0, 3).join(',') === '255,216,255'
    || contentType === 'image/gif' && new TextDecoder().decode(bytes.slice(0, 6)) === 'GIF87a'
    || contentType === 'image/gif' && new TextDecoder().decode(bytes.slice(0, 6)) === 'GIF89a'
    || contentType === 'image/webp' && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    || contentType === 'application/pdf' && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  if (!valid) throw new Error('Asset content does not match its declared MIME type');
  return rule;
}

function assetRoot() {
  const configured = process.env.PORTFOLIO_ASSET_DIR;
  return configured ? path.resolve(configured) : path.resolve(process.cwd(), '.data', 'assets');
}

function safeAssetPath(candidate: string) {
  const root = path.resolve(assetRoot());
  const absolute = path.resolve(candidate);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Asset path is outside the configured asset directory');
  return absolute;
}

export async function listProjectAssets(projectId: string) {
  return prisma.projectAsset.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, altText: true, visibility: true, createdAt: true, updatedAt: true } });
}

export async function readProjectAsset(projectId: string, assetId: string) {
  const asset = await prisma.projectAsset.findFirst({ where: { id: assetId, projectId } });
  if (!asset) throw new Error('Asset not found');
  const absolutePath = safeAssetPath(asset.path);
  const bytes = await readFile(absolutePath);
  const contentType = asset.kind === AssetKind.DOCUMENT ? 'application/pdf' : asset.path.endsWith('.png') ? 'image/png' : asset.path.endsWith('.jpg') ? 'image/jpeg' : asset.path.endsWith('.gif') ? 'image/gif' : asset.path.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
  return { asset, bytes, contentType };
}

export async function deleteProjectAsset(projectId: string, assetId: string, actorId: string) {
  const asset = await prisma.projectAsset.findFirst({ where: { id: assetId, projectId } });
  if (!asset) throw new Error('Asset not found');
  const absolutePath = safeAssetPath(asset.path);
  await unlink(absolutePath).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  });
  await prisma.projectAsset.delete({ where: { id: asset.id } });
  await recordAudit({ actorId, action: 'asset.deleted', entityType: 'ProjectAsset', entityId: asset.id, metadata: { projectId, kind: asset.kind } });
  return asset;
}

export async function storeProjectAsset(projectId: string, file: File, actorId: string, altText?: string) {
  const contentType = file.type.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const rule = validateAssetBytes(contentType, bytes);
  const filename = `${randomBytes(18).toString('hex')}.${rule.ext}`;
  const root = assetRoot();
  await mkdir(root, { recursive: true });
  const absolutePath = safeAssetPath(path.join(root, filename));
  await writeFile(absolutePath, bytes, { flag: 'wx', mode: 0o640 });
  const asset = await prisma.projectAsset.create({ data: { projectId, kind: rule.kind, path: absolutePath, altText: altText?.trim().slice(0, 300) || null, createdById: actorId } });
  await recordAudit({ actorId, action: 'asset.uploaded', entityType: 'ProjectAsset', entityId: asset.id, metadata: { projectId, kind: rule.kind, bytes: bytes.byteLength } });
  return asset;
}
