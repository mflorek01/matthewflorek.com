import type { CSSProperties, ReactNode } from 'react';
import { PortfolioAiChat } from '@/components/ai/PortfolioAiChat';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import { ProjectExplorer } from '@/components/portfolio/ProjectExplorer';
import type { PortfolioContent } from '@/lib/content/portfolio';
import type { VisualBlock, VisualPageDocument } from '@/lib/visual-editor';
import styles from './VisualPage.module.css';

type Props = {
  document: VisualPageDocument;
  portfolio: PortfolioContent;
  aiEnabled?: boolean;
};

function safeHref(value?: string) {
  if (!value) return '#';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '#';
  } catch {
    return '#';
  }
}

function styleFor(block: VisualBlock): CSSProperties & Record<string, string | number> {
  return {
    gridColumn: `span ${block.style.desktopSpan}`,
    '--tablet-span': block.style.tabletSpan,
    '--mobile-span': block.style.mobileSpan,
    paddingTop: block.style.paddingTop,
    paddingBottom: block.style.paddingBottom,
    paddingInline: block.style.paddingInline,
    color: block.style.textColor,
    background: block.style.background,
    borderRadius: block.style.borderRadius
  };
}

function Orbit() {
  return <div className={styles.orbitWrap} aria-hidden="true"><div className="hero-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core" /><span className="orbit-tag orbit-tag-data">DATA</span><span className="orbit-tag orbit-tag-ai">AI</span><span className="orbit-tag orbit-tag-ops">OPS</span></div></div>;
}

function renderBlock(block: VisualBlock, portfolio: PortfolioContent, aiEnabled: boolean): ReactNode {
  const { content } = block;
  switch (block.type) {
    case 'hero':
      return <div className="hero" style={{ minHeight: 0, padding: 0, width: '100%' }}><div className="hero-copy"><h1>{content.text}<span className="accent-dot">.</span></h1><p className="hero-lede">{content.headline}</p><p className="hero-body">{content.body}</p><div className="hero-actions"><TrackedLink href={safeHref(content.primaryHref)} event="contact_cta_clicked" properties={{ cta: 'visual-primary' }} className="button button-primary">{content.primaryLabel || 'Learn more'}</TrackedLink><TrackedLink href={safeHref(content.secondaryHref)} event="contact_cta_clicked" properties={{ cta: 'visual-secondary' }} className="button button-secondary">{content.secondaryLabel || 'Explore'}</TrackedLink></div></div><Orbit /></div>;
    case 'heading': {
      const Heading = content.level ?? 'h2';
      return <Heading>{content.text}</Heading>;
    }
    case 'text':
      return <p className={styles.text}>{content.text}</p>;
    case 'button':
      return <TrackedLink href={safeHref(content.href)} event="external_link_clicked" properties={{ source: `visual-block:${block.id}` }} className={`button ${content.variant === 'primary' ? 'button-primary' : content.variant === 'text' ? 'text-link' : 'button-secondary'}`}>{content.label || 'Link'}</TrackedLink>;
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return content.src ? <img className={styles.image} src={safeHref(content.src)} alt={content.alt ?? ''} /> : null;
    case 'spacer':
      return <div aria-hidden="true" style={{ height: content.height ?? 48 }} />;
    case 'divider':
      return <hr className={styles.divider} />;
    case 'orbit':
      return <Orbit />;
    case 'skills':
      return <div className={styles.skills}>{portfolio.overview.skills.map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}</div>;
    case 'profile-links':
      return <div className={styles.profileLinks}>{portfolio.overview.links.map((link) => <TrackedLink key={link.url} href={link.url} event="external_link_clicked" properties={{ source: link.label }} target="_blank" rel="noreferrer" className="button button-secondary">{link.label}</TrackedLink>)}{portfolio.overview.resumeAsset ? <TrackedLink href={portfolio.overview.resumeAsset.path} event="resume_downloaded" properties={{ source: 'visual-page' }} className="button button-secondary" download>Download résumé</TrackedLink> : null}</div>;
    case 'projects': {
      const projects = portfolio.projects.filter((project) => project.category === content.category);
      return <div className={styles.projects}><h2>{content.category === 'AI' ? 'Selected AI projects' : 'Selected work'}</h2><p>Search by project, tool, or theme. Open a card for the problem, approach, and outcome.</p><ProjectExplorer projects={projects} emptyTitle="No projects are published yet." emptyCopy="Published projects will appear here." /></div>;
    }
    case 'chat':
      return aiEnabled ? <PortfolioAiChat /> : <p className={styles.empty}>The portfolio assistant is currently unavailable.</p>;
    default:
      return null;
  }
}

export function VisualPage({ document, portfolio, aiEnabled = false }: Props) {
  return <main className={styles.page}><div className={styles.grid}>{document.blocks.map((block) => <section key={block.id} className={`${styles.block} ${styles[`align${block.style.align[0].toUpperCase()}${block.style.align.slice(1)}` as keyof typeof styles]} ${styles[block.style.fontSize]}`} style={styleFor(block)}>{renderBlock(block, portfolio, aiEnabled)}</section>)}</div></main>;
}
