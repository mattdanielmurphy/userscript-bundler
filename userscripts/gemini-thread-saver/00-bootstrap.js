// ==UserScript==
// @name         Gemini Enhancements
// @namespace    local.gemini.enhancements
// @version      5.0.0
// @description  Timestamps, thread token counter, private local Markdown archiving, prompt tools, model optimizer, and terminal command execution for Gemini.
// @match        https://gemini.google.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @connect      127.0.0.1
// @run-at       document-start
// ==/UserScript==

/**
 * Gemini Thread Saver - Grouped Source
 * All files in the gemini-thread-saver group are concatenated by bundler.js
 * into a single shared lexical scope inside this outer IIFE.
 */
(function () {
	"use strict"
