/* global chrome */

if (!globalThis.__volvoOneVoiceExistingTabSync) {
  globalThis.__volvoOneVoiceExistingTabSync = true;

  const TITLES = {
    testDriveScore: "Test Drive - Overall Satisfaction (OSAT)",
    carHandoverScore: "Car Handover - Overall Satisfaction (OSAT)",
  };

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function exactText(text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    return [...document.querySelectorAll("body *")]
      .filter((element) => visible(element))
      .sort((left, right) => left.children.length - right.children.length)
      .find(
        (element) =>
          element.textContent?.replace(/\s+/g, " ").trim() === normalized,
      );
  }

  function scoreFor(title) {
    const heading = exactText(title);
    if (!heading) return null;

    let card = heading;
    for (let depth = 0; depth < 8 && card.parentElement; depth += 1) {
      card = card.parentElement;
      const bounds = card.getBoundingClientRect();
      if (bounds.width >= 280 && bounds.height >= 230) break;
    }

    const candidates = [...card.querySelectorAll("*")]
      .filter((element) => element.children.length === 0 && visible(element))
      .map((element) => ({
        text: element.textContent?.trim() ?? "",
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize || "0"),
      }))
      .filter(
        ({ text, fontSize }) =>
          /^(?:100(?:\.0)?|\d{1,2}(?:\.\d)?)$/.test(text) && fontSize >= 20,
      )
      .sort((left, right) => right.fontSize - left.fontSize);

    return candidates.length ? Number(candidates[0].text) : null;
  }

  function collectScores() {
    const testDriveScore = scoreFor(TITLES.testDriveScore);
    const carHandoverScore = scoreFor(TITLES.carHandoverScore);
    if (
      typeof testDriveScore !== "number" ||
      typeof carHandoverScore !== "number"
    ) {
      return null;
    }
    return { testDriveScore, carHandoverScore };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "one-voice-collect") return false;
    sendResponse({
      scores: collectScores(),
      pageTitle: document.title,
      pageUrl: location.href,
    });
    return true;
  });
}
