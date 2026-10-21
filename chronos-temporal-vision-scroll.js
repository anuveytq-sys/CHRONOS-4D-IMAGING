(() => {
  'use strict';

  function enableTemporalVisionScrolling() {
    const panels = Array.from(document.querySelectorAll('.right-stack .panel, .panel'));
    const panel = panels.find((candidate) => {
      const text = (candidate.querySelector('.panel-title')?.textContent || candidate.textContent || '').trim();
      return /TEMPORAL\s+VISION/i.test(text);
    });
    if (!panel) return false;

    const body = panel.querySelector('.panel-body');
    if (!body) return false;

    body.style.overflow = 'auto';
    body.style.overflowX = 'auto';
    body.style.overflowY = 'auto';
    body.style.webkitOverflowScrolling = 'touch';
    body.style.touchAction = 'pan-x pan-y';
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableTemporalVisionScrolling, { once: true });
  } else {
    enableTemporalVisionScrolling();
  }
})();
