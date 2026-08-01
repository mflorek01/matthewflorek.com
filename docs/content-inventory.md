# Portfolio content inventory

Curated 2026-07-31 for the portfolio redesign. The source of truth is `content/portfolio-source.json`; this document records where the material came from and what still needs Matthew's review.

## Recovered from the prior public website

The personal-site repository history before commit `22cbe13` contained the prior public site implementation. The most useful content was recovered from commit `e8b37db` and related earlier revisions:

- Prior overview copy: `client/src/components/Hero.tsx`, `client/src/pages/About.tsx`, and `client/src/index.html`.
- Prior education and experience claims: `client/src/lib/data.ts`.
- Prior skills list: `client/src/lib/data.ts`.
- Public LinkedIn link: `client/src/components/Hero.tsx`.
- Public resume link and portrait references: `client/src/components/Hero.tsx`.
- Recovered assets: `client/public/assets/headshot.png` and `client/public/assets/Matthew Florek Resume.pdf`.

The current branch is a 25-byte “Coming Soon” placeholder, so this inventory intentionally uses Git history rather than the current working tree as the source for legacy copy/assets.

## Read-only Metamorphysis sources

The private `mflorek01/metamorphysis` repository was inspected without copying secrets or private account data. The curated project themes came from `data/mega-resume.json`; product/system context came from `README.md`.

Included at a high level:

- Work-project themes such as grant data systems, dashboards, workflow automation, compliance evaluation, and geospatial analysis.
- AI-project themes such as Metamorphysis, BettrGrants, the resume workshop system, ArXiv Observatory, AI-agent experiments, and YapGPT.
- Public-safe technical themes such as SQL, Python, Excel, Power Query, Power Automate, TypeScript, PostgreSQL, data modeling, and AI-assisted development.

Explicitly omitted:

- Email address and phone number from the private profile source.
- Private repository URLs and internal application URLs.
- Employer/customer names, internal program details, private account data, and unreviewed metrics.
- Evidence strings that referred to interview notes, internal systems, or confidential operating details.
- Specific internal data volumes, team sizes, time savings, and implementation details until Matthew approves them.

## Curated public set

The current public-safe set includes five representative Work Projects:

- Operations Grant Database
- Grant Application Dashboard
- Grant Evaluation Workflow Automation
- Title I Comparability Evaluation
- School District Boundary and Census Analysis

It also includes the requested AI Projects:

- Metamorphysis.ai
- BettrGrants
- HyperMap

These records use deliberately generic summaries. BettrGrants and HyperMap have no verified public URL or repository in the inspected sources, so the portfolio must render them as unlinked project cards until Matthew supplies evidence. Work-project records remain excluded from the visitor AI knowledge boundary (`includeInAi: false`) because they derive from employer-related material, even though their public card summaries are safe at this level.

## Publication status rules

- `PUBLIC`: safe to render as public copy based on an existing public source or a deliberately generic description.
- `DRAFT`: a personal-project candidate that needs Matthew's confirmation of status, wording, ownership language, and links.
- `NEEDS_REVIEW`: employer-derived or asset-related material that must be approved before publication.

Only `PUBLIC` records should appear in an unaudited public portfolio by default. The admin editor should make status and `includeInAi` visible before publishing or adding material to the visitor-facing AI knowledge boundary.

## Matthew's review checklist

- Confirm the preferred headshot and whether `matthew-florek-headshot.png` is still appropriate for public use.
- Confirm that the recovered resume is current before exposing it at `/downloads/matthew-florek-resume.pdf`.
- Confirm current employment wording and whether the generic work-project titles can remain public under employer policy.
- Approve or revise the public-safe work-project summaries before adding screenshots, metrics, named systems, or employer context.
- Confirm whether BettrGrants, HyperMap, ArXiv Observatory, AI Agent Harness, and YapGPT are separate projects and what their current statuses are.
- Provide public URLs/repository links for projects that should have them; private links should remain explicit `PRIVATE` and should not render publicly.
- Decide whether Matthew should be identified as creator, maintainer, contributor, or collaborator for Metamorphysis.ai and BettrGrants.
- Review every record marked `includeInAi: true` before enabling the public visitor assistant.

## Missing content

- No verified public URL or repository was found for BettrGrants or HyperMap during this pass; their public records therefore have no links.
- No verified public repository/demo was found for the other draft AI projects.
- No current public contact method was added; private profile contact fields were intentionally excluded.
- No employer-approved screenshots, diagrams, or project artifacts were available for publication.
- No public metrics were added from the private source; quantified outcomes require explicit review.

## Withheld details

The curation intentionally withholds employer and customer names, internal program or system names, private repository and application URLs, personal contact details, screenshots or artifacts from internal systems, source-dataset details, team or stakeholder details, internal data volumes, time-savings claims, unverified metrics, and any claim about ownership or current status that was not supported by a public source. These items remain either absent or marked `NEEDS_REVIEW`/`DRAFT` in the source file rather than being inferred.

## Asset files

- `public/assets/matthew-florek-headshot.png` — recovered from the prior public site as `headshot.png`; needs visual/usage confirmation.
- `public/downloads/matthew-florek-resume.pdf` — recovered from the prior public site as `Matthew Florek Resume.pdf`; needs freshness and publication confirmation.
