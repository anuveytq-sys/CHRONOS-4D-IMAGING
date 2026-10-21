(() => {
  'use strict';

  function enableTemporalVisionScrolling() {
    // Target the actual Phase 2 panel by ID. Searching every .panel by text
    // can accidentally select an ancestor/child panel and leave this panel unchanged.
    const panel = document.getElementById('chronosPhase2Panel');
    if (!panel) return false;

    const head = panel.querySelector(':scope > .panel-head');
    const body = panel.querySelector(':scope > .panel-body');
    if (!body) return false;

    // Give the content a definite scrollable viewport. The page/layout is
    // intentionally overflow-hidden, so the panel body itself must scroll.
    panel.style.setProperty('display', 'flex', 'important');
    panel.style.setProperty('flex-direction', 'column', 'important');
    panel.style.setProperty('min-height', '0', 'important');
    panel.style.setProperty('height', 'calc(100dvh - 90px)', 'important');
    panel.style.setProperty('max-height', 'calc(100dvh - 90px)', 'important');
    panel.style.setProperty('overflow', 'hidden', 'important');

    if (head) head.style.setProperty('flex', '0 0 auto', 'important');
    body.style.setProperty('display', 'block', 'important');
    body.style.setProperty('flex', '1 1 0', 'important');
    body.style.setProperty('height', '0', 'important');
    body.style.setProperty('min-height', '0', 'important');
    body.style.setProperty('max-height', 'none', 'important');
    body.style.setProperty('overflow-y', 'auto', 'important');
    body.style.setProperty('overflow-x', 'auto', 'important');
    body.style.setProperty('overscroll-behavior', 'contain', 'important');
    body.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    body.style.setProperty('touch-action', 'pan-x pan-y', 'important');
    body.style.setProperty('pointer-events', 'auto', 'important');
    return true;
  }

  function start() {
    if (enableTemporalVisionScrolling()) return;
    const observer = new MutationObserver(() => {
      if (enableTemporalVisionScrolling()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();