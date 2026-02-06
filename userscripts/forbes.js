// ==UserScript==
// @name        Forbes Paywall Bypass
// @match       *://*.forbes.com/*
// ==/UserScript==

document.querySelector("#article-modal")?.remove()
document.querySelectorAll(".zephr-backdrop").forEach((e) => e.remove())
document.body.style.overflow = "auto"
document.documentElement.style.overflow = "auto"
