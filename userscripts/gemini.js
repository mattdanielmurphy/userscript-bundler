// ==UserScript==
// @name         GMT Archive
// @namespace    local.gmt.archive
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

;(function () {
	"use strict"

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
		console.log(`[GMT] scan: ${nodes.length} p.query-text-line node(s)`)
		nodes.forEach((p, i) => {
			const raw = p.innerText || p.textContent || ""
			const match = raw.match(EMBED_RE)
			if (!match) return
			console.log(
				`[GMT] [${i}] date=${match[1]} time=${match[2]} tz=${match[3]} offset=${match[4]}`,
			)
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
			p.innerText = raw.replace(EMBED_RE, "").trim()
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

	let currentPhase = 0
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

			const timestamp = getNowTimestamp() + " "
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

			const timestamp = getNowTimestamp() + " "
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
		} else if (warnIfMissing) {
			console.warn(
				"Element not found: .right-section > .buttons-container.adv-upsell",
			)
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
					const stopButton = document.querySelector('button[aria-label*="Stop"], button[aria-label*="stop"]')
					if (stopButton) {
						const label = stopButton.getAttribute("aria-label") || ""
						if (/stop/i.test(label) && (/generat/i.test(label) || /respons/i.test(label) || /stream/i.test(label))) {
							return true
						}
					}
					const msgElements = document.querySelectorAll("user-query, model-response")
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
            margin-bottom: 8px !important;
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
		btnSpan.textContent = `Phase ${currentPhase}`
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
		phaseDropdownMenu.style.top = `${window.scrollY + rect.bottom + 6}px`
		phaseDropdownMenu.style.left = `${rect.left}px`
		phaseDropdownMenu.style.display = "block"
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

	// ═══════════════════════════════════════════════════════════
	// PRIVATE LOCAL MARKDOWN ARCHIVE
	// ═══════════════════════════════════════════════════════════
	const ARCHIVE_SERVER = "http://127.0.0.1:3030/archive"
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
				"position:fixed;right:16px;bottom:16px;z-index:999999;padding:7px 10px;border-radius:7px;font:12px monospace;pointer-events:none;opacity:0;transition:opacity .2s ease"
			document.body.appendChild(notice)
		}
		notice.textContent = text
		notice.style.background =
			isError ? "rgba(180,45,45,.94)" : "rgba(25,110,65,.94)"
		notice.style.color = "#fff"
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
		return (
			document.title.replace(/\s+-\s+(Google )?Gemini\s*$/i, "").trim() ||
			"Untitled Thread"
		)
	}
	GM_registerMenuCommand("Set local archive key", () => {
		const key = prompt(
			"Paste the local archive key printed/held by gmt-archive-server:",
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
			icon.style.fontSize = "12px"
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
						"X-GMT-Archive-Key": key,
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
			showArchiveNotice(`Saved locally: ${result.path}`)
			console.log("[GMT archive] Saved:", result.path)
		} catch (error) {
			console.error("[GMT archive] Save failed:", error)
			showArchiveNotice(`Local save failed: ${error.message}`, true)
		} finally {
			archiveWriteInFlight = false
		}
	}
})()
