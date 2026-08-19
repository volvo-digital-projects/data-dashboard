import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { collectionWindow, hourlySlotKst } from "../scripts/one-voice/korean-business-day.mjs";

test("collects once during the weekday 10 AM Korea window", () => {
  assert.equal(collectionWindow(new Date("2026-08-18T00:59:00Z")).allowed, false);
  assert.equal(collectionWindow(new Date("2026-08-18T01:00:00Z")).allowed, true);
  assert.equal(collectionWindow(new Date("2026-08-18T01:59:59Z")).allowed, true);
  assert.equal(collectionWindow(new Date("2026-08-18T02:00:00Z")).allowed, false);
  assert.equal(collectionWindow(new Date("2026-08-22T01:10:00Z")).reason, "weekend");
  assert.equal(
    hourlySlotKst(new Date("2026-08-18T01:45:00Z")),
    "2026-08-18T10:00:00+09:00",
  );
});

test("refreshes the existing ONE VOICE tab and immediately retries the cards", async () => {
  const background = await readFile(
    new URL("../browser-extension/one-voice-existing-tab/background.js", import.meta.url),
    "utf8",
  );
  const workflow = await readFile(
    new URL("../.github/workflows/one-voice-watchdog.yml", import.meta.url),
    "utf8",
  );

  assert.match(
    background,
    /async function reloadAndCollect\(tabId\)[\s\S]*?chrome\.tabs\.reload\(tabId\)[\s\S]*?waitForTabComplete\(tabId\)[\s\S]*?await delay\(4_000\)[\s\S]*?return injectAndCollect\(tabId\)/,
  );
  assert.match(background, /await storeScores\(slotKst, refreshed\.scores\)/);
  assert.match(workflow, /cron: "23 1 \* \* 1-5"/);
});
