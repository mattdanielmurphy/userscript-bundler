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

gm.registerMenuCommand("Set local archive key", () => {
	const key = prompt(
		"Paste the local archive key. Run `cat ~/.config/gemini-thread-saver/secret | pbcopy` in your terminal to get it:",
		gm.getValue(ARCHIVE_KEY, ""),
	)
	if (key?.trim()) {
		gm.setValue(ARCHIVE_KEY, key.trim())
		showArchiveNotice("Local archive key saved")
	}
})

gm.registerMenuCommand("Save this thread now", () =>
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
	if (!gm.isXmlHttpRequestSupported) {
		if (force) showArchiveNotice("Archive unavailable: network API unsupported", true)
		return
	}
	const key = gm.getValue(ARCHIVE_KEY, "")
	if (!key) {
		if (force) showArchiveNotice("Set local archive key first", true)
		return
	}
	archiveWriteInFlight = true
	try {
		const response = await new Promise((resolve, reject) =>
			gm.xmlHttpRequest({
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
