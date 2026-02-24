// components/event-handlers.js — CLEAN (no capitals), buttons always present

(function () {
  const $ = (id) => document.getElementById(id);

  /* -------- Reset (time difference) -------- */
  const resetBtn = $('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (typeof window.resetDiff === 'function') window.resetDiff();
    });
  }

  /* -------- Map open/close + close cross hitbox -------- */
  const showMapBtn  = $('showMapBtn');
  const mapArea     = $('mapArea');
  const closeMapBtn = $('closeMapBtn');

  function openMap() {
    if (!mapArea || !showMapBtn) return;
    showMapBtn.style.display = 'none';
    mapArea.style.display = 'block';
    if (closeMapBtn) closeMapBtn.style.display = 'block';

    // Recalc the SVG cross & masks after becoming visible
    try {
      const ev = new Event('resize');
      // next frame to ensure layout box is correct
      if (window.requestAnimationFrame) {
        requestAnimationFrame(() => window.dispatchEvent(ev));
      } else {
        window.dispatchEvent(ev);
      }
    } catch {}
  }

  function closeMap() {
    if (!mapArea || !showMapBtn) return;
    mapArea.style.display = 'none';
    showMapBtn.style.display = 'block';
    if (closeMapBtn) closeMapBtn.style.display = 'none';
  }

  if (showMapBtn)  showMapBtn.addEventListener('click', openMap);
  if (closeMapBtn) closeMapBtn.addEventListener('click', closeMap);

  /* -------- Service Worker (optional, silent on error) -------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* no-op */ });
  }
})();
