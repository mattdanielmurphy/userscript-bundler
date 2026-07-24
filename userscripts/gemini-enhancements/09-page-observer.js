// ═══════════════════════════════════════════════════════════
// PAGE OBSERVERS & TOP-LEVEL ORCHESTRATION
// ═══════════════════════════════════════════════════════════

function updateTabTitle() {
	const titleEl = document.querySelector(
		'[data-test-id="conversation-title"]',
	)
	if (titleEl) {
		const newTitle = titleEl.innerText.trim()
		if (newTitle && document.title !== newTitle) {
			document.title = newTitle
		}
	}
}

function removeAdvUpsell(warnIfMissing = false) {
	const upsellContainer = document.querySelector(
		".right-section > .buttons-container.adv-upsell",
	)
	if (upsellContainer) {
		upsellContainer.remove()
	}
}

let lastSidebarClickTime = 0
function ensureSidebarOpen() {
	const now = Date.now()
	if (now - lastSidebarClickTime < 3000) return
	const openButton = document.querySelector(
		'button.side-nav-sparkle-button[aria-label="Open sidebar"]',
	)
	if (openButton && openButton.offsetParent !== null) {
		lastSidebarClickTime = now
		openButton.click()
		console.log("[GMT] Sidebar persistence: Sidebar was closed. Opening it now.")
	}
}

let lastUrl = location.href

let syncTimeout = null
let observerTimeout = null
function startObservers() {
	if (!document.body) {
		requestAnimationFrame(startObservers)
		return
	}
	ensureTooltip()
	ensureSidebarOpen()
	new MutationObserver((mutations) => {
		// Check if mutations only contain typing/editing events or temp sync elements
		let isOnlyTypingOrTemp = true
		for (const m of mutations) {
			const target = m.target
			if (!target) continue
			if (target.nodeType === Node.ELEMENT_NODE) {
				if (
					target.closest(
						'[contenteditable="true"], input, textarea, .ql-editor, #ai-os-sync-temp-container',
					)
				) {
					continue
				}
			} else if (target.nodeType === Node.TEXT_NODE) {
				if (
					target.parentElement &&
					target.parentElement.closest(
						'[contenteditable="true"], input, textarea, .ql-editor, #ai-os-sync-temp-container',
					)
				) {
					continue
				}
			}
			isOnlyTypingOrTemp = false
			break
		}
		if (isOnlyTypingOrTemp) return

		// Debounce DOM-heavy callbacks to avoid thrashing during rapid mutations
		if (observerTimeout) clearTimeout(observerTimeout)
		observerTimeout = setTimeout(() => {
			ensureSidebarOpen()
			processEmbeddedTimestamps()
			updateSidebarDOM()
			updateTabTitle()
			removeAdvUpsell()

			// AI-OS Integrations
			injectUI()
			scanExecutionPayloads()
			injectRunButtons()
			if (typeof window.scanToolCalls === "function") window.scanToolCalls()

			const url = location.href
			if (url !== lastUrl) {
				lastUrl = url
				updateSidebarDOM()
				updateTabTitle()
			}
		}, 250)

		// Detect if a user-query or model-response changed or was added for context sync
		let shouldExport = false
		for (const mutation of mutations) {
			if (
				mutation.target &&
				mutation.target.nodeType === Node.ELEMENT_NODE &&
				mutation.target.closest("model-response, user-query")
			) {
				shouldExport = true
				break
			}
			if (mutation.addedNodes) {
				for (const node of mutation.addedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const tag = node.tagName.toLowerCase()
						if (
							tag === "model-response" ||
							tag === "user-query" ||
							node.querySelector?.("model-response, user-query")
						) {
							shouldExport = true
							break
						}
					}
				}
				if (shouldExport) break
			}
		}

		if (shouldExport && autoThreadSync) {
			if (syncTimeout) clearTimeout(syncTimeout)

			const isCurrentlyGenerating = () => {
				const stopButton = document.querySelector(
					'button[aria-label*="Stop"], button[aria-label*="stop"]',
				)
				if (stopButton) {
					const label = stopButton.getAttribute("aria-label") || ""
					if (
						/stop/i.test(label) &&
						(/generat/i.test(label) ||
							/respons/i.test(label) ||
							/stream/i.test(label))
					) {
						return true
					}
				}
				const msgElements = document.querySelectorAll(
					"user-query, model-response",
				)
				if (msgElements.length > 0) {
					const lastMsg = msgElements[msgElements.length - 1]
					if (lastMsg.tagName.toLowerCase() === "user-query") {
						return true
					}
				}
				return false
			}

			if (!isCurrentlyGenerating()) {
				syncTimeout = setTimeout(() => {
					exportThreadWithTimestamps()
				}, 3000)
			}
		}
	}).observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true,
	})

	processEmbeddedTimestamps()
	updateSidebarDOM()
	updateTabTitle()
	removeAdvUpsell(true)

	// Initial AI-OS integrations
	injectUI()
	scanExecutionPayloads()
	injectRunButtons()
	if (typeof window.scanToolCalls === "function") window.scanToolCalls()
	setTimeout(() => {
		if (autoThreadSync) {
			exportThreadWithTimestamps()
		}
	}, 1500)

	console.log("[GMT] observers started")
}

startObservers()

// Close the outer IIFE started in 00-bootstrap.js
})();
