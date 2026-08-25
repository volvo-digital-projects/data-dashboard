export type LoginStats = {
  today: number;
  cumulative: number;
};

type RuntimeEnv = {
  DB?: D1Database;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  LOGIN_STATS_HASH_SALT?: string;
};

type SupabaseStatsRow = {
  today_visitors?: unknown;
  total_visitors?: unknown;
};

const EMPTY_STATS: LoginStats = { today: 0, cumulative: 0 };
const SUPABASE_TIMEOUT_MS = 2_500;

async function runtimeEnv() {
  try {
    const { env } = await import("cloudflare:workers");
    return env as unknown as RuntimeEnv;
  } catch {
    return {} as RuntimeEnv;
  }
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : null;
}

function normalizeStats(row: SupabaseStatsRow | null | undefined) {
  if (!row) return null;
  const today = normalizeCount(row.today_visitors);
  const cumulative = normalizeCount(row.total_visitors);
  return today === null || cumulative === null ? null : { today, cumulative };
}

async function hashCdsid(cdsid: string, salt: string) {
  const input = new TextEncoder().encode(`${salt}:${cdsid.trim().toUpperCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function supabaseRpc(
  env: RuntimeEnv,
  functionName: string,
  body: Record<string, string> = {},
) {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const apiKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apiKey) return null;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as SupabaseStatsRow[] | SupabaseStatsRow;
    return normalizeStats(Array.isArray(payload) ? payload[0] : payload);
  } catch {
    return null;
  }
}

async function getD1Stats(DB: D1Database | undefined) {
  if (!DB) return null;
  try {
    const row = await DB.prepare(
      `SELECT COUNT(*) AS total_visitors,
              SUM(CASE
                    WHEN date(last_seen_at, '+9 hours') = date('now', '+9 hours')
                    THEN 1 ELSE 0
                  END) AS today_visitors
       FROM dashboard_login_visitors`,
    ).first<SupabaseStatsRow>();
    return normalizeStats(row);
  } catch {
    return null;
  }
}

async function recordD1Visit(DB: D1Database | undefined, visitorHash: string) {
  if (!DB) return null;
  try {
    await DB.prepare(
      `INSERT INTO dashboard_login_visitors
         (visitor_hash, first_seen_at, last_seen_at)
       VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(visitor_hash) DO UPDATE SET
         last_seen_at = CURRENT_TIMESTAMP`,
    )
      .bind(visitorHash)
      .run();
    return getD1Stats(DB);
  } catch {
    return null;
  }
}

export async function getLoginStats(): Promise<LoginStats> {
  const env = await runtimeEnv();
  const [supabaseStats, d1Stats] = await Promise.all([
    supabaseRpc(env, "get_volvo_dashboard_visit_stats"),
    getD1Stats(env.DB),
  ]);
  return supabaseStats ?? d1Stats ?? EMPTY_STATS;
}

export async function recordLoginVisit(cdsid: string): Promise<LoginStats> {
  const env = await runtimeEnv();
  const salt = env.LOGIN_STATS_HASH_SALT?.trim();
  if (!salt) return getLoginStats();

  const visitorHash = await hashCdsid(cdsid, salt);
  const [supabaseStats, d1Stats] = await Promise.all([
    supabaseRpc(env, "record_volvo_dashboard_visit", {
      p_visitor_hash: visitorHash,
    }),
    recordD1Visit(env.DB, visitorHash),
  ]);
  return supabaseStats ?? d1Stats ?? EMPTY_STATS;
}
