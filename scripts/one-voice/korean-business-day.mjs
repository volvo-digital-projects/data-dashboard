const SEOUL_TIME_ZONE = "Asia/Seoul";

const seoulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const lunarFormatter = new Intl.DateTimeFormat("en-u-ca-chinese", {
  timeZone: SEOUL_TIME_ZONE,
  month: "numeric",
  day: "numeric",
});

const WEEKEND = new Set(["Sat", "Sun"]);
const GENERAL_SUBSTITUTE = new Set([
  "national",
  "buddha",
  "labor",
  "children",
  "christmas",
]);
const LUNAR_GROUP_SUBSTITUTE = new Set(["seollal", "chuseok"]);

function partsMap(formatter, date) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function seoulParts(date = new Date()) {
  const parts = partsMap(seoulFormatter, date);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday: parts.weekday,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function dateAtSeoulNoon(year, month, day) {
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return new Date(`${year}-${monthText}-${dayText}T03:00:00.000Z`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function keyFor(date) {
  return seoulParts(date).date;
}

function lunarParts(date) {
  const parts = partsMap(lunarFormatter, date);
  return {
    month: Number.parseInt(parts.month, 10),
    day: Number(parts.day),
    leap: /bis|leap/i.test(parts.month),
  };
}

function addHoliday(map, key, category, name) {
  const entries = map.get(key) ?? [];
  entries.push({ category, name });
  map.set(key, entries);
}

function baseHolidays(year, extraHolidays = []) {
  const holidays = new Map();
  const fixed = [
    [1, 1, "new-year", "New Year's Day"],
    [3, 1, "national", "Independence Movement Day"],
    [5, 1, "labor", "Labor Day"],
    [5, 5, "children", "Children's Day"],
    [6, 6, "memorial", "Memorial Day"],
    [7, 17, "national", "Constitution Day"],
    [8, 15, "national", "Liberation Day"],
    [10, 3, "national", "National Foundation Day"],
    [10, 9, "national", "Hangul Day"],
    [12, 25, "christmas", "Christmas Day"],
  ];
  for (const [month, day, category, name] of fixed) {
    addHoliday(holidays, keyFor(dateAtSeoulNoon(year, month, day)), category, name);
  }

  let cursor = dateAtSeoulNoon(year, 1, 1);
  const end = dateAtSeoulNoon(year, 12, 31);
  while (cursor <= end) {
    const key = keyFor(cursor);
    const lunar = lunarParts(cursor);
    const tomorrow = lunarParts(addDays(cursor, 1));
    if (!lunar.leap && tomorrow.month === 1 && tomorrow.day === 1) {
      addHoliday(holidays, key, "seollal", "Seollal Eve");
    }
    if (!lunar.leap && lunar.month === 1 && lunar.day === 1) {
      addHoliday(holidays, key, "seollal", "Seollal");
    }
    if (!lunar.leap && lunar.month === 1 && lunar.day === 2) {
      addHoliday(holidays, key, "seollal", "Day after Seollal");
    }
    if (!lunar.leap && lunar.month === 4 && lunar.day === 8) {
      addHoliday(holidays, key, "buddha", "Buddha's Birthday");
    }
    if (!lunar.leap && lunar.month === 8 && lunar.day === 14) {
      addHoliday(holidays, key, "chuseok", "Chuseok Eve");
    }
    if (!lunar.leap && lunar.month === 8 && lunar.day === 15) {
      addHoliday(holidays, key, "chuseok", "Chuseok");
    }
    if (!lunar.leap && lunar.month === 8 && lunar.day === 16) {
      addHoliday(holidays, key, "chuseok", "Day after Chuseok");
    }
    cursor = addDays(cursor, 1);
  }

  for (const extra of extraHolidays) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(extra)) {
      addHoliday(holidays, extra, "temporary", "Election or temporary holiday");
    }
  }
  return holidays;
}

function substituteHolidays(year, base) {
  const substitutes = new Map();
  const triggers = [];
  for (const [key, entries] of base) {
    const date = new Date(`${key}T03:00:00.000Z`);
    const { weekday } = seoulParts(date);
    const overlaps = entries.length > 1 && !WEEKEND.has(weekday);
    const triggeredEntry = entries.find((entry) => {
      const weekendTrigger =
        GENERAL_SUBSTITUTE.has(entry.category) && WEEKEND.has(weekday);
      const sundayLunarTrigger =
        LUNAR_GROUP_SUBSTITUTE.has(entry.category) && weekday === "Sun";
      const overlapTrigger =
        overlaps &&
        (GENERAL_SUBSTITUTE.has(entry.category) ||
          LUNAR_GROUP_SUBSTITUTE.has(entry.category));
      return weekendTrigger || sundayLunarTrigger || overlapTrigger;
    });
    if (triggeredEntry) triggers.push({ date, entry: triggeredEntry });
  }

  triggers.sort((left, right) => left.date - right.date);
  for (const trigger of triggers) {
    let candidate = addDays(trigger.date, 1);
    while (true) {
      const key = keyFor(candidate);
      const { weekday } = seoulParts(candidate);
      if (!WEEKEND.has(weekday) && !base.has(key) && !substitutes.has(key)) {
        substitutes.set(key, `${trigger.entry.name} substitute holiday`);
        break;
      }
      candidate = addDays(candidate, 1);
    }
  }
  return substitutes;
}

export function koreaHolidayInfo(date = new Date(), extraHolidays = []) {
  const parts = seoulParts(date);
  const base = baseHolidays(parts.year, extraHolidays);
  const substitutes = substituteHolidays(parts.year, base);
  const baseEntries = base.get(parts.date);
  if (baseEntries?.length) {
    return {
      holiday: true,
      name: baseEntries.map((item) => item.name).join(" / "),
    };
  }
  const substituteName = substitutes.get(parts.date);
  if (substituteName) return { holiday: true, name: substituteName };
  return { holiday: false, name: null };
}

export function collectionWindow(date = new Date(), extraHolidays = []) {
  const parts = seoulParts(date);
  if (WEEKEND.has(parts.weekday)) {
    return { allowed: false, reason: "weekend", parts };
  }
  const holiday = koreaHolidayInfo(date, extraHolidays);
  if (holiday.holiday) {
    return { allowed: false, reason: holiday.name, parts };
  }
  if (parts.hour !== 10) {
    return { allowed: false, reason: "outside collection hours", parts };
  }
  return { allowed: true, reason: null, parts };
}

export function hourlySlotKst(date = new Date()) {
  const parts = seoulParts(date);
  return `${parts.date}T${String(parts.hour).padStart(2, "0")}:00:00+09:00`;
}
