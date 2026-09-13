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

export const forcePageScrollToTop = () => {
  resetPageScrollToTop();
  window.requestAnimationFrame(() => {
    resetPageScrollToTop();
    window.requestAnimationFrame(resetPageScrollToTop);
  });
  // Hash routing, Next navigation and Safari history restoration can each run
  // after the click handler. Reassert the page origin after those phases.
  window.setTimeout(resetPageScrollToTop, 80);
  window.setTimeout(resetPageScrollToTop, 240);
};
