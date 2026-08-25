import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const dashboardUpdates = sqliteTable("dashboard_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  note: text("note").notNull().default(""),
  effectiveDate: text("effective_date").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dashboardAttachments = sqliteTable("dashboard_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  updateId: integer("update_id")
    .notNull()
    .references(() => dashboardUpdates.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oneVoiceSnapshots = sqliteTable("one_voice_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slotKst: text("slot_kst").notNull().unique(),
  capturedAt: text("captured_at").notNull(),
  testDriveScore: real("test_drive_score").notNull(),
  carHandoverScore: real("car_handover_score").notNull(),
  source: text("source").notNull().default("medallia-market-admin"),
  period: text("period").notNull().default("last-6-months-to-date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oneVoiceSyncGaps = sqliteTable("one_voice_sync_gaps", {
  slotKst: text("slot_kst").primaryKey(),
  reason: text("reason").notNull().default("hourly-snapshot-missing"),
  status: text("status").notNull().default("open"),
  firstDetectedAt: text("first_detected_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  lastCheckedAt: text("last_checked_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  resolvedAt: text("resolved_at"),
});

export const dashboardLoginVisitors = sqliteTable("dashboard_login_visitors", {
  visitorHash: text("visitor_hash").primaryKey(),
  firstSeenAt: text("first_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
