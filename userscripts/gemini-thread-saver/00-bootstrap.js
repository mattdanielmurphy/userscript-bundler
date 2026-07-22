// ==UserScript==
// @name         Gemini Thread Saver
// @namespace    local.gemini.thread.saver
// @version      5.0.0
// @description  Gemini timestamps and private local Markdown archive.
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
