import type { VisualBlock, VisualPageDocument } from './schema';

const baseStyle: VisualBlock['style'] = {
  desktopSpan: 12,
  tabletSpan: 12,
  mobileSpan: 12,
  align: 'left',
  paddingTop: 16,
  paddingBottom: 16,
  paddingInline: 0,
  background: 'transparent',
  textColor: '#10213f',
  borderRadius: 0,
  fontSize: 'body'
};

function block(id: string, type: VisualBlock['type'], content: VisualBlock['content'], style: Partial<VisualBlock['style']> = {}): VisualBlock {
  return { id, type, content, style: { ...baseStyle, ...style } };
}

export function defaultVisualDocument(slug: string, overview?: { name?: string; headline?: string; shortBio?: string; longBio?: string } | null): VisualPageDocument {
  if (slug === 'work') {
    return { version: 1, blocks: [
      block('work-title', 'heading', { level: 'h1', text: 'Data systems built around real operational work.' }, { fontSize: 'display', paddingTop: 72 }),
      block('work-intro', 'text', { text: 'These projects began with familiar problems: scattered information, repetitive steps, difficult-to-audit decisions, and reporting that took too much effort. The descriptions stay appropriately high level, but the work and tools are real.' }, { fontSize: 'large', textColor: '#607080' }),
      block('work-projects', 'projects', { category: 'WORK' }, { paddingTop: 48, paddingBottom: 80 })
    ] };
  }
  if (slug === 'ai') {
    return { version: 1, blocks: [
      block('ai-title', 'heading', { level: 'h1', text: 'Software experiments that grew into working products.' }, { fontSize: 'display', paddingTop: 72 }),
      block('ai-intro', 'text', { text: 'I use AI as one part of a system—not as a substitute for product thinking, reliable data, or careful controls. These projects explore where it can make complicated tasks more useful and approachable.' }, { fontSize: 'large', textColor: '#607080' }),
      block('ai-projects', 'projects', { category: 'AI' }, { paddingTop: 48, paddingBottom: 80 })
    ] };
  }
  const name = overview?.name || 'Matthew Florek';
  const headline = overview?.headline || 'Data analyst, systems builder, and practical AI developer.';
  const shortBio = overview?.shortBio || '';
  const longBio = overview?.longBio || '';
  return { version: 1, blocks: [
    block('home-hero', 'hero', { text: name, headline, body: shortBio, primaryLabel: 'See selected work', primaryHref: '/work', secondaryLabel: 'Explore AI projects', secondaryHref: '/ai' }, { paddingTop: 48, paddingBottom: 64 }),
    block('home-story-title', 'heading', { level: 'h2', text: 'Analysis is the starting point, not the limit.' }, { desktopSpan: 5, fontSize: 'title', paddingTop: 72 }),
    block('home-story', 'text', { text: longBio }, { desktopSpan: 7, fontSize: 'large', textColor: '#607080', paddingTop: 72 }),
    block('home-skills', 'skills', {}, { paddingTop: 56, paddingBottom: 56 }),
    block('home-links', 'profile-links', {}, { desktopSpan: 7, paddingTop: 48, paddingBottom: 64 }),
    block('home-chat', 'chat', {}, { desktopSpan: 5, paddingTop: 48, paddingBottom: 64 })
  ] };
}
