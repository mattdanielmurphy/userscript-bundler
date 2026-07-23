// ═══════════════════════════════════════════════════════════
// TOKEN COUNTER & THREAD TOKEN USAGE BADGE
// ═══════════════════════════════════════════════════════════

/**
 * Highly accurate, self-contained token estimator using the official
 * cl100k_base (GPT-4 / Claude) regex splitting rules.
 * Zero external dependencies, 100% CSP-safe.
 *
 * @param {string} text - The input text to estimate.
 * @returns {number} Estimated token count.
 */
const estimateTokensAccurate = (text) => {
	if (!text) return 0

	// The official cl100k_base regex pattern used to isolate tokens before mapping
	const cl100k_regex =
		/'s|'t|'re|'ve|'m|'ll|'d|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}|[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu

	const chunks = text.match(cl100k_regex)
	if (!chunks) return 0

	let totalTokens = 0

	for (let chunk of chunks) {
		const len = chunk.length

		// 1. Handle standard small chunks (single characters, spaces, punctuation)
		if (len <= 3) {
			totalTokens += 1
			continue
		}

		// 2. Adjust for dense code syntax or repetitive punctuation strings
		if (/^[^\s\p{L}\p{N}]+$/u.test(chunk)) {
			// Punctuation bursts (e.g., " => {", " }): roughly 1 token per 2 chars
			totalTokens += Math.ceil(len / 2)
			continue
		}

		// 3. Standard prose words
		// Long English words average out to roughly 1 token per 4 characters
		totalTokens += Math.ceil(len / 4)
	}

	return totalTokens
}

let lastConversationId = null
let beginningLoaded = false

function getScrollContainer() {
	const firstQuery = document.querySelector(".query-text")
	if (!firstQuery) return null
	let parent = firstQuery.parentElement
	while (parent && parent !== document.body) {
		const overflowY = window.getComputedStyle(parent).overflowY
		if (overflowY === "auto" || overflowY === "scroll") {
			return parent
		}
		parent = parent.parentElement
	}
	return document.documentElement
}

function getThreadMessages() {
	const elements = document.querySelectorAll(
		".query-text, model-response .markdown",
	)
	return Array.from(elements).map((el) => {
		const isUser = el.classList.contains("query-text")
		let text = (el.textContent || "").trim()
		if (isUser && el.dataset.contextAnchor) {
			text += ` [context to this point is ${el.dataset.contextAnchor}]`
		}
		return {
			role: isUser ? "user" : "assistant",
			text: text,
			element: el,
		}
	})
}

function calculateThreadTokens() {
	const messages = getThreadMessages()
	if (messages.length === 0) {
		return {
			total: 0,
			input: 0,
			output: 0,
			isPrecise: true,
			hasAnchor: false,
		}
	}

	const currentId = getArchiveConversationId()
	if (currentId !== lastConversationId) {
		lastConversationId = currentId
		beginningLoaded = false
	}

	if (!beginningLoaded) {
		const scrollContainer = getScrollContainer()
		if (scrollContainer && scrollContainer.scrollTop <= 5) {
			beginningLoaded = true
		}
	}

	let anchorIndex = -1
	let anchorValue = 0
	let hasAnchor = false

	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]
		if (msg.role === "user") {
			const match = msg.text.match(/\[context to this point is (\d+|\*)\]/)
			if (match) {
				const val = match[1]
				if (val !== "*") {
					anchorIndex = i
					anchorValue = parseInt(val, 10)
					hasAnchor = true
					break
				}
			}
		}
	}

	// If no text anchor is found, attempt to retrieve the last precise total from localStorage
	if (!hasAnchor && currentId) {
		try {
			const cached = localStorage.getItem(`gmt_thread_${currentId}`)
			if (cached) {
				const cachedData = JSON.parse(cached)
				if (
					cachedData &&
					typeof cachedData.total === "number" &&
					cachedData.lastMessageText
				) {
					for (let i = messages.length - 1; i >= 0; i--) {
						if (messages[i].text === cachedData.lastMessageText) {
							anchorIndex = i
							anchorValue = cachedData.total
							hasAnchor = true
							break
						}
					}
				}
			}
		} catch (e) {
			console.error("[GMT] LocalStorage retrieval error:", e)
		}
	}

	let total = 0
	let input = 0
	let output = 0
	let isPrecise = beginningLoaded

	if (hasAnchor) {
		total = anchorValue
		isPrecise = true
		for (let i = anchorIndex + 1; i < messages.length; i++) {
			const tokens = estimateTokensAccurate(messages[i].text)
			total += tokens
			if (messages[i].role === "user") {
				input += tokens
			} else {
				output += tokens
			}
		}
	} else {
		for (let i = 0; i < messages.length; i++) {
			const tokens = estimateTokensAccurate(messages[i].text)
			total += tokens
			if (messages[i].role === "user") {
				input += tokens
			} else {
				output += tokens
			}
		}
	}

	// Save the precise count to localStorage if precise and we have a valid conversation ID
	if (isPrecise && currentId && messages.length > 0) {
		const lastMsg = messages[messages.length - 1]
		if (lastMsg && lastMsg.text) {
			try {
				localStorage.setItem(
					`gmt_thread_${currentId}`,
					JSON.stringify({
						total,
						lastMessageText: lastMsg.text,
						timestamp: Date.now(),
					}),
				)
			} catch (e) {
				console.error("[GMT] LocalStorage save error:", e)
			}
		}
	}

	return { total, input, output, isPrecise, hasAnchor }
}

