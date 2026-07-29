import { isEditorEmail } from "../../permissions";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "text/csv",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

type RuntimeEnv = {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
};

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnv;
}

function authenticatedEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? null;
}

export async function GET() {
  try {
    const { DB } = await runtimeEnv();
    const latest = await DB.prepare(
      `SELECT id, title, note, effective_date AS effectiveDate,
              updated_by AS updatedBy, created_at AS createdAt
       FROM dashboard_updates
       ORDER BY id DESC
       LIMIT 1`,
    ).first<{
      id: number;
      title: string;
      note: string;
      effectiveDate: string;
      updatedBy: string;
      createdAt: string;
    }>();

    if (!latest) return Response.json({ update: null });

    const attachments = await DB.prepare(
      `SELECT filename, content_type AS contentType, size_bytes AS sizeBytes
       FROM dashboard_attachments
       WHERE update_id = ?
       ORDER BY id DESC`,
    )
      .bind(latest.id)
      .all();

    return Response.json({
      update: {
        ...latest,
        attachments: attachments.results,
      },
    });
  } catch {
    return Response.json({ update: null });
  }
}

export async function POST(request: Request) {
  const email = authenticatedEmail(request);
  if (!isEditorEmail(email)) {
    return Response.json(
      { error: "데이터 업데이트 권한이 없습니다." },
      { status: 403 },
    );
  }

  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const effectiveDate = String(form.get("effectiveDate") ?? "").trim();
    const file = form.get("file");

    if (!title || !effectiveDate) {
      return Response.json(
        { error: "업데이트 제목과 적용일을 입력해 주세요." },
        { status: 400 },
      );
    }

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: "첨부파일은 10MB 이하여야 합니다." },
          { status: 400 },
        );
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        return Response.json(
          { error: "CSV, Excel, PDF, PNG, JPG 파일만 첨부할 수 있습니다." },
          { status: 400 },
        );
      }
    }

    const { DB, ATTACHMENTS } = await runtimeEnv();
    const insert = await DB.prepare(
      `INSERT INTO dashboard_updates (title, note, effective_date, updated_by)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(title, note, effectiveDate, email)
      .run();
    const updateId = Number(insert.meta.last_row_id);
    let attachment: { filename: string; sizeBytes: number } | null = null;

    if (file instanceof File && file.size > 0) {
      const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_");
      const objectKey = `dashboard-updates/${updateId}/${crypto.randomUUID()}-${safeName}`;
      await ATTACHMENTS.put(objectKey, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { uploadedBy: email, originalName: file.name },
      });
      await DB.prepare(
        `INSERT INTO dashboard_attachments
          (update_id, object_key, filename, content_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(updateId, objectKey, file.name, file.type, file.size, email)
        .run();
      attachment = { filename: file.name, sizeBytes: file.size };
    }

    return Response.json(
      {
        update: {
          id: updateId,
          title,
          note,
          effectiveDate,
          updatedBy: email,
          attachments: attachment ? [attachment] : [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "업데이트를 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
