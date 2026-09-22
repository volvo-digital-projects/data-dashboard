import { mkdir, writeFile } from "node:fs/promises";

const workbookId = "1KZust31kwsHrv0VZEqyPhACza9R3rZibOdf467c6JXA";

const sheets = {
  dates: "DB_날짜(참고)",
  voc: "②VOC(결과)",
  vocOverall: "01☆VOC종합만족도(60%)",
  vocGreeting: "02☆VOC첫인사(20%)",
  vocTablet: "03☆VOC태블릿(10%)",
  vocHappyCall: "04☆VOC해피콜(10%)",
  vocSent: "☆VOC 발송건수",
  delivery: "③-1 신차출고 만족도(결과)",
  testDrive: "③-2시승 만족도(결과)",
  emergency: "③-3긴급경보 처리여부(결과)",
  actionPlan: "③-4조치 계획(결과)",
  app: "③-5헤이볼보 앱 가입율(결과)",
  appRegistered: "08☆헤이볼보 앱 가입고객수",
  appEligible: "09☆헤이볼보 앱 전체고객 수",
  newCarHappyCall: "10☆신차해피콜 이행율",
  newCarHappyCallResponses: "11☆신차해피콜 총회신건수",
  newCarHappyCallIssued: "12☆신차해피콜 총발행건수",
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

const formatCompactDate = (value) => {
  const compact = clean(value).match(/\d{6}/)?.[0];
  if (!compact) return null;
  return `${compact.slice(0, 2)}.${compact.slice(2, 4)}.${compact.slice(4, 6)}`;
};

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

function weekRangesResult(rows) {
  const headerIndex = rows.findIndex(
    (row) => clean(row[0]) === "2026년 기준 주간",
  );
  if (headerIndex < 0) {
    throw new Error("DB_날짜(참고)에서 주간 헤더를 찾지 못했습니다.");
  }

  const ranges = rows
    .slice(headerIndex + 1)
    .filter((row) => /^26W\d{2}$/.test(clean(row[0])))
    .slice(0, 52)
    .map((row, index) => ({
      week: index + 1,
      start: formatCompactDate(row[1]),
      end: formatCompactDate(row[2]),
    }));

  if (
    ranges.length !== 52 ||
    ranges.some((range) => range.start === null || range.end === null)
  ) {
    throw new Error("DB_날짜(참고)의 W01~W52 날짜가 완전하지 않습니다.");
  }

  return ranges;
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
  const byCdsid = Object.fromEntries(
    storeRows.map((row) => [clean(row[0]), normalize(row)]),
  );
  const nationalLatestWeek =
    average.reduce(
      (latest, value, index) => (value === null ? latest : index + 1),
      0,
    );
  const storeSeries = Object.values(byCdsid);
  const storeLatestWeek = Array.from({ length: 52 }, (_, index) => index)
    .reduce(
      (latest, index) =>
        storeSeries.length === 39 &&
        storeSeries.every((values) => values[index] !== null)
          ? index + 1
          : latest,
      0,
    );

  return {
    latestWeek: Math.max(nationalLatestWeek, storeLatestWeek),
    nationalLatestWeek,
    average,
    byCdsid,
  };
}

function fillNationalRateFromCounts(result, numerator, denominator) {
  const average = result.average.map((value, index) => {
    if (value !== null) return value;

    const numeratorValue = numerator.average[index];
    const denominatorValue = denominator.average[index];
    if (
      numeratorValue === null ||
      denominatorValue === null ||
      denominatorValue <= 0
    ) {
      return null;
    }

    return round1((numeratorValue / denominatorValue) * 100);
  });
  const nationalLatestWeek = average.reduce(
    (latest, value, index) => (value === null ? latest : index + 1),
    0,
  );

  return {
    ...result,
    average,
    nationalLatestWeek,
    latestWeek: Math.max(result.latestWeek, nationalLatestWeek),
  };
}

function quarterlyResult(rows, { useLastHeader = false } = {}) {
  const headerIndex = useLastHeader
    ? rows.findLastIndex((row) => clean(row[0]) === "RDM코드")
    : rows.findIndex((row) => clean(row[0]) === "RDM코드");
  if (headerIndex < 0) throw new Error("RDM코드 헤더를 찾지 못했습니다.");
  const nationalRow = rows[headerIndex + 1];
  const storeRows = rows
    .slice(headerIndex + 2)
    .filter((row) => clean(row[0]).startsWith("6KR"))
    .slice(0, 39);
  const normalize = (row) =>
    Array.from({ length: 4 }, (_, index) => toNumber(row[index + 5]));

  return {
    average: normalize(nationalRow),
    byCdsid: Object.fromEntries(
      storeRows.map((row) => [clean(row[0]), normalize(row)]),
    ),
  };
}

function expandQuarterlyResult(result) {
  const expand = (values) =>
    Array.from({ length: 52 }, (_, index) => values[Math.floor(index / 13)] ?? null);
  const latestQuarter = result.average.reduce(
    (latest, value, index) => (value === null ? latest : index + 1),
    0,
  );

  return {
    latestWeek: latestQuarter * 13,
    average: expand(result.average),
    byCdsid: Object.fromEntries(
      Object.entries(result.byCdsid).map(([cdsid, values]) => [cdsid, expand(values)]),
    ),
  };
}

const loaded = Object.fromEntries(
  await Promise.all(
    Object.entries(sheets).map(async ([key, sheetName]) => [
      key,
      await loadSheet(sheetName),
    ]),
  ),
);

const weekRanges = weekRangesResult(loaded.dates);
const voc = weeklyResult(loaded.voc);
const vocOverall = weeklyResult(loaded.vocOverall);
const vocGreeting = weeklyResult(loaded.vocGreeting);
const vocTablet = weeklyResult(loaded.vocTablet);
const vocHappyCall = weeklyResult(loaded.vocHappyCall);
const vocSent = weeklyResult(loaded.vocSent);
const vocSentMax = Math.max(
  1,
  ...Object.values(vocSent.byCdsid)
    .flat()
    .filter((value) => typeof value === "number"),
);
const delivery = weeklyResult(loaded.delivery);
const testDrive = weeklyResult(loaded.testDrive);
const emergency = weeklyResult(loaded.emergency);
const appRegistered = weeklyResult(loaded.appRegistered);
const appEligible = weeklyResult(loaded.appEligible);
const app = fillNationalRateFromCounts(
  weeklyResult(loaded.app),
  appRegistered,
  appEligible,
);
const newCarHappyCallResponses = weeklyResult(
  loaded.newCarHappyCallResponses,
);
const newCarHappyCallIssued = weeklyResult(loaded.newCarHappyCallIssued);
const newCarHappyCall = fillNationalRateFromCounts(
  weeklyResult(loaded.newCarHappyCall),
  newCarHappyCallResponses,
  newCarHappyCallIssued,
);
const newCarHappyCallQuarters = quarterlyResult(loaded.newCarHappyCall, {
  useLastHeader: true,
});
const actionPlan = quarterlyResult(loaded.actionPlan);
const actionPlanWeekly = expandQuarterlyResult(actionPlan);
const syncedAt = new Date().toISOString();

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
      const actionScore = actionPlan.byCdsid[cdsid]?.[quarterIndex] ?? 0;
      const parts = [
        delivery.byCdsid[cdsid]?.[index],
        testDrive.byCdsid[cdsid]?.[index],
        emergency.byCdsid[cdsid]?.[index],
        actionScore,
        app.byCdsid[cdsid]?.[index],
      ];
      if (parts.some((value) => value === null || value === undefined)) return null;

      return round1(parts.reduce((sum, value) => sum + value, 0));
    });

    return [cdsid, values];
  }),
);

