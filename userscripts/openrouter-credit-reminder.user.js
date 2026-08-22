// ==UserScript==
// @name         OpenRouter Credit Reminder
// @namespace    openrouter.credit.reminder
// @version      1.1
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

    //! DOES NOT WORK: (who cares anyway)
    // const input = container.querySelector('input[name="creditAmount"]');
    // if (input && !input.value) {
    //   const nativeSetter = Object.getOwnPropertyDescriptor(
    //     window.HTMLInputElement.prototype,
    //     'value'
    //   ).set;
    //   nativeSetter.call(input, '15');
    //   input.dispatchEvent(new Event('input', { bubbles: true }));
    // }

    const reminder = document.createElement('div');
    reminder.id = 'or-service-fee-reminder';
    reminder.textContent =
    '💡 Reload > $15 to hit the $0.80 flat fee floor without paying extra percentage cents.'

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
