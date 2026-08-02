export type AnalyticsRow = { label: string; value: number };
export type AnalyticsTrendPoint = { date: string; visitors: number; visits: number; pageviews: number };
export type AnalyticsRetentionCohort = { date: string; visitors: number; day1: number | null; day7: number | null };
export type AnalyticsSummary = {
  windowLabel: string;
  stats: {
    visitors: number;
    visits: number;
    pageviews: number;
    bounceRate: number | null;
    averageDurationSeconds: number | null;
  };
  activeVisitors: number | null;
  trend: AnalyticsTrendPoint[];
  retention: {
    day1ReturnRate: number | null;
    day7ReturnRate: number | null;
    cohorts: AnalyticsRetentionCohort[];
  };
  topPages: AnalyticsRow[];
  topReferrers: AnalyticsRow[];
  topEvents: AnalyticsRow[];
  error?: string;
};
type UmamiConfig = { baseUrl: string; websiteId: string; username: string; password: string };
type UmamiResponse = Record<string, unknown> | Array<Record<string, unknown>>;

export function getUmamiAdminConfig(env: Record<string, string | undefined> = process.env): UmamiConfig | null {
  const baseUrl = (env.UMAMI_API_URL || "").trim().replace(/\/$/, "");
  const websiteId = (env.UMAMI_WEBSITE_ID || "").trim();
  const username = (env.UMAMI_API_USERNAME || "").trim();
  const password = env.UMAMI_API_PASSWORD || "";
  if (!baseUrl || !websiteId || !username || !password) return null;
  try {
    const url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
  } catch {
    return null;
  }
  return { baseUrl, websiteId, username, password };
}

const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
function dateLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
}
function rows(value: unknown): AnalyticsRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const label = typeof item.x === "string" ? item.x : "";
    return label ? [{ label: label.slice(0, 120), value: numeric(item.y) }] : [];
  });
}
function series(value: unknown): Array<{ date: string; value: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const date = typeof item.x === "string" ? item.x : "";
    return date ? [{ date, value: numeric(item.y) }] : [];
  });
}
function retentionRows(value: unknown): AnalyticsRetentionCohort[] {
  if (!Array.isArray(value)) return [];
  const cohorts = new Map<string, { visitors: number; day1: number | null; day7: number | null }>();
  value.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const item = row as Record<string, unknown>;
    const date = typeof item.date === "string" ? dateLabel(item.date) : "";
    const day = numeric(item.day);
    if (!date || ![0, 1, 7].includes(day)) return;
    const cohort = cohorts.get(date) ?? { visitors: 0, day1: null, day7: null };
    if (day === 0) cohort.visitors = numeric(item.visitors);
    if (day === 1) cohort.day1 = numeric(item.percentage);
    if (day === 7) cohort.day7 = numeric(item.percentage);
    cohorts.set(date, cohort);
  });
  return [...cohorts.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-30).map(([date, cohort]) => ({ date, ...cohort }));
}
function weightedRetentionRate(cohorts: AnalyticsRetentionCohort[], key: "day1" | "day7") {
  const eligible = cohorts.filter((cohort) => cohort.visitors > 0 && cohort[key] != null);
  const denominator = eligible.reduce((sum, cohort) => sum + cohort.visitors, 0);
  if (!denominator) return null;
  return Math.round((eligible.reduce((sum, cohort) => sum + cohort.visitors * (cohort[key] ?? 0), 0) / denominator) * 10) / 10;
}

export function normalizeAnalyticsSummary(input: {
  stats: Record<string, unknown>;
  active: Record<string, unknown> | null;
  pages: UmamiResponse;
  referrers: UmamiResponse;
  events: UmamiResponse;
  trend?: AnalyticsTrendPoint[];
  retention?: unknown;
}): AnalyticsSummary {
  const { stats, active } = input;
  const visits = numeric(stats.visits);
  const cohorts = retentionRows(input.retention);
  return {
    windowLabel: "Last 30 days",
    stats: {
      visitors: numeric(stats.visitors),
      visits,
      pageviews: numeric(stats.pageviews),
      bounceRate: visits ? Math.round((numeric(stats.bounces) / visits) * 1000) / 10 : null,
      averageDurationSeconds: visits ? Math.round(numeric(stats.totaltime) / visits) : null,
    },
    activeVisitors: active ? numeric(active.visitors) : null,
    trend: input.trend ?? [],
    retention: {
      day1ReturnRate: weightedRetentionRate(cohorts, "day1"),
      day7ReturnRate: weightedRetentionRate(cohorts, "day7"),
      cohorts,
    },
    topPages: rows(input.pages),
    topReferrers: rows(input.referrers),
    topEvents: rows(input.events),
  };
}

