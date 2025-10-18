// ==UserScript==
// @name         YouTube - Toggle Thumbnails
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Adds a button to toggle video thumbnails on YouTube, waiting for elements to appear and handling dynamically loaded content.
// @author       Gemini
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    console.log('Userscript "YouTube - Toggle Thumbnails" loaded.');

    let hidden = false;
    let buttonSetup = false

    // Function to hide or show all thumbnails currently in the DOM
    function toggleAllThumbnails(hide) {
        document.querySelectorAll('yt-thumbnail-view-model').forEach(el => {
            applyThumbnailStyle(el, hide);
        });
    }

    // Applies the style to a single thumbnail element
    function applyThumbnailStyle(el, hide) {
        el.style.position = hide ? 'absolute' : '';
        el.style.left = hide ? '-999999px' : '';
        el.style.top = hide ? '-999999px' : '';
    }

    // Check for dark mode
    function isDarkMode() {
        return window.matchMedia &&
               window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Main function to create and set up the toggle button
    function setupButton(createBtn) {
        buttonSetup = true
        console.log('setupButton called for:', createBtn);
        // Prevent re-creating the button
        if (document.getElementById('thumbnail-toggle-btn')) {
            console.log('Button already exists.');
            return;
        }

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'thumbnail-toggle-btn';
        toggleBtn.title = "Toggle Thumbnails";
        toggleBtn.style.height = createBtn.offsetHeight + 'px';
        toggleBtn.style.width = createBtn.offsetWidth + 'px';
        toggleBtn.style.display = 'flex';
        toggleBtn.style.alignItems = 'center';
        toggleBtn.style.justifyContent = 'center';
        toggleBtn.style.background = 'transparent';
        toggleBtn.style.border = 'none';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.padding = '0';
        toggleBtn.style.position = 'relative';

        // SVG elements from user's code
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

        function setIconColor() {
            const isDark = isDarkMode();
            const main = isDark ? '#fff' : '#0f0f0f';
            const strike = isDark ? '#D8D8D8' : '#252525';
            rect.setAttribute("stroke", main);
            sun.setAttribute("fill", main);
            mountain.setAttribute("fill", main);
            mountain.setAttribute("opacity", "0.4");
            line.setAttribute("stroke", strike);
        }

        function attachThemeListeners() {
            setIconColor();
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setIconColor);
            }
        }

        svg.appendChild(rect);
        svg.appendChild(sun);
        svg.appendChild(mountain);
        svg.appendChild(line);
        toggleBtn.appendChild(svg);

        toggleBtn.addEventListener('mouseenter', () => {
            if (!hidden) line.style.display = "block";
        });
        toggleBtn.addEventListener('mouseleave', () => {
            if (!hidden) line.style.display = "none";
        });
        toggleBtn.addEventListener('click', () => {
            hidden = !hidden;
            console.log('toggle thumbnails')
            toggleAllThumbnails(hidden);
            line.style.display = hidden ? "block" : "none";
        });

        createBtn.replaceWith(toggleBtn);
        console.log('Replaced createBtn with toggleBtn.');
        attachThemeListeners();
        setTimeout(setIconColor, 5);
    }

    // Use a MutationObserver to wait for the create video button and watch for new thumbnails
    const observer = new MutationObserver((mutationsList, obs) => {
        console.log('11:32.2 Observer callback fired.');
        if (!buttonSetup) {
            console.log(" Checking for create video button...");
            const createBtn = document.querySelector('button[aria-label="Create"]').closest('ytd-button-renderer');
            if (createBtn) {
                console.log('Create button FOUND:', createBtn);
                setupButton(createBtn);
            }
        }

        console.log("going to hide thumbnails if hidden");
        if (hidden) {
            console.log("hiding thumbnails");
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches('yt-thumbnail-view-model')) {
                                applyThumbnailStyle(node, true);
                            }
                            node.querySelectorAll('yt-thumbnail-view-model').forEach(el => {
                                applyThumbnailStyle(el, true);
                            });
                        }
                    });
                }
            }
        }
    });

    // Start observing the entire document body for changes
    console.log('Starting observer.');
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();