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
// @connect      127.0.0.1
// @run-at       document-start
// ==/UserScript==

/**
 * Gemini Thread Saver Userscript
 *
 * To modify this script, take advantage of the chrome MCP server!
 * If you update the userscript, all you have to do is reload the Chrome
 * debug tab to get the latest changes loaded.
 *
 * If you need to modify the gemini-thread-saver server, you can do so
 * and then run `la restart gemini-thread-saver` in your terminal to restart it.
 */

// Token Counter
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

// Token counter logic has been relocated inside the IIFE below.
;(function () {
	"use strict"

	// --- Integration with your parsing logic ---
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

	// ═══════════════════════════════════════════════════════════
	// GM SETTINGS
	// ═══════════════════════════════════════════════════════════

	let currentLayout = GM_getValue("gwd_layout_style", "split")
	let showAbsolute = GM_getValue("gwd_show_absolute", false)
	let dateFormat = GM_getValue("gwd_date_format", "yyyy-mm-dd")
	let autoThreadSync = GM_getValue("gwd_auto_thread_sync", true)
	let isMenuExpanded = GM_getValue("gwd_menu_expanded", false)

	let menuIds = []

	function getMenuText(key) {
		const dict = {
			settingsToggle: `⚙️ Sidebar Date Settings (${isMenuExpanded ? "Click to collapse ⬆️" : "Click to expand ⬇️"})`,
			layout: ` ├─ 📐 Layout: ${currentLayout === "split" ? "Right (Click → Below title)" : "Below title (Click → Right)"}`,
			absolute: ` ├─ ⏰ Detailed Time: ${showAbsolute ? "Visible (Click → Hide)" : "Hidden (Click → Show)"}`,
			format: ` ├─ 📅 Date Format: ${dateFormat === "yyyy-mm-dd" ? "YYYY-MM-DD (Click → MM/DD/YYYY)" : "MM/DD/YYYY (Click → YYYY-MM-DD)"}`,
			sync: ` └─ 🔄 Auto Thread Sync: ${autoThreadSync ? "Enabled (Click → Disable)" : "Disabled (Click → Enable)"}`,
		}
		return dict[key] || ""
	}

	function refreshMenu() {
		menuIds.forEach((id) => GM_unregisterMenuCommand(id))
		menuIds = []
		const opts = { autoClose: false }

		menuIds.push(
			GM_registerMenuCommand(
				getMenuText("settingsToggle"),
				() => {
					isMenuExpanded = !isMenuExpanded
					GM_setValue("gwd_menu_expanded", isMenuExpanded)
					refreshMenu()
				},
				opts,
			),
		)

		if (isMenuExpanded) {
			menuIds.push(
				GM_registerMenuCommand(
					getMenuText("layout"),
					() => {
						currentLayout = currentLayout === "classic" ? "split" : "classic"
						GM_setValue("gwd_layout_style", currentLayout)
						clearAndReRenderSidebar()
						refreshMenu()
					},
					opts,
				),
			)

			menuIds.push(
				GM_registerMenuCommand(
					getMenuText("absolute"),
					() => {
						showAbsolute = !showAbsolute
						GM_setValue("gwd_show_absolute", showAbsolute)
						clearAndReRenderSidebar()
						refreshMenu()
					},
					opts,
				),
			)

			menuIds.push(
				GM_registerMenuCommand(
					getMenuText("format"),
					() => {
						dateFormat =
							dateFormat === "yyyy-mm-dd" ? "mm/dd/yyyy" : "yyyy-mm-dd"
						GM_setValue("gwd_date_format", dateFormat)
						clearAndReRenderSidebar()
						refreshMenu()
					},
					opts,
				),
			)

			menuIds.push(
				GM_registerMenuCommand(
					getMenuText("sync"),
					() => {
						autoThreadSync = !autoThreadSync
						GM_setValue("gwd_auto_thread_sync", autoThreadSync)
						refreshMenu()
					},
					opts,
				),
			)
		}
	}

	refreshMenu()

	// ═══════════════════════════════════════════════════════════
	// SHARED TOOLTIP SINGLETON
	// ═══════════════════════════════════════════════════════════

	const FONT = "Google Sans, Google Sans Flex, Roboto, sans-serif"
	let tooltipEl = null
	let tooltipTimer = null

	function ensureTooltip() {
		if (tooltipEl || !document.body) return
		tooltipEl = document.createElement("div")
		tooltipEl.style.cssText = `
      position: fixed;
      background: #1e1e2e;
      color: #e2e2f0;
      padding: 7px 13px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-family: ${FONT};
      pointer-events: none;
      z-index: 99999;
      display: none;
      box-shadow: 0 4px 18px rgba(0,0,0,0.4);
      white-space: nowrap;
      line-height: 1.6;
    `
		document.body.appendChild(tooltipEl)
	}

	function showTooltip(e, text) {
		ensureTooltip()
		if (!tooltipEl) return
		tooltipEl.innerText = text
		tooltipEl.style.display = "block"
		positionTooltip(e)
	}

	function hideTooltip() {
		if (tooltipEl) tooltipEl.style.display = "none"
	}

	function positionTooltip(e) {
		if (!tooltipEl) return
		tooltipEl.style.left = `${e.clientX + 14}px`
		tooltipEl.style.top = `${e.clientY - 42}px`
	}

	// Used by message timestamp spans
	function attachTooltip(el, getFullText) {
		el.style.cursor = "default"
		el.addEventListener("mouseenter", (e) => showTooltip(e, getFullText()))
		el.addEventListener("mousemove", positionTooltip)
		el.addEventListener("mouseleave", hideTooltip)
	}

	// ═══════════════════════════════════════════════════════════
	// SHARED TIME UTILITIES
	// ═══════════════════════════════════════════════════════════

	function getLocalTzAbbr() {
		return new Date()
			.toLocaleTimeString("en-US", { timeZoneName: "short" })
			.split(" ")
			.pop()
	}

	function getLocalTzOffsetHours() {
		return -new Date().getTimezoneOffset() / 60
	}

	function formatTime(date) {
		return date.toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
		})
	}

	function formatFullDateTime(date) {
		const d = date.toLocaleDateString([], {
			month: "long",
			day: "numeric",
			year: "numeric",
		})
		return `${d} at ${formatTime(date)} ${getLocalTzAbbr()}`
	}

	function getRelativeDateLabel(unix, forSidebar = false) {
		const date = new Date(unix * 1000)
		const now = new Date()
		const todayMs = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		).getTime()
		const targetMs = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate(),
		).getTime()
		const diffDays = Math.floor((todayMs - targetMs) / 86400000)

		if (diffDays <= 0) return forSidebar ? "Today" : null
		if (diffDays === 1) return "Yesterday"
		if (diffDays === 2) return "2 days ago"
		if (diffDays < 7) return `${diffDays} days ago`

		const weeks = Math.floor(diffDays / 7)
		if (diffDays < 30) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`

		const months = Math.floor(diffDays / 30.44)
		if (diffDays < 365)
			return months === 1 ? "1 month ago" : `${months} months ago`

		const years = Math.floor(diffDays / 365.25)
		return years === 1 ? "1 year ago" : `${years} years ago`
	}

	// ═══════════════════════════════════════════════════════════
	// EMBED REGEX + MESSAGE TIMESTAMP STATE
	// ═══════════════════════════════════════════════════════════

	const EMBED_RE =
		/^\s*\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) ([A-Z]{2,5})([+-]\d+(?:\.\d+)?)\]\s*/
	const idToTimeMap = new Map()
	const exactContainers = new WeakSet()

	function buildMessageDisplay(unix, isEstimate) {
		const rel = getRelativeDateLabel(unix, false)
		const time = formatTime(new Date(unix * 1000))
		const prefix = isEstimate ? "~ " : ""
		return rel === null ? `${prefix}${time}` : `${prefix}${rel}, ${time}`
	}

	function injectTimestamp(container, unix, isEstimate) {
		if (container.querySelector(".gm-timestamp")) return
		const stamp = document.createElement("span")
		stamp.className = "gm-timestamp"
		stamp.innerText = buildMessageDisplay(unix, isEstimate)
		stamp.setAttribute(
			"data-timestamp",
			formatAbsoluteTime(new Date(unix * 1000)),
		)
		stamp.style.cssText = `
      font-size: 1rem;
      color: #555;
      font-family: ${FONT};
      width: 100%;
      margin-bottom: 8px;
      display: block;
      text-align: right;
    `
		attachTooltip(stamp, () => formatFullDateTime(new Date(unix * 1000)))
		container.prepend(stamp)
		console.log(`[GMT] injected "${stamp.innerText}" (estimate=${isEstimate})`)
	}

	// ═══════════════════════════════════════════════════════════
	// UNIFIED XHR + FETCH INTERCEPT
	// ═══════════════════════════════════════════════════════════

	function isSidebarUrl(url) {
		return url.includes("batchexecute") && url.includes("rpcids=MaZiqc")
	}

	function syncToAiOs(url, payload) {
		// Local-file archive replaces the former localhost raw-response mirror.
		// Gemini responses are still parsed locally for timestamps below.
	}

	const _xhrOpen = XMLHttpRequest.prototype.open
	XMLHttpRequest.prototype.open = function (method, url) {
		this._url = url
		return _xhrOpen.apply(this, arguments)
	}

	const _xhrSend = XMLHttpRequest.prototype.send
	XMLHttpRequest.prototype.send = function () {
		this.addEventListener("readystatechange", () => {
			const url = (this._url || "").toString()
			if (!url.includes("batchexecute")) return

			let res
			try {
				if (this.responseType === "" || this.responseType === "text") {
					res = this.responseText
				}
			} catch (e) {
				return
			}
			if (!res) return
			if (isSidebarUrl(url)) {
				if (this.readyState === 4) {
					extractSidebarTimestamps(res)
					syncToAiOs(url, res)
				}
			} else {
				if (this.readyState >= 3 && res.length > 500)
					extractMessageTimestamps(res)
				if (this.readyState === 4) {
					syncToAiOs(url, res)
				}
			}
		})
		return _xhrSend.apply(this, arguments)
	}

	const _fetch = window.fetch
	window.fetch = function (input, init) {
		const url = (typeof input === "string" ? input : input?.url) || ""
		if (!url.includes("batchexecute")) return _fetch.apply(this, arguments)
		return _fetch.apply(this, arguments).then((res) => {
			res
				.clone()
				.text()
				.then((text) => {
					if (isSidebarUrl(url)) {
						extractSidebarTimestamps(text)
					} else if (text.length > 500) {
						extractMessageTimestamps(text)
					}
					syncToAiOs(url, text)
				})
				.catch(() => {})
			return res
		})
	}

	// ═══════════════════════════════════════════════════════════
	// MESSAGE TIMESTAMP EXTRACTION
	// ═══════════════════════════════════════════════════════════

	function extractMessageTimestamps(res) {
		try {
			const hexIds = res.match(/[a-f0-9]{16}/g) || []
			const timestamps = res.match(/\b17\d{8}\b/g) || []
			if (!hexIds.length || !timestamps.length) return

			let added = 0
			hexIds.forEach((id, i) => {
				if (!idToTimeMap.has(id)) {
					idToTimeMap.set(id, parseInt(timestamps[i] || timestamps[0]))
					added++
				}
			})

			if (added > 0) {
				console.log(
					`[GMT] XHR message: processed ${hexIds.length} IDs, added ${added} new timestamps`,
				)
				injectHeuristicTimes()
			}
		} catch (e) {
			console.warn("[GMT] message ts error:", e)
		}
	}

	function injectHeuristicTimes() {
		const pending = []
		idToTimeMap.forEach((unix, id) => {
			let el =
				document.getElementById(id) ||
				document
					.querySelector(`[jslog*="${id}"]`)
					?.closest(".conversation-container")
			if (
				el &&
				!el.closest(".conversation-container, user-query, model-response")
			) {
				el = null
			}
			if (el && !el.querySelector(".gm-timestamp") && !exactContainers.has(el))
				pending.push({ container: el, unix })
		})
		pending.sort((a, b) =>
			(
				a.container.compareDocumentPosition(b.container) &
				Node.DOCUMENT_POSITION_FOLLOWING
			) ?
				-1
			:	1,
		)
		let floor = 0
		pending.forEach(({ container, unix }) => {
			const clamped = Math.max(unix, floor)
			floor = clamped
			injectTimestamp(container, clamped, true)
		})
	}

	setInterval(injectHeuristicTimes, 2000)

	// ═══════════════════════════════════════════════════════════
	// EMBEDDED TIMESTAMP EXTRACTION FROM USER MESSAGES
	// ═══════════════════════════════════════════════════════════

	function parseEmbeddedUnix(dateStr, timeStr, offsetHours) {
		const ms = new Date(`${dateStr}T${timeStr}:00Z`).getTime()
		return Math.floor((ms - offsetHours * 3600000) / 1000)
	}

	function processEmbeddedTimestamps() {
		const nodes = document.querySelectorAll("p.query-text-line")
		if (nodes.length === 0) return
		nodes.forEach((p, i) => {
			const raw = p.innerText || p.textContent || ""
			const match = raw.match(EMBED_RE)
			if (!match) return
			const userQuery = p.closest("user-query")
			if (!userQuery) {
				console.warn(`[GMT] [${i}] no user-query ancestor`)
				return
			}
			const container = userQuery.parentElement
			if (!container) {
				console.warn(`[GMT] [${i}] no container`)
				return
			}
			if (
				exactContainers.has(container) ||
				container.querySelector(".gm-timestamp")
			)
				return
			const unix = parseEmbeddedUnix(match[1], match[2], parseFloat(match[4]))

			const contextMatch = raw.match(/\[context to this point is (\d+|\*)\]/)
			const queryTextEl = p.closest(".query-text")
			if (contextMatch && queryTextEl) {
				queryTextEl.dataset.contextAnchor = contextMatch[1]
			}

			let cleanText = raw.replace(EMBED_RE, "")
			cleanText = cleanText.replace(
				/\[context to this point is (\d+|\*)\]\s*/,
				"",
			)
			p.innerText = cleanText.trim()

			exactContainers.add(container)
			injectTimestamp(container, unix, false)
		})
	}

	// ═══════════════════════════════════════════════════════════
	// SIDEBAR DATES
	// ═══════════════════════════════════════════════════════════

	const conversationDates = new Map()

	function extractSidebarTimestamps(text) {
		if (!text) return
		const blocks = text.split('"c_')
		let found = false
		for (let i = 1; i < blocks.length; i++) {
			const idMatch = blocks[i].match(/^([a-zA-Z0-9_-]+)/)
			if (!idMatch) continue
			const id = idMatch[1]
			const tsMatch = blocks[i].match(/\[(\d{10}),/)
			if (tsMatch && !conversationDates.has(id)) {
				conversationDates.set(id, parseInt(tsMatch[1], 10))
				found = true
			}
		}
		if (found) {
			console.log(`[GMT] sidebar: ${conversationDates.size} conversation dates`)
			updateSidebarDOM()
		}
	}

	function formatAbsoluteTime(d) {
		const yyyy = d.getFullYear()
		const MM = String(d.getMonth() + 1).padStart(2, "0")
		const dd = String(d.getDate()).padStart(2, "0")
		const min = String(d.getMinutes()).padStart(2, "0")
		if (dateFormat === "mm/dd/yyyy") {
			const h12 = d.getHours() % 12 || 12
			const ampm = d.getHours() >= 12 ? "PM" : "AM"
			return `${MM}/${dd}/${yyyy} ${h12}:${min} ${ampm}`
		}
		return `${yyyy}-${MM}-${dd} ${String(d.getHours()).padStart(2, "0")}:${min}`
	}

	function clearAndReRenderSidebar() {
		document
			.querySelectorAll(".gwd-sidebar-date-wrapper")
			.forEach((el) => el.remove())
		document
			.querySelectorAll('a[data-test-id="conversation"]')
			.forEach((item) => {
				item.removeAttribute("data-date-injected")
				item.classList.remove("gwd-split-mode")
				const title = item.querySelector(".conversation-title")
				if (title) title.style.paddingRight = ""
			})
		updateSidebarDOM()
	}

	function updateSidebarDOM() {
		if (!document.body) return
		const currentPath = window.location.pathname

		document
			.querySelectorAll('a[data-test-id="conversation"]')
			.forEach((item) => {
				const href = item.getAttribute("href")
				item.classList.toggle("gwd-is-active", href === currentPath)

				// Suppress Gemini's native Angular tooltip on the item itself
				if (!item.hasAttribute("data-gwd-hover-bound")) {
					const blockNative = (e) => e.stopImmediatePropagation()
					item.addEventListener("mouseover", blockNative, true)
					item.addEventListener(
						"mouseenter",
						() => item.removeAttribute("mattooltip"),
						true,
					)
					item.setAttribute("data-gwd-hover-bound", "true")
				}

				if (item.hasAttribute("data-date-injected")) return
				if (!href) return

				const idMatch = href.match(/\/app\/([a-zA-Z0-9_-]+)/)
				if (!idMatch || !conversationDates.has(idMatch[1])) return

				const id = idMatch[1]
				const d = new Date(conversationDates.get(id) * 1000)
				const ts = conversationDates.get(id)
				const rel = getRelativeDateLabel(ts, true)
				const abs = formatAbsoluteTime(d)
				const titleContainer = item.querySelector(".conversation-title")

				item.style.position = "relative"
				const wrapper = document.createElement("div")
				wrapper.className = "gwd-sidebar-date-wrapper"

				// Tooltip is bound to the wrapper only — not the whole item
				wrapper.style.cursor = "default"
				wrapper.addEventListener("mouseenter", (e) => {
					clearTimeout(tooltipTimer)
					tooltipTimer = setTimeout(
						() => showTooltip(e, formatFullDateTime(d)),
						100,
					)
				})
				wrapper.addEventListener("mousemove", positionTooltip)
				wrapper.addEventListener("mouseleave", () => {
					clearTimeout(tooltipTimer)
					hideTooltip()
				})

				if (currentLayout === "classic") {
					wrapper.style.cssText = `
          font-size: 11px;
          font-family: ${FONT};
          color: var(--gmpx-color-on-surface-variant, #888);
          line-height: 1.2;
          font-weight: normal;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: default;
        `
					wrapper.textContent = showAbsolute ? `${rel} · ${abs}` : rel
					if (titleContainer) titleContainer.appendChild(wrapper)
				} else {
					item.classList.add("gwd-split-mode")
					wrapper.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          flex-shrink: 0;
          margin-left: auto;
          padding-left: 8px;
          cursor: default;
        `
					const relDiv = document.createElement("div")
					relDiv.textContent = rel
					relDiv.style.cssText = `
          font-size: 13px;
          font-weight: 500;
          font-family: ${FONT};
          color: var(--gmpx-color-on-surface-variant, #888);
          line-height: 1.2;
          pointer-events: none;
        `
					wrapper.appendChild(relDiv)

					if (showAbsolute) {
						const absDiv = document.createElement("div")
						absDiv.textContent = abs
						absDiv.style.cssText = `
            position: absolute;
            bottom: -6px;
            left: 14px;
            font-size: 11px;
            font-family: ${FONT};
            font-weight: var(--gem-sys-typography-type-scale--label-l-font-weight);
            letter-spacing: var(--gem-sys-typography-type-scale--label-l-font-tracking);
            line-height: var(--gem-sys-typography-type-scale--label-l-line-height);
            color: var(--gmpx-color-on-surface-variant, #888);
            white-space: nowrap;
            pointer-events: none;
          `
						wrapper.appendChild(absDiv)
					}

					const trailingIcon = item.querySelector(".trailing-icon-container")
					if (trailingIcon) item.insertBefore(wrapper, trailingIcon)
					else item.appendChild(wrapper)
				}

				item.setAttribute("data-date-injected", "true")
			})
	}

	// ═══════════════════════════════════════════════════════════
	// PROMPT TIMESTAMP PREPEND
	// ═══════════════════════════════════════════════════════════

	function getNowTimestamp() {
		const now = new Date()
		const date = now.toLocaleDateString("en-CA")
		const hh = String(now.getHours()).padStart(2, "0")
		const mm = String(now.getMinutes()).padStart(2, "0")
		const tz = getLocalTzAbbr()
		const off = getLocalTzOffsetHours()
		return `[${date} ${hh}:${mm} ${tz}${off >= 0 ? "+" + off : off}]`
	}

	function getSendButton(target) {
		if (!target) return null
		const btn = target.closest("button")
		if (!btn) return null
		const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase()
		const title = (btn.getAttribute("title") || "").toLowerCase()
		const dataTestId = (
			btn.getAttribute("data-test-id") ||
			btn.getAttribute("data-testid") ||
			""
		).toLowerCase()
		const hasSendClass = Array.from(btn.classList).some(
			(c) =>
				c.toLowerCase().includes("send") || c.toLowerCase().includes("submit"),
		)

		if (
			ariaLabel.includes("send") ||
			ariaLabel.includes("submit") ||
			title.includes("send") ||
			title.includes("submit") ||
			dataTestId.includes("send") ||
			dataTestId.includes("submit") ||
			hasSendClass ||
			btn.querySelector(
				'mat-icon[fonticon="send"], mat-icon[fonticon="arrow_upward"], mat-icon[data-mat-icon-name="send"], mat-icon[data-mat-icon-name="arrow_upward"]',
			)
		) {
			return btn
		}
		return null
	}

	// ═══════════════════════════════════════════════════════════
	// AI-OS CONTEXT SYNC VARIABLES
	// ═══════════════════════════════════════════════════════════
	// No localhost server is used. Thread archives are written to a directory
	// explicitly selected once through the Tampermonkey menu.

	// Predefined phase prompts
	const PHASE_PROMPTS = [
		"Act as a technical sounding board. I have an idea for a new feature/project, and we need to brainstorm. \n\nDo not try to build it, write code, or structure a final plan yet. Your goal is to help me explore the edges of this idea. Ask me clarifying questions about the core problem, the ideal user experience, and potential pitfalls. Let's keep the conversation fluid and conceptual until I tell you we are ready to lock in a plan.\n\nHere is my initial thought: ",
		"Act as a Product Manager. We are closing the brainstorming phase. Synthesize our agreed-upon concept into a strict High-Level Plan outlining what this feature DOES and the exact user experience. \n\nStrictly avoid discussing how it is built under the hood. Structure your response using this exact framework:\n1. The Trigger: How the user or system initiates the action.\n2. The Staging Area: The intermediate UI, choices, or routing that happens before execution.\n3. Task Configuration: The rules, modes, or constraints applied to the task.\n4. Execution & Feedback: What happens during the process and how the user knows it finished.",
		"Act as a Systems Architect. Translate our approved High-Level Plan into a Lower-Level Technical Plan. \n\nFocus on the plumbing and architecture. You may include hyper-specific, uncommon code snippets if they are necessary to illustrate an architectural choice (e.g., a specific Rust/Tauri bridge implementation or complex API endpoint), but do not write the standard implementation logic.\n\nBreak down the architecture into:\n1. Tech Stack & CLI Tools: Required packages or background processes.\n2. Component Bridge: How the layers communicate (e.g., file watchers, HTTP, standard I/O).\n3. State & Context Management: Where temporary data or files live during execution.\n4. Technical Bottlenecks: Highlight 2-3 edge cases or potential fail states to watch out for.",
		"Act as a Prompt Engineer. We are ready to execute. Take the High-Level Plan and the Lower-Level Technical Plan and generate a strict, optimized instruction set for a local autonomous AI agent.\n\nOutput the final instructions inside a single code block formatted like this:\n```claude-instruction\n[Instructions here]\n```\n\nThe instructions must include:\n- The target context or directory behavior.\n- Strict constraints for the task (e.g., required logging formats, restricted commands).\n- A definitive, step-by-step implementation checklist.\n\nDo not include any conversational filler before or after the code block.",
	]

	let currentPhase = null
	let localSkills = []

	function fetchSkills() {
		// Local skills came from the retired backend. Keep the phase prompts only.
		localSkills = []
	}
	fetchSkills()

	function replaceEditorContent(editor, newText) {
		editor.focus()
		document.execCommand("selectAll", false, null)
		document.execCommand("insertText", false, newText)
	}

	function processCommandReplacement(editor) {
		const currentText = editor.innerText || ""
		let newText = currentText.trim()
		let replaced = false

		const phaseSkills = [
			{ name: "phase0", prompt: PHASE_PROMPTS[0] },
			{ name: "phase1", prompt: PHASE_PROMPTS[1] },
			{ name: "phase2", prompt: PHASE_PROMPTS[2] },
			{ name: "phase3", prompt: PHASE_PROMPTS[3] },
		]
		const allOptions = [...phaseSkills, ...localSkills]

		allOptions.forEach((s) => {
			const pattern = new RegExp("\\/" + s.name + "\\b", "g")
			if (pattern.test(newText)) {
				newText = newText.replace(pattern, s.prompt)
				replaced = true
			}
		})

		if (replaced) {
			replaceEditorContent(editor, newText)
		}
	}

	document.addEventListener(
		"click",
		function (e) {
			const btn = getSendButton(e.target)
			if (!btn) return
			const editor = document.querySelector(
				'.ql-editor[contenteditable="true"]',
			)
			if (!editor) return

			// Avoid the read-replace cycle that can double newlines in contenteditable
			let currentText = editor.innerText || ""
			if (!currentText.trim() || EMBED_RE.test(currentText)) return

			e.stopImmediatePropagation()
			e.preventDefault()

			// Run decoy/replacement substitution
			processCommandReplacement(editor)

			// Prepend timestamp by moving cursor to start and inserting text
			editor.focus()
			const sel = window.getSelection()
			const range = document.createRange()
			range.setStart(editor, 0)
			range.collapse(true)
			sel.removeAllRanges()
			sel.addRange(range)

			const tokenUsage = calculateThreadTokens()
			const tokenStr = tokenUsage.isPrecise ? tokenUsage.total : "*"
			const timestamp = `${getNowTimestamp()} [context to this point is ${tokenStr}] `
			document.execCommand("insertText", false, timestamp)
			console.log(`[GMT] prepended: "${timestamp}"`)

			// Re-trigger click after a short delay
			setTimeout(() => {
				const freshBtn = getSendButton(e.target) || btn
				if (freshBtn) freshBtn.click()
			}, 80)
		},
		true,
	)

	document.addEventListener(
		"keydown",
		function (e) {
			if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)
				return

			const editor = e.target.closest('.ql-editor[contenteditable="true"]')
			if (!editor) return

			// If autocomplete menu is open, handle autocomplete keys instead
			if (autocompleteMenu && autocompleteMenu.style.display === "block") {
				return // Let autocomplete's keydown listener handle it
			}

			const currentText = editor.innerText || ""
			if (!currentText.trim() || EMBED_RE.test(currentText)) return

			e.stopImmediatePropagation()
			e.preventDefault()

			// Run decoy/replacement substitution
			processCommandReplacement(editor)

			// Prepend timestamp
			editor.focus()
			const sel = window.getSelection()
			const range = document.createRange()
			range.setStart(editor, 0)
			range.collapse(true)
			sel.removeAllRanges()
			sel.addRange(range)

			const tokenUsage = calculateThreadTokens()
			const tokenStr = tokenUsage.isPrecise ? tokenUsage.total : "*"
			const timestamp = `${getNowTimestamp()} [context to this point is ${tokenStr}] `
			document.execCommand("insertText", false, timestamp)
			console.log(`[GMT] keydown prepended: "${timestamp}"`)

			// Dispatch enter key to trigger angular submission
			setTimeout(() => {
				const event = new KeyboardEvent("keydown", {
					key: "Enter",
					code: "Enter",
					keyCode: 13,
					which: 13,
					bubbles: true,
					cancelable: true,
				})
				editor.dispatchEvent(event)
			}, 80)
		},
		true,
	)

	// ═══════════════════════════════════════════════════════════
	// TAB TITLE SYNC
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

	// ═══════════════════════════════════════════════════════════
	// OBSERVERS
	// ═══════════════════════════════════════════════════════════

	function removeAdvUpsell(warnIfMissing = false) {
		const upsellContainer = document.querySelector(
			".right-section > .buttons-container.adv-upsell",
		)
		if (upsellContainer) {
			upsellContainer.remove()
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
				processEmbeddedTimestamps()
				updateSidebarDOM()
				updateTabTitle()
				removeAdvUpsell()

				// AI-OS Integrations
				injectUI()
				scanExecutionPayloads()
				injectRunButtons()

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
		setTimeout(() => {
			if (autoThreadSync) {
				exportThreadWithTimestamps()
			}
		}, 1500)

		console.log("[GMT] observers started")
	}

	startObservers()

	// ═══════════════════════════════════════════════════════════
	// GEMINI MODEL OPTIMIZER
	// ═══════════════════════════════════════════════════════════

	const OPTIMIZER_SCRIPT_ID = "gemini_optimizer_final_v11"

	if (window[OPTIMIZER_SCRIPT_ID]) {
		window[OPTIMIZER_SCRIPT_ID].observer.disconnect()
	}

	function getModelDetails(item) {
		const clone = item.cloneNode(true)
		// Remove icons, SVGs, and other non-text decorative components
		clone
			.querySelectorAll("mat-icon, g-icon, svg, .icon, img")
			.forEach((el) => el.remove())

		// Try to find known title elements or classes
		const titleEl = clone.querySelector(
			'.bard-mode-menu-item-title, .model-title, [class*="title"], strong, b',
		)
		const descEl = clone.querySelector(
			'.bard-mode-menu-item-description, .model-description, [class*="description"], [class*="subtitle"], .description',
		)

		let name = titleEl ? titleEl.innerText.trim() : ""
		let description = descEl ? descEl.innerText.trim() : ""

		if (!name) {
			const lines = clone.innerText
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0)

			if (lines.length >= 2) {
				name = lines[0]
				description = lines[1]
			} else if (lines.length === 1) {
				name = lines[0]
			}
		}

		return { name, description }
	}

	function isModelMatch(modelName, labelText) {
		const clean = (str) =>
			str
				.toLowerCase()
				.replace(/\bgemini\b/g, "")
				.replace(/\bgoogle\b/g, "")
				.replace(/[^a-z0-9.-]/g, " ")
				.replace(/\s+/g, " ")
				.trim()

		const cleanModel = clean(modelName)
		const cleanLabel = clean(labelText)

		if (!cleanModel || !cleanLabel) return false

		const hasLite = (str) => str.includes("lite")
		if (hasLite(cleanModel) !== hasLite(cleanLabel)) {
			return false
		}

		return cleanLabel.includes(cleanModel) || cleanModel.includes(cleanLabel)
	}

	async function performSelection(modelName, targetThinking) {
		const originalModelBtn = Array.from(
			document.querySelectorAll(".mat-mdc-menu-item.bard-mode-list-button"),
		).find(
			(el) =>
				getModelDetails(el).name.toLowerCase() === modelName.toLowerCase(),
		)

		if (!originalModelBtn) return

		const trigger = document.querySelector("button.input-area-switch")
		const currentLabel = trigger?.innerText.toLowerCase() || ""
		const isTargetModelSelected = isModelMatch(modelName, currentLabel)
		const isCurrentlyExtended =
			currentLabel.includes("extended") || currentLabel.includes("thinking")

		const overlayContainer = document.querySelector(".cdk-overlay-container")
		const hideOverlay = () => {
			if (overlayContainer) overlayContainer.style.opacity = "0"
		}
		const showOverlay = () => {
			if (overlayContainer) overlayContainer.style.opacity = "1"
		}

		if (targetThinking === "extended") {
			if (isTargetModelSelected && isCurrentlyExtended) {
				document.body.click()
				return
			}

			hideOverlay()
			originalModelBtn.click()

			setTimeout(async () => {
				const newTrigger = document.querySelector("button.input-area-switch")
				if (newTrigger) newTrigger.click()
				await new Promise((r) => setTimeout(r, 60))

				const header = document.querySelector(".thinking-level-header")
				if (header) {
					header.click()
					await new Promise((r) => setTimeout(r, 40))
					const opt = Array.from(
						document.querySelectorAll(".thinking-level-option-title"),
					).find((o) => o.innerText.toLowerCase().includes("extended"))
					if (opt) opt.click()
				}
				showOverlay()
			}, 180)
		} else {
			if (isTargetModelSelected && isCurrentlyExtended) {
				hideOverlay()
				const header = document.querySelector(".thinking-level-header")
				if (header) {
					header.click()
					await new Promise((r) => setTimeout(r, 40))
					const opt = Array.from(
						document.querySelectorAll(".thinking-level-option-title"),
					).find((o) => o.innerText.toLowerCase().includes("standard"))
					if (opt) opt.click()
				}
				showOverlay()
			} else {
				originalModelBtn.click()
			}
		}
	}

	function modifyMenu() {
		document
			.querySelectorAll(
				".thinking-level-divider, .upgrade-container.g1-upsell-container",
			)
			.forEach((el) => el.style.setProperty("display", "none", "important"))

		const panels = document.querySelectorAll(".mat-mdc-menu-panel")
		panels.forEach((panel) => {
			if (panel.querySelector(".custom-menu-grid-row")) return

			const menuItems = Array.from(
				panel.querySelectorAll(".mat-mdc-menu-item.bard-mode-list-button"),
			)
			if (menuItems.length === 0) return

			const header = panel.querySelector(".thinking-level-header")
			if (header) {
				header.style.cssText =
					"width: 0; height: 0; opacity: 0; overflow: hidden; padding: 0; margin: 0; border: none; min-height: 0; position: absolute; pointer-events: auto;"
			}

			const trigger = document.querySelector("button.input-area-switch")
			const currentLabelText = trigger?.innerText.toLowerCase() || ""

			menuItems.forEach((item) => {
				const { name: modelName, description } = getModelDetails(item)
				if (!modelName) return

				const isThisModelSelected = isModelMatch(modelName, currentLabelText)
				const isExtended =
					currentLabelText.includes("extended") ||
					currentLabelText.includes("thinking")

				const grid = document.createElement("div")
				grid.className = "custom-menu-grid-row"
				grid.style.cssText =
					"display: grid; grid-template-columns: 1.8fr 1fr; gap: 0; margin: 6px 12px; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.2s ease;"

				const isStandardActive = isThisModelSelected && !isExtended
				const isThinkingActive = isThisModelSelected && isExtended

				// Create standard button
				const btnStandard = document.createElement("button")
				btnStandard.style.cssText =
					'display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 12px 10px; margin: 0; border: none; background: transparent; cursor: pointer; font-family: "Google Sans Flex", sans-serif; text-align: center; transition: all 0.2s ease; border-right: 1px solid rgba(255, 255, 255, 0.06); outline: none;'

				const nameDiv = document.createElement("div")
				nameDiv.innerText = modelName
				nameDiv.style.cssText =
					"font-weight: 500; font-size: 14px; color: #e3e3e3;"
				btnStandard.appendChild(nameDiv)

				let descDiv = null
				if (description) {
					descDiv = document.createElement("div")
					descDiv.innerText = description
					descDiv.style.cssText =
						"font-weight: 400; font-size: 11px; margin-top: 3px; transition: color 0.2s ease;"
					btnStandard.appendChild(descDiv)
				}

				// Create thinking button
				const btnThinking = document.createElement("button")
				btnThinking.style.cssText =
					'display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 12px 10px; margin: 0; border: none; background: transparent; cursor: pointer; font-family: "Google Sans Flex", sans-serif; text-align: center; transition: all 0.2s ease; outline: none;'

				const thinkingDiv = document.createElement("div")
				thinkingDiv.innerText = "Thinking"
				thinkingDiv.style.cssText =
					"font-weight: 500; font-size: 14px; color: #e3e3e3; transition: color 0.2s ease;"
				btnThinking.appendChild(thinkingDiv)

				// Style based on active state
				if (isStandardActive) {
					btnStandard.style.backgroundColor = "rgba(255, 255, 255, 0.12)"
					if (descDiv) descDiv.style.color = "#c4c7c5"
				} else if (isThinkingActive) {
					btnThinking.style.backgroundColor = "rgba(168, 199, 250, 0.2)"
					thinkingDiv.style.color = "#a8c7fa"

					// Subtle highlight for base button to show connection
					btnStandard.style.backgroundColor = "rgba(255, 255, 255, 0.04)"
					if (descDiv) descDiv.style.color = "#a8c7fa"
				} else {
					if (descDiv) descDiv.style.color = "#8e918f"
				}

				// Hover interaction logic
				btnStandard.onmouseenter = () => {
					if (!isStandardActive && !isThinkingActive) {
						btnStandard.style.backgroundColor = "rgba(255, 255, 255, 0.08)"
						if (descDiv) descDiv.style.color = "#c4c7c5"
					}
				}
				btnStandard.onmouseleave = () => {
					if (!isStandardActive && !isThinkingActive) {
						btnStandard.style.backgroundColor = "transparent"
						if (descDiv) descDiv.style.color = "#8e918f"
					}
				}

				btnThinking.onmouseenter = () => {
					if (!isThinkingActive) {
						btnThinking.style.backgroundColor = "rgba(168, 199, 250, 0.12)"
						thinkingDiv.style.color = "#a8c7fa"
					}
					// Hovering thinking highlights standard as an extension
					if (!isStandardActive && !isThinkingActive) {
						btnStandard.style.backgroundColor = "rgba(255, 255, 255, 0.04)"
						if (descDiv) descDiv.style.color = "#c4c7c5"
					}
				}
				btnThinking.onmouseleave = () => {
					if (!isThinkingActive) {
						btnThinking.style.backgroundColor = "transparent"
						thinkingDiv.style.color = "#e3e3e3"
					}
					if (!isStandardActive && !isThinkingActive) {
						btnStandard.style.backgroundColor = "transparent"
						if (descDiv) descDiv.style.color = "#8e918f"
					}
				}

				btnStandard.onclick = (e) => {
					e.preventDefault()
					e.stopPropagation()
					performSelection(modelName, "standard")
				}

				btnThinking.onclick = (e) => {
					e.preventDefault()
					e.stopPropagation()
					performSelection(modelName, "extended")
				}

				grid.appendChild(btnStandard)
				grid.appendChild(btnThinking)

				item.style.display = "none"
				item.parentNode.insertBefore(grid, item)
			})
		})
	}

	function startOptimizer() {
		if (!document.body) {
			requestAnimationFrame(startOptimizer)
			return
		}
		const observer = new MutationObserver(modifyMenu)
		observer.observe(document.body, { childList: true, subtree: true })
		modifyMenu()

		window[OPTIMIZER_SCRIPT_ID] = { observer }
		console.log("Gemini Optimizer Active (Dynamic Models).")
	}

	startOptimizer()

	// ═══════════════════════════════════════════════════════════
	// AI-OS CONTEXT SYNC & STYLING INTEGRATIONS
	// ═══════════════════════════════════════════════════════════

	function isDarkTheme() {
		return (
			document.body.classList.contains("dark-theme") ||
			document.documentElement.classList.contains("dark-theme") ||
			window.matchMedia("(prefers-color-scheme: dark)").matches
		)
	}

	// Inject Styles for AI-OS custom dropdowns, executor button, and phase dropdown trigger
	const aiosStyle = document.createElement("style")
	aiosStyle.textContent = `
        /* Unified Dropdown Style (Matches Gemini Dropdown) */
        .aios-dropdown {
            position: absolute;
            background: #ffffff !important;
            border-radius: 16px !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.04) !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
            z-index: 999999 !important;
            padding: 8px 0 !important;
            min-width: 260px !important;
            box-sizing: border-box !important;
            font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
            display: none;
        }
        
        .aios-dark .aios-dropdown,
        .dark-theme .aios-dropdown,
        .dark-theme-active .aios-dropdown {
            background: #1e1f20 !important;
            border-color: rgba(255, 255, 255, 0.08) !important;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
        }
        
        @media (prefers-color-scheme: dark) {
            .aios-dropdown {
                background: #1e1f20 !important;
                border-color: rgba(255, 255, 255, 0.08) !important;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
            }
        }

        .aios-dropdown-item {
            display: flex !important;
            align-items: center !important;
            padding: 10px 16px !important;
            cursor: pointer !important;
            transition: background-color 0.15s ease !important;
            box-sizing: border-box !important;
            gap: 12px !important;
            text-align: left !important;
            user-select: none !important;
        }

        .aios-dropdown-item:hover {
            background-color: #f0f4f9 !important;
        }
        
        .aios-dark .aios-dropdown-item:hover,
        .dark-theme .aios-dropdown-item:hover,
        .dark-theme-active .aios-dropdown-item:hover {
            background-color: #2d2f31 !important;
        }
        
        @media (prefers-color-scheme: dark) {
            .aios-dropdown-item:hover {
                background-color: #2d2f31 !important;
            }
        }

        .aios-dropdown-checkmark {
            width: 16px !important;
            height: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 14px !important;
            font-weight: bold !important;
            color: #1a73e8 !important;
            visibility: hidden !important;
        }
        
        .aios-dropdown-item.active .aios-dropdown-checkmark {
            visibility: visible !important;
        }

        .aios-dropdown-content {
            display: flex !important;
            flex-direction: column !important;
            flex-grow: 1 !important;
        }

        .aios-dropdown-name {
            font-size: 14px !important;
            font-weight: 500 !important;
            color: #1f1f1f !important;
            line-height: 1.4 !important;
            font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
        }
        
        .aios-dark .aios-dropdown-name,
        .dark-theme .aios-dropdown-name,
        .dark-theme-active .aios-dropdown-name {
            color: #e3e3e3 !important;
        }
        
        @media (prefers-color-scheme: dark) {
            .aios-dropdown-name {
                color: #e3e3e3 !important;
            }
        }

        .aios-dropdown-desc {
            font-size: 11px !important;
            color: #5f6368 !important;
            margin-top: 2px !important;
            line-height: 1.4 !important;
            font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
        }
        
        .aios-dark .aios-dropdown-desc,
        .dark-theme .aios-dropdown-desc,
        .dark-theme-active .aios-dropdown-desc {
            color: #c4c7c5 !important;
        }
        
        @media (prefers-color-scheme: dark) {
            .aios-dropdown-desc {
                color: #c4c7c5 !important;
            }
        }

        /* Container for Phase and Model selects */
        .pill-ui-logo-container.under-input {
            flex-direction: row !important;
            align-items: center !important;
        }

        /* Phase selector trigger pill */
        .aios-phase-select-btn {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 6px 14px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            color: #1f1f1f !important;
            background: #f0f4f9 !important;
            border: 1px solid transparent !important;
            border-radius: 16px !important;
            cursor: pointer !important;
            transition: background-color 0.2s, border-color 0.2s !important;
            font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
            margin-right: 8px !important;
            margin-bottom: 0 !important;
            height: 40px !important;
            box-sizing: border-box !important;
            outline: none !important;
        }
        .aios-phase-select-btn:hover {
            background: #e1e7ef !important;
        }
        
        .dark-theme .aios-phase-select-btn,
        .dark-theme-active .aios-phase-select-btn {
            color: #e3e3e3 !important;
            background: #2e2f33 !important;
        }
        .dark-theme .aios-phase-select-btn:hover,
        .dark-theme-active .aios-phase-select-btn:hover {
            background: #3e3f43 !important;
        }
        
        @media (prefers-color-scheme: dark) {
            .aios-phase-select-btn {
                color: #e3e3e3 !important;
                background: #2e2f33 !important;
            }
            .aios-phase-select-btn:hover {
                background: #3e3f43 !important;
            }
        }

        /* Execute Button next to block */
        .aios-btn-execute {
            background: linear-gradient(135deg, #10b981, #059669) !important;
            color: #0f172a !important;
            border: none !important;
            padding: 6px 14px !important;
            border-radius: 8px !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            margin: 8px 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15) !important;
        }
        .aios-btn-execute:hover {
            background: linear-gradient(135deg, #34d399, #059669) !important;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
            transform: translateY(-1px) !important;
        }
        .aios-btn-execute:active {
            transform: translateY(0) !important;
        }

        /* Autocomplete Menu specific sizing */
        .aios-autocomplete-menu {
            max-height: 280px !important;
            overflow-y: auto !important;
            width: 320px !important;
            padding: 6px !important;
        }
        .aios-autocomplete-menu::-webkit-scrollbar {
            width: 6px;
        }
        .aios-autocomplete-menu::-webkit-scrollbar-track {
            background: transparent;
        }
        .aios-autocomplete-menu::-webkit-scrollbar-thumb {
            background: rgba(128, 128, 128, 0.2);
            border-radius: 3px;
        }
        .aios-autocomplete-menu::-webkit-scrollbar-thumb:hover {
            background: rgba(128, 128, 128, 0.4);
        }

        /* Full-width and Compact Table Layout */
        .horizontal-scroll-wrapper {
            width: 100vw !important;
            max-width: 100vw !important;
            position: relative !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            box-sizing: border-box !important;
            padding: 0 48px !important;
            display: flex !important;
            justify-content: center !important;
            overflow-x: auto !important;
        }
        .table-block-component, .table-block, .table-content {
            width: auto !important;
            max-width: 100% !important;
        }
        table {
            width: auto !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
        }
        table th, table td {
            padding: 8px 12px !important;
            white-space: normal !important;
            word-break: break-word !important;
            width: auto !important;
            min-width: 0 !important;
        }
        
        /* Responsive adjustments for narrower viewports */
        @media (max-width: 1400px) {
            table th, table td {
                padding: 6px 10px !important;
                font-size: 14px !important; /* reduce font size slightly from default 17px */
                max-width: 160px !important; /* help trigger wrapping when space is constrained */
            }
        }
    `
	document.head.appendChild(aiosStyle)

	function getThreadId() {
		const titleMatch = document.title.match(/^(.*) - (Google Gemini|Gemini)$/i)
		if (titleMatch && titleMatch[1].trim() && titleMatch[1] !== "Gemini") {
			return titleMatch[1].trim()
		}
		const activeSidebarItem = document.querySelector(
			'a[aria-current="page"], .selected a, a.selected, [data-is-active="true"] a',
		)
		if (activeSidebarItem && activeSidebarItem.innerText.trim()) {
			return activeSidebarItem.innerText.trim().split("\n")[0]
		}
		return window._aiOsThreadId || "Untitled Thread"
	}

	// Autocomplete Menu logic
	let autocompleteMenu = null
	let selectedIndex = 0

	function createAutocompleteMenu() {
		if (autocompleteMenu) return
		autocompleteMenu = document.createElement("div")
		autocompleteMenu.className = "aios-dropdown aios-autocomplete-menu"
		document.body.appendChild(autocompleteMenu)
	}

	function renderAutocomplete(inputEl, query) {
		createAutocompleteMenu()
		const rect = inputEl.getBoundingClientRect()

		const phaseSkills = [
			{
				name: "phase0",
				description: "Brainstorming - Explore edges conceptually",
				prompt: PHASE_PROMPTS[0],
			},
			{
				name: "phase1",
				description: "Product Map - Synthesize plan into product map",
				prompt: PHASE_PROMPTS[1],
			},
			{
				name: "phase2",
				description: "Tech Architecture - Technical plan & components",
				prompt: PHASE_PROMPTS[2],
			},
			{
				name: "phase3",
				description: "Execution Payload - Instruction set for local agent",
				prompt: PHASE_PROMPTS[3],
			},
		]

		const allOptions = [...phaseSkills, ...localSkills]
		const filtered = allOptions.filter(
			(s) =>
				s.name.toLowerCase().includes(query.toLowerCase()) ||
				s.description.toLowerCase().includes(query.toLowerCase()),
		)

		if (filtered.length === 0) {
			autocompleteMenu.style.display = "none"
			return
		}

		// Apply dark mode class
		if (isDarkTheme()) {
			autocompleteMenu.classList.add("aios-dark")
		} else {
			autocompleteMenu.classList.remove("aios-dark")
		}

		autocompleteMenu.style.top = `${window.scrollY + rect.top - autocompleteMenu.offsetHeight - 8}px`
		autocompleteMenu.style.left = `${rect.left}px`
		autocompleteMenu.style.display = "block"

		// Adjust positioning if it overflows top of screen
		const topVal = window.scrollY + rect.top - autocompleteMenu.offsetHeight - 8
		autocompleteMenu.style.top = `${topVal < 0 ? window.scrollY + rect.bottom + 8 : topVal}px`

		autocompleteMenu.textContent = ""
		filtered.forEach((skill, idx) => {
			const item = document.createElement("div")
			item.className = `aios-dropdown-item ${idx === selectedIndex ? "active" : ""}`

			const check = document.createElement("div")
			check.className = "aios-dropdown-checkmark"
			check.textContent = "✓"

			const content = document.createElement("div")
			content.className = "aios-dropdown-content"

			const nameEl = document.createElement("div")
			nameEl.className = "aios-dropdown-name"
			nameEl.textContent = "/" + skill.name

			const descEl = document.createElement("div")
			descEl.className = "aios-dropdown-desc"
			descEl.textContent = skill.description

			content.appendChild(nameEl)
			content.appendChild(descEl)

			item.appendChild(check)
			item.appendChild(content)

			item.addEventListener("click", () => {
				applySkill(inputEl, skill.name)
			})
			autocompleteMenu.appendChild(item)
		})
	}

	function applySkill(inputEl, skillName) {
		const text = inputEl.innerText || inputEl.value || ""
		const queryStart = text.lastIndexOf("/")
		if (queryStart !== -1) {
			const before = text.substring(0, queryStart)
			const after = text.substring(
				queryStart + text.substring(queryStart).split(/\s/)[0].length,
			)
			const newText = before + "/" + skillName + after
			replaceEditorContent(inputEl, newText)
		}
		if (autocompleteMenu) autocompleteMenu.style.display = "none"
		inputEl.focus()
	}

	// Phase Selection dropdown
	let phaseDropdownMenu = null

	function injectPhaseDropdown(promptContainer) {
		if (promptContainer.querySelector(".aios-phase-select-container")) return

		const container = document.createElement("div")
		container.className = "aios-phase-select-container"
		container.style.cssText = "position: relative; display: inline-block;"

		const btn = document.createElement("button")
		btn.className = "aios-phase-select-btn"

		const btnSpan = document.createElement("span")
		if (currentPhase === null) {
			const planSvg = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"svg",
			)
			planSvg.setAttribute("width", "14")
			planSvg.setAttribute("height", "14")
			planSvg.setAttribute("viewBox", "0 0 24 24")
			planSvg.setAttribute("fill", "none")
			planSvg.setAttribute("stroke", "currentColor")
			planSvg.setAttribute("stroke-width", "2")
			planSvg.setAttribute("stroke-linecap", "round")
			planSvg.setAttribute("stroke-linejoin", "round")
			planSvg.style.marginRight = "4px"
			planSvg.style.verticalAlign = "-2px"

			const planPath = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"path",
			)
			planPath.setAttribute(
				"d",
				"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
			)

			const planPoly1 = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"polyline",
			)
			planPoly1.setAttribute("points", "14 2 14 8 20 8")

			const planLine1 = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"line",
			)
			planLine1.setAttribute("x1", "16")
			planLine1.setAttribute("y1", "13")
			planLine1.setAttribute("x2", "8")
			planLine1.setAttribute("y2", "13")

			const planLine2 = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"line",
			)
			planLine2.setAttribute("x1", "16")
			planLine2.setAttribute("y1", "17")
			planLine2.setAttribute("x2", "8")
			planLine2.setAttribute("y2", "17")

			const planPoly2 = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"polyline",
			)
			planPoly2.setAttribute("points", "10 9 9 9 8 9")

			planSvg.appendChild(planPath)
			planSvg.appendChild(planPoly1)
			planSvg.appendChild(planLine1)
			planSvg.appendChild(planLine2)
			planSvg.appendChild(planPoly2)

			btnSpan.appendChild(planSvg)
			btnSpan.appendChild(document.createTextNode("Plan"))
		} else {
			btnSpan.textContent = `Phase ${currentPhase}`
		}
		btn.appendChild(btnSpan)

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		svg.setAttribute("width", "10")
		svg.setAttribute("height", "6")
		svg.setAttribute("viewBox", "0 0 10 6")
		svg.setAttribute("fill", "none")
		svg.style.marginLeft = "4px"
		svg.style.transition = "transform 0.2s"

		const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
		path.setAttribute("d", "M1 1L5 5L9 1")
		path.setAttribute("stroke", "currentColor")
		path.setAttribute("stroke-width", "1.5")
		path.setAttribute("stroke-linecap", "round")
		path.setAttribute("stroke-linejoin", "round")

		svg.appendChild(path)
		btn.appendChild(svg)

		btn.addEventListener("click", (e) => {
			e.preventDefault()
			e.stopPropagation()
			togglePhaseDropdown(container, btn)
		})

		container.appendChild(btn)

		const switchBtn = promptContainer.querySelector(
			'button.input-area-switch, button[aria-label*="Send"], button.send-button',
		)
		if (switchBtn) {
			switchBtn.parentNode.style.setProperty(
				"flex-direction",
				"row",
				"important",
			)
			switchBtn.parentNode.insertBefore(container, switchBtn)
		} else {
			promptContainer.appendChild(container)
		}
	}

	function togglePhaseDropdown(container, btn) {
		if (phaseDropdownMenu && phaseDropdownMenu.style.display === "block") {
			phaseDropdownMenu.style.display = "none"
			btn.querySelector("svg").style.transform = "rotate(0deg)"
			return
		}

		if (!phaseDropdownMenu) {
			phaseDropdownMenu = document.createElement("div")
			phaseDropdownMenu.className = "aios-dropdown"
			document.body.appendChild(phaseDropdownMenu)

			document.addEventListener("click", (e) => {
				if (
					!container.contains(e.target) &&
					!phaseDropdownMenu.contains(e.target)
				) {
					phaseDropdownMenu.style.display = "none"
					btn.querySelector("svg").style.transform = "rotate(0deg)"
				}
			})
		}

		phaseDropdownMenu.textContent = ""

		const phases = [
			{
				id: 0,
				name: "Phase 0: Brainstorming",
				desc: "Explore the edges of the idea conceptually",
			},
			{
				id: 1,
				name: "Phase 1: High-Level Plan",
				desc: "Synthesize concept into product map",
			},
			{
				id: 2,
				name: "Phase 2: Tech Architecture",
				desc: "Translate plan into technical plan",
			},
			{
				id: 3,
				name: "Phase 3: Execution Payload",
				desc: "Generate strict instruction set for local agent",
			},
		]

		phases.forEach((p) => {
			const item = document.createElement("div")
			item.className = `aios-dropdown-item ${p.id === currentPhase ? "active" : ""}`

			const check = document.createElement("div")
			check.className = "aios-dropdown-checkmark"
			check.textContent = "✓"

			const content = document.createElement("div")
			content.className = "aios-dropdown-content"

			const nameEl = document.createElement("div")
			nameEl.className = "aios-dropdown-name"
			nameEl.textContent = p.name

			const descEl = document.createElement("div")
			descEl.className = "aios-dropdown-desc"
			descEl.textContent = p.desc

			content.appendChild(nameEl)
			content.appendChild(descEl)

			item.appendChild(check)
			item.appendChild(content)

			item.addEventListener("click", () => {
				currentPhase = p.id
				btn.querySelector("span").textContent = `Phase ${currentPhase}`
				phaseDropdownMenu.style.display = "none"
				btn.querySelector("svg").style.transform = "rotate(0deg)"

				const editor = document.querySelector(
					'.ql-editor[contenteditable="true"]',
				)
				if (editor) {
					replaceEditorContent(editor, `/phase${currentPhase}`)
				}
			})

			phaseDropdownMenu.appendChild(item)
		})

		if (isDarkTheme()) {
			phaseDropdownMenu.classList.add("aios-dark")
		} else {
			phaseDropdownMenu.classList.remove("aios-dark")
		}

		const rect = btn.getBoundingClientRect()
		phaseDropdownMenu.style.display = "block"
		phaseDropdownMenu.style.top = `${window.scrollY + rect.top - phaseDropdownMenu.offsetHeight - 6}px`
		phaseDropdownMenu.style.left = `${rect.left}px`
		btn.querySelector("svg").style.transform = "rotate(180deg)"
	}

	// Inject Phase Controls & Listeners
	function injectUI() {
		const promptContainer = document.querySelector(
			".input-area-container, .prompt-box-container, form .input-area",
		)
		if (!promptContainer) return

		// 1. Inject Phase Selection Pill Dropdown
		injectPhaseDropdown(promptContainer)

		// 2. Hook Input elements for `/` Autocomplete
		const inputEl = promptContainer.querySelector(
			'textarea, [contenteditable="true"]',
		)
		if (inputEl && !inputEl.dataset.aiosHooked) {
			inputEl.dataset.aiosHooked = "true"
			inputEl.addEventListener("input", (e) => {
				const text = inputEl.value || inputEl.innerText || ""
				const slashIdx = text.lastIndexOf("/")
				if (slashIdx !== -1 && slashIdx === text.length - 1) {
					renderAutocomplete(inputEl, "")
				} else if (slashIdx !== -1 && slashIdx < text.length - 1) {
					const query = text.substring(slashIdx + 1)
					if (!query.includes(" ") && !query.includes("\n")) {
						renderAutocomplete(inputEl, query)
					} else {
						if (autocompleteMenu) autocompleteMenu.style.display = "none"
					}
				} else {
					if (autocompleteMenu) autocompleteMenu.style.display = "none"
				}
			})

			inputEl.addEventListener("keydown", (e) => {
				if (autocompleteMenu && autocompleteMenu.style.display === "block") {
					const items = autocompleteMenu.querySelectorAll(".aios-dropdown-item")
					if (e.key === "ArrowDown") {
						e.preventDefault()
						selectedIndex = (selectedIndex + 1) % items.length
						renderAutocomplete(
							inputEl,
							inputEl.innerText
								.substring(inputEl.innerText.lastIndexOf("/") + 1)
								.trim(),
						)
					} else if (e.key === "ArrowUp") {
						e.preventDefault()
						selectedIndex = (selectedIndex - 1 + items.length) % items.length
						renderAutocomplete(
							inputEl,
							inputEl.innerText
								.substring(inputEl.innerText.lastIndexOf("/") + 1)
								.trim(),
						)
					} else if (e.key === "Enter") {
						e.preventDefault()
						const activeItem = items[selectedIndex]
						if (activeItem) {
							const name = activeItem
								.querySelector(".aios-dropdown-name")
								.innerText.substring(1) // strip leading slash
							applySkill(inputEl, name)
						}
					} else if (e.key === "Escape") {
						autocompleteMenu.style.display = "none"
					}
				}
			})
		}
	}

	// Scan for and Inject "Execute Locally" buttons next to Phase 3 blocks
	function scanExecutionPayloads() {
		// The former “Execute Locally” button POSTed to the retired localhost API.
		// It is intentionally disabled in this backend-free version.
	}

	function injectRunButtons() {
		const preElements = document.querySelectorAll("model-response pre, pre")
		// console.log(`[GMT] injectRunButtons running. Found ${preElements.length} <pre> elements.`);

		preElements.forEach((pre) => {
			if (pre.dataset.runButtonInjected) return
			if (pre.closest(".gmt-inline-output")) return

			let container = pre.parentElement
			let copyBtn = null
			let headerText = ""

			// Try to find the closest wrapper that has a copy button
			for (let i = 0; i < 5; i++) {
				if (!container || container.tagName === "BODY") break

				// Try various known selectors for the copy button
				copyBtn = container.querySelector(
					'button[aria-label*="Copy" i], button[aria-label*="copy" i], button[data-tooltip*="Copy" i], button.copy-button',
				)
				if (!copyBtn) {
					const icon = container.querySelector(
						'mat-icon[data-mat-icon-name="content_copy"], mat-icon[fonticon="content_copy"], .copy-icon, [data-icon="content_copy"]',
					)
					if (icon) copyBtn = icon.closest("button")
				}

				if (copyBtn) {
					headerText = container.innerText.toLowerCase()
					break
				}
				container = container.parentElement
			}

			if (!copyBtn) {
				// No copy button found, so we can't inject safely next to it.
				return
			}

			// Detect language
			let isBash =
				headerText.includes("bash") ||
				headerText.includes("shell") ||
				headerText.includes("sh")
			if (!isBash) {
				const codeClass = (pre.querySelector("code") || pre).className || ""
				if (
					codeClass.toLowerCase().includes("bash") ||
					codeClass.toLowerCase().includes("sh") ||
					codeClass.toLowerCase().includes("shell")
				) {
					isBash = true
				} else {
					// Check spans
					container.querySelectorAll("span, div").forEach((s) => {
						const txt = s.innerText.trim().toLowerCase()
						if (txt === "bash" || txt === "sh" || txt === "shell") isBash = true
					})
				}
			}

			if (!isBash) return

			console.log("[GMT] Injecting Run button for bash block")
			pre.dataset.runButtonInjected = "true"

			const runBtn = document.createElement("button")
			runBtn.className = "run-btn-gmt"
			if (window.trustedTypes && window.trustedTypes.createPolicy) {
				if (!window.gmtPolicy) {
					try { window.gmtPolicy = window.trustedTypes.createPolicy("gmt-svg", { createHTML: s => s }); }
					catch(e) { window.gmtPolicy = { createHTML: s => s }; }
				}
				runBtn.innerHTML = window.gmtPolicy.createHTML(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`)
			} else {
				runBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
			}
			runBtn.title = "Run this command locally"
			runBtn.style.cssText = `
				background: transparent;
				color: #c4c7c5;
				border: none;
				border-radius: 50%;
				padding: 6px;
				margin-right: 4px;
				cursor: pointer;
				transition: all 0.2s;
				display: inline-flex;
				align-items: center;
				justify-content: center;
			`
			runBtn.onmouseover = () => {
				runBtn.style.background = "rgba(255,255,255,0.1)"
				runBtn.style.color = "#e3e3e3"
			}
			runBtn.onmouseout = () => {
				runBtn.style.background = "transparent"
				runBtn.style.color = "#c4c7c5"
			}

			runBtn.onclick = (e) => {
				e.preventDefault()
				e.stopPropagation()

				const code = (pre.querySelector("code") || pre).innerText
				const secret =
					typeof GM_getValue === "function" ?
						GM_getValue("gmt_archive_secret")
					:	null
				if (!secret) {
					alert("Please set your gmt_archive_secret in Tampermonkey first.")
					return
				}

				if (window.gmtPolicy) {
					runBtn.innerHTML = window.gmtPolicy.createHTML(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`)
				} else {
					runBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`
				}

				if (typeof GM_xmlhttpRequest === "function") {
					GM_xmlhttpRequest({
						method: "POST",
						url: "http://127.0.0.1:3033/run-command",
						headers: {
							"Content-Type": "application/json",
							"x-gemini-thread-saver-key": secret,
						},
						data: JSON.stringify({ command: code }),
						onload: (res) => {
							try {
								const data = JSON.parse(res.responseText)
								if (data.ok) {
									runBtn.style.color = "#89b4fa"
									if (window.gmtPolicy) {
										runBtn.innerHTML = window.gmtPolicy.createHTML(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`)
									} else {
										runBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
									}
									if (typeof terminalManager !== "undefined")
										terminalManager.startInline(pre, data.session)
								} else {
									runBtn.style.color = "#f38ba8"
								}
							} catch (err) {
								runBtn.style.color = "#f38ba8"
							}
							setTimeout(() => {
								runBtn.style.color = "#c4c7c5"
								if (window.gmtPolicy) {
									runBtn.innerHTML = window.gmtPolicy.createHTML(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`)
								} else {
									runBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
								}
							}, 8000)
						},
						onerror: () => {
							runBtn.style.color = "#f38ba8"
							setTimeout(() => {
								runBtn.style.color = "#c4c7c5"
								if (window.gmtPolicy) {
									runBtn.innerHTML = window.gmtPolicy.createHTML(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`)
								} else {
									runBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
								}
							}, 5000)
						},
					})
				} else {
					console.error("[GMT] GM_xmlhttpRequest is not defined.")
				}
			}

			// Find the correct wrapper to insert before (so we don't end up inside a tooltip wrapper)
			let targetNode = copyBtn
			if (copyBtn.closest("gem-icon-button")) {
				targetNode = copyBtn.closest("gem-icon-button")
			} else if (copyBtn.closest("button-group") || copyBtn.closest("span.action-btn-wrapper")) {
				targetNode = copyBtn.closest("span.action-btn-wrapper") || copyBtn.closest("button-group") || targetNode
			}

			if (targetNode && targetNode.parentNode) {
				if (targetNode.parentNode.querySelector(".run-btn-gmt")) return

				targetNode.parentNode.insertBefore(runBtn, targetNode)
				// Make sure the parent has a flex layout or similar so they sit side by side
				const parentStyle = window.getComputedStyle(targetNode.parentNode)
				if (
					parentStyle.display !== "flex" &&
					parentStyle.display !== "inline-flex"
				) {
					targetNode.parentNode.style.display = "flex"
					targetNode.parentNode.style.alignItems = "center"
					targetNode.parentNode.style.flexDirection = "row"
				}
			}
		})
	}

	// ═══════════════════════════════════════════════════════════
	// TERMINAL OUTPUT ATTACHMENT
	// ═══════════════════════════════════════════════════════════
	const terminalManager = {
		pollers: {},
		contexts: {},

		startInline(pre, session) {
			let container = pre.nextElementSibling
			if (!container || !container.classList.contains("gmt-inline-output")) {
				container = document.createElement("div")
				container.className = "gmt-inline-output"
				container.style.cssText = `
					background: rgba(30, 30, 46, 0.85);
					border: 1px solid rgba(255, 255, 255, 0.08);
					border-radius: 8px;
					margin-top: 8px;
					padding: 12px;
					font-family: monospace;
					font-size: 12px;
					color: #a6adc8;
					max-height: 400px;
					overflow-y: auto;
					position: relative;
				`
				pre.parentNode.insertBefore(container, pre.nextSibling)
			}

			container.textContent = ""

			const header = document.createElement("div")
			header.style.cssText =
				"display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; color: #89b4fa; font-weight: bold;"
			header.innerText = `Terminal Output (tmux: ${session})`

			const outputEl = document.createElement("pre")
			outputEl.style.cssText =
				"margin: 0; white-space: pre-wrap; word-wrap: break-word;"
			outputEl.innerText = "Loading..."

			const inputForm = document.createElement("form")
			inputForm.style.cssText = "display: flex; gap: 8px; margin-top: 8px;"
			const inputField = document.createElement("input")
			inputField.type = "text"
			inputField.placeholder = "Sudo pwd or input..."
			inputField.style.cssText =
				"flex-grow: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #e2e2f0; padding: 4px 8px; font-size: 12px;"
			const sendBtn = document.createElement("button")
			sendBtn.innerText = "Send"
			sendBtn.type = "submit"
			sendBtn.style.cssText =
				"background: #89b4fa; color: #11111b; border: none; border-radius: 4px; padding: 4px 12px; font-size: 12px; cursor: pointer; font-weight: bold;"

			inputForm.appendChild(inputField)
			inputForm.appendChild(sendBtn)

			inputForm.onsubmit = (e) => {
				e.preventDefault()
				this.sendInput(session, inputField.value)
				inputField.value = ""
			}

			container.appendChild(header)
			container.appendChild(outputEl)
			container.appendChild(inputForm)

			if (this.pollers[session]) clearInterval(this.pollers[session])
			this.pollers[session] = setInterval(
				() => this.poll(session, outputEl),
				2000,
			)
			this.poll(session, outputEl)
		},

		poll(session, outputEl) {
			if (typeof GM_xmlhttpRequest === "function") {
				GM_xmlhttpRequest({
					method: "GET",
					url: `http://127.0.0.1:3033/session-output?session=${session}`,
					onload: (res) => {
						try {
							const data = JSON.parse(res.responseText)
							if (data.ok && typeof data.output === "string") {
								outputEl.innerText = data.output || "(empty output)"
								outputEl.scrollTop = outputEl.scrollHeight
								this.updateContextPill(session, data.output)
							}
						} catch (e) {}
					},
				})
			}
		},

		sendInput(session, text) {
			if (typeof GM_xmlhttpRequest === "function") {
				GM_xmlhttpRequest({
					method: "POST",
					url: "http://127.0.0.1:3033/send-input",
					headers: {
						"Content-Type": "application/json",
						"x-gemini-thread-saver-key":
							typeof GM_getValue === "function" ?
								GM_getValue("gmt_archive_secret")
							:	"",
					},
					data: JSON.stringify({ session: session, text: text }),
				})
			}
		},

		updateContextPill(session, output) {
			if (!this.contexts[session]) {
				this.contexts[session] = { active: true, output: output }
			} else {
				this.contexts[session].output = output
			}
			this.renderContextPills()
		},

		renderContextPills() {
			const inputArea =
				document.querySelector('rich-textarea[aria-label="Message Gemini"]') ||
				document.querySelector(".ql-editor")
			if (!inputArea) return

			let container = document.getElementById("gmt-context-pills-container")
			if (!container) {
				container = document.createElement("div")
				container.id = "gmt-context-pills-container"
				container.style.cssText =
					"display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;"

				// Insert right before the input area or as its previous sibling
				const wrapper = inputArea.closest("rich-textarea") || inputArea
				if (wrapper && wrapper.parentNode) {
					wrapper.parentNode.insertBefore(container, wrapper)
				}
			}

			container.textContent = ""
			Object.entries(this.contexts).forEach(([session, ctx]) => {
				if (!ctx.active) return

				const pill = document.createElement("div")
				pill.style.cssText = `
					background: rgba(137, 180, 250, 0.15);
					border: 1px solid rgba(137, 180, 250, 0.3);
					color: #89b4fa;
					border-radius: 16px;
					padding: 4px 12px;
					font-size: 12px;
					font-family: "Google Sans", sans-serif;
					display: flex;
					align-items: center;
					gap: 6px;
					cursor: pointer;
					position: relative;
				`

				const textNode = document.createElement("span")
				textNode.innerText = `Terminal: ${session}`
				pill.appendChild(textNode)

				const removeBtn = document.createElement("span")
				removeBtn.textContent = "\u00D7"
				removeBtn.style.cssText =
					"font-size: 14px; font-weight: bold; opacity: 0.7; cursor: pointer;"
				removeBtn.onclick = (e) => {
					e.stopPropagation()
					ctx.active = false
					this.renderContextPills()
				}
				pill.appendChild(removeBtn)

				// Hover tooltip
				pill.onmouseover = (e) => {
					let tooltip = document.getElementById("gmt-context-tooltip")
					if (!tooltip) {
						tooltip = document.createElement("div")
						tooltip.id = "gmt-context-tooltip"
						tooltip.style.cssText = `
							position: absolute;
							bottom: 100%;
							left: 0;
							margin-bottom: 8px;
							background: #1e1e2e;
							border: 1px solid rgba(255,255,255,0.1);
							border-radius: 8px;
							padding: 8px;
							color: #cdd6f4;
							font-family: monospace;
							font-size: 11px;
							max-width: 400px;
							max-height: 200px;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: pre-wrap;
							box-shadow: 0 4px 12px rgba(0,0,0,0.5);
							z-index: 99999;
							pointer-events: none;
						`
						pill.appendChild(tooltip)
					}
					// Show the last 500 chars roughly
					const snippet =
						ctx.output.length > 500 ?
							"..." + ctx.output.slice(-500)
						:	ctx.output
					tooltip.innerText = snippet
				}
				pill.onmouseout = (e) => {
					const tooltip = document.getElementById("gmt-context-tooltip")
					if (tooltip) tooltip.remove()
				}

				// Clicking the pill itself toggles insertion manually
				pill.onclick = () => {
					this.injectToChat(ctx.output)
				}

				container.appendChild(pill)
			})
		},

		injectToChat(text) {
			if (!text) return
			const input =
				document.querySelector('rich-textarea[aria-label="Message Gemini"]') ||
				document.querySelector(".ql-editor")
			if (input) {
				input.focus()
				// Fix newline issue by using execCommand insertText
				// We format it as a markdown code block
				const formatted = `

\`\`\`text
${text}
\`\`\`
`
				document.execCommand("insertText", false, formatted)
			}
		},
	}

	// Auto-inject context on enter/submit logic
	document.addEventListener(
		"keydown",
		(e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				const input =
					document.querySelector(
						'rich-textarea[aria-label="Message Gemini"]',
					) || document.querySelector(".ql-editor")
				if (input && input.contains(e.target)) {
					// If there are active contexts, inject them right before sending
					let allContext = ""
					Object.entries(terminalManager.contexts).forEach(([session, ctx]) => {
						if (ctx.active) {
							allContext += `

[Attached Context: ${session}]
\`\`\`text
${ctx.output}
\`\`\`
`
							// Auto-detach after injection
							ctx.active = false
						}
					})

					if (allContext) {
						// Inject gracefully
						input.focus()
						document.execCommand("insertText", false, allContext)
						terminalManager.renderContextPills()
					}
				}
			}
		},
		true,
	)

	// ═══════════════════════════════════════════════════════════
	// PRIVATE LOCAL MARKDOWN ARCHIVE
	// ═══════════════════════════════════════════════════════════
	const ARCHIVE_SERVER = "http://127.0.0.1:3033/archive"
	const ARCHIVE_KEY = "gmt_archive_secret"
	let archiveWriteInFlight = false
	let archiveNoticeTimer = null

	function showArchiveNotice(text, isError = false) {
		if (!document.body) return
		let notice = document.getElementById("gmt-archive-notice")
		if (!notice) {
			notice = document.createElement("div")
			notice.id = "gmt-archive-notice"
			notice.style.cssText =
				"position:fixed;right:64px;top:16px;z-index:999999;padding:7px 10px;border-radius:7px;font:18px monospace;pointer-events:none;opacity:0;transition:opacity .2s ease"
			document.body.appendChild(notice)
		}
		notice.textContent = text
		notice.style.color = isError ? "rgba(180,45,45,.94)" : "rgba(25,110,65,.94)"
		notice.style.opacity = "1"
		clearTimeout(archiveNoticeTimer)
		archiveNoticeTimer = setTimeout(() => {
			notice.style.opacity = "0"
		}, 2800)
	}
	function getArchiveConversationId() {
		return location.pathname.match(/\/app\/([a-zA-Z0-9_-]+)/)?.[1] || null
	}
	function getArchiveTitle() {
		let title = document.title
			.replace(/\s+-\s+(Google )?Gemini\s*$/i, "")
			.trim()
		title = title.replace(
			/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?:\s+[A-Z]{3,4}[+-]?\d*)?\]\s*/i,
			"",
		)
		return title || "Untitled Thread"
	}
	GM_registerMenuCommand("Set local archive key", () => {
		const key = prompt(
			"Paste the local archive key. Run `cat ~/.config/gemini-thread-saver/secret | pbcopy` in your terminal to get it:",
			GM_getValue(ARCHIVE_KEY, ""),
		)
		if (key?.trim()) {
			GM_setValue(ARCHIVE_KEY, key.trim())
			showArchiveNotice("Local archive key saved")
		}
	})
	GM_registerMenuCommand("Save this thread now", () =>
		exportThreadWithTimestamps(true),
	)

	// Thread Context Sync
	function showSyncedIcon() {
		let icon = document.getElementById("ai-os-synced-icon")
		if (!icon) {
			icon = document.createElement("div")
			icon.id = "ai-os-synced-icon"
			icon.textContent = "✓ Synced"
			icon.style.position = "fixed"
			icon.style.bottom = "16px"
			icon.style.right = "16px"
			icon.style.padding = "4px 8px"
			icon.style.background = "rgba(100, 255, 100, 0.2)"
			icon.style.border = "1px solid rgba(100, 255, 100, 0.4)"
			icon.style.color = "#0f0"
			icon.style.borderRadius = "6px"
			icon.style.fontSize = "22px"
			icon.style.fontFamily = "monospace"
			icon.style.zIndex = "9999"
			icon.style.opacity = "0"
			icon.style.transition = "opacity 0.3s ease-in-out"
			icon.style.pointerEvents = "none"
			document.body.appendChild(icon)
		}

		icon.style.opacity = "1"
		if (window._syncIconTimeout) clearTimeout(window._syncIconTimeout)
		window._syncIconTimeout = setTimeout(() => {
			icon.style.opacity = "0"
		}, 2000)
	}

	async function exportThreadWithTimestamps(force = false) {
		if (!autoThreadSync && !force) return
		if (archiveWriteInFlight) return
		const conversationId = getArchiveConversationId()
		const messages = Array.from(
			document.querySelectorAll("user-query, model-response"),
		)
		if (!conversationId || messages.length === 0) return

		const threadData = messages.map((msg) => {
			const role =
				msg.tagName.toLowerCase() === "user-query" ? "user" : "assistant"
			const timestampEl = msg.parentElement?.querySelector(".gm-timestamp")
			const timestamp = timestampEl?.getAttribute("data-timestamp") || null
			if (msg.dataset.aiosParsedText && msg !== messages[messages.length - 1]) {
				return { role, timestamp, text: msg.dataset.aiosParsedText }
			}
			const clone = msg.cloneNode(true)
			const hidden = document.createElement("div")
			hidden.id = "ai-os-sync-temp-container"
			hidden.style.cssText = "display:block;position:absolute;left:-9999px"
			hidden.appendChild(clone)
			document.body.appendChild(hidden)
			clone.querySelectorAll("pre").forEach((pre) => {
				pre.innerText = `\n\`\`\`\n${pre.innerText}\n\`\`\`\n`
			})
			clone.querySelectorAll("code").forEach((code) => {
				if (!code.closest("pre")) code.innerText = `\`${code.innerText}\``
			})
			clone.querySelectorAll("b, strong").forEach((el) => {
				el.innerText = `**${el.innerText}**`
			})
			clone.querySelectorAll("i, em").forEach((el) => {
				el.innerText = `*${el.innerText}*`
			})
			const text = (clone.innerText || "")
				.trim()
				.replace(/^(You said|Gemini said)\s*/i, "")
			hidden.remove()
			if (msg !== messages[messages.length - 1])
				msg.dataset.aiosParsedText = text
			return { role, timestamp, text }
		})

		const record = {
			schema_version: 1,
			source: "gemini.google.com",
			conversation_id: conversationId,
			title: getArchiveTitle(),
			source_url: location.href,
			archived_at: new Date().toISOString(),
			message_count: threadData.length,
			messages: threadData,
		}
		const signature = JSON.stringify({
			id: conversationId,
			title: record.title,
			messages: threadData,
		})
		if (!force && window._lastLocalThreadArchive === signature) return
		const key = GM_getValue(ARCHIVE_KEY, "")
		if (!key) {
			if (force) showArchiveNotice("Set local archive key first", true)
			return
		}
		archiveWriteInFlight = true
		try {
			const response = await new Promise((resolve, reject) =>
				GM_xmlhttpRequest({
					method: "POST",
					url: ARCHIVE_SERVER,
					data: JSON.stringify(record),
					headers: {
						"Content-Type": "application/json",
						"X-Gemini-Thread-Saver-Key": key,
					},
					timeout: 30000,
					onload: resolve,
					onerror: () =>
						reject(new Error("Could not reach local archive server")),
					ontimeout: () => reject(new Error("Local archive server timed out")),
				}),
			)
			if (response.status < 200 || response.status >= 300)
				throw new Error(`Server ${response.status}: ${response.responseText}`)
			const result = JSON.parse(response.responseText)
			window._lastLocalThreadArchive = signature
			showArchiveNotice(`•`)
			console.log("[Gemini Thread Saver] Saved:", result.path)
		} catch (error) {
			console.error("[Gemini Thread Saver] Save failed:", error)
			showArchiveNotice(`Local save failed: ${error.message}`, true)
		} finally {
			archiveWriteInFlight = false
		}
	}
})()
