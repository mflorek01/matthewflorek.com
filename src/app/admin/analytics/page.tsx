import Link from "next/link";
import { getAnalyticsSummary, type AnalyticsTrendPoint } from "@/lib/analytics/admin";
import { AnalyticsCockpit } from "@/components/admin/AnalyticsCockpit";

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="admin-card analytics-metric-card">
      <p className="admin-help-text">{label}</p>
      <strong className="analytics-number">{value}</strong>
      <p className="admin-help-text">{detail}</p>
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <section className="admin-card">
      <h2>{title}</h2>
      {rows.length ? (
        <ul className="admin-list">
          {rows.map((row) => <li key={`${title}-${row.label}`}><span>{row.label}</span><strong>{row.value}</strong></li>)}
        </ul>
      ) : <p className="admin-help-text">No data in this window.</p>}
    </section>
  );
}

function TrendChart({ points }: { points: AnalyticsTrendPoint[] }) {
  if (!points.length) return <p className="admin-help-text">No daily trend data in this window.</p>;
  const width = 760;
  const height = 250;
  const padding = { top: 24, right: 18, bottom: 34, left: 42 };
  const max = Math.max(1, ...points.flatMap((point) => [point.visitors, point.visits, point.pageviews]));
  const x = (index: number) => padding.left + (index / Math.max(1, points.length - 1)) * (width - padding.left - padding.right);
  const y = (value: number) => height - padding.bottom - (value / max) * (height - padding.top - padding.bottom);
  const line = (key: keyof Pick<AnalyticsTrendPoint, "visitors" | "visits" | "pageviews">) => points.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");
  return (
    <figure className="analytics-chart">
      <figcaption className="analytics-chart-heading">
        <div><h2>Daily traffic</h2><p className="admin-help-text">Each line is a daily aggregate. Visitors are unique visitors; visits are sessions.</p></div>
        <div className="analytics-legend" aria-label="Chart legend"><span className="legend-visitors">Visitors</span><span className="legend-visits">Visits / sessions</span><span className="legend-pageviews">Pageviews</span></div>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily visitors, visits or sessions, and pageviews for the last 30 days">
        <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} className="analytics-axis" />
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} className="analytics-axis" />
        <polyline points={line("visitors")} className="analytics-line analytics-line-visitors" />
        <polyline points={line("visits")} className="analytics-line analytics-line-visits" />
        <polyline points={line("pageviews")} className="analytics-line analytics-line-pageviews" />
        <text x={padding.left} y={height - 10} className="analytics-label">{points[0].date}</text>
        <text x={width - padding.right} y={height - 10} textAnchor="end" className="analytics-label">{points[points.length - 1].date}</text>
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" className="analytics-label">{max.toLocaleString()}</text>
        <text x={padding.left - 8} y={height - padding.bottom + 4} textAnchor="end" className="analytics-label">0</text>
      </svg>
      <div className="sr-only"><table><caption>Daily traffic values</caption><thead><tr><th>Date</th><th>Visitors</th><th>Visits / sessions</th><th>Pageviews</th></tr></thead><tbody>{points.map((point) => <tr key={point.date}><td>{point.date}</td><td>{point.visitors}</td><td>{point.visits}</td><td>{point.pageviews}</td></tr>)}</tbody></table></div>
    </figure>
  );
}

function Retention({ summary }: { summary: Awaited<ReturnType<typeof getAnalyticsSummary>> }) {
  const value = (rate: number | null) => rate == null ? "—" : `${Math.round(rate * 10) / 10}%`;
  return (
    <section className="admin-card analytics-retention">
      <div className="analytics-chart-heading"><div><h2>Returning visitors</h2><p className="admin-help-text">Cohorts are grouped by their first visit. Rates are weighted by cohort size.</p></div></div>
      <div className="analytics-retention-grid">
        <div><span className="admin-help-text">Day-1 return rate</span><strong className="analytics-retention-number">{value(summary.retention.day1ReturnRate)}</strong><span className="admin-help-text">Returned the next day</span></div>
        <div><span className="admin-help-text">Day-7 return rate</span><strong className="analytics-retention-number">{value(summary.retention.day7ReturnRate)}</strong><span className="admin-help-text">Returned seven days later</span></div>
      </div>
      {summary.retention.cohorts.length ? <div className="analytics-cohort-list" aria-label="Recent visitor cohorts">{summary.retention.cohorts.slice(-7).map((cohort) => <div className="analytics-cohort-row" key={cohort.date}><span>{cohort.date}</span><span>{cohort.visitors.toLocaleString()} {cohort.visitors === 1 ? "visitor" : "visitors"}</span><span>Day 1: {value(cohort.day1)}</span><span>Day 7: {value(cohort.day7)}</span></div>)}</div> : <p className="admin-help-text">Retention will appear after Umami has enough cohort data.</p>}
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const summary = await getAnalyticsSummary();
  return (
    <article>
      <div className="admin-heading"><div><Link href="/admin" className="admin-back">← Workspace</Link><h1>Analytics</h1><p>Private, aggregated Umami reporting for {summary.windowLabel.toLowerCase()}.</p></div></div>
      {summary.error ? <div className="admin-card admin-error" role="alert"><h2>Analytics unavailable</h2><p>{summary.error}</p></div> : <>
        <div className="admin-grid analytics-metrics">
          <Metric label="Unique visitors" value={summary.stats.visitors.toLocaleString()} detail="Distinct anonymous visitors in the window" />
          <Metric label="Visits / sessions" value={summary.stats.visits.toLocaleString()} detail="Sessions started in the window" />
          <Metric label="Pageviews" value={summary.stats.pageviews.toLocaleString()} detail="Pages loaded in the window" />
          <Metric label="Active now" value={summary.activeVisitors == null ? "—" : summary.activeVisitors.toLocaleString()} detail="Unique visitors in the last five minutes" />
          <Metric label="Bounce rate" value={summary.stats.bounceRate == null ? "—" : `${summary.stats.bounceRate}%`} detail="Sessions with one pageview" />
          <Metric label="Average visit" value={summary.stats.averageDurationSeconds == null ? "—" : `${summary.stats.averageDurationSeconds}s`} detail="Average session duration" />
        </div>
        <div className="admin-card analytics-chart-card"><TrendChart points={summary.trend} /></div>
        <Retention summary={summary} />
        <div className="admin-grid"><Table title="Top pages" rows={summary.topPages} /><Table title="Top referrers" rows={summary.topReferrers} /><Table title="Events" rows={summary.topEvents} /></div>
        <AnalyticsCockpit visitors={summary.visitors} />
        <p className="admin-help-text">This private page receives bounded, anonymous session summaries and activity paths from Umami; credentials, raw IP addresses, and free-form visitor input never reach the browser. Unique visitors are anonymous Umami counts, not a promise that one person can be recognized across browsers or devices.</p>
      </>}
    </article>
  );
}
