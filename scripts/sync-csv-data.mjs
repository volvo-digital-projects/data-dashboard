import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , q1Path, q2Path] = process.argv;

if (!q1Path || !q2Path) {
  throw new Error("Usage: node scripts/sync-csv-data.mjs <q1.csv> <q2.csv>");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

const numberAt = (row, index) => {
  const value = Number.parseFloat(row[index] ?? "");
  return Number.isFinite(value) ? value : null;
};

function quarterData(rows) {
  const records = rows
    .slice(7)
    .filter((row) => row[0]?.startsWith("6KR"))
    .map((row) => ({
      cdsid: row[0].trim(),
      showroom: row[1].trim(),
      dealer: row[2].trim(),
      manager: row[3].trim(),
      size: row[4].trim(),
      region: row[5].trim(),
      combat: numberAt(row, 6),
      v3s: numberAt(row, 11),
      vocWeekly: numberAt(row, 16),
      voc: numberAt(row, 17),
      cx: numberAt(row, 22),
      deliveryWeekly: numberAt(row, 27),
      delivery: numberAt(row, 28),
      testDriveWeekly: numberAt(row, 32),
      testDrive: numberAt(row, 33),
      emergencyWeekly: numberAt(row, 37),
      emergency: numberAt(row, 38),
      actionPlan: numberAt(row, 42),
      appWeekly: numberAt(row, 46),
      app: numberAt(row, 47),
      happyCallWeekly: numberAt(row, 51),
      happyCall: numberAt(row, 52),
    }));

  return {
    records,
    sourceWeek: rows[2]?.[1] ?? "",
    quarter: rows[2]?.[6] ?? "",
    startDate: rows[4]?.[2] ?? "",
    endDate: rows[4]?.[3] ?? "",
    averages: {
      v3s: numberAt(rows[4], 11),
      vocWeekly: numberAt(rows[4], 16),
      voc: numberAt(rows[4], 17),
      cx: numberAt(rows[4], 22),
      deliveryWeekly: numberAt(rows[4], 27),
      delivery: numberAt(rows[4], 28),
      testDriveWeekly: numberAt(rows[4], 32),
      testDrive: numberAt(rows[4], 33),
      emergencyWeekly: numberAt(rows[4], 37),
      emergency: numberAt(rows[4], 38),
      actionPlan: numberAt(rows[4], 42),
      appWeekly: numberAt(rows[4], 46),
      app: numberAt(rows[4], 47),
      happyCallWeekly: numberAt(rows[4], 51),
      happyCall: numberAt(rows[4], 52),
    },
  };
}

const [q1Text, q2Text] = await Promise.all([
  readFile(q1Path, "utf8"),
  readFile(q2Path, "utf8"),
]);

const q1 = quarterData(parseCsv(q1Text.replace(/^\uFEFF/, "")));
const q2 = quarterData(parseCsv(q2Text.replace(/^\uFEFF/, "")));
const q1ById = new Map(q1.records.map((record) => [record.cdsid, record]));

const showrooms = q2.records.map((record) => ({
  ...record,
  q1: q1ById.get(record.cdsid) ?? null,
}));

const combatAverage =
  showrooms.reduce((sum, item) => sum + (item.combat ?? 0), 0) /
  showrooms.length;

const output = {
  meta: {
    showroomCount: showrooms.length,
    quarter: q2.quarter,
    sourceWeek: q2.sourceWeek,
    startDate: q2.startDate,
    endDate: q2.endDate,
    combatMax: 330,
    combatAverage: Number(combatAverage.toFixed(1)),
    generatedFrom: [path.basename(q1Path), path.basename(q2Path)],
  },
  averages: q2.averages,
  showrooms,
};

await mkdir("app/data", { recursive: true });
await writeFile(
  "app/data/showrooms.json",
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(
  `Synced ${showrooms.length} showrooms (${q1.quarter} + ${q2.quarter})`,
);
