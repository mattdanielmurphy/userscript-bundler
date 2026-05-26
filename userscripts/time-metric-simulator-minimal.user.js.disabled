// ==UserScript==
// @name         D2L / StudyForge Time Metric Simulator (Minimal)
// @namespace    https://example.com/
// @version      1.0.0
// @description  Minimal userscript that reproduces the working canvas click pattern: exact selector, 30s wait, mousedown -> 50ms -> mouseup + click, no auto-advance.
// @match        https://onlinelearningbc.com/d2l/*
// @match        https://onlinelearningbc.com/content/*
// @match        https://studyforge.net/*
// @match        https://d2l.sd44.bc.ca/*
// @match        *://*.contentconnections.ca/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    canvasSelector: '.qf-canvas-wrapper canvas',
    questionSelector: '.qf-question, #question-display-',
    slideSelector: '.question-fullscreen',
    delayMs: 30 * 1000,
    holdMs: 50,
    debug: true,
  };

  const state = {
    running: false,
    timerId: null,
    observerDisconnectors: [],
    activeKey: null,
    statusEl: null,
    buttonEl: null,
    countdownId: null,
    scheduledAt: 0,
    scheduledDelayMs: 0,
  };

  const log = (...args) => {
    if (CONFIG.debug) console.log('[time-metric-sim]', ...args);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function setStatus(text) {
    if (state.statusEl) state.statusEl.textContent = text;
    log(text);
  }

  function clearTimer() {
    if (state.timerId !== null) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }
    if (state.countdownId !== null) {
      clearInterval(state.countdownId);
      state.countdownId = null;
    }
    state.scheduledAt = 0;
    state.scheduledDelayMs = 0;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function uniquePush(list, item) {
    if (item && !list.includes(item)) list.push(item);
  }

  function findInShadow(selector, root, out = []) {
    if (!root) return out;
    if (root.querySelectorAll) {
      root.querySelectorAll(selector).forEach(el => uniquePush(out, el));
    }
    const walker = (root.ownerDocument || document).createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          return node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );
    let node;
    while ((node = walker.nextNode())) {
      findInShadow(selector, node.shadowRoot, out);
    }
    return out;
  }

  function collectSameOriginDocuments() {
    const docs = [];
    const seen = new Set();

    function walk(doc) {
      if (!doc || seen.has(doc)) return;
      seen.add(doc);
      docs.push(doc);

      const iframes = [
        ...doc.querySelectorAll('iframe'),
        ...findInShadow('iframe', doc)
      ];

      for (const iframe of iframes) {
        try {
          if (iframe.contentDocument) walk(iframe.contentDocument);
        } catch (_) {}
      }
    }

    walk(document);
    return docs;
  }

  function getQuestionCandidates() {
    const results = [];
    for (const doc of collectSameOriginDocuments()) {
      for (const selector of CONFIG.questionSelector.split(',').map(s => s.trim())) {
        findInShadow(selector, doc, results);
      }
    }
    return results;
  }

  function getActiveQuestionRoot() {
    const candidates = getQuestionCandidates().filter(isVisible);
    if (!candidates.length) return null;
    return candidates[candidates.length - 1];
  }

  function getQuestionKey(root) {
    if (!root) return null;
    const doc = root.ownerDocument || document;
    const slide = root.closest?.(CONFIG.slideSelector) || root;
    const ref = slide.querySelector?.('.qf-reference')?.textContent?.trim();
    const num = slide.querySelector?.('.qf-number')?.textContent?.trim();
    return root.id || ref || num || root.textContent?.trim()?.slice(0, 80) || null;
  }

  function getTargetCanvas() {
    const root = getActiveQuestionRoot();
    if (!root) return null;

    const doc = root.ownerDocument || document;
    const slide = root.closest?.(CONFIG.slideSelector) || root;

    let canvas = slide.querySelector(CONFIG.canvasSelector);
    if (!canvas && doc) canvas = doc.querySelector(CONFIG.canvasSelector);
    if (!canvas) return null;
    if (!isVisible(canvas)) return null;

    return canvas;
  }

  function dispatchWorkingPattern(canvas) {
    const win = canvas.ownerDocument?.defaultView || window;
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const mousedownEvent = new win.MouseEvent('mousedown', {
      view: win,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      buttons: 1
    });

    const mouseupEvent = new win.MouseEvent('mouseup', {
      view: win,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      buttons: 0
    });

    const clickEvent = new win.MouseEvent('click', {
      view: win,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    });

    canvas.dispatchEvent(mousedownEvent);
    setTimeout(() => {
      if (!state.running) return;
      canvas.dispatchEvent(mouseupEvent);
      canvas.dispatchEvent(clickEvent);
      log('clicked canvas', {
        x: Math.round(x),
        y: Math.round(y),
        sameAsDirectQuery: canvas === (canvas.ownerDocument || document).querySelector(CONFIG.canvasSelector)
      });
      setStatus('Click fired; waiting for question change or rescan');
    }, CONFIG.holdMs);
  }

  function startCountdown() {
    if (state.countdownId !== null) clearInterval(state.countdownId);
    state.countdownId = setInterval(() => {
      if (!state.running || !state.scheduledAt || !state.scheduledDelayMs) return;
      const elapsed = Date.now() - state.scheduledAt;
      const remaining = Math.max(0, state.scheduledDelayMs - elapsed);
      setStatus(`Click in ${Math.ceil(remaining / 1000)}s`);
    }, 500);
  }

  function scheduleForCurrentQuestion() {
    if (!state.running) return;

    const root = getActiveQuestionRoot();
    if (!root) {
      clearTimer();
      setStatus('No visible question found');
      return;
    }

    const key = getQuestionKey(root);
    if (!key) {
      clearTimer();
      setStatus('Question found but key unavailable');
      return;
    }

    if (key === state.activeKey && state.timerId !== null) return;

    state.activeKey = key;
    clearTimer();

    const canvas = getTargetCanvas();
    if (!canvas) {
      setStatus('No visible .qf-canvas-wrapper canvas found');
      return;
    }

    state.scheduledAt = Date.now();
    state.scheduledDelayMs = CONFIG.delayMs;
    setStatus(`Scheduled 30s click for ${key}`);
    startCountdown();

    state.timerId = setTimeout(() => {
      if (!state.running) return;
      const latestRoot = getActiveQuestionRoot();
      const latestKey = getQuestionKey(latestRoot);
      if (latestKey !== key) {
        setStatus('Question changed before click; rescheduling');
        scheduleForCurrentQuestion();
        return;
      }
      const latestCanvas = getTargetCanvas();
      if (!latestCanvas) {
        setStatus('Canvas missing at fire time');
        return;
      }
      dispatchWorkingPattern(latestCanvas);
    }, CONFIG.delayMs);
  }

  function disconnectObservers() {
    for (const fn of state.observerDisconnectors) {
      try { fn(); } catch (_) {}
    }
    state.observerDisconnectors = [];
  }

  function startObservers() {
    disconnectObservers();
    for (const doc of collectSameOriginDocuments()) {
      const observer = new MutationObserver(() => {
        scheduleForCurrentQuestion();
      });
      observer.observe(doc.documentElement || doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'aria-hidden']
      });
      state.observerDisconnectors.push(() => observer.disconnect());
    }
  }

  function start() {
    if (state.running) return;
    state.running = true;
    if (state.buttonEl) state.buttonEl.classList.add('on');
    startObservers();
    scheduleForCurrentQuestion();
  }

  function stop(reason = 'Stopped') {
    state.running = false;
    state.activeKey = null;
    clearTimer();
    disconnectObservers();
    if (state.buttonEl) state.buttonEl.classList.remove('on');
    setStatus(reason);
  }

  async function fireNow() {
    const canvas = getTargetCanvas();
    if (!canvas) {
      setStatus('No canvas available for fireNow()');
      return false;
    }
    dispatchWorkingPattern(canvas);
    return true;
  }

  function createUi() {
    if (document.getElementById('tm-sim-bar')) return;

    const style = document.createElement('style');
    style.textContent = `
      #tm-sim-bar {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(20, 20, 20, 0.88);
        color: #efefef;
        border: 1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.35);
        font: 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        max-width: min(92vw, 560px);
      }
      #tm-sim-bar .title { font-weight: 700; color: white; }
      #tm-sim-bar .status {
        min-width: 180px;
        max-width: 34vw;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #d5d5d5;
      }
      #tm-sim-bar button {
        appearance: none;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: white;
        padding: 7px 10px;
        border-radius: 10px;
        cursor: pointer;
        font: inherit;
        font-weight: 650;
      }
      #tm-sim-bar button:hover { background: rgba(255,255,255,0.12); }
      #tm-sim-bar button.on {
        background: rgba(17, 153, 142, 0.22);
        border-color: rgba(56, 239, 125, 0.35);
      }
    `;
    document.documentElement.appendChild(style);

    const bar = document.createElement('div');
    bar.id = 'tm-sim-bar';
    bar.innerHTML = `
      <span class="title">Sim time</span>
      <button id="tm-sim-toggle" type="button">Start</button>
      <button id="tm-sim-fire" type="button">Fire now</button>
      <button id="tm-sim-rescan" type="button">Rescan</button>
      <span id="tm-sim-status" class="status">Idle</span>
    `;
    document.body.appendChild(bar);

    state.buttonEl = bar.querySelector('#tm-sim-toggle');
    state.statusEl = bar.querySelector('#tm-sim-status');

    state.buttonEl.addEventListener('click', () => {
      if (state.running) {
        stop('Stopped');
        state.buttonEl.textContent = 'Start';
      } else {
        start();
        state.buttonEl.textContent = 'Stop';
      }
    });

    bar.querySelector('#tm-sim-fire').addEventListener('click', () => {
      fireNow();
    });

    bar.querySelector('#tm-sim-rescan').addEventListener('click', () => {
      state.activeKey = null;
      scheduleForCurrentQuestion();
    });
  }

  function waitForBodyThenInit() {
    if (document.body) {
      createUi();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      observer.disconnect();
      createUi();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.questionTimeSimulator = {
    start,
    stop,
    fireNow,
    rescan: () => {
      state.activeKey = null;
      scheduleForCurrentQuestion();
    },
    getCanvas: getTargetCanvas,
    getActiveQuestionRoot,
    config: CONFIG,
    state,
  };

  waitForBodyThenInit();
})();