function checkThreadUsage() {
	const usage = calculateThreadTokens()
	const { total, input, output, isPrecise, hasAnchor } = usage

	if (total === 0) {
		const existingBadge = document.getElementById("gmt-token-usage-badge")
		if (existingBadge) {
			existingBadge.style.display = "none"
		}
		const existingTooltip = document.getElementById("gmt-token-usage-tooltip")
		if (existingTooltip) {
			existingTooltip.style.display = "none"
		}
		return
	}

	let badge = document.getElementById("gmt-token-usage-badge")
	let tooltip = document.getElementById("gmt-token-usage-tooltip")
	let totalSpan
	if (!badge) {
		badge = document.createElement("div")
		badge.id = "gmt-token-usage-badge"
		badge.style.cssText = `
			position: fixed;
			bottom: 8px;
			right: 8px;
			background: rgba(30, 30, 46, 0.75);
			backdrop-filter: blur(12px) saturate(180%);
			-webkit-backdrop-filter: blur(12px) saturate(180%);
			border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 10px;
			padding: 6px 10px;
			font-family: Google Sans, Roboto, sans-serif;
			font-size: 0.82rem;
			color: #e2e2f0;
			z-index: 99999;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
			display: flex;
			align-items: center;
			gap: 8px;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			user-select: none;
			opacity: 0.9;
			cursor: default;
		`

		// Create Custom Tooltip (Google/Gemini style)
		tooltip = document.createElement("div")
		tooltip.id = "gmt-token-usage-tooltip"
		tooltip.style.cssText = `
			position: fixed;
			bottom: 44px;
			right: 8px;
			background: rgba(23, 23, 27, 0.95);
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			border: 1px solid rgba(255, 255, 255, 0.12);
			border-radius: 8px;
			padding: 8px 12px;
			font-family: Google Sans, Roboto, sans-serif;
			font-size: 0.8rem;
			color: #e3e3e6;
			z-index: 99999;
			box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
			display: flex;
			flex-direction: column;
			gap: 4px;
			pointer-events: none;
			opacity: 0;
			transform: translateY(4px);
			transition: opacity 0.12s cubic-bezier(0.4, 0, 0.2, 1), transform 0.12s cubic-bezier(0.4, 0, 0.2, 1);
			min-width: 120px;
		`

		const titleEl = document.createElement("div")
		titleEl.textContent = "Thread Usage"
		titleEl.style.cssText =
			"font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.5px; color: #80808b; font-weight: 700; margin-bottom: 2px;"
		tooltip.appendChild(titleEl)

		// Input row
		const inRow = document.createElement("div")
		inRow.style.cssText =
			"display: flex; justify-content: space-between; gap: 16px; color: #c4c4c7;"
		const inLabel = document.createElement("span")
		inLabel.textContent = "Input:"
		inRow.appendChild(inLabel)
		const inVal = document.createElement("span")
		inVal.id = "gmt-tooltip-in-val"
		inVal.style.cssText = "color: #a6e3a1; font-weight: 600;"
		inRow.appendChild(inVal)
		tooltip.appendChild(inRow)

		// Output row
		const outRow = document.createElement("div")
		outRow.style.cssText =
			"display: flex; justify-content: space-between; gap: 16px; color: #c4c4c7;"
		const outLabel = document.createElement("span")
		outLabel.textContent = "Output:"
		outRow.appendChild(outLabel)
		const outVal = document.createElement("span")
		outVal.id = "gmt-tooltip-out-val"
		outVal.style.cssText = "color: #74c7ec; font-weight: 600;"
		outRow.appendChild(outVal)
		tooltip.appendChild(outRow)

		// Divider
		const divider = document.createElement("div")
		divider.style.cssText =
			"height: 1px; background: rgba(255, 255, 255, 0.1); margin: 2px 0;"
		tooltip.appendChild(divider)

		// Total row
		const totalRow = document.createElement("div")
		totalRow.style.cssText =
			"display: flex; justify-content: space-between; gap: 16px; font-weight: 700;"
		const totalLabel = document.createElement("span")
		totalLabel.textContent = "Total:"
		totalRow.appendChild(totalLabel)
		const totalVal = document.createElement("span")
		totalVal.id = "gmt-tooltip-total-val"
		totalVal.style.cssText = "color: #f9e2af;"
		totalRow.appendChild(totalVal)
		tooltip.appendChild(totalRow)

		document.body.appendChild(tooltip)

		badge.addEventListener("mouseenter", () => {
			badge.style.transform = "translateY(-2px)"
			badge.style.opacity = "1"
			badge.style.borderColor = "rgba(255, 255, 255, 0.16)"
			badge.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.4)"

			tooltip.style.opacity = "1"
			tooltip.style.transform = "translateY(0)"
		})
		badge.addEventListener("mouseleave", () => {
			badge.style.transform = "translateY(0)"
			badge.style.opacity = "0.9"
			badge.style.borderColor = "rgba(255, 255, 255, 0.08)"
			badge.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.3)"

			tooltip.style.opacity = "0"
			tooltip.style.transform = "translateY(4px)"
		})

		// Total span
		totalSpan = document.createElement("span")
		totalSpan.id = "gmt-token-total"
		totalSpan.style.cssText = "font-weight: 700; color: #e2e2f0;"
		badge.appendChild(totalSpan)

		// Blocks container
		const blocksContainer = document.createElement("div")
		blocksContainer.id = "gmt-token-blocks"
		blocksContainer.style.cssText =
			"display: flex; align-items: flex-end; gap: 2px; height: 12px;"

		// Create 5 blocks
		const heights = [4, 6, 8, 10, 12]
		for (let i = 0; i < 5; i++) {
			const block = document.createElement("div")
			block.className = "gmt-token-block"
			block.style.cssText = `width: 3px; height: ${heights[i]}px; border-radius: 1px; transition: background-color 0.3s ease;`
			blocksContainer.appendChild(block)
		}
		badge.appendChild(blocksContainer)

		document.body.appendChild(badge)
	} else {
		totalSpan = document.getElementById("gmt-token-total")
	}

	// Calculate stage
	let stage = 1
	let stageColor = "#a6e3a1" // Green
	if (total > 20000) {
		stage = 5
		stageColor = "#f38ba8" // Red
	} else if (total > 10000) {
		stage = 4
		stageColor = "#fab387" // Orange
	} else if (total > 5000) {
		stage = 3
		stageColor = "#f9e2af" // Yellow
	} else if (total > 2000) {
		stage = 2
		stageColor = "#89b4fa" // Blue
	}

	badge.style.display = "flex"
	if (tooltip) {
		tooltip.style.display = "flex"
		const inVal = document.getElementById("gmt-tooltip-in-val")
		const outVal = document.getElementById("gmt-tooltip-out-val")
		const totalVal = document.getElementById("gmt-tooltip-total-val")

		const prefix = hasAnchor ? "+" : ""
		const suffix = isPrecise ? "" : "*"

		if (inVal) inVal.textContent = prefix + input.toLocaleString() + suffix
		if (outVal) outVal.textContent = prefix + output.toLocaleString() + suffix
		if (totalVal) totalVal.textContent = total.toLocaleString() + suffix

		let statusRow = document.getElementById("gmt-tooltip-status")
		if (!statusRow) {
			statusRow = document.createElement("div")
			statusRow.id = "gmt-tooltip-status"
			statusRow.style.cssText =
				"font-size: 0.65rem; color: #f38ba8; font-weight: 500; margin-top: 4px; text-align: right;"
			tooltip.appendChild(statusRow)
		}
		if (!isPrecise) {
			statusRow.textContent = "* Scroll to top to calculate full count"
			statusRow.style.color = "#f38ba8"
			statusRow.style.display = "block"
		} else if (hasAnchor) {
			statusRow.textContent = "Incremental since last saved point"
			statusRow.style.color = "#89b4fa"
			statusRow.style.display = "block"
		} else {
			statusRow.style.display = "none"
		}
	}

	totalSpan.textContent = total.toLocaleString() + (isPrecise ? "" : "*")

	// Update block colors
	const blocks = badge.querySelectorAll(".gmt-token-block")
	blocks.forEach((block, index) => {
		if (index < stage) {
			block.style.backgroundColor = stageColor
		} else {
			block.style.backgroundColor = "rgba(255, 255, 255, 0.15)"
		}
	})
}

// Call checkThreadUsage periodically
setInterval(checkThreadUsage, 2500)
