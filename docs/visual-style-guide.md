# Shared visual style guide

This guide governs the public-facing Matthew Florek portfolio and Metamorphysis. It is deliberately restrained: the work and the writing should carry the personality, not a layer of fashionable interface decoration.

## Non-negotiable exclusions

- Do not use decorative all-caps mini headers, eyebrows, kickers, or labels such as “PROJECT NOTES.” Use a normal heading, sentence-case lead, or no label.
- Do not use decorative green availability/status dots or “online” indicators. They imply live operational state without adding meaning.
- Do not expose internal publication language to visitors: `PUBLIC`, `PRIVATE`, `UNLISTED`, “draft,” “review required,” provenance, source IDs, conflict counts, or approval workflow belong in the private admin UI.
- Do not stack buzzwords. Prefer one concrete verb, object, outcome, and audience over strings such as “AI-powered, data-driven, innovative solutions.”
- Do not scatter `DATA`, `AI`, or `OPS` pill badges through the interface. The one intentional exception is the large orbital artwork on the portfolio home page, where the three labels are part of the approved composition.

Legitimate semantic status indicators remain appropriate in private admin, form validation, save confirmation, error, and system-health UI. They must have text, an accessible role/name, and never rely on color or a dot alone.

## Brand mark and favicon

The blue orbital mark is an abstract identity asset, not a logo lockup with initials.

- Header and favicon versions use the supplied blue/cyan orbital form with no initials, surrounding text pills, `DATA`/`AI`/`OPS` labels, or extra ornaments. The large home-page hero version retains its approved `DATA`, `AI`, and `OPS` labels.
- Preserve clear space equal to at least the diameter of the central orb on every side. Never crop the orbit, squeeze it, stretch it, rotate it, or recolor it outside the approved blue/cyan palette.
- Header mark: use a compact 28–36px square visual, optically centered, with enough clear space that the orbit remains legible. Pair it with “Matthew Florek” as ordinary text when the name is needed; do not put the name in a pill.
- Favicon: use a simplified, centered orb/orbit silhouette without initials or labels. Provide a 32px favicon and an SVG or 180–512px source for high-density contexts. Keep the central shape recognizable at 16px.
- If the full orbital artwork is too detailed at a small size, simplify the paths; do not add text to compensate.

## Color, type, and surfaces

Use the existing navy text, pale background, blue accent, and cyan highlight as the shared foundation. Blue should signal action or emphasis, not decorate every surface. Gradients should be soft, sparse, and directional; reserve them for hero atmosphere, the orbital mark, or a primary action. Avoid rainbow, neon, or high-contrast gradient fills.

Use sentence case for headings and controls. Establish hierarchy with size, weight, spacing, and placement. Body copy should be comfortable to read, with line length around 60–75 characters where practical. Keep contrast at WCAG AA minimum; test muted text, borders, gradient overlays, and focus states rather than assuming the navy text is sufficient.

## Copy principles

Write for two visitors at once: a technical reader looking for evidence and a nontechnical reader trying to understand the value.

- Lead with what Matt does and why it matters, not a job-title cloud.
- Name the problem, the intervention, and the result. Explain specialized terms when they are necessary.
- Show range through specifics: analytical work, operational systems, product building, and independent AI projects can coexist without being forced into one label.
- Use credible qualifiers: “helped,” “built,” “designed,” “prototyped,” or a measured result when the evidence supports it. Do not imply ownership or impact that cannot be substantiated.
- Prefer “I built a tool that…” to “I leverage cutting-edge…” and “This reduced…” to “This transformed…” unless the latter can be demonstrated.
- Keep project summaries skimmable: one clear summary, a short explanation of the decisions, and links/evidence where available.

## Layout, cards, buttons, and interaction

Cards are containers for a decision or a coherent story, not a grid of ornamental modules. Give each card one clear title, useful supporting copy, and an obvious next action. Avoid nesting cards inside cards and avoid badges that repeat the heading.

Buttons should describe an action: “Read the case study,” “View the repository,” “Download résumé,” or “Ask about my work.” Use one primary blue action per region and quiet secondary links for the rest. Do not make every link look like a button.

Interactive portfolio behavior should reveal useful detail: expandable evidence, filterable projects, keyboard-reachable tabs, and deliberate hover/focus states. Motion should be short, subtle, and optional. Respect `prefers-reduced-motion`; never make content depend on animation or require a visitor to chase moving elements.

## Photography and cropping

Use the supplied headshot as a human introduction, not as a decorative texture. Keep the face, eyes, and expression clear. For the circular/square header treatment, use `object-fit: cover` with a face-centered crop and test desktop and mobile separately; do not crop through the eyes or chin. Preserve the original image privately and export an appropriately sized, optimized web asset with descriptive alt text. Decorative orbital artwork should have empty alt text; informative photography should identify Matt plainly.

## Accessibility and governance

Every interactive element needs a visible keyboard focus state, an accessible name, and a logical tab order. Tabs must expose selected state and keyboard navigation. Do not communicate meaning through color, uppercase styling, a dot, or animation alone. Maintain reduced-motion behavior and test at narrow widths, zoom, keyboard-only navigation, and a screen reader pass.

Exceptions require a written reason tied to user comprehension, semantics, or brand recognition. The exception must identify the page, component, audience benefit, accessibility treatment, and an expiry/review date. Decorative trends are not sufficient justification. Apply this guide to both sites during design review and before release.
