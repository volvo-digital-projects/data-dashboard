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
  let released = false;
  let frame = 0;
  let releaseTimer = 0;

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
  };

  resetPageScrollToTop();
  window.addEventListener("wheel", blockResidualScroll, { capture: true, passive: false });
  window.addEventListener("touchmove", blockResidualScroll, { capture: true, passive: false });
  frame = window.requestAnimationFrame(keepAtTop);
  releaseTimer = window.setTimeout(release, holdMilliseconds);
  return release;
};
