import Link from "next/link";
export const metadata = { title: "How to use the portfolio editor" };
export default function AdminHelpPage() {
  return (
    <article className="admin-card admin-guide">
      <Link href="/admin" className="admin-back">
        ← Workspace
      </Link>
      <h1>How to edit your portfolio</h1>
      <p>
        This private editor lets you change words, links, projects, and selected
        assets without changing code. The page preview uses the same validated
        layout format as the public site.
      </p>
      <h2>Visual editing workflow</h2>
      <ol>
        <li>Open a page or project and choose the part of the layout to edit.</li>
        <li>Add an element when you need new content, then edit its text, link, or asset.</li>
        <li>Reorder elements by moving them into the order you want.</li>
        <li>Use the available style controls for readable spacing, type, color, and alignment.</li>
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
      <p>
        Use <strong>Undo</strong> and <strong>Redo</strong> to step through recent
        editor changes. Check both desktop and narrow-screen responsive views
        before publishing so text, images, and controls remain usable.
      </p>
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
        credentials, API keys, tokens, or other secrets into this guide or share
        them with visitors. Enter an OpenAI key only in the designated masked
        credential field under <Link href="/admin/ai">AI assistant</Link>; never
        paste one into page content.
      </p>
      <h2>Style guide note</h2>
      <p>
        Do not add decorative all-caps eyebrow or kicker labels, or status-dot
        decoration. Use a normal sentence-case heading and explain status with
        text when it matters. These rules apply to public content and decorative
        admin treatment. Practical form labels and text-backed validation remain
        appropriate.
      </p>
    </article>
  );
}
