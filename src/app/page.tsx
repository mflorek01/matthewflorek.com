import Image from 'next/image';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import { SectionHeading } from '@/components/site/SectionHeading';
import { SiteShell } from '@/components/site/SiteShell';
import { getPublicPortfolio } from '@/lib/content/portfolio';
import { resolvePreview } from '@/lib/content/preview';
import { PortfolioAiChat } from '@/components/ai/PortfolioAiChat';
import { getRuntimeAiConfig } from '@/lib/ai/config';
import { loadVisualPageDocument } from '@/lib/visual-editor';
import { VisualPage } from '@/components/site/VisualPage';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await resolvePreview(searchParams, '/?preview=1');
  const portfolio = await getPublicPortfolio({ preview });
  const { overview, githubRepositories } = portfolio;
  const [aiConfig, visualDocument] = await Promise.all([getRuntimeAiConfig(), loadVisualPageDocument('overview', preview)]);
  const aiEnabled = aiConfig.enabled;
  if (visualDocument) return <SiteShell><VisualPage document={visualDocument} portfolio={portfolio} aiEnabled={aiEnabled} /></SiteShell>;
  return <SiteShell>
    <section className="hero shell">
      <div className="hero-copy">
        <h1>{overview.name}<span className="accent-dot">.</span></h1>
        <p className="hero-lede">{overview.headline}</p>
        <p className="hero-body">{overview.shortBio}</p>
        <div className="hero-actions">
          <TrackedLink href="/work" event="contact_cta_clicked" properties={{ cta: 'explore-work-projects' }} className="button button-primary">See selected work <span aria-hidden="true">→</span></TrackedLink>
          <TrackedLink href="/ai" event="contact_cta_clicked" properties={{ cta: 'explore-ai-projects' }} className="button button-secondary">Explore AI projects</TrackedLink>
        </div>
      </div>
      <div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><Image className="orbit-headshot" src="/assets/matthew-florek-headshot-2026.jpg" width={300} height={300} sizes="(max-width: 760px) 190px, 250px" alt="" priority /></div><span className="orbit-tag orbit-tag-data">DATA</span><span className="orbit-tag orbit-tag-ai">AI</span><span className="orbit-tag orbit-tag-ops">OPS</span></div>
    </section>
    <section className="shell page-section intro-grid">
      <div><SectionHeading title="Analysis is the starting point, not the limit." /></div>
      <div className="prose"><p>{overview.longBio}</p><p>I care less about whether the answer is called a dashboard, an automation, or an application than whether it makes the work clearer, more reliable, and easier to do.</p></div>
    </section>
    <section className="shell page-section capability-section"><SectionHeading title="Tools I use to get the job done." /><div className="skill-cloud">{overview.skills.map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}</div></section>
    <section className="shell page-section split-section">
      <div><SectionHeading title="A data foundation, expanded through building." /><p className="section-copy">My formal background is in finance and business analytics. The work since then has stretched across data quality, operations, reporting, automation, geospatial analysis, and software development.</p>{overview.education.length ? <div className="education-list">{overview.education.map((item) => <div className="education-item" key={item.credential}><strong>{item.credential}</strong><span>{item.institution} · {item.year}</span></div>)}</div> : null}</div>
      <div className="action-card"><h3>Resume and profiles</h3><p>For the conventional version of my experience—and the code behind the public projects—these are the best places to start.</p><div className="stacked-links">{overview.links.map((link) => <TrackedLink key={link.url} href={link.url} event={link.label === 'GitHub' ? 'github_profile_clicked' : 'external_link_clicked'} properties={{ source: link.label }} target="_blank" rel="noreferrer" className="button button-secondary button-full">{link.label} <span aria-hidden="true">↗</span></TrackedLink>)}{overview.resumeAsset ? <TrackedLink href={overview.resumeAsset.path} event="resume_downloaded" properties={{ source: 'overview' }} className="button button-secondary button-full" download>Download résumé</TrackedLink> : null}{githubRepositories.map((repo) => <TrackedLink key={repo.url} href={repo.url} event="project_source_clicked" properties={{ source: 'github' }} target="_blank" rel="noreferrer" className="text-link">{repo.name} on GitHub <span aria-hidden="true">↗</span></TrackedLink>)}</div></div>
    </section>
    {aiEnabled ? <section className="shell page-section"><PortfolioAiChat /></section> : null}
  </SiteShell>;
}
