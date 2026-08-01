import Link from "next/link";
import { getAnalyticsSummary } from "@/lib/analytics/admin";
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-card">
      <p className="admin-help-text">{label}</p>
      <strong className="analytics-number">{value}</strong>
    </div>
  );
}
function Table({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <section className="admin-card">
      <h2>{title}</h2>
      {rows.length ? (
        <ul className="admin-list">
          {rows.map((row) => (
            <li key={`${title}-${row.label}`}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-help-text">No data in this window.</p>
      )}
    </section>
  );
}
export default async function AdminAnalyticsPage() {
  const summary = await getAnalyticsSummary();
  return (
    <article>
      <div className="admin-heading">
        <div>
          <Link href="/admin" className="admin-back">
            ← Workspace
          </Link>
          <h1>Analytics</h1>
          <p>
            Private, aggregated Umami reporting for{" "}
            {summary.windowLabel.toLowerCase()}.
          </p>
        </div>
      </div>
      {summary.error ? (
        <div className="admin-card admin-error" role="alert">
          <h2>Analytics unavailable</h2>
          <p>{summary.error}</p>
        </div>
      ) : (
        <>
          <div className="admin-grid analytics-metrics">
            <Metric label="Visitors" value={summary.stats.visitors} />
            <Metric label="Visits" value={summary.stats.visits} />
            <Metric label="Pageviews" value={summary.stats.pageviews} />
            <Metric label="Active now" value={summary.activeVisitors ?? "—"} />
            <Metric
              label="Bounce rate"
              value={
                summary.stats.bounceRate == null
                  ? "—"
                  : `${summary.stats.bounceRate}%`
              }
            />
            <Metric
              label="Average visit"
              value={
                summary.stats.averageDurationSeconds == null
                  ? "—"
                  : `${summary.stats.averageDurationSeconds}s`
              }
            />
          </div>
          <div className="admin-grid">
            <Table title="Top pages" rows={summary.topPages} />
            <Table title="Top referrers" rows={summary.topReferrers} />
            <Table title="Events" rows={summary.topEvents} />
          </div>
          <p className="admin-help-text">
            Only aggregated counts are shown here. Visitor identifiers,
            credentials, and raw event records never reach this page.
          </p>
        </>
      )}
    </article>
  );
}
