export const resetPageScrollToTop = () => {
  const scrollingElement = document.scrollingElement as HTMLElement | null;
  if (scrollingElement) {
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
  }
  document.documentElement.scrollTop = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollTop = 0;
  document.body.scrollLeft = 0;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};

export const lockPageScrollToTop = (holdMilliseconds = 320) => {
  const root = document.documentElement;
  const usesTouchSectionSnap = window.matchMedia(
    "(hover: none) and (pointer: coarse) and (min-width: 761px) and (max-width: 1400px)",
  ).matches;
  let released = false;
  let frame = 0;
  let releaseTimer = 0;

  // iPad landscape uses mandatory section snapping on page 2. Temporarily
  // suspend it while Safari settles the new route at scrollTop 0; otherwise
  // the snap correction and this top lock can fight each other visibly.
  if (usesTouchSectionSnap) {
    root.classList.add("analysis-entry-top-locked");
  }

  const blockResidualScroll = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    resetPageScrollToTop();
  };
  const keepAtTop = () => {
    if (released) return;
    resetPageScrollToTop();
    frame = window.requestAnimationFrame(keepAtTop);
  };
  const release = () => {
    if (released) return;
    released = true;
    window.cancelAnimationFrame(frame);
    window.clearTimeout(releaseTimer);
    window.removeEventListener("wheel", blockResidualScroll, true);
    window.removeEventListener("touchmove", blockResidualScroll, true);
    resetPageScrollToTop();
    if (usesTouchSectionSnap) {
      root.classList.remove("analysis-entry-top-locked");
    }
  };

  resetPageScrollToTop();
  window.addEventListener("wheel", blockResidualScroll, { capture: true, passive: false });
  window.addEventListener("touchmove", blockResidualScroll, { capture: true, passive: false });
  frame = window.requestAnimationFrame(keepAtTop);
  releaseTimer = window.setTimeout(release, holdMilliseconds);
  return release;
};
