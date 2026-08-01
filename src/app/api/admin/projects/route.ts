import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { listCategories, listProjects, projectDraftSchema } from '@/lib/cms';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ projects: await listProjects(), categories: await listCategories() });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const input = projectDraftSchema.parse(await request.json());
    const project = await prisma.project.create({ data: { slug: input.slug, categoryId: input.categoryId, title: input.title, summary: input.summary, details: input.details as Prisma.InputJsonValue | undefined, publicationStatus: 'DRAFT', visibility: input.visibility, sortOrder: input.sortOrder, includeInAi: false, source: input.source ?? null, reviewNotes: input.reviewNotes ?? null } });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create project' }, { status: 400 });
  }
}
