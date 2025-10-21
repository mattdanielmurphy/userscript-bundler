// ==UserScript==
// @name        Open Apple Music links in Music App
// @author      Matthew Daniel Murphy
// @description Changes Apple Music web links (https://) to app links (music://) to open in the native Music app.
// @version     1.0
// @match       *://*/*
// @grant       none
// ==/UserScript==

(() => {
    'use strict';

    const processLinks = (container) => {
        // Find all unprocessed links pointing to Apple Music
        const links = container.querySelectorAll('a[href*="music.apple.com"]:not([data-am-link-processed])');
        
        links.forEach(link => {
            // Mark the link as processed to avoid an infinite loop
            link.setAttribute('data-am-link-processed', 'true');
            
            // Replace https protocol with the music app protocol
            if (link.href.startsWith('https://music.apple.com/') || link.href.startsWith('https://geo.music.apple.com/')) {
                link.href = link.href.replace('https://', 'music://');
                console.log(`Updated Apple Music link: ${link.href}`);
            }
        });
    };

    // Initial run on page load
    processLinks(document.body);

    // Use a MutationObserver to handle links added dynamically (e.g., in SPAs)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                processLinks(document.body);
            }
        });
    });

    // Start observing the entire document body for changes
    observer.observe(document.body, { childList: true, subtree: true });
})();

  