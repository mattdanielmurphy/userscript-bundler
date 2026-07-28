// ==UserScript==
// @name        XKCD Explain Embed
// @author      Matthew Daniel Murphy
// @description Embeds the explainxkcd.com page for the current comic at the bottom of the page
// @version     1.0
// @match       https://xkcd.com/*
// @grant       none
// ==/UserScript==

;(() => {
	"use strict"

	// Comic URL is e.g. https://xkcd.com/1234/ → pathname "/1234/" → "1234"
	const comicNumber = location.pathname.replace(/\//g, "")
	if (!comicNumber) return

	const embedExplain = () => {
		const container = document.getElementById("middleContainer")
		if (!container) return false

		// Avoid re-embedding if already present
		if (container.querySelector(".xkcd-explain-embed")) return true

		const explainUrl = `https://www.explainxkcd.com/wiki/index.php/${comicNumber}`
		const iframe = document.createElement("iframe")
		iframe.className = "xkcd-explain-embed"
		iframe.src = explainUrl
		iframe.style.width = "100%"
		iframe.style.height = "600px"
		iframe.style.border = "2px solid #ccc"
		iframe.style.marginTop = "16px"

		container.appendChild(iframe)
		return true
	}

	if (!embedExplain()) {
		const observer = new MutationObserver((mutations, obs) => {
			if (embedExplain()) {
				obs.disconnect()
			}
		})
		observer.observe(document.body, { childList: true, subtree: true })

		// Fallback timeout
		setTimeout(() => observer.disconnect(), 8000)
	}
})()