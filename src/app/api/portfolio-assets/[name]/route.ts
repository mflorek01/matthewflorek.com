import { readResume } from '@/lib/storage/portfolio-files';

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await context.params;
    const bytes = await readResume(name);
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Matthew-Florek-Resume.pdf"`,
        'Cache-Control': 'public, max-age=3600, must-revalidate'
      }
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
