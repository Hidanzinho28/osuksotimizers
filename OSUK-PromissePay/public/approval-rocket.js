(() => {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let layer = null, flight = null;
  function stop() {
    const running = flight; flight = null;
    if (running) running.cancel();
    layer?.remove(); layer = null;
  }
  function play() {
    if (motion.matches || document.hidden || layer) return;
    const overlay = document.createElement('div');
    overlay.className = 'approval-celebration';
    overlay.setAttribute('aria-hidden', 'true');
    // Fixed artwork only. Payment data never enters the SVG or its markup.
    overlay.innerHTML = `<div class="approval-ship"><svg viewBox="0 0 96 176" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <defs>
        <linearGradient id="approval-hull" x1="0" x2="1"><stop stop-color="#4c1495"/><stop offset=".42" stop-color="#b67bff"/><stop offset=".62" stop-color="#933cfa"/><stop offset="1" stop-color="#5516a9"/></linearGradient>
        <linearGradient id="approval-fin" x2="0" y2="1"><stop stop-color="#c69aff"/><stop offset="1" stop-color="#6624c7"/></linearGradient>
        <linearGradient id="approval-exhaust" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".2" stop-color="#dfbaff"/><stop offset=".5" stop-color="#a855f7"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></linearGradient>
      </defs>
      <path d="M37 116Q28 143 48 175Q68 143 59 116Z" fill="url(#approval-exhaust)"/>
      <path d="M28 74 11 102 13 121 33 109M68 74 85 102 83 121 63 109" fill="url(#approval-fin)" stroke="#c59afc" stroke-width="1.4"/>
      <path d="M48 5C24 29 20 61 28 96L34 115H62L68 96C76 61 72 29 48 5Z" fill="url(#approval-hull)" stroke="#d5b0ff" stroke-width="1.2"/>
      <path d="M48 5C38 16 32 26 28 38H68C64 26 58 16 48 5Z" fill="#7c3aed"/>
      <path d="M41 20C29 39 28 68 35 94" fill="none" stroke="#e3c5ff" stroke-width="2" stroke-linecap="round" opacity=".65"/>
      <circle cx="48" cy="62" r="15" fill="#17082d" stroke="#d4adff" stroke-width="3"/>
      <circle cx="48" cy="62" r="10" fill="#351254"/>
      <path d="M42 59a7 7 0 0 1 8-4" fill="none" stroke="#e3c7ff" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M47 87V114" stroke="#d1a2ff" stroke-width="3" stroke-linecap="round"/>
      <path d="M34 113H62L59 121H37Z" fill="#341056" stroke="#b979fa" stroke-width="1.3"/>
    </svg></div>`;
    const ship = overlay.querySelector('.approval-ship');
    if (typeof ship.animate !== 'function') return;
    document.body.append(overlay); layer = overlay;
    const running = ship.animate([
      { transform: `translate3d(-50%, ${window.innerHeight + 24}px, 0)`, opacity: 0, offset: 0 },
      { opacity: 1, offset: .08 },
      { opacity: 1, offset: .86 },
      { transform: 'translate3d(-50%, -340px, 0)', opacity: 0, offset: 1 }
    ], { duration: 2100, easing: 'cubic-bezier(.32,.12,.58,1)', fill: 'both' });
    flight = running;
    const cleanup = () => { if (flight === running) stop(); };
    running.finished.then(cleanup, cleanup);
  }
  motion.addEventListener('change', event => { if (event.matches) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  window.OSUK_APPROVAL_MOTION = Object.freeze({ play, stop });
})();
