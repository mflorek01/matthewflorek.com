# Portfolio admin guide

Use `/admin` to edit the portfolio. Sign in with the email and password used during bootstrap.

## Safe editing cycle

1. Open a page or project.
2. Edit the friendly fields.
3. Select **Save draft**. Visitors still see the last published version.
4. Select **Preview draft** and inspect it.
5. Select **Publish** when ready.

Public means visible after publication. Unlisted is for a direct link. Private is hidden. The AI assistant uses only published, public content marked **Include in AI knowledge**.

Project fields include tags, context, contribution, outcome, links, and assets. Advanced JSON is an escape hatch for extra fields. Every save creates a revision; **Restore as draft** brings back an older version without publishing it.

The Metamorphysis integration imports reviewed content into this site; local edits do not change the source account. Analytics are available in the private dashboard configured during deployment.

## Public style guide

Avoid decorative mini-headers, green status indicators, and unnecessary project-status badges. Use plain language, concrete evidence, and restrained labels. These rules apply to public content and branding, not practical controls inside the private admin area.

## Live analytics

After signing in, choose **Analytics** in the top navigation or **View live analytics** on the workspace home. It shows aggregated Umami counts for the last 30 days, including visitors, visits, pageviews, active visitors, bounce rate, average visit duration, popular pages, referrers, and tracked events. It is intentionally not a list of individual visitors. If it says analytics is unavailable, the server-only Umami settings have not been filled in or the private network is not connected.

For the one-time credential connection, run `bash scripts/admin/configure-analytics-access.sh` from the portfolio folder on the server. Enter the existing Umami username and password when prompted. The password is hidden while you type; the helper validates it, updates the private environment file, and restarts only the portfolio app.
