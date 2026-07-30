import { mkdir, writeFile } from "node:fs/promises";

const workbookId = "1KZust31kwsHrv0VZEqyPhACza9R3rZibOdf467c6JXA";
const workbookUrl = `https://docs.google.com/spreadsheets/d/${workbookId}/edit`;

const sheets = {
  voc: "②VOC(결과)",
  delivery: "③-1 신차출고 만족도(결과)",
  testDrive: "③-2시승 만족도(결과)",
  emergency: "③-3긴급경보 처리여부(결과)",
  actionPlan: "③-4조치 계획(결과)",
  app: "③-5헤이볼보 앱 가입율(결과)",
};

const clean = (value) =>
  value === null || value === undefined
    ? ""
    : String(value).replace(/\u00a0/g, " ").trim();

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(clean(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const round1 = (value) => Math.round(value * 10) / 10;

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

async function loadSheet(sheetName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${workbookId}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${sheetName}: Google Sheets 응답 ${response.status}`);
  }

  return parseCsv(await response.text());
}

function weeklyResult(rows, { zeroIsMissing = false } = {}) {
  const headerIndex = rows.findIndex((row) => clean(row[0]) === "RDM코드");
  if (headerIndex < 0) throw new Error("RDM코드 헤더를 찾지 못했습니다.");

  const nationalRow = rows[headerIndex + 1];
  const storeRows = rows
    .slice(headerIndex + 2)
    .filter((row) => clean(row[0]).startsWith("6KR"))
    .slice(0, 39);
  const normalize = (row) =>
    Array.from({ length: 52 }, (_, index) => {
      const value = toNumber(row[index + 5]);
      return zeroIsMissing && value === 0 ? null : value;
    });

  const average = normalize(nationalRow);
  const latestWeek =
    average.reduce(
      (latest, value, index) => (value === null ? latest : index + 1),
      0,
    );

  return {
    latestWeek,
    average,
    byCdsid: Object.fromEntries(
      storeRows.map((row) => [clean(row[0]), normalize(row)]),
    ),
  };
}

function quarterlyResult(rows) {
  const headerIndex = rows.findIndex((row) => clean(row[0]) === "RDM코드");
  if (headerIndex < 0) throw new Error("RDM코드 헤더를 찾지 못했습니다.");
  const storeRows = rows
    .slice(headerIndex + 2)
    .filter((row) => clean(row[0]).startsWith("6KR"))
    .slice(0, 39);
  return Object.fromEntries(
    storeRows.map((row) => [
      clean(row[0]),
      Array.from({ length: 4 }, (_, index) => toNumber(row[index + 5])),
    ]),
  );
}

function deliveryScore(value) {
  if (value === null || value === 0 || value < 80) return 0;
  return value >= 90 ? 40 : 20;
}

function testDriveScore(value) {
  if (value === null || value === 0) return 0;
  if (value >= 90) return 50;
  return value >= 80 ? 40 : 30;
}

function appScore(value) {
  return value !== null && value >= 90 ? 20 : 0;
}

const loaded = Object.fromEntries(
  await Promise.all(
    Object.entries(sheets).map(async ([key, sheetName]) => [
      key,
      await loadSheet(sheetName),
    ]),
  ),
);

const voc = weeklyResult(loaded.voc, { zeroIsMissing: true });
const delivery = weeklyResult(loaded.delivery);
const testDrive = weeklyResult(loaded.testDrive);
const emergency = weeklyResult(loaded.emergency);
const app = weeklyResult(loaded.app);
const actionPlan = quarterlyResult(loaded.actionPlan);

const cxLatestWeek = Math.min(
  delivery.latestWeek,
  testDrive.latestWeek,
  emergency.latestWeek,
  app.latestWeek,
);
const cdsids = Object.keys(delivery.byCdsid);

const cxByCdsid = Object.fromEntries(
  cdsids.map((cdsid) => {
    const values = Array.from({ length: 52 }, (_, index) => {
      const week = index + 1;
      if (week > cxLatestWeek) return null;

      const quarterIndex =
        week <= 13 ? 0 : week <= 26 ? 1 : week <= 39 ? 2 : 3;
      const actionScore = actionPlan[cdsid]?.[quarterIndex] ?? 0;
      const alertScore = emergency.byCdsid[cdsid]?.[index] ?? 0;

      return (
        deliveryScore(delivery.byCdsid[cdsid]?.[index] ?? null) +
        testDriveScore(testDrive.byCdsid[cdsid]?.[index] ?? null) +
        alertScore +
        actionScore +
        appScore(app.byCdsid[cdsid]?.[index] ?? null)
      );
    });

    return [cdsid, values];
  }),
);

const cxAverage = Array.from({ length: 52 }, (_, index) => {
  if (index >= cxLatestWeek) return null;
  const values = cdsids
    .map((cdsid) => cxByCdsid[cdsid][index])
    .filter((value) => value !== null);
  return values.length
    ? round1(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
});

const output = {
  meta: {
    workbookUrl,
    syncedAt: new Date().toISOString(),
    vocLatestWeek: voc.latestWeek,
    cxLatestWeek,
    rules: {
      voc: "0.0은 고객 미응답으로 처리하여 주간 선에서 제외",
      cx:
        "출고 40/20/0 + 시승 50/40/30(미응답 0) + 긴급경보 10/0 + 조치계획 10/0 + 앱 20/0",
    },
  },
  voc: {
    average: voc.average,
    byCdsid: voc.byCdsid,
  },
  cx: {
    average: cxAverage,
    byCdsid: cxByCdsid,
  },
};

await mkdir("app/data", { recursive: true });
await writeFile(
  "app/data/weekly.json",
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(
  `Google Sheet weekly sync complete: VOC W${String(voc.latestWeek).padStart(2, "0")}, ` +
    `CX W${String(cxLatestWeek).padStart(2, "0")}, ${cdsids.length} showrooms`,
);
