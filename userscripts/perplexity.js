// ==UserScript==
// @name         Perplexity Thread Saver
// @namespace    local.perplexity.thread.saver
// @version      1.0.0
// @description  Perplexity private local Markdown archive.
// @match        https://www.perplexity.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @run-at       document-start
// ==/UserScript==

const estimateTokensAccurate = (text) => {
	if (!text) return 0

	const cl100k_regex =
		/'s|'t|'re|'ve|'m|'ll|'d|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}|[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu

	const chunks = text.match(cl100k_regex)
	if (!chunks) return 0

	let totalTokens = 0

	for (let chunk of chunks) {
		const len = chunk.length

		if (len <= 3) {
			totalTokens += 1
			continue
		}

		if (/^[^\s\p{L}\p{N}]+$/u.test(chunk)) {
			totalTokens += Math.ceil(len / 2)
			continue
		}

		totalTokens += Math.ceil(len / 4)
	}

	return totalTokens
}

;(function () {
	"use strict"

	let lastConversationId = null
	let beginningLoaded = false

	function getScrollContainer() {
		const firstQuery = document.querySelector('[class*="group/query"]')
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
			'[class*="group/query"], .prose',
		)
		return Array.from(elements).map((el) => {
			const isUser = el.className.includes("group/query")
			let text = (el.textContent || "").trim()
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

		let total = 0
		let input = 0
		let output = 0
		let isPrecise = beginningLoaded

		for (let i = 0; i < messages.length; i++) {
			const tokens = estimateTokensAccurate(messages[i].text)
			total += tokens
			if (messages[i].role === "user") {
				input += tokens
			} else {
				output += tokens
			}
		}

		return { total, input, output, isPrecise }
	}

	function checkThreadUsage() {
		const usage = calculateThreadTokens()
		const { total, input, output, isPrecise } = usage

		if (total === 0) {
			const existingBadge = document.getElementById("pplx-token-usage-badge")
			if (existingBadge) {
				existingBadge.style.display = "none"
			}
			const existingTooltip = document.getElementById("pplx-token-usage-tooltip")
			if (existingTooltip) {
				existingTooltip.style.display = "none"
			}
			return
		}

		let badge = document.getElementById("pplx-token-usage-badge")
		let tooltip = document.getElementById("pplx-token-usage-tooltip")
		let totalSpan
		if (!badge) {
			badge = document.createElement("div")
			badge.id = "pplx-token-usage-badge"
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
				font-family: system-ui, -apple-system, sans-serif;
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

			tooltip = document.createElement("div")
			tooltip.id = "pplx-token-usage-tooltip"
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
				font-family: system-ui, -apple-system, sans-serif;
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

			const inRow = document.createElement("div")
			inRow.style.cssText =
				"display: flex; justify-content: space-between; gap: 16px; color: #c4c4c7;"
			const inLabel = document.createElement("span")
			inLabel.textContent = "Input:"
			inRow.appendChild(inLabel)
			const inVal = document.createElement("span")
			inVal.id = "pplx-tooltip-in-val"
			inVal.style.cssText = "color: #a6e3a1; font-weight: 600;"
			inRow.appendChild(inVal)
			tooltip.appendChild(inRow)

			const outRow = document.createElement("div")
			outRow.style.cssText =
				"display: flex; justify-content: space-between; gap: 16px; color: #c4c4c7;"
			const outLabel = document.createElement("span")
			outLabel.textContent = "Output:"
			outRow.appendChild(outLabel)
			const outVal = document.createElement("span")
			outVal.id = "pplx-tooltip-out-val"
			outVal.style.cssText = "color: #74c7ec; font-weight: 600;"
			outRow.appendChild(outVal)
			tooltip.appendChild(outRow)

			const divider = document.createElement("div")
			divider.style.cssText =
				"height: 1px; background: rgba(255, 255, 255, 0.1); margin: 2px 0;"
			tooltip.appendChild(divider)

			const totalRow = document.createElement("div")
			totalRow.style.cssText =
				"display: flex; justify-content: space-between; gap: 16px; font-weight: 700;"
			const totalLabel = document.createElement("span")
			totalLabel.textContent = "Total:"
			totalRow.appendChild(totalLabel)
			const totalVal = document.createElement("span")
			totalVal.id = "pplx-tooltip-total-val"
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

			totalSpan = document.createElement("span")
			totalSpan.id = "pplx-token-total"
			totalSpan.style.cssText = "font-weight: 700; color: #e2e2f0;"
			badge.appendChild(totalSpan)

			const blocksContainer = document.createElement("div")
			blocksContainer.id = "pplx-token-blocks"
			blocksContainer.style.cssText =
				"display: flex; align-items: flex-end; gap: 2px; height: 12px;"

			const heights = [4, 6, 8, 10, 12]
			for (let i = 0; i < 5; i++) {
				const block = document.createElement("div")
				block.className = "pplx-token-block"
				block.style.cssText = `width: 3px; height: ${heights[i]}px; border-radius: 1px; transition: background-color 0.3s ease;`
				blocksContainer.appendChild(block)
			}
			badge.appendChild(blocksContainer)

			document.body.appendChild(badge)
		} else {
			totalSpan = document.getElementById("pplx-token-total")
		}

		let stage = 1
		let stageColor = "#a6e3a1"
		if (total > 20000) {
			stage = 5
			stageColor = "#f38ba8"
		} else if (total > 10000) {
			stage = 4
			stageColor = "#fab387"
		} else if (total > 5000) {
			stage = 3
			stageColor = "#f9e2af"
		} else if (total > 2000) {
			stage = 2
			stageColor = "#89b4fa"
		}

		badge.style.display = "flex"
		if (tooltip) {
			tooltip.style.display = "flex"
			const inVal = document.getElementById("pplx-tooltip-in-val")
			const outVal = document.getElementById("pplx-tooltip-out-val")
			const totalVal = document.getElementById("pplx-tooltip-total-val")

			const suffix = isPrecise ? "" : "*"

			if (inVal) inVal.textContent = input.toLocaleString() + suffix
			if (outVal) outVal.textContent = output.toLocaleString() + suffix
			if (totalVal) totalVal.textContent = total.toLocaleString() + suffix

			let statusRow = document.getElementById("pplx-tooltip-status")
			if (!statusRow) {
				statusRow = document.createElement("div")
				statusRow.id = "pplx-tooltip-status"
				statusRow.style.cssText =
					"font-size: 0.65rem; color: #f38ba8; font-weight: 500; margin-top: 4px; text-align: right;"
				tooltip.appendChild(statusRow)
			}
			if (!isPrecise) {
				statusRow.textContent = "* Scroll to top to calculate full count"
				statusRow.style.color = "#f38ba8"
				statusRow.style.display = "block"
			} else {
				statusRow.style.display = "none"
			}
		}

		totalSpan.textContent = total.toLocaleString() + (isPrecise ? "" : "*")

		const blocks = badge.querySelectorAll(".pplx-token-block")
		blocks.forEach((block, index) => {
			if (index < stage) {
				block.style.backgroundColor = stageColor
			} else {
				block.style.backgroundColor = "rgba(255, 255, 255, 0.15)"
			}
		})
	}

	setInterval(checkThreadUsage, 2500)

	// ═══════════════════════════════════════════════════════════
	// PRIVATE LOCAL MARKDOWN ARCHIVE
	// ═══════════════════════════════════════════════════════════
	const ARCHIVE_SERVER = "http://127.0.0.1:3033/archive"
	const ARCHIVE_KEY = "gmt_archive_secret" // Share the same local archive key
	let archiveWriteInFlight = false
	let archiveNoticeTimer = null

	function showArchiveNotice(text, isError = false) {
		if (!document.body) return
		let notice = document.getElementById("pplx-archive-notice")
		if (!notice) {
			notice = document.createElement("div")
			notice.id = "pplx-archive-notice"
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
		return location.pathname.match(/\/search\/([a-zA-Z0-9-]+)/)?.[1] || null
	}

	function getArchiveTitle() {
		let title = document.title
			.replace(/\s+-\s+Perplexity\s*$/i, "")
			.trim()
		return title || "Untitled Thread"
	}

	GM_registerMenuCommand("Save this Perplexity thread now", () =>
		exportThreadWithTimestamps(true),
	)

	// Auto-save on page load / completion
	let lastSaveMessageCount = 0

	async function exportThreadWithTimestamps(force = false) {
		if (archiveWriteInFlight) return
		const conversationId = getArchiveConversationId()
		const messages = Array.from(
			document.querySelectorAll('[class*="group/query"], .prose'),
		)
		if (!conversationId || messages.length === 0) return

		// Avoid spamming requests unless the message count has grown
		if (!force && messages.length <= lastSaveMessageCount) return

		const threadData = messages.map((msg) => {
			const role = msg.className.includes("group/query") ? "user" : "assistant"
			
			// Custom parsing to markdown
			const clone = msg.cloneNode(true)
			const hidden = document.createElement("div")
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
			const text = (clone.innerText || "").trim()
			hidden.remove()
			
			return { 
				role, 
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
				text 
			}
		})

		const record = {
			schema_version: 1,
			source: "perplexity.ai",
			conversation_id: conversationId,
			title: getArchiveTitle(),
			source_url: location.href,
			archived_at: new Date().toISOString(),
			message_count: threadData.length,
			messages: threadData,
		}

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
			
			lastSaveMessageCount = messages.length
			showArchiveNotice(`•`)
			console.log("[Perplexity Thread Saver] Saved:", conversationId)
		} catch (error) {
			console.error("[Perplexity Thread Saver] Save failed:", error)
			showArchiveNotice(`Local save failed: ${error.message}`, true)
		} finally {
			archiveWriteInFlight = false
		}
	}

	// Periodically auto-sync if active
	setInterval(() => {
		exportThreadWithTimestamps(false)
	}, 10000)
})()
