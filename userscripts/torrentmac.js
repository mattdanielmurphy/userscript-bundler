// ==UserScript==
// @name        TorrentMac Cleanup
// @namespace   http://tampermonkey.net/
// @version     1.0
// @description Remove fake "Download Now" buttons
// @author      Matthew Daniel Murphy
// @match       *://torrentmac.net/*
// @grant       none
// ==/UserScript==

;(function () {
	"use strict"

	const removeFakeButtons = () => {
		// Broad selection of potential button elements
		const candidates = document.querySelectorAll("a, button, span, div, strong, b")

		candidates.forEach((el) => {
			// Check strictly for "Download Now" with trimmed whitespace
			if (el.textContent && el.textContent.trim() === "Download Now") {
				// Determine if it looks roughly like a button (optional, but helps avoid removing text in paragraphs)
				// However, the prompt implies "any button", and "Download Now" is unlikely to be valid text content in a sentence
				// without being a link/button.
				// We'll trust the text content heuristic as requested.

				// We also want to ensure we aren't removing a container that just happens to have that text
				// but isn't the button itself, although for "Download Now", the leaf node or the wrapper is typically strictly that text.
				// A safe approach: if it has child elements that also have text, we might be too high up.
				// ideally we target leaf-ish nodes or links. `a` tags usually wrap the text.

				// Let's check if it's a link or button, or resembles one.
				// But the user said "dont rely on class names".

				// If we match an 'a' tag, remove it.
				if (el.tagName === "A" || el.tagName === "BUTTON") {
					el.remove()
					console.log("Removed fake Download Now button (tag match)", el)
				} else {
					// For non-semantic tags, checking if it is a leaf or close to it might be safer,
					// but let's just be aggressive if the text match is exact.
					// To be safe against removing a whole paragraph, we check if the text is the ONLY content.
					// el.textContent.trim() === 'Download Now' handles this implicitly for the full element content.

					// One edge case: <div><span>Download Now</span></div>
					// Both match. Removing the div removes the span. Removing the span removes the text.
					// If we remove the parent `div`, it's cleaner.
					// But if we remove the `span`, the empty `div` remains.
					// Let's just remove whatever matches.
					el.remove()
					console.log("Removed fake Download Now element", el)
				}
			}
		})
	}

	// Initial check
	removeFakeButtons()

	// Observer for dynamic content
	const observer = new MutationObserver((mutations) => {
		let shouldScan = false
		for (const mutation of mutations) {
			if (mutation.addedNodes.length > 0) {
				shouldScan = true
				break
			}
		}
		if (shouldScan) {
			removeFakeButtons()
		}
	})

	observer.observe(document.body, { childList: true, subtree: true })
})()
