import { collectionWindow, hourlySlotKst } from "./korean-business-day.mjs";

const siteUrl = process.env.ONE_VOICE_SITE_URL?.replace(/\/$/, "");
const token = process.env.ONE_VOICE_INGEST_TOKEN;
if (!siteUrl || !token) {
  throw new Error("ONE_VOICE_SITE_URL and ONE_VOICE_INGEST_TOKEN are required");
}

const extraHolidays = (process.env.ONE_VOICE_EXTRA_HOLIDAYS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const window = collectionWindow(new Date(), extraHolidays);
if (!window.allowed) {
  console.log(`ONE VOICE monitor skipped: ${window.reason}`);
  process.exit(0);
}

const slotKst = hourlySlotKst(new Date());
const response = await fetch(`${siteUrl}/api/one-voice`, {
  headers: { Accept: "application/json" },
  cache: "no-store",
});
if (!response.ok) throw new Error(`Dashboard API GET failed: ${response.status}`);
const current = await response.json();
if (current.snapshot?.slotKst === slotKst) {
  console.log(`ONE VOICE hourly slot is complete: ${slotKst}`);
  process.exit(0);
}

const monitorResponse = await fetch(`${siteUrl}/api/one-voice`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ kind: "monitor", slotKst }),
});
if (!monitorResponse.ok) {
  throw new Error(`Dashboard monitor POST failed: ${monitorResponse.status}`);
}
throw new Error(
  `ONE VOICE ${slotKst} snapshot is missing. The local signed-in collector must retry it.`,
);
