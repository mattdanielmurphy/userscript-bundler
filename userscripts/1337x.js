// ==UserScript==
// @name        Auto Focus 1337x Search
// @author      Matthew Daniel Murphy
// @description Auto focus the search input on 1337x.to
// @version     1.0
// @match       *://1337x.to
// @grant       none
// ==/UserScript==

;(() => {
	"use strict"

	const focusSearch = () => {
		const input = document.querySelector("#search-index-form input")
		if (input) {
			input.focus()
			return true
		}
		return false
	}

	if (!focusSearch()) {
		const observer = new MutationObserver((mutations, obs) => {
			if (focusSearch()) {
				obs.disconnect()
			}
		})
		observer.observe(document.body, { childList: true, subtree: true })

		// Fallback timeout to stop observing after a while
		setTimeout(() => observer.disconnect(), 5000)
	}
})()
