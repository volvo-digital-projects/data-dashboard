import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  collectionWindow,
  dailySlotKst,
  hourlySlotKst,
} from "../scripts/one-voice/korean-business-day.mjs";

test("collects from 10 AM and recovers a missing daily slot during business hours", () => {
  assert.equal(collectionWindow(new Date("2026-08-18T00:59:00Z")).allowed, false);
  assert.equal(collectionWindow(new Date("2026-08-18T01:00:00Z")).allowed, true);
  assert.equal(collectionWindow(new Date("2026-08-18T08:59:59Z")).allowed, true);
  assert.equal(collectionWindow(new Date("2026-08-18T09:00:00Z")).allowed, false);
  assert.equal(collectionWindow(new Date("2026-08-22T01:10:00Z")).reason, "weekend");
  assert.equal(
    dailySlotKst(new Date("2026-08-18T08:45:00Z")),
    "2026-08-18T10:00:00+09:00",
  );
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
    /async function reloadAndCollect\(tabId\)[\s\S]*?chrome\.tabs\.reload\(tabId\)[\s\S]*?waitForTabComplete\(tabId\)[\s\S]*?CARD_RETRY_ATTEMPTS[\s\S]*?injectAndCollect\(tabId\)/,
  );
  assert.match(background, /await storeScores\(slotKst, refreshed\.scores\)/);
  assert.match(background, /chrome\.tabs\.onUpdated\.addListener/);
  assert.match(background, /chrome\.tabs\.onActivated\.addListener/);
  assert.match(background, /periodInMinutes: CAPTURE_INTERVAL_MINUTES/);
  assert.match(background, /await recordRun\(trigger, result, null\)/);
  assert.match(background, /LAST_MEDALLIA_URL_KEY = "lastMedalliaUrl"/);
  assert.match(
    background,
    /chrome\.tabs\.create\(\{ url: rememberedUrl, active: false \}\)/,
  );
  assert.match(
    background,
    /chrome\.tabs\.remove\(autoCreatedTabId\)/,
  );
  assert.match(
    background,
    /chrome\.tabs[\s\S]*?\.update\(autoCreatedTabId, \{ active: true \}\)/,
  );
  assert.match(background, /await markMissing\(slotKst\);[\s\S]*?status: "missing-tab"/);
  assert.match(workflow, /cron: "23 1 \* \* 1-5"/);
  assert.match(
    workflow,
    /ONE_VOICE_SITE_URL: https:\/\/volvo-dsc-pc-test-2026\.kongboojang\.chatgpt\.site/,
  );
});
