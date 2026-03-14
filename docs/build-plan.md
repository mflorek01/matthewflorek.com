# Build Plan

Date: March 12, 2026

## Goal

Build a clean professional personal site for Matthew Florek that works locally on this machine, serves on port 4000, and starts from a minimal scope: portrait area, concise professional summary, contact paths, and resume access.

## Research-Informed Decisions

- Use a static site instead of a framework because the current scope is simple and should start quickly with no install step.
- Keep the homepage to a few sections so the site feels intentional instead of empty.
- Put the resume directly on the homepage instead of hiding it behind navigation.
- Use a strong visual identity so the page does not look like a default template.

## V1 Sections

### 1. Hero

- Name
- One-line professional positioning
- Short summary paragraph
- Email, LinkedIn, and resume actions
- Portrait panel

### 2. Capability Snapshot

- Analytics and reporting
- Workflow automation and data pipelines
- AI-assisted data and operations work
- Tooling chips drawn from the resume

### 3. Resume

- Embedded PDF viewer
- Download button
- Fallback link if browser PDF embedding is unavailable

### 4. Contact

- Email
- Phone
- LinkedIn
- Short note on the kinds of roles the site is built to support

## Constraints

- No headshot image was present in the directory, so V1 will use a polished monogram placeholder.
- Resume details are kept concise where the PDF extraction is noisy; the site will stay accurate by emphasizing broad strengths that are clearly visible in the resume.
- The implementation should remain dependency-light and easy to host anywhere later.

## Next Upgrade Path

- Replace the placeholder image with a professional headshot.
- Add public project or case-study pages.
- Add a writing section if Matthew wants to showcase current thinking in analytics and AI.