const cxAverage = Array.from({ length: 52 }, (_, index) => {
  if (index >= cxLatestWeek) return null;
  const week = index + 1;
  const quarterIndex =
    week <= 13 ? 0 : week <= 26 ? 1 : week <= 39 ? 2 : 3;
  const parts = [
    delivery.average[index],
    testDrive.average[index],
    emergency.average[index],
    actionPlan.average[quarterIndex],
    app.average[index],
  ];
  if (parts.some((value) => value === null || value === undefined)) return null;

  return round1(parts.reduce((sum, value) => sum + value, 0));
});

const output = {
  meta: {
    syncedAt,
    vocLatestWeek: voc.latestWeek,
    cxLatestWeek,
    weekRanges,
    rules: {
      voc:
        "VOC(결과) 시트의 전시장별 원점수를 사용하며, 0.0도 실제 점수로 표시",
      cx:
        "신차출고 100점 + 시승 100점 + 긴급경보 10점 + 조치계획 10점 + 앱 가입율 100점의 원점수 합산(총 320점)",
    },
  },
  voc: {
    average: voc.average,
    byCdsid: voc.byCdsid,
  },
  happyCall: {
    newCar: {
      average: newCarHappyCall.average,
      byCdsid: newCarHappyCall.byCdsid,
      quarters: newCarHappyCallQuarters,
      responses: {
        average: newCarHappyCallResponses.average,
        byCdsid: newCarHappyCallResponses.byCdsid,
      },
      issued: {
        average: newCarHappyCallIssued.average,
        byCdsid: newCarHappyCallIssued.byCdsid,
      },
    },
  },
  cx: {
    average: cxAverage,
    byCdsid: cxByCdsid,
  },
};

