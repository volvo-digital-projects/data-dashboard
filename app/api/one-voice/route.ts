type RuntimeEnv = {
  DB: D1Database;
  ONE_VOICE_INGEST_TOKEN?: string;
};

type SnapshotPayload = {
  kind?: "snapshot";
  slotKst?: unknown;
  capturedAt?: unknown;
  testDriveScore?: unknown;
  carHandoverScore?: unknown;
};

type MonitorPayload = {
  kind: "monitor";
  slotKst?: unknown;
};

const SLOT_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:0[9]|1[0-7]):00:00\+09:00$/;

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnv;
}

function json(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return Response.json(payload, { ...init, headers });
}

async function constantTimeEqual(actual: string, expected: string) {
  const encoder = new TextEncoder();
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const actualBytes = new Uint8Array(actualDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

async function authorize(request: Request, token: string | undefined) {
  if (!token) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!supplied) return false;
  return constantTimeEqual(supplied, token);
}

function validScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function validSlot(value: unknown): value is string {
  return typeof value === "string" && SLOT_PATTERN.test(value);
}

export async function GET() {
  try {
    const { DB } = await runtimeEnv();
    const [latest, gapCount] = await Promise.all([
      DB.prepare(
        `SELECT slot_kst AS slotKst,
                captured_at AS capturedAt,
                test_drive_score AS testDriveScore,
                car_handover_score AS carHandoverScore,
                source,
                period
         FROM one_voice_snapshots
         ORDER BY slot_kst DESC
         LIMIT 1`,
      ).first<{
        slotKst: string;
        capturedAt: string;
        testDriveScore: number;
        carHandoverScore: number;
        source: string;
        period: string;
      }>(),
      DB.prepare(
        `SELECT COUNT(*) AS count
         FROM one_voice_sync_gaps
         WHERE status = 'open'`,
      ).first<{ count: number }>(),
    ]);

    return json({
      snapshot: latest ?? null,
      sync: {
        openGapCount: Number(gapCount?.count ?? 0),
      },
    });
  } catch {
    return json({
      snapshot: null,
      sync: { openGapCount: 0, unavailable: true },
    });
  }
}

export async function POST(request: Request) {
  try {
    const env = await runtimeEnv();
    if (!(await authorize(request, env.ONE_VOICE_INGEST_TOKEN))) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16_384) {
      return json({ error: "Payload too large" }, { status: 413 });
    }

    const payload = (await request.json()) as SnapshotPayload | MonitorPayload;
    if (payload.kind === "monitor") {
      if (!validSlot(payload.slotKst)) {
        return json({ error: "Invalid Korea hourly slot" }, { status: 400 });
      }
      const existing = await env.DB.prepare(
        `SELECT slot_kst FROM one_voice_snapshots WHERE slot_kst = ? LIMIT 1`,
      )
        .bind(payload.slotKst)
        .first();

      if (existing) {
        await env.DB.prepare(
          `UPDATE one_voice_sync_gaps
           SET status = 'resolved',
               resolved_at = CURRENT_TIMESTAMP,
               last_checked_at = CURRENT_TIMESTAMP
           WHERE slot_kst = ?`,
        )
          .bind(payload.slotKst)
          .run();
        return json({ missing: false, slotKst: payload.slotKst });
      }

      await env.DB.prepare(
        `INSERT INTO one_voice_sync_gaps
          (slot_kst, reason, status, first_detected_at, last_checked_at)
         VALUES (?, 'hourly-snapshot-missing', 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(slot_kst) DO UPDATE SET
           status = 'open',
           last_checked_at = CURRENT_TIMESTAMP`,
      )
        .bind(payload.slotKst)
        .run();
      return json({ missing: true, slotKst: payload.slotKst });
    }

    if (
      !validSlot(payload.slotKst) ||
      typeof payload.capturedAt !== "string" ||
      !validScore(payload.testDriveScore) ||
      !validScore(payload.carHandoverScore)
    ) {
      return json({ error: "Invalid ONE VOICE snapshot" }, { status: 400 });
    }

    await env.DB.prepare(
      `INSERT INTO one_voice_snapshots
        (slot_kst, captured_at, test_drive_score, car_handover_score, source, period)
       VALUES (?, ?, ?, ?, 'medallia-market-admin', 'last-6-months-to-date')
       ON CONFLICT(slot_kst) DO UPDATE SET
         captured_at = excluded.captured_at,
         test_drive_score = excluded.test_drive_score,
         car_handover_score = excluded.car_handover_score,
         source = excluded.source,
         period = excluded.period`,
    )
      .bind(
        payload.slotKst,
        payload.capturedAt,
        payload.testDriveScore,
        payload.carHandoverScore,
      )
      .run();

    await env.DB.prepare(
      `UPDATE one_voice_sync_gaps
       SET status = 'resolved',
           resolved_at = CURRENT_TIMESTAMP,
           last_checked_at = CURRENT_TIMESTAMP
       WHERE slot_kst = ?`,
    )
      .bind(payload.slotKst)
      .run();

    return json(
      {
        stored: true,
        snapshot: {
          slotKst: payload.slotKst,
          capturedAt: payload.capturedAt,
          testDriveScore: payload.testDriveScore,
          carHandoverScore: payload.carHandoverScore,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unable to store snapshot",
      },
      { status: 500 },
    );
  }
}
