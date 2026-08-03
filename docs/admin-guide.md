# Portfolio admin guide

Use `/admin` to edit the portfolio. Sign in with the email and password used during bootstrap.

## Visual editor workflow

The visual editor is intended to let you work on a page or project as a layout
of content elements instead of editing code. Open the page or project, select
an element, and edit its text, link, image, or other available field. Add new
elements when needed, move them to reorder the page, and use the style controls
for spacing, type, color, and alignment. The preview modes use the same
validated page format as the public site.

Use **Undo** and **Redo** to step through recent changes. Check the desktop and
narrow-screen responsive previews before you publish so content remains legible
and controls remain easy to use.

## Safe editing cycle

1. Open a page or project.
2. Edit the friendly fields or visual elements.
3. Select **Save draft**. Visitors still see the last published version.
4. Select **Preview draft** and inspect both available preview modes.
5. Select **Publish** only when the draft is ready for visitors.

Public means visible after publication. Unlisted is for a direct link. Private is hidden. The AI assistant uses only published, public content marked **Include in AI knowledge**.

Project fields include tags, context, contribution, outcome, links, and assets. Advanced JSON is an escape hatch for extra fields. Every save creates a revision; **Restore as draft** brings back an older version without publishing it.

## Resume and profile buttons

On the Overview page, use **Resume download** to upload a replacement PDF. The upload is stored outside the release image so it survives future deployments. The page still needs **Save draft** and **Publish** before visitors receive the new file. The LinkedIn and GitHub button URLs can be changed in the same Overview section; leave a URL blank to remove that button.

The Metamorphysis integration imports reviewed content into this site; local edits do not change the source account. Analytics are available in the private dashboard configured during deployment.

## AI reference documents

Open **AI assistant** in the admin navigation. Upload a UTF-8 text document (TXT, Markdown, CSV, or JSON), optionally give it a clearer title, and it will appear as a draft. Drafts are not used by the public assistant. Select **Publish for AI** only after reviewing the file; select **Unpublish** to stop using it while keeping it available for later, or **Archive** to retire it. The assistant can use only published documents that are explicitly active.

## AI key safety

Never put an AI provider key, admin token, password, or other secret into page
content, this guide, or a screenshot. The only place to enter an OpenAI key in
the browser is the designated credential field under **AI assistant**. It is
sent over HTTPS, encrypted on the server, and never displayed again. The public
assistant should receive only the approved content boundary; a key is never
portfolio content.

## Public style guide

Ban decorative all-caps eyebrow or kicker labels and status-dot decoration.
Use normal sentence-case headings and explain meaningful status with text. Keep
the interface plain, concrete, and restrained. These rules apply to both the
public site and decorative treatment inside the private admin. Normal form
labels and text-backed validation or system status remain appropriate.

## Live analytics

The analytics page includes a private visitor cockpit in addition to the aggregate cards. It lists bounded anonymous session summaries, coarse location, browser/OS/device/screen/language, page and event activity, and heuristic automation signals. Click any visitor or activity row to highlight every matching instance. These signals are not proof of automation and cannot identify a person.

The page shows the last 30 days of unique visitors, visits/sessions, pageviews, daily trends, return rates, popular pages, referrers, tracked events, and detailed visitor activity. “Unique visitors” is Umami’s anonymous visitor count; “visits/sessions” counts sessions; and “pageviews” counts page loads. Automation labels are signals, not proof, and the data cannot identify a person. If it says analytics is unavailable, the server-only Umami settings have not been filled in or the private network is not connected.

For the one-time credential connection, run `bash scripts/admin/configure-analytics-access.sh` from the portfolio folder on the server. Enter the existing Umami username and password when prompted. The password is hidden while you type; the helper validates it, updates the private environment file, and restarts only the portfolio app.

If the Umami password has been forgotten, run `bash scripts/admin/reset-umami-admin-password.sh` from the same folder. It lists active Umami administrator usernames, asks you to choose one, prompts for a new password twice, creates a database backup, and requires you to type `RESET-UMAMI` before changing anything. It does not remove analytics data.

If the portfolio admin email or password has been forgotten, run `bash scripts/admin/reset-admin-password.sh` from the same folder. It lists active portfolio administrator email addresses, creates a verified database backup, prompts for a new password, revokes existing admin sessions, and verifies the new login. It requires the literal confirmation `RESET-PORTFOLIO-ADMIN` and does not change portfolio content.
