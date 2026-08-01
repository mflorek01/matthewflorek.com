import Image from 'next/image';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SiteShell } from '@/components/site/SiteShell';
import { getPublicPortfolio } from '@/lib/content/portfolio';
import { resolvePreview } from '@/lib/content/preview';
import { PortfolioAiChat } from '@/components/ai/PortfolioAiChat';
import { getAiConfig } from '@/lib/ai/config';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await resolvePreview(searchParams, '/?preview=1');
  const { overview, githubRepositories } = await getPublicPortfolio({ preview });
  const aiEnabled = getAiConfig().enabled;
  return <SiteShell>
    <section className="hero shell">
      <div className="hero-copy">
        <p className="eyebrow">Independent portfolio · 2026</p>
        <h1>{overview.name}<span className="accent-dot">.</span></h1>
        <p className="hero-lede">{overview.headline}</p>
        <p className="hero-body">{overview.shortBio}</p>
        <div className="hero-actions">
          <TrackedLink href="/ai" event="contact_cta_clicked" properties={{ cta: 'explore-ai-projects' }} className="button button-primary">Explore AI projects <span aria-hidden="true">→</span></TrackedLink>
          <TrackedLink href="/work" event="contact_cta_clicked" properties={{ cta: 'explore-work-projects' }} className="button button-secondary">View work projects</TrackedLink>
        </div>
        <p className="availability-note"><span className="status-dot" aria-hidden="true" /> Open to thoughtful problems in data, automation, and AI-assisted systems.</p>
      </div>
      <div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core">MF</div><span className="orbit-label label-one">DATA</span><span className="orbit-label label-two">AI</span><span className="orbit-label label-three">OPS</span></div>
    </section>
    <section className="shell page-section intro-grid">
      <div><SectionHeading eyebrow="The throughline" title="Find the structure. Build the useful thing." /></div>
      <div className="prose"><p>{overview.longBio}</p><p>The best work is usually a translation: from noise to a model, from a manual step to a workflow, or from a promising idea to something another person can actually use.</p></div>
    </section>
    <section className="shell page-section capability-section"><SectionHeading eyebrow="Working toolkit" title="A practical, connected toolkit." /><div className="skill-cloud">{overview.skills.map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}</div></section>
    <section className="shell page-section split-section">
      <div><SectionHeading eyebrow="Background" title="Grounded in the details." /><p className="section-copy">Education in finance and business analytics, paired with hands-on work across data quality, operations, reporting, and software.</p>{overview.education.length ? <div className="education-list">{overview.education.map((item) => <div className="education-item" key={item.credential}><strong>{item.credential}</strong><span>{item.institution} · {item.year}</span></div>)}</div> : null}</div>
      <div className="action-card"><p className="eyebrow">Stay connected</p><h3>Explore the public trail.</h3><p>Find the source projects and professional context that are currently ready to share.</p>{overview.portraitAsset ? <Image className="portrait-image" src={overview.portraitAsset.path} alt="Portrait of Matthew Florek" width={320} height={320} /> : null}<div className="stacked-links">{overview.links.map((link) => <TrackedLink key={link.url} href={link.url} event={link.label === 'GitHub' ? 'github_profile_clicked' : 'external_link_clicked'} properties={{ source: link.label }} target="_blank" rel="noreferrer" className="button button-secondary button-full">{link.label} <span aria-hidden="true">↗</span></TrackedLink>)}{overview.resumeAsset ? <TrackedLink href={overview.resumeAsset.path} event="resume_downloaded" properties={{ source: 'overview' }} className="button button-secondary button-full" download>Download résumé</TrackedLink> : null}{githubRepositories.map((repo) => <TrackedLink key={repo.url} href={repo.url} event="project_source_clicked" properties={{ source: 'github' }} target="_blank" rel="noreferrer" className="text-link">{repo.name} on GitHub <span aria-hidden="true">↗</span></TrackedLink>)}</div><p className="muted-copy resume-note">Only assets marked PUBLIC are shown here.</p></div>
    </section>
    {aiEnabled ? <section className="shell page-section"><PortfolioAiChat /></section> : null}
  </SiteShell>;
}
