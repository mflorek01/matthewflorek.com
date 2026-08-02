# Portfolio analytics

## Provider and privacy posture

Use self-hosted Umami with its cookie-free, anonymous defaults. Analytics is fail-closed unless `ANALYTICS_MODE` is explicitly set to `cookieless` or `consent`, and both `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` are present. `UMAMI_DOMAINS` is optional and should list the production hostname(s). The browser shell mirrors these values through safe HTML data attributes, and the tracker is loaded after the page becomes interactive. For backward compatibility only, the legacy `NEXT_PUBLIC_*` names remain optional fallbacks.

The modes are intentionally explicit:

- `off` or an unrecognized value: no tracker and no events.
- `cookieless`: privacy-first auto mode; the tracker may load after hydration unless the visitor has opted out locally.
- `consent`: tracker and events remain off until the visitor selects “Allow anonymous analytics.” There is no pre-consent page-view or preference event.

Do not add a custom persistent visitor cookie, fingerprinting, cross-site identity stitching, user IDs, session replay, heatmaps, or third-party ad tracking. Analytics payloads must not contain names, email addresses, chat text, resume content, raw visitor input, or free-form search text.

The privacy page exposes a visible browser-local preference control. The current preference is stored as `portfolio-analytics-preference` (`opt-in` or `opt-out`); the prior `portfolio-analytics-disabled` key is read only for opt-out migration. The preference is respected by both the tracker component and event helper, and changing it does not emit an analytics event.

## Event contract

The typed contract is in `src/lib/analytics/events.ts`. It supports:

- `tab_viewed`
- `project_opened`
- `project_source_clicked`
- `resume_downloaded`
- `github_profile_clicked`
- `contact_cta_clicked`
- `external_link_clicked`
- `ai_chat_started`
- `ai_question_submitted`
- `ai_answer_completed`
- `ai_chat_rate_limited`
- `portfolio_search_used`
- `project_filter_used`

Properties are limited to bounded categorical values: `slug`, `tab`, `cta`, `content_type`, `source`, `filter`, and `result`. Use stable slugs such as `work-projects` or `github`; never send the visible question, search query, email, or other free-form text.

Public UI can adopt `TrackedLink`, `TrackedButton`, or call `trackAnalyticsEvent` directly. Integration should happen at the interaction boundary so navigation remains independent of analytics availability.

## Dashboard setup

## Private admin analytics

The portfolio exposes private analytics at `/admin/analytics`, behind the normal portfolio admin session. The server calls the private Umami service over Docker networking; the browser never receives the Umami username, password, API token, raw IP address, or raw Umami session identifier. The dashboard includes bounded anonymous session summaries and page/event activity for investigation; it does not expose free-form visitor input.

Set these server-only values in production `.env`: `UMAMI_API_URL=http://umami:3000`, `UMAMI_WEBSITE_ID=<production website id>`, `UMAMI_API_USERNAME=<Umami administrator username>`, and `UMAMI_API_PASSWORD=<Umami administrator password>`. If any value is missing, the page fails closed with a setup message. Do not use `NEXT_PUBLIC_*` names for these credentials. The server uses Umami's website stats, metrics, pageview series, active endpoint, session summaries, session details, and session activity endpoints. Daily visitor counts are obtained from one-day aggregate stats; daily visits/sessions and pageviews come from Umami's pageview series. Retention is obtained from Umami's aggregate `POST /api/reports/retention` endpoint and summarized as weighted day-1 and day-7 return rates. Session records are limited to the selected window and bounded to the first 100 records and 200 activity items per record. Visitor keys are one-way opaque dashboard keys, not Umami IDs. Umami's `totaltime` is already measured in seconds, so average visit duration is calculated as `totaltime / visits`.

On the production host, `bash scripts/admin/configure-analytics-access.sh` performs this connection interactively without printing the password or token. It validates the login over the private Docker network, preserves `.env` permissions, records the server-only values atomically, and recreates only the portfolio application with its currently deployed image.

Create one Umami website for the production portfolio and use a separate website or disabled local configuration for development. Use the current official Docker image tag `ghcr.io/umami-software/umami:3.2.0`. Keep session replay and heatmaps unconfigured. The initial dashboard should include visitors, sessions, page views, referrers, campaign parameters, device category, browser, operating system, country/region, project opens, source clicks, resume downloads, contact CTA clicks, and AI-chat starts/completions/rate limits.

At launch, exclude admin routes, development traffic, health checks, uptime monitors, internal jobs, and known bot traffic. Keep Umami bot filtering enabled. The private cockpit may show Umami's coarse city field because the owner explicitly requested investigation detail; it is not shown publicly and is not treated as identity evidence. Automation labels are heuristics based on activity and device signals, not proof. Ordinary crawlers that do not execute JavaScript may not appear in Umami and require separately retained edge-request aggregates if that distinction becomes important.

Retention is a manual, verifiable policy at launch, not an automated deletion job. An operator must review Umami at least quarterly, record the review date, dashboard/site, data ranges checked, deletion action, and the next due date. The target is to delete raw analytics older than approximately 12 months and aggregate reporting older than approximately 24 months when the configured Umami controls support that distinction. If the review or deletion cannot be completed, the release checklist must remain open and public wording must say that retention may be longer. Ordinary server access logs have a separate, shorter retention policy.

## Operating checks

After deployment, verify that:

1. The script is absent when analytics mode is off, either required runtime variable is missing, consent has not been granted in consent mode, or local opt-out is enabled.
2. Consent-mode browser validation confirms that no pre-consent page view or preference event reaches Umami.
3. A page view appears in cookieless mode without setting a custom analytics cookie.
4. Each event has only the intended categorical properties.
5. Health checks, admin use, and bot traffic are not counted as portfolio engagement.
6. The dashboard shows event data after a real journey, and the quarterly retention review is recorded.
