import Link from "next/link";
export const metadata = { title: "How to use the portfolio editor" };
export default function AdminHelpPage() {
  return (
    <article className="admin-card admin-guide">
      <Link href="/admin" className="admin-back">
        ← Workspace
      </Link>
      <p className="admin-kicker">Owner guide</p>
      <h1>How to edit your portfolio</h1>
      <p>
        This private editor lets you change words, links, projects, and selected
        assets without changing code.
      </p>
      <h2>Basic workflow</h2>
      <ol>
        <li>Open a page or project.</li>
        <li>Make your changes.</li>
        <li>
          <strong>Save draft</strong> stores them privately; visitors still see
          the published version.
        </li>
        <li>
          <strong>Preview draft</strong> lets you inspect the private version.
        </li>
        <li>
          <strong>Publish</strong> makes the current draft public.
        </li>
      </ol>
      <h2>Visibility and AI</h2>
      <p>
        <strong>Public</strong> means visitors can see the item after
        publication. <strong>Unlisted</strong> is useful for a direct link.{" "}
        <strong>Private</strong> keeps it out of the public site. The AI
        assistant uses only content that is published, public, and marked{" "}
        <strong>Include in AI knowledge</strong>.
      </p>
      <h2>Projects, links, and assets</h2>
      <p>
        Projects have fields for tags, context, your contribution, and outcomes.
        Links should begin with <code>https://</code>. Upload images or PDFs
        from Assets, then use their path in an asset-path field when needed.
      </p>
      <h2>Revisions</h2>
      <p>
        Each save creates a revision. <strong>Restore as draft</strong> brings
        back an older version without publishing it.
      </p>
      <h2>Metamorphysis</h2>
      <p>
        The integration can fetch an approved export or accept manual export
        JSON. Review imported projects carefully; local edits are separate from
        the source account.
      </p>
      <h2>Analytics</h2>
      <p>
        Open the private <Link href="/admin/analytics">analytics dashboard</Link>{" "}
        to see visitor counts, current activity, popular pages, referrers, and
        tracked interactions. Your own admin visits are excluded.
      </p>
      <h2>Sign-in</h2>
      <p>
        Use the email and password used during bootstrap. Do not put those
        credentials into this guide or share them with visitors.
      </p>
      <h2>Public style notes</h2>
      <p>
        The public site avoids decorative mini-labels, green status dots, and
        unnecessary status badges. These rules apply to public content and
        branding, not practical admin controls.
      </p>
    </article>
  );
}
