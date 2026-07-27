// ==UserScript==
// @name         OpenRouter Credit Reminder
// @namespace    openrouter.credit.reminder
// @version      1.0
// @description  Show a service fee reminder on the OpenRouter Add Credits modal when inputting amounts.
// @match        https://openrouter.ai/settings/credits
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  /**
   * Inject the service-fee reminder below the credit input container.
   * Guarded by a unique id so we never duplicate.
   */
  function injectReminder() {
    if (document.getElementById('or-service-fee-reminder')) return;

    const container = document.querySelector(
      '.flex.h-10.items-center.overflow-hidden.rounded-md.border.border-input'
    );
    if (!container) return;

    const reminder = document.createElement('div');
    reminder.id = 'or-service-fee-reminder';
    reminder.textContent =
      '💡 Reminder: Flat $0.80 service fee. Adding small amounts (like $5) is less cost-effective!';

    Object.assign(reminder.style, {
      fontSize: '12px',
      color: '#d97706',
      marginTop: '6px',
      fontWeight: '500',
      fontFamily: 'inherit',
    });

    container.parentNode.insertBefore(reminder, container.nextSibling);
  }

  // Run once on initial DOM in case the modal is already open
  injectReminder();

  // Watch for dynamic DOM changes (the Add Credits modal appears on button click)
  const observer = new MutationObserver(() => {
    injectReminder();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();