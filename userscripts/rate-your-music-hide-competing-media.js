// ==UserScript==
// @name        Rate Your Music - Hide Competing Media Links
// @author      Matthew Daniel Murphy
// @description Hides competing media links on Rate Your Music when an Apple Music link is present.
// @version     1.0
// @match       *://rateyourmusic.com/*
// @grant       none
// ==/UserScript==

(() => {
    'use strict';

    const processMediaLinks = (container) => {
        const mediaLinkContainers = container.querySelectorAll('.ui_media_links_container');

        mediaLinkContainers.forEach(mediaLinkContainer => {
            const appleMusicLink = mediaLinkContainer.querySelector('.ui_media_link_btn_applemusic');

            if (appleMusicLink) {
                const allLinks = mediaLinkContainer.querySelectorAll('.ui_media_link_btn');
                allLinks.forEach(link => {
                    if (!link.classList.contains('ui_media_link_btn_applemusic')) {
                        link.remove();
                    }
                });
            }
        });
    };

    // Initial run on page load
    processMediaLinks(document.body);

    // Use a MutationObserver to handle links added dynamically
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                processMediaLinks(document.body);
            }
        });
    });

    // Start observing the entire document body for changes
    observer.observe(document.body, { childList: true, subtree: true });
})();