async function umamiFetch(config: UmamiConfig, token: string, path: string, params: Record<string, string> = {}): Promise<UmamiResponse> {
  const url = new URL(`${config.baseUrl}/api${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Umami request failed (${response.status})`);
  return response.json() as Promise<UmamiResponse>;
}
async function umamiPost(config: UmamiConfig, token: string, path: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${config.baseUrl}/api${path}`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Umami request failed (${response.status})`);
  return response.json();
}
function emptySummary(): Omit<AnalyticsSummary, "error"> {
  return {
    windowLabel: "Last 30 days",
    stats: { visitors: 0, visits: 0, pageviews: 0, bounceRate: null, averageDurationSeconds: null },
    activeVisitors: null,
    trend: [],
    retention: { day1ReturnRate: null, day7ReturnRate: null, cohorts: [] },
    topPages: [],
    topReferrers: [],
    topEvents: [],
  };
}
function rangeForDay(day: number, endAt: number) {
  const dayEnd = endAt - day * 24 * 60 * 60 * 1000;
  return { startAt: String(dayEnd - 24 * 60 * 60 * 1000), endAt: String(dayEnd) };
}
async function getDailyTrend(config: UmamiConfig, token: string, endAt: number): Promise<AnalyticsTrendPoint[]> {
  const pageviewRange = { startAt: String(endAt - 30 * 24 * 60 * 60 * 1000), endAt: String(endAt), unit: "day", timezone: "UTC" };
  const [pageviewSeries, dailyStats] = await Promise.all([
    umamiFetch(config, token, `/websites/${config.websiteId}/pageviews`, pageviewRange),
    Promise.all(Array.from({ length: 30 }, (_, day) => umamiFetch(config, token, `/websites/${config.websiteId}/stats`, rangeForDay(day, endAt)).then((stats) => ({ day, stats })))),
  ]);
  const pageviews = pageviewSeries as Record<string, unknown>;
  const pageviewRows = new Map(series(pageviews.pageviews).map((row) => [dateLabel(row.date), row.value]));
  const sessionRows = new Map(series(pageviews.sessions).map((row) => [dateLabel(row.date), row.value]));
  return dailyStats.map(({ day, stats }) => {
    const item = stats as Record<string, unknown>;
    const date = dateLabel(new Date(endAt - (day + 1) * 24 * 60 * 60 * 1000).toISOString());
    return { date, visitors: numeric(item.visitors), visits: numeric(item.visits) || sessionRows.get(date) || 0, pageviews: pageviewRows.get(date) ?? numeric(item.pageviews) };
  }).sort((left, right) => left.date.localeCompare(right.date));
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const empty = emptySummary();
  const config = getUmamiAdminConfig();
  if (!config) return { ...empty, error: "Analytics is not configured for the admin area. Add the server-only Umami API settings and redeploy." };
  const endAt = Date.now();
  const range = { startAt: String(endAt - 30 * 24 * 60 * 60 * 1000), endAt: String(endAt) };
  try {
    const loginResponse = await fetch(`${config.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username: config.username, password: config.password }),
      cache: "no-store",
    });
    if (!loginResponse.ok) throw new Error("Umami credentials were rejected");
    const login = (await loginResponse.json()) as { token?: string };
    if (!login.token) throw new Error("Umami did not return an API token");
    const [stats, active, pages, referrers, events, trend, retention] = await Promise.all([
      umamiFetch(config, login.token, `/websites/${config.websiteId}/stats`, range),
      umamiFetch(config, login.token, `/websites/${config.websiteId}/active`),
      umamiFetch(config, login.token, `/websites/${config.websiteId}/metrics`, { ...range, type: "path", limit: "8" }),
      umamiFetch(config, login.token, `/websites/${config.websiteId}/metrics`, { ...range, type: "referrer", limit: "8" }),
      umamiFetch(config, login.token, `/websites/${config.websiteId}/metrics`, { ...range, type: "event", limit: "8" }),
      getDailyTrend(config, login.token, endAt),
      umamiPost(config, login.token, "/reports/retention", {
        websiteId: config.websiteId,
        type: "retention",
        filters: {},
        parameters: { startDate: new Date(endAt - 30 * 24 * 60 * 60 * 1000).toISOString(), endDate: new Date(endAt).toISOString(), timezone: "UTC" },
      }),
    ]);
    return normalizeAnalyticsSummary({ stats: stats as Record<string, unknown>, active: active as Record<string, unknown>, pages, referrers, events, trend, retention });
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "Analytics is temporarily unavailable." };
  }
}
