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
