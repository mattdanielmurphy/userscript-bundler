// ==UserScript==
// @name         YouTube Refresh on Unavailable Video
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Refreshes the YouTube page once if a "Video unavailable" error is detected.
// @author       Gemini CLI Agent
// @match        https://www.youtube.com/watch?v=*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const REFRESH_KEY = 'yt_refresh_on_error_count';
    const MAX_REFRESHES = 1;
    // Selector for the "Video unavailable" text element
    const ERROR_SELECTOR = 'yt-player-error-message-renderer #reason'; 

    function checkAndRefresh() {
        // Check for the error element
        const errorElement = document.querySelector(ERROR_SELECTOR);
        const isErrorPresent = errorElement && errorElement.textContent.trim() === 'Video unavailable';
        
        // Get the current refresh count from localStorage
        let refreshCount = parseInt(localStorage.getItem(REFRESH_KEY) || '0', 10);

        if (isErrorPresent) {
            if (refreshCount < MAX_REFRESHES) {
                console.log('YouTube Refresh on Unavailable Video: Detected "Video unavailable" error. Refreshing page.');
                
                // Increment count and refresh
                localStorage.setItem(REFRESH_KEY, refreshCount + 1);
                window.location.reload();
            } else {
                console.log('YouTube Refresh on Unavailable Video: Detected "Video unavailable" error, but max refreshes reached.');
                // Do not clear the counter here, as the user is still on the broken page.
            }
        } else {
            // If no error is present, or the video is playing, clear the counter for the next video.
            // This is crucial for allowing a refresh on a *new* video that might be broken.
            if (refreshCount > 0) {
                localStorage.removeItem(REFRESH_KEY);
                console.log('YouTube Refresh on Unavailable Video: Error cleared. Resetting refresh counter.');
            }
        }
    }

    // Use a MutationObserver to watch for changes in the document body, which is necessary
    // because YouTube is a Single Page Application (SPA) and the error can appear dynamically.
    const observer = new MutationObserver(checkAndRefresh);
    
    // Start observing the body for changes in its descendants
    // We use document.documentElement (<html>) as the target for maximum coverage.
    observer.observe(document.documentElement, { childList: true, subtree: true });
    
    // Also run an initial check in case the error is present on initial load
    checkAndRefresh();
    
})();