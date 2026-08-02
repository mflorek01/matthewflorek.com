"use client";

import { useMemo, useState } from "react";
import type { AnalyticsVisitor } from "@/lib/analytics/admin";

type Filter = "all" | AnalyticsVisitor["automation"];

function when(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function location(visitor: AnalyticsVisitor) {
  return [visitor.city, visitor.region, visitor.country].filter((value) => value && value !== "—").join(", ") || "Location unavailable";
}

function automationLabel(value: AnalyticsVisitor["automation"]) {
  if (value === "likely") return "Likely automation";
  if (value === "possible") return "Possible automation";
  return "Lower automation signal";
}

export function AnalyticsCockpit({ visitors }: { visitors: AnalyticsVisitor[] }) {
  const [selectedKey, setSelectedKey] = useState(visitors[0]?.recordKey ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredVisitors = useMemo(() => visitors.filter((visitor) => {
    if (filter !== "all" && visitor.automation !== filter) return false;
    if (!normalizedQuery) return true;
    return [visitor.recordKey, visitor.browser, visitor.os, visitor.device, visitor.screen, visitor.language, visitor.country, visitor.region, visitor.city, ...visitor.activity.map((item) => `${item.path} ${item.referrer} ${item.event}`)].join(" ").toLowerCase().includes(normalizedQuery);
  }), [filter, normalizedQuery, visitors]);
  const activity = useMemo(() => filteredVisitors.flatMap((visitor) => visitor.activity.map((item, index) => ({ visitor, item, index }))).sort((left, right) => right.item.createdAt.localeCompare(left.item.createdAt)), [filteredVisitors]);
  const selected = visitors.find((visitor) => visitor.recordKey === selectedKey) ?? filteredVisitors[0] ?? visitors[0];

  return (
    <section className="analytics-cockpit" aria-labelledby="visitor-cockpit-title">
      <div className="admin-card-heading analytics-cockpit-heading">
        <div>
          <h2 id="visitor-cockpit-title">Visitor cockpit</h2>
          <p className="admin-help-text">Detailed anonymous records from Umami. Click a visitor or activity row; every matching instance stays highlighted.</p>
        </div>
        <span className="analytics-cockpit-count">{visitors.length} record{visitors.length === 1 ? "" : "s"}</span>
      </div>
      <div className="analytics-cockpit-controls">
        <label className="analytics-search">Search records<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="city, browser, path, event…" /></label>
        <label className="analytics-filter">Signal filter<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">All records</option><option value="lower">Lower automation signal</option><option value="possible">Possible automation</option><option value="likely">Likely automation</option></select></label>
      </div>
      {!visitors.length ? <p className="admin-help-text">No visitor records are available in this window.</p> : (
        <div className="analytics-cockpit-grid">
          <div className="analytics-visitor-roster" aria-label="Visitor records">
            {filteredVisitors.length ? filteredVisitors.map((visitor) => (
              <button key={visitor.recordKey} type="button" className={`analytics-visitor-row ${visitor.recordKey === selectedKey ? "is-selected" : ""} analytics-visitor-row-signal-${visitor.automation}`} onClick={() => setSelectedKey(visitor.recordKey)} aria-pressed={visitor.recordKey === selectedKey}>
                <span className="analytics-visitor-row-top"><strong>#{visitor.recordKey}</strong><span className={`analytics-signal analytics-signal-${visitor.automation}`}>{automationLabel(visitor.automation)}</span></span>
                <span>{location(visitor)}</span>
                <span>{visitor.browser} · {visitor.os} · {visitor.device} · {visitor.screen}</span>
                <span>{visitor.views} views · {visitor.visits} visits · {visitor.events} events</span>
                <small>{when(visitor.firstAt)} → {when(visitor.lastAt)}</small>
              </button>
            )) : <p className="admin-help-text">No records match this filter.</p>}
          </div>
          <div className="analytics-visitor-detail">
            {selected ? <>
              <div className="analytics-detail-heading"><div><span className="admin-help-text">Selected record</span><h3>#{selected.recordKey}</h3></div><span className={`analytics-signal analytics-signal-${selected.automation}`}>{automationLabel(selected.automation)}</span></div>
              <dl className="analytics-facts">
                <div><dt>Location</dt><dd>{location(selected)}</dd></div>
                <div><dt>Environment</dt><dd>{selected.browser} · {selected.os} · {selected.device}</dd></div>
                <div><dt>Viewport</dt><dd>{selected.screen}</dd></div>
                <div><dt>Language</dt><dd>{selected.language}</dd></div>
                <div><dt>Activity</dt><dd>{selected.views} views · {selected.visits} visits · {selected.events} events</dd></div>
                <div><dt>Seen</dt><dd>{when(selected.firstAt)} → {when(selected.lastAt)}</dd></div>
              </dl>
              <div className="analytics-signal-list"><strong>Why this classification</strong>{selected.signals.map((signal) => <span key={signal}>{signal}</span>)}</div>
            </> : <p className="admin-help-text">Select a record to inspect it.</p>}
          </div>
        </div>
      )}
      <div className="analytics-activity-stream">
        <div className="admin-card-heading"><div><h3>All visitor activity</h3><p className="admin-help-text">Pageviews and tracked events, newest first. The visitor key is opaque and private to this dashboard.</p></div></div>
        {activity.length ? <div className="analytics-activity-list">{activity.map(({ visitor, item, index }) => <button key={`${visitor.recordKey}-${item.createdAt}-${item.path}-${index}`} type="button" className={`analytics-activity-row ${visitor.recordKey === selectedKey ? "is-selected" : ""}`} onClick={() => setSelectedKey(visitor.recordKey)} aria-pressed={visitor.recordKey === selectedKey}><span className="analytics-activity-time">{when(item.createdAt)}</span><span className="analytics-activity-record">#{visitor.recordKey}</span><span>{item.event === "pageview" ? item.path : item.event}</span><span>{item.referrer !== "—" ? `from ${item.referrer}` : item.path}</span></button>)}</div> : <p className="admin-help-text">No activity matches the current filter.</p>}
      </div>
      <p className="admin-help-text analytics-cockpit-note">Automation labels are heuristics, not proof. Umami provides anonymous browser, device, location, timing, page, referrer, and event information; it does not identify a person or expose a raw IP address here.</p>
    </section>
  );
}
