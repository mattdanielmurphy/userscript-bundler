// ==UserScript==
// @name         TorrentGalaxy Modal Fix
// @namespace    torrentgalaxy-official.is
// @version      1.0
// @description  Fixes modal styling and escape key behavior on TorrentGalaxy.
// @match        https://torrentgalaxy-official.is/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // ── DevTools Shield ──────────────────────────────────────────────────────────
  // Wraps common detection points, logs when they're accessed, and neutralizes them.

  (() => {
    const log = (msg) => console.warn(`[DevTools Shield] ${msg}`);

    // 1. Trap eval-based debugger statements
    const oldEval = window.eval;
    window.eval = function(code) {
      if (typeof code === 'string' && code.includes('debugger')) {
        log('Blocked an eval-based debugger statement.');
        return oldEval(code.replace(/debugger/g, '/* debugger blocked */'));
      }
      return oldEval(code);
    };

    // 2. Neutralize outerWidth/Height — some detectors compare these to inner dimensions
    Object.defineProperty(window, 'outerWidth',  { get: () => window.innerWidth });
    Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight });
    log('Neutralized outerWidth/Height detection.');

    // 3. Trap getters on console properties used by detectors (profiles, memory, table)
    const detectorProps = ['profiles', 'memory', 'table'];
    detectorProps.forEach(prop => {
      if (console[prop]) {
        try {
          Object.defineProperty(console, prop, {
            get() {
              log(`Detected access to console.${prop}`);
              return undefined;
            },
            configurable: true,
          });
        } catch (_) { /* property may be non-reconfigurable */ }
      }
    });

    // 4. Block resize / devtoolschange event listeners
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
      if (type === 'resize' || type === 'devtoolschange') return;
      return originalAddEventListener.apply(this, arguments);
    };

    log('Anti-detection script injected into this session.');
  })();

  // ── Modal Fixes ──────────────────────────────────────────────────────────────

  function applyFixes() {
    // 1. Inject Styles
    let style = document.getElementById('torrentgalaxy-modal-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'torrentgalaxy-modal-styles';
      style.textContent = `
        .modal-overlay {
          padding: 0 !important;
        }
        .modal {
          max-width: none !important;
          padding: 2rem max(2rem, 10vw);
        }
      `;
      document.head.append(style);
    }

    // 2. Intercept Escape Key
    if (!window.hasTorrentgalaxyEscapeInterceptor) {
      window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' || event.keyCode === 27) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true); // capture phase
      window.hasTorrentgalaxyEscapeInterceptor = true;
    }
  }

  applyFixes();

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' || mutation.type === 'subtree') {
        applyFixes();
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
