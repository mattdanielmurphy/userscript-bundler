// ==UserScript==
// @name         Google Docs (published) — readable layout
// @namespace    Matt's userscripts
// @version      1.0.0
// @description  Removes the stacked page padding on published Google Docs (/pub) and shrinks Word-style 48px-per-level list indents so text is readable at any width.
// @match        https://docs.google.com/document/d/*/pub*
// @match        https://docs.google.com/document/d/e/*/pub*
// @run-at       document-end
// @grant        none
// ==/UserScript==

;(() => {
	"use strict"

	const styleId = "gdocs-pub-readable-style"
	if (document.getElementById(styleId)) return

	const doc = document.querySelector("#contents > .doc-content")
	if (!doc) return

	const style = document.createElement("style")
	style.id = styleId
	style.textContent = `
		#contents {
			padding: 1.5rem clamp(1rem, 4vw, 3rem) 3rem !important;
			box-sizing: border-box;
		}
		#contents > .doc-content {
			box-sizing: border-box;
			max-width: 48rem !important;
			width: 100% !important;
			padding: 0 !important;
			margin: 0 auto !important;
		}
		#contents > .doc-content table {
			width: 100% !important;
			max-width: 100% !important;
			margin-left: 0 !important;
			margin-right: 0 !important;
		}
		#contents > .doc-content td {
			width: auto !important;
		}
		#contents > .doc-content span:has(> img) {
			max-width: 100% !important;
			height: auto !important;
		}
		#contents > .doc-content img {
			max-width: 100% !important;
			height: auto !important;
			margin: 0 !important;
			transform: none !important;
		}
	`
	document.head.appendChild(style)

	// Google converts Word indents literally: 48px (36pt) per list level.
	// Rescale every left indent to 1.5em per level so deep lists stay readable.
	const STEP_PX = 48
	const STEP_EM = 1.5
	for (const el of doc.querySelectorAll("li, p")) {
		const ml = parseFloat(getComputedStyle(el).marginLeft)
		if (ml >= STEP_PX / 2) {
			const levels = ml / STEP_PX
			el.style.setProperty("margin-left", `${(levels * STEP_EM).toFixed(2)}em`, "important")
		}
	}
})()
