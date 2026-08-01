import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { isAiAdminAuthorized } from '@/lib/ai/admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!isAiAdminAuthorized(request.headers.get('x-ai-admin-token'))) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'AI admin authorization is required.' } }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ documents: [], database: 'unconfigured' });
  const documents = await prisma.aiKnowledgeDocument.findMany({
    where: { status: 'PUBLISHED', includeInAi: true },
    select: { slug: true, title: true, sourceType: true, vectorStoreId: true, metadata: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' }
  });
  return NextResponse.json({
    documents: documents.filter((document) => {
      const metadata = document.metadata && typeof document.metadata === 'object' && !Array.isArray(document.metadata) ? document.metadata as Record<string, unknown> : {};
      return metadata.visibility === 'PUBLIC' || metadata.publicationStatus === 'PUBLIC';
    }).map(({ metadata, ...document }) => ({
      ...document,
      public: true,
      sourceUrl: metadata && typeof metadata === 'object' && !Array.isArray(metadata) && typeof (metadata as Record<string, unknown>).sourceUrl === 'string' ? (metadata as Record<string, unknown>).sourceUrl : null
    }))
  });
}