const detailsOutput = {
  meta: {
    syncedAt,
    weekRanges,
  },
  voc: {
    label: "VOC",
    components: [
      {
        key: "overall",
        label: "VOC 종합만족도",
        weight: "60점",
        max: 100,
        unit: "점",
        cadence: "weekly",
        ...vocOverall,
      },
      {
        key: "greeting",
        label: "VOC 첫인사",
        weight: "20점",
        max: 100,
        unit: "점",
        cadence: "weekly",
        ...vocGreeting,
      },
      {
        key: "tablet",
        label: "VOC 태블릿",
        weight: "10점",
        max: 100,
        unit: "점",
        cadence: "weekly",
        ...vocTablet,
      },
      {
        key: "happyCall",
        label: "VOC 해피콜",
        weight: "10점",
        max: 100,
        unit: "점",
        cadence: "weekly",
        ...vocHappyCall,
      },
      {
        key: "sent",
        label: "VOC 발송건수",
        weight: "",
        max: vocSentMax,
        unit: "건",
        cadence: "weekly",
        ...vocSent,
      },
    ],
  },
  happyCall: {
    label: "신차 해피콜 이행률",
    components: [
      {
        key: "newCar",
        label: "ONE Voice 출고 후 해피콜",
        weight: "",
        max: 100,
        unit: "%",
        cadence: "weekly",
        ...newCarHappyCall,
      },
    ],
  },
  cx: {
    label: "CX Index",
    components: [
      {
        key: "delivery",
        label: "신차출고 만족도",
        weight: "100점",
        max: 100,
        unit: "점",
        cadence: "weekly",
        ...delivery,
      },
      {
        key: "testDrive",
        label: "시승 만족도",
        weight: "100점",
        max: 100,
        unit: "점",
        cadence: "weekly",
        ...testDrive,
      },
      {
        key: "emergency",
        label: "긴급경보 처리여부",
        weight: "10점",
        max: 10,
        unit: "점",
        cadence: "weekly",
        ...emergency,
      },
      {
        key: "actionPlan",
        label: "조치 계획",
        weight: "10점",
        max: 10,
        unit: "점",
        cadence: "quarterly",
        ...actionPlanWeekly,
      },
      {
        key: "app",
        label: "헤이볼보 앱 가입율",
        weight: "100점",
        max: 100,
        unit: "점",
        cadence: "weekly",
        ...app,
      },
    ],
  },
};

await mkdir("app/data", { recursive: true });
await writeFile(
  "app/data/weekly.json",
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);
await writeFile(
  "app/data/weekly-details.json",
  `${JSON.stringify(detailsOutput, null, 2)}\n`,
  "utf8",
);

console.log(
  `Google Sheet weekly sync complete: VOC W${String(voc.latestWeek).padStart(2, "0")}, ` +
    `CX W${String(cxLatestWeek).padStart(2, "0")}, ${cdsids.length} showrooms`,
);
