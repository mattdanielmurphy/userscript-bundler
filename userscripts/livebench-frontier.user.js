// ==UserScript==
// @name         LiveBench Efficient Frontier Highlight
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Highlight efficient frontier on LiveBench by striking through rows with no new performance peaks
// @author       You
// @match        https://livebench.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  console.log('[LiveBench Frontier] Script loaded');

  function run() {
    const rows = Array.from(document.querySelectorAll('tr.row'));
    if (rows.length === 0) {
      console.log('[LiveBench Frontier] No rows found yet, will retry');
      return false;
    }

    console.log('[LiveBench Frontier] Processing', rows.length, 'rows');

    // Column detection — use the first data row's cells
    // The columns are: 0=expander, 1=model name, 2=overall, 3-9=categories, 10=cost
    const perfColIndices = [2, 3, 4, 5, 6, 7, 8, 9]; // Overall + 7 categories
    const costColIdx = 10;

    // Track per-column max values
    const colMaxes = [2, 3, 4, 5, 6, 7, 8, 9].map(() => -Infinity);

    rows.forEach((row) => {
      let rowHasPeak = false;

      Array.from(row.cells).forEach((cell, c) => {
        // Remove old delta spans
        const oldDelta = cell.querySelector('.delta-value');
        if (oldDelta) oldDelta.remove();

        const pi = perfColIndices.indexOf(c);
        if (pi !== -1) {
          // Performance or overall column
          const raw = cell.textContent.trim().replace(/[^\d.-]/g, '');
          const val = parseFloat(raw);
          if (!isNaN(val)) {
            const prevMax = colMaxes[pi];

            if (val >= prevMax) {
              // New peak or equal
              if (prevMax !== -Infinity && val > prevMax) {
                const delta = (val - prevMax).toFixed(0);
                const span = document.createElement('span');
                span.className = 'delta-value';
                span.textContent = ' +' + delta;
                span.style.cssText = 'font-size:0.75em;font-weight:400;color:#2ecc71;margin-left:4px;display:inline-block';
                cell.appendChild(span);
              }
              colMaxes[pi] = val;
              cell.style.setProperty('font-weight', '900', 'important');
              cell.style.setProperty('color', '#000', 'important');
              rowHasPeak = true;
            } else {
              const delta = (val - prevMax).toFixed(0);
              const span = document.createElement('span');
              span.className = 'delta-value';
              span.textContent = ' ' + delta;
              span.style.cssText = 'font-size:0.75em;font-weight:400;color:#e74c3c;margin-left:4px;display:inline-block';
              cell.appendChild(span);
              cell.style.setProperty('font-weight', '300', 'important');
              cell.style.setProperty('color', '#aaa', 'important');
            }
          }
        } else if (c === costColIdx) {
          cell.style.setProperty('font-weight', '300', 'important');
          cell.style.setProperty('color', '#666', 'important');
        } else {
          cell.style.setProperty('font-weight', '300', 'important');
        }
      });

      // Strike through rows with no new peaks
      if (!rowHasPeak) {
        row.style.setProperty('text-decoration', 'line-through', 'important');
        row.style.setProperty('opacity', '0.4', 'important');
        row.style.setProperty('filter', 'grayscale(1)', 'important');
      } else {
        row.style.setProperty('text-decoration', 'none', 'important');
        row.style.setProperty('opacity', '1', 'important');
        row.style.setProperty('filter', 'none', 'important');
      }
    });

    console.log('[LiveBench Frontier] Applied highlighting');
    return true;
  }

  // Poll for up to 15 seconds (every 500ms) for the table to appear
  let attempts = 0;
  const maxAttempts = 30;
  const pollInterval = setInterval(() => {
    attempts++;
    const applied = run();
    if (applied) {
      clearInterval(pollInterval);
      console.log('[LiveBench Frontier] Done after ~' + (attempts * 500) + 'ms');
    } else if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      console.log('[LiveBench Frontier] Gave up after 15s');
    }
  }, 500);

  // Also re-run on any click (for sorting / SPA navigation)
  document.addEventListener('click', () => {
    setTimeout(run, 100);
  });
})();