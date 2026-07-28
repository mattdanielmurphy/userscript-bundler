// ═══════════════════════════════════════════════════════════
// TOOL CALL EXECUTION & PARSING
// ═══════════════════════════════════════════════════════════

window.executeToolCall = function(tool, args) {
	if (tool === "save_note") {
		const title = args.title || "Untitled Note"
		const content = args.content || ""
		
		const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim()
		const dirPath = "/Users/matt/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal/Development/Project Notes"
		const filePath = `${dirPath}/${safeTitle}.md`

		const base64Content = btoa(unescape(encodeURIComponent(content)))
		const cmd = `echo "${base64Content}" | base64 --decode > "${filePath}"`
		const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""

		const doReq = (fn) => fn({
			method: "POST",
			url: "http://127.0.0.1:3033/run-command",
			headers: {
				"Content-Type": "application/json",
				"x-gemini-thread-saver-key": secret,
			},
			data: JSON.stringify({ command: cmd }),
			onload: (res) => {
				try {
					const data = JSON.parse(res.responseText)
					if (data.ok) {
						showToolNotification(`Note Saved: ${safeTitle}`, filePath)
					} else {
						showToolNotification(`Error saving note: ${safeTitle}`, null, true)
					}
				} catch (e) {
					showToolNotification(`Error saving note: ${safeTitle}`, null, true)
				}
			},
			onerror: () => {
				showToolNotification(`Connection error saving note`, null, true)
			}
		})

		if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) {
			doReq(o => gm.xmlHttpRequest(o))
		} else if (typeof GM_xmlhttpRequest !== "undefined") {
			doReq(GM_xmlhttpRequest)
		}
	}
}

// Generate a human-readable one-line summary of a tool call
function toolCallSummary(tool, args) {
	if (tool === "save_note") {
		return `Save note: "${args.title || 'Untitled'}"`
	}
	const firstVal = args && Object.values(args)[0]
	const preview = typeof firstVal === "string" ? `"${firstVal.slice(0, 60)}"` : ""
	return `${tool}${preview ? `: ${preview}` : ""}`
}

function showToolNotification(message, filePath = null, isError = false) {
	if (!document.getElementById("gmt-notif-styles")) {
		const style = document.createElement("style")
		style.id = "gmt-notif-styles"
		style.textContent = `
			@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
			@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
		`
		document.head.appendChild(style)
	}

	const notif = document.createElement("div")
	notif.style.cssText = `
		position: fixed;
		bottom: 24px;
		right: 24px;
		background: ${isError ? '#f38ba8' : '#a6e3a1'};
		color: #11111b;
		padding: 12px 16px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		z-index: 2147483647;
		font-family: "Google Sans", sans-serif;
		font-size: 14px;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 12px;
		animation: slideIn 0.3s ease-out forwards;
		max-width: 360px;
	`

	const textEl = document.createElement("div")
	textEl.textContent = message
	notif.appendChild(textEl)

	if (filePath && !isError) {
		const openBtn = document.createElement("button")
		openBtn.textContent = "Open"
		openBtn.style.cssText = "background: rgba(0,0,0,0.1); border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit; white-space: nowrap;"
		openBtn.onclick = () => {
			const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
			const reqData = {
				method: "POST",
				url: "http://127.0.0.1:3033/run-command",
				headers: { "Content-Type": "application/json", "x-gemini-thread-saver-key": secret },
				data: JSON.stringify({ command: `open "${filePath}"` })
			}
			if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) gm.xmlHttpRequest(reqData)
			else if (typeof GM_xmlhttpRequest !== "undefined") GM_xmlhttpRequest(reqData)
		}
		notif.appendChild(openBtn)

		const undoBtn = document.createElement("button")
		undoBtn.textContent = "Undo"
		undoBtn.style.cssText = "background: rgba(0,0,0,0.1); border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit;"
		undoBtn.onclick = () => {
			const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
			const reqData = {
				method: "POST",
				url: "http://127.0.0.1:3033/run-command",
				headers: { "Content-Type": "application/json", "x-gemini-thread-saver-key": secret },
				data: JSON.stringify({ command: `rm "${filePath}"` }),
				onload: () => {
					textEl.textContent = "Note deleted."
					openBtn.remove()
					undoBtn.remove()
				}
			}
			if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) gm.xmlHttpRequest(reqData)
			else if (typeof GM_xmlhttpRequest !== "undefined") GM_xmlhttpRequest(reqData)
		}
		notif.appendChild(undoBtn)
	}

	const closeBtn = document.createElement("div")
	closeBtn.textContent = "\u00D7"
	closeBtn.style.cssText = "cursor: pointer; font-size: 18px; font-weight: bold; opacity: 0.6; flex-shrink: 0;"
	closeBtn.onclick = () => {
		notif.style.animation = "fadeOut 0.3s ease-out forwards"
		setTimeout(() => notif.remove(), 300)
	}
	notif.appendChild(closeBtn)

	document.body.appendChild(notif)

	setTimeout(() => {
		if (document.body.contains(notif)) {
			notif.style.animation = "fadeOut 0.3s ease-out forwards"
			setTimeout(() => notif.remove(), 300)
		}
	}, 10000)
}

