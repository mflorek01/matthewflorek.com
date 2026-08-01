export type AnalyticsRow = { label: string; value: number };
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
  topPages: AnalyticsRow[];
  topReferrers: AnalyticsRow[];
  topEvents: AnalyticsRow[];
  error?: string;
};
type UmamiConfig = {
  baseUrl: string;
  websiteId: string;
  username: string;
  password: string;
};
type UmamiResponse = Record<string, unknown> | Array<Record<string, unknown>>;

export function getUmamiAdminConfig(
  env: Record<string, string | undefined> = process.env,
): UmamiConfig | null {
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
const numeric = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
function rows(value: unknown): AnalyticsRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const label = typeof item.x === "string" ? item.x : "";
    return label
      ? [{ label: label.slice(0, 120), value: numeric(item.y) }]
      : [];
  });
}
export function normalizeAnalyticsSummary(input: {
  stats: Record<string, unknown>;
  active: Record<string, unknown> | null;
  pages: UmamiResponse;
  referrers: UmamiResponse;
  events: UmamiResponse;
}): AnalyticsSummary {
  const { stats, active } = input;
  const visits = numeric(stats.visits);
  const bounces = numeric(stats.bounces);
  const totalTime = numeric(stats.totaltime);
  return {
    windowLabel: "Last 30 days",
    stats: {
      visitors: numeric(stats.visitors),
      visits,
      pageviews: numeric(stats.pageviews),
      bounceRate: visits ? Math.round((bounces / visits) * 1000) / 10 : null,
      averageDurationSeconds: visits ? Math.round(totalTime / visits) : null,
    },
    activeVisitors: active ? numeric(active.visitors) : null,
    topPages: rows(input.pages),
    topReferrers: rows(input.referrers),
    topEvents: rows(input.events),
  };
}
async function umamiFetch(
  config: UmamiConfig,
  token: string,
  path: string,
  params: Record<string, string> = {},
): Promise<UmamiResponse> {
  const url = new URL(`${config.baseUrl}/api${path}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Umami request failed (${response.status})`);
  return response.json() as Promise<UmamiResponse>;
}
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const empty = {
    windowLabel: "Last 30 days",
    stats: {
      visitors: 0,
      visits: 0,
      pageviews: 0,
      bounceRate: null,
      averageDurationSeconds: null,
    },
    activeVisitors: null,
    topPages: [],
    topReferrers: [],
    topEvents: [],
  };
  const config = getUmamiAdminConfig();
  if (!config)
    return {
      ...empty,
      error:
        "Analytics is not configured for the admin area. Add the server-only Umami API settings and redeploy.",
    };
  const endAt = Date.now();
  const range = {
    startAt: String(endAt - 30 * 24 * 60 * 60 * 1000),
    endAt: String(endAt),
  };
  try {
    const loginResponse = await fetch(`${config.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username: config.username,
        password: config.password,
      }),
      cache: "no-store",
    });
    if (!loginResponse.ok) throw new Error("Umami credentials were rejected");
    const login = (await loginResponse.json()) as { token?: string };
    if (!login.token) throw new Error("Umami did not return an API token");
    const [stats, active, pages, referrers, events] = await Promise.all([
      umamiFetch(
        config,
        login.token,
        `/websites/${config.websiteId}/stats`,
        range,
      ),
      umamiFetch(config, login.token, `/websites/${config.websiteId}/active`),
      umamiFetch(config, login.token, `/websites/${config.websiteId}/metrics`, {
        ...range,
        type: "path",
        limit: "8",
      }),
      umamiFetch(config, login.token, `/websites/${config.websiteId}/metrics`, {
        ...range,
        type: "referrer",
        limit: "8",
      }),
      umamiFetch(config, login.token, `/websites/${config.websiteId}/metrics`, {
        ...range,
        type: "event",
        limit: "8",
      }),
    ]);
    return normalizeAnalyticsSummary({
      stats: stats as Record<string, unknown>,
      active: active as Record<string, unknown>,
      pages,
      referrers,
      events,
    });
  } catch (error) {
    return {
      ...empty,
      error:
        error instanceof Error
          ? error.message
          : "Analytics is temporarily unavailable.",
    };
  }
}
