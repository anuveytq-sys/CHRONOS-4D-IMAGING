(() => {
  'use strict';

  function enableTemporalVisionScrolling() {
    const panels = Array.from(document.querySelectorAll('.right-stack .panel, .panel'));
    const panel = panels.find((candidate) => {
      const title = candidate.querySelector('.panel-title')?.textContent || '';
      return /TEMPORAL\s+VISION/i.test(title);
    });
    if (!panel) return false;

    const body = panel.querySelector('.panel-body');
    if (!body) return false;

    // The panel is intentionally tall, so constrain its content area to the
    // visible viewport; overflow alone cannot scroll unless a height is set.
    panel.style.minHeight = '0';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.maxHeight = 'calc(100vh - 32px)';
    panel.style.maxHeight = 'calc(100dvh - 32px)';
    body.style.minHeight = '0';
    body.style.flex = '1 1 auto';
    body.style.maxHeight = 'calc(100vh - 105px)';
    body.style.maxHeight = 'calc(100dvh - 105px)';
    body.style.overflowX = 'auto';
    body.style.overflowY = 'auto';
    body.style.webkitOverflowScrolling = 'touch';
    body.style.touchAction = 'pan-x pan-y';
    return true;
  }

  function start() {
    if (enableTemporalVisionScrolling()) return;
    // Panel markup may be added by another engine after DOMContentLoaded.
    const observer = new MutationObserver(() => {
      if (enableTemporalVisionScrolling()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();