function ensureToolCallStyles() {
	if (document.getElementById("gmt-tool-call-styles")) return
	const style = document.createElement("style")
	style.id = "gmt-tool-call-styles"
	style.textContent = `
		.gmt-tool-call-pill {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			background: rgba(166, 227, 161, 0.12);
			border: 1px solid rgba(166, 227, 161, 0.35);
			color: #a6e3a1;
			border-radius: 6px;
			padding: 4px 10px;
			font-family: "Google Sans", sans-serif;
			font-size: 12px;
			font-weight: 500;
			cursor: pointer;
			user-select: none;
			margin: 4px 0;
			transition: background 0.15s;
		}
		.gmt-tool-call-pill:hover {
			background: rgba(166, 227, 161, 0.22);
		}
		.gmt-pill-arrow {
			font-size: 10px;
			opacity: 0.7;
			transition: transform 0.15s;
			display: inline-block;
		}
		.gmt-tool-call-pill.expanded .gmt-pill-arrow {
			transform: rotate(90deg);
		}
		.gmt-tool-call-original {
			display: none;
			margin-top: 6px;
		}
		.gmt-tool-call-pill.expanded + .gmt-tool-call-original {
			display: block;
		}
		.gmt-run-btn {
			background: rgba(166,227,161,0.15);
			border: 1px solid rgba(166,227,161,0.4);
			color: #a6e3a1;
			border-radius: 4px;
			padding: 2px 8px;
			font-size: 11px;
			cursor: pointer;
			font-family: "Google Sans", sans-serif;
			margin-left: 6px;
			transition: background 0.15s;
		}
		.gmt-run-btn:hover { background: rgba(166,227,161,0.3); }
	`
	document.head.appendChild(style)
}

function findCodeBlockWrapper(pre) {
	let el = pre.parentElement
	for (let i = 0; i < 10; i++) {
		if (!el || el.tagName === "BODY") break
		const tag = el.tagName.toLowerCase()
		if (tag === "response-element" || tag === "code-block") return el
		el = el.parentElement
	}
	return pre.closest(".code-block") || pre.parentElement
}

window.scanToolCalls = function() {
	// Track whether this is the initial page-load scan or a live mutation scan
	const isInitialScan = !document.body.dataset.gmtInitialScanDone

	const preElements = document.querySelectorAll("model-response pre, pre")

	preElements.forEach((pre) => {
		if (pre.dataset.toolCallProcessed) return

		const codeEl = pre.querySelector("code") || pre
		const text = codeEl.innerText || ""
		if (!text.trim().startsWith("{")) return

		try {
			const parsed = JSON.parse(text)
			if (!parsed || !parsed.tool || !parsed.args) return

			pre.dataset.toolCallProcessed = "true"

			const summary = toolCallSummary(parsed.tool, parsed.args)
			const wrapper = findCodeBlockWrapper(pre)

			ensureToolCallStyles()

			// Build pill
			const pill = document.createElement("span")
			pill.className = "gmt-tool-call-pill"

			const arrow = document.createElement("span")
			arrow.className = "gmt-pill-arrow"
			arrow.textContent = "▶"
			pill.appendChild(arrow)

			const label = document.createElement("span")
			label.textContent = ` ⚡ ${summary}`
			pill.appendChild(label)

			const runBtn = document.createElement("button")
			runBtn.className = "gmt-run-btn"
			runBtn.textContent = "Run"
			runBtn.title = "Execute this tool call"
			runBtn.onclick = (e) => {
				e.stopPropagation()
				runBtn.textContent = "Running…"
				runBtn.disabled = true
				window.executeToolCall(parsed.tool, parsed.args)
			}
			pill.appendChild(runBtn)

			const originalClone = wrapper.cloneNode(true)
			originalClone.className = (originalClone.className || "") + " gmt-tool-call-original"

			pill.addEventListener("click", () => {
				pill.classList.toggle("expanded")
			})

			const container = document.createElement("div")
			container.appendChild(pill)
			container.appendChild(originalClone)

			if (wrapper.parentNode) {
				wrapper.parentNode.insertBefore(container, wrapper)
				wrapper.remove()
			}

			// Auto-execute if requested
			if (!isInitialScan && parsed.run_automatically === true) {
				window.executeToolCall(parsed.tool, parsed.args)
			}

		} catch (e) {
			// Not valid JSON or still streaming — skip
		}
	})
	// Mark initial scan done after first pass
	if (isInitialScan) {
		document.body.dataset.gmtInitialScanDone = "true"
	}
}
