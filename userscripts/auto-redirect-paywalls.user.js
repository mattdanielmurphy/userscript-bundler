// ==UserScript==
// @name         Auto Redirect Paywalls to Archive
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically redirects paywalled news sites to archive.ph
// @match        https://www.theverge.com/*
// @match        https://www.nytimes.com/*
// @match        https://www.wsj.com/*
// @match        https://www.washingtonpost.com/*
// @match        https://www.theatlantic.com/*
// @match        https://www.economist.com/*
// @match        https://www.newyorker.com/*
// @match        https://www.bloomberg.com/*
// @match        https://www.ft.com/*
// @match        https://www.wired.com/*
// @match        https://www.thetimes.co.uk/*
// @match        https://www.businessinsider.com/*
// @match        https://hbr.org/*
// @run-at       document-start
// ==UserScript==

(function() {
    'use strict';
    // Prevent infinite loops if already on archive
    if (!window.location.href.includes('archive.ph')) {
        const archiveUrl = 'https://archive.ph/newest/' + encodeURIComponent(window.location.href);
        window.location.replace(archiveUrl);
    }
})();
