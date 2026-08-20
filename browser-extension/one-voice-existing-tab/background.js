/* global chrome */

import { ONE_VOICE_CONFIG } from "./local-config.js";
import { collectionWindow, dailySlotKst } from "./business-day.js";

const CAPTURE_ALARM = "one-voice-existing-tab-capture";
const MEDALLIA_PATTERN = "https://volvo.medallia.eu/*";
const API_URL = `${ONE_VOICE_CONFIG.siteUrl.replace(/\/$/, "")}/api/one-voice`;
const CAPTURE_INTERVAL_MINUTES = 2;
const CARD_RETRY_INTERVAL_MS = 2_500;
const CARD_RETRY_ATTEMPTS = 12;

function extraHolidays() {
  return Array.isArray(ONE_VOICE_CONFIG.extraHolidays)
    ? ONE_VOICE_CONFIG.extraHolidays
    : [];
}

async function apiRequest(method = "GET", body) {
  const response = await fetch(API_URL, {
    method,
    headers: {
      Accept: "application/json",
      ...(body
        ? {
            Authorization: `Bearer ${ONE_VOICE_CONFIG.ingestToken}`,
            "Content-Type": "application/json",
          }
        : {}),
    },
    cache: "no-store",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`ONE VOICE API ${method} failed: ${response.status}`);
  }
  return response.json();
}

async function injectAndCollect(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
  return chrome.tabs.sendMessage(tabId, { type: "one-voice-collect" });
}

function isMedalliaTab(tab) {
  return typeof tab?.url === "string" && tab.url.startsWith("https://volvo.medallia.eu/");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function waitForTabComplete(tabId, timeoutMilliseconds = 90_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      finish(new Error("ONE VOICE refresh timed out"));
    }, timeoutMilliseconds);

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      finish();
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === "complete") finish();
      })
      .catch((error) => finish(error));
  });
}

async function reloadAndCollect(tabId) {
  await chrome.tabs.reload(tabId);
  await waitForTabComplete(tabId);
  await delay(CARD_RETRY_INTERVAL_MS);

  for (let attempt = 0; attempt < CARD_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const result = await injectAndCollect(tabId);
      if (result?.scores) return result;
    } catch {
      // Medallia is a client-rendered app; keep waiting for the score cards.
    }
    await delay(CARD_RETRY_INTERVAL_MS);
  }
  return null;
}

async function markMissing(slotKst) {
  await apiRequest("POST", { kind: "monitor", slotKst });
}

async function storeScores(slotKst, scores) {
  await apiRequest("POST", {
    kind: "snapshot",
    slotKst,
    capturedAt: new Date().toISOString(),
    testDriveScore: scores.testDriveScore,
    carHandoverScore: scores.carHandoverScore,
  });
  await chrome.storage.local.remove("lastReloadSlot");
}

async function captureFromExistingTab() {
  const now = new Date();
  const window = collectionWindow(now, extraHolidays());
  if (!window.allowed) return { status: "skipped", reason: window.reason };

  const slotKst = dailySlotKst(now);
  const current = await apiRequest();
  if (current.snapshot?.slotKst === slotKst) {
    return { status: "current", slotKst };
  }

  const tabs = await chrome.tabs.query({ url: MEDALLIA_PATTERN });
  const candidates = tabs
    .filter((tab) => typeof tab.id === "number")
    .sort((left, right) => Number(right.active) - Number(left.active));
  if (!candidates.length) {
    return { status: "missing-tab", slotKst };
  }

  for (const tab of candidates) {
    let result = null;
    try {
      result = await injectAndCollect(tab.id);
    } catch {
      result = null;
    }

    if (result?.scores) {
      await storeScores(slotKst, result.scores);
      return { status: "stored", slotKst, scores: result.scores };
    }
  }

  const state = await chrome.storage.local.get({ lastReloadSlot: "" });
  if (state.lastReloadSlot !== slotKst) {
    await chrome.storage.local.set({ lastReloadSlot: slotKst });
    let refreshed = null;
    try {
      refreshed = await reloadAndCollect(candidates[0].id);
    } catch {
      refreshed = null;
    }
    if (refreshed?.scores) {
      await storeScores(slotKst, refreshed.scores);
      return { status: "stored", slotKst, scores: refreshed.scores };
    }
    await markMissing(slotKst);
    return { status: "cards-unavailable", slotKst };
  }

  await markMissing(slotKst);
  return { status: "cards-unavailable", slotKst };
}

async function recordRun(trigger, result, error) {
  const failed = Boolean(error);
  const status = failed ? "failed" : result?.status ?? "unknown";
  await chrome.storage.local.set({
    lastRun: {
      trigger,
      status,
      at: new Date().toISOString(),
      slotKst: result?.slotKst ?? null,
      message: error instanceof Error ? error.message : null,
    },
  });

  const succeeded = status === "stored" || status === "current";
  await chrome.action.setBadgeBackgroundColor({
    color: succeeded ? "#138a54" : failed ? "#c92a36" : "#c47d00",
  });
  await chrome.action.setBadgeText({
    text: succeeded ? "OK" : status === "skipped" ? "" : "!",
  });
}

async function runCapture(trigger) {
  try {
    const result = await captureFromExistingTab();
    await recordRun(trigger, result, null);
  } catch (error) {
    await recordRun(trigger, null, error);
  }
}

function scheduleCapture() {
  const interval = CAPTURE_INTERVAL_MINUTES * 60 * 1000;
  const nextBoundary = Math.ceil(Date.now() / interval) * interval;
  chrome.alarms.create(CAPTURE_ALARM, {
    when: nextBoundary,
    periodInMinutes: CAPTURE_INTERVAL_MINUTES,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleCapture();
  void runCapture("installed");
});

chrome.runtime.onStartup.addListener(() => {
  scheduleCapture();
  void runCapture("browser-startup");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== CAPTURE_ALARM) return;
  void runCapture("alarm");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !isMedalliaTab(tab)) return;
  void delay(CARD_RETRY_INTERVAL_MS).then(() => runCapture(`tab-updated:${tabId}`));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs
    .get(tabId)
    .then((tab) => {
      if (isMedalliaTab(tab)) return runCapture(`tab-activated:${tabId}`);
      return undefined;
    })
    .catch(() => undefined);
});

chrome.action.onClicked.addListener(() => {
  scheduleCapture();
  void runCapture("manual");
});

scheduleCapture();
