/* global chrome */

import { ONE_VOICE_CONFIG } from "./local-config.js";
import { collectionWindow, hourlySlotKst } from "./business-day.js";

const CAPTURE_ALARM = "one-voice-existing-tab-capture";
const MEDALLIA_PATTERN = "https://volvo.medallia.eu/*";
const API_URL = `${ONE_VOICE_CONFIG.siteUrl.replace(/\/$/, "")}/api/one-voice`;

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

async function markMissing(slotKst) {
  await apiRequest("POST", { kind: "monitor", slotKst });
}

async function captureFromExistingTab() {
  const now = new Date();
  const window = collectionWindow(now, extraHolidays());
  if (!window.allowed) return;

  const slotKst = hourlySlotKst(now);
  const current = await apiRequest();
  if (current.snapshot?.slotKst === slotKst) return;

  const tabs = await chrome.tabs.query({ url: MEDALLIA_PATTERN });
  const candidates = tabs
    .filter((tab) => typeof tab.id === "number")
    .sort((left, right) => Number(right.active) - Number(left.active));
  if (!candidates.length) return;

  for (const tab of candidates) {
    let result = null;
    try {
      result = await injectAndCollect(tab.id);
    } catch {
      result = null;
    }

    if (result?.scores) {
      await apiRequest("POST", {
        kind: "snapshot",
        slotKst,
        capturedAt: new Date().toISOString(),
        testDriveScore: result.scores.testDriveScore,
        carHandoverScore: result.scores.carHandoverScore,
      });
      await chrome.storage.local.remove("lastReloadSlot");
      return;
    }
  }

  const state = await chrome.storage.local.get({ lastReloadSlot: "" });
  if (state.lastReloadSlot !== slotKst) {
    await chrome.storage.local.set({ lastReloadSlot: slotKst });
    await chrome.tabs.reload(candidates[0].id);
    return;
  }

  await markMissing(slotKst);
}

function scheduleCapture() {
  const tenMinutes = 10 * 60 * 1000;
  const nextBoundary = Math.ceil(Date.now() / tenMinutes) * tenMinutes;
  chrome.alarms.create(CAPTURE_ALARM, {
    when: nextBoundary,
    periodInMinutes: 10,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleCapture();
  void captureFromExistingTab();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleCapture();
  void captureFromExistingTab();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== CAPTURE_ALARM) return;
  void captureFromExistingTab();
});

chrome.action.onClicked.addListener(() => {
  void captureFromExistingTab();
});
