// ==UserScript==
// @name         YouTube - Toggle Thumbnails (Optimized)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adds a button to toggle video thumbnails on YouTube, optimized for performance.
// @author       Gemini
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let thumbnailsHidden = sessionStorage.getItem('thumbnailsHidden') === 'true';
    toggleAllThumbnails(thumbnailsHidden);

    /**
     * Applies the appropriate style to an element to hide or show it.
     * @param {HTMLElement} el The element to style.
     * @param {boolean} hide Whether to hide the element.
     */
    function applyThumbnailStyle(el, hide) {
        el.style.visibility = hide ? 'hidden' : '';
    }

    /**
     * Toggles the visibility of all thumbnails currently on the page.
     * @param {boolean} hide Whether to hide the thumbnails.
     */
    function toggleAllThumbnails(hide) {
        // Hide video previews
        document.querySelectorAll('#video-preview').forEach(videoPreview => {
            applyThumbnailStyle(videoPreview, hide);
        });
        // Hide both kinds of thumbnails
        document.querySelectorAll('ytd-thumbnail').forEach(thumbnail => {
            applyThumbnailStyle(thumbnail, hide);
        });
        document.querySelectorAll('yt-thumbnail-view-model').forEach(thumbnail => {
            applyThumbnailStyle(thumbnail, hide);
        });
    }

    /**
     * Checks if the system is in dark mode.
     * @returns {boolean} True if in dark mode, false otherwise.
     */
    function isDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /**
     * Creates and sets up the thumbnail toggle button.
     * @param {HTMLElement} createBtn The original "Create" button to be replaced.
     */
    function setupButton(createBtn) {
        if (document.getElementById('thumbnail-toggle-btn')) {
            return; // Button already exists
        }

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'thumbnail-toggle-btn';
        toggleBtn.title = "Toggle Thumbnails";
        Object.assign(toggleBtn.style, {
            height: `${createBtn.offsetHeight}px`,
            width: `${createBtn.offsetWidth}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            position: 'relative'
        });

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "26.4");
        svg.setAttribute("height", "26.4");
        svg.style.display = "block";

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", "2");
        rect.setAttribute("y", "4");
        rect.setAttribute("width", "20");
        rect.setAttribute("height", "16");
        rect.setAttribute("rx", "2");
        rect.setAttribute("fill", "none");
        rect.setAttribute("stroke-width", "2");

        const sun = document.createElementNS(svgNS, "circle");
        sun.setAttribute("cx", "7");
        sun.setAttribute("cy", "9");
        sun.setAttribute("r", "2");

        const mountain = document.createElementNS(svgNS, "path");
        mountain.setAttribute("d", "M2 20 L9 13 L13 17 L17 12 L22 20 Z");

        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", "4");
        line.setAttribute("y1", "18");
        line.setAttribute("x2", "20");
        line.setAttribute("y2", "6");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-linecap", "round");
        line.style.display = "none";

        const setIconColor = () => {
            const isDark = isDarkMode();
            const mainColor = isDark ? '#fff' : '#0f0f0f';
            const strikeColor = isDark ? '#D8D8D8' : '#252525';
            rect.setAttribute("stroke", mainColor);
            sun.setAttribute("fill", mainColor);
            mountain.setAttribute("fill", mainColor);
            mountain.setAttribute("opacity", "0.4");
            line.setAttribute("stroke", strikeColor);
        };

        svg.append(rect, sun, mountain, line);
        toggleBtn.appendChild(svg);

        toggleBtn.addEventListener('mouseenter', () => {
            if (!thumbnailsHidden) line.style.display = "block";
        });
        toggleBtn.addEventListener('mouseleave', () => {
            if (!thumbnailsHidden) line.style.display = "none";
        });
        toggleBtn.addEventListener('click', () => {
            thumbnailsHidden = !thumbnailsHidden;
            sessionStorage.setItem('thumbnailsHidden', thumbnailsHidden);
            toggleAllThumbnails(thumbnailsHidden);
            line.style.display = thumbnailsHidden ? "block" : "none";
        });

        createBtn.replaceWith(toggleBtn);

        // Set initial icon color and listen for changes
        setIconColor();
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setIconColor);
    }

    /**
     * Handles mutations to the DOM, looking for new thumbnails and the create button.
     * @param {MutationRecord[]} mutationsList The list of mutations.
     */
    function handleMutations(mutationsList) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // First, check for the create button if it's not there yet
                if (!document.getElementById('thumbnail-toggle-btn')) {
                    const createBtn = document.querySelector('button[aria-label="Create"]');
                    if (createBtn) {
                        const parentButtonRenderer = createBtn.closest('ytd-button-renderer');
                        if (parentButtonRenderer) {
                           setupButton(parentButtonRenderer);
                        }
                    }
                }
                
                // ! DOES NOT WORK:
                // If thumbnails are hidden, hide any newly added ones
                if (thumbnailsHidden) {
                        console.log('thumbs hidden...hiding');
                        toggleAllThumbnails(true)
                    //     mutation.addedNodes.forEach(node => {
                        //         if (node.nodeType === Node.ELEMENT_NODE) {
                            //             if (node.matches && (node.matches('ytd-thumbnail') || node.matches('ytm-media-item')) || (node.matches('yt-thumbnail-view-model'))) {
                                
                //             }
                //         }
                //     });
                }   
            }
        }
    }

    // --- Main Execution ---

    console.log('start observer. 12:44');
    
    // More targeted observer
    const observer = new MutationObserver(handleMutations);

    // We can start by observing the body, but once we find the main content area,
    // we can narrow our focus.
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // An alternative, more focused approach is to wait for a key element to appear
    // and then observe that. For example, YouTube's main content area.
    const interval = setInterval(() => {
        const content = document.querySelector('ytd-page-manager');
        if (content) {
            clearInterval(interval);
            // Disconnect the broad observer and connect a more focused one
            observer.disconnect();
            observer.observe(content, {
                childList: true,
                subtree: true
            });
        }
    }, 500);

})();