// ═══════════════════════════════════════════════════════════
// TOOL CALL EXECUTION & PARSING
// ═══════════════════════════════════════════════════════════

window.executeToolCall = function(tool, args) {
	return new Promise((resolve, reject) => {
		if (tool === "save_note") {
			const title = args.title || "Untitled Note"
			const content = args.content || ""
			
			let safeTitle = title.trim()
			if (safeTitle.toLowerCase().endsWith('.md')) {
				safeTitle = safeTitle.slice(0, -3)
			}
			// Allow slashes, remove backslash and invalid chars
			safeTitle = safeTitle.replace(/[\\?%*:|"<>]/g, '-').replace(/\.\.\//g, '').replace(/^\/+/, '')
			
			const baseVault = "/Users/matt/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal"
			const filePath = `${baseVault}/${safeTitle}.md`
			const fileDir = filePath.substring(0, filePath.lastIndexOf('/'))

			const base64Content = btoa(unescape(encodeURIComponent(content)))
			const cmd = `mkdir -p "${fileDir}" && echo "${base64Content}" | base64 --decode > "${filePath}"`
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
							queueFileNotification(safeTitle, filePath)
							resolve()
						} else {
							queueFileNotification(safeTitle, filePath, true)
							reject(new Error("Failed to save note"))
						}
					} catch (e) {
						queueFileNotification(safeTitle, filePath, true)
						reject(e)
					}
				},
				onerror: () => {
					queueFileNotification(safeTitle, filePath, true)
					reject(new Error("Connection error"))
				}
			})

			if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) {
				doReq(o => gm.xmlHttpRequest(o))
			} else if (typeof GM_xmlhttpRequest !== "undefined") {
				doReq(GM_xmlhttpRequest)
			} else {
				reject(new Error("No XHR support"))
			}
		} else {
			resolve()
		}
	})
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

window.__gmtNotificationBatch = window.__gmtNotificationBatch || {
	timer: null,
	items: [],
	errors: []
};

function queueFileNotification(title, filePath, isError = false) {
	if (isError) {
		window.__gmtNotificationBatch.errors.push({ title, filePath });
	} else {
		window.__gmtNotificationBatch.items.push({ title, filePath });
	}
	
	if (window.__gmtNotificationBatch.timer) {
		clearTimeout(window.__gmtNotificationBatch.timer);
	}
	
	window.__gmtNotificationBatch.timer = setTimeout(() => {
		flushFileNotifications();
	}, 300);
}

function flushFileNotifications() {
	const items = window.__gmtNotificationBatch.items;
	const errors = window.__gmtNotificationBatch.errors;
	
	window.__gmtNotificationBatch.items = [];
	window.__gmtNotificationBatch.errors = [];
	
	if (items.length > 0) {
		showBatchedNotification(items, false);
	}
	if (errors.length > 0) {
		showBatchedNotification(errors, true);
	}
}

function showBatchedNotification(files, isError = false) {
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
		flex-direction: column;
		gap: 12px;
		animation: slideIn 0.3s ease-out forwards;
		min-width: 300px;
		max-width: 450px;
	`

	const header = document.createElement("div")
	header.style.cssText = "display: flex; align-items: center; justify-content: space-between; font-weight: bold;"
	
	const titleEl = document.createElement("div")
	if (isError) {
		titleEl.textContent = files.length === 1 ? "Error saving note" : `${files.length} notes failed to save`
	} else {
		titleEl.textContent = files.length === 1 ? "Note Saved" : `${files.length} Notes Saved`
	}
	header.appendChild(titleEl)

	const closeBtn = document.createElement("div")
	closeBtn.textContent = "\\u00D7"
	closeBtn.style.cssText = "cursor: pointer; font-size: 18px; font-weight: bold; opacity: 0.6; line-height: 1;"
	closeBtn.onclick = () => {
		notif.style.animation = "fadeOut 0.3s ease-out forwards"
		setTimeout(() => notif.remove(), 300)
	}
	header.appendChild(closeBtn)
	notif.appendChild(header)

	const listEl = document.createElement("div")
	listEl.style.cssText = "display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;"
	
	files.forEach(f => {
		const itemRow = document.createElement("div")
		itemRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.05); padding: 6px 10px; border-radius: 6px; font-size: 13px;"
		
		const nameEl = document.createElement("div")
		nameEl.textContent = f.title.split('/').pop()
		nameEl.title = f.title
		nameEl.style.cssText = "white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;"
		itemRow.appendChild(nameEl)
		
		if (!isError && f.filePath) {
			const actionRow = document.createElement("div")
			actionRow.style.cssText = "display: flex; gap: 6px;"
			
			const openBtn = document.createElement("button")
			openBtn.textContent = "Open"
			openBtn.style.cssText = "background: rgba(0,0,0,0.1); border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit; font-size: 11px;"
			openBtn.onclick = () => {
				const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
				const reqData = {
					method: "POST",
					url: "http://127.0.0.1:3033/run-command",
					headers: { "Content-Type": "application/json", "x-gemini-thread-saver-key": secret },
					data: JSON.stringify({ command: `open "${f.filePath}"` })
				}
				if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) gm.xmlHttpRequest(reqData)
				else if (typeof GM_xmlhttpRequest !== "undefined") GM_xmlhttpRequest(reqData)
			}
			actionRow.appendChild(openBtn)

			const revealBtn = document.createElement("button")
			revealBtn.textContent = "Reveal"
			revealBtn.style.cssText = "background: rgba(0,0,0,0.1); border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit; font-size: 11px;"
			revealBtn.onclick = () => {
				const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
				const reqData = {
					method: "POST",
					url: "http://127.0.0.1:3033/run-command",
					headers: { "Content-Type": "application/json", "x-gemini-thread-saver-key": secret },
					data: JSON.stringify({ command: `open -R "${f.filePath}"` })
				}
				if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) gm.xmlHttpRequest(reqData)
				else if (typeof GM_xmlhttpRequest !== "undefined") GM_xmlhttpRequest(reqData)
			}
			actionRow.appendChild(revealBtn)
			
			itemRow.appendChild(actionRow)
		}
		
		listEl.appendChild(itemRow)
	})
	notif.appendChild(listEl)

	if (!isError && files.length > 1) {
		const globalActions = document.createElement("div")
		globalActions.style.cssText = "display: flex; gap: 8px; margin-top: 4px;"
		
		const openAllBtn = document.createElement("button")
		openAllBtn.textContent = "Open All"
		openAllBtn.style.cssText = "background: rgba(0,0,0,0.15); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit; flex: 1;"
		openAllBtn.onclick = () => {
			const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
			const cmds = files.map(f => `open "${f.filePath}"`).join(" && ")
			const reqData = {
				method: "POST",
				url: "http://127.0.0.1:3033/run-command",
				headers: { "Content-Type": "application/json", "x-gemini-thread-saver-key": secret },
				data: JSON.stringify({ command: cmds })
			}
			if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) gm.xmlHttpRequest(reqData)
			else if (typeof GM_xmlhttpRequest !== "undefined") GM_xmlhttpRequest(reqData)
		}
		globalActions.appendChild(openAllBtn)
		
		const undoAllBtn = document.createElement("button")
		undoAllBtn.textContent = "Undo All"
		undoAllBtn.style.cssText = "background: rgba(0,0,0,0.15); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit; flex: 1;"
		undoAllBtn.onclick = () => {
			const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
			const cmds = files.map(f => `rm "${f.filePath}"`).join(" && ")
			const reqData = {
				method: "POST",
				url: "http://127.0.0.1:3033/run-command",
				headers: { "Content-Type": "application/json", "x-gemini-thread-saver-key": secret },
				data: JSON.stringify({ command: cmds }),
				onload: () => {
					header.querySelector('div').textContent = "Notes deleted."
					listEl.remove()
					globalActions.remove()
				}
			}
			if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) gm.xmlHttpRequest(reqData)
			else if (typeof GM_xmlhttpRequest !== "undefined") GM_xmlhttpRequest(reqData)
		}
		globalActions.appendChild(undoAllBtn)
		notif.appendChild(globalActions)
	} else if (!isError && files.length === 1) {
		const globalActions = document.createElement("div")
		globalActions.style.cssText = "display: flex; gap: 8px; margin-top: 4px;"
		const undoBtn = document.createElement("button")
		undoBtn.textContent = "Undo"
		undoBtn.style.cssText = "background: rgba(0,0,0,0.15); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit; flex: 1;"
		undoBtn.onclick = () => {
			const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
			const reqData = {
				method: "POST",
				url: "http://127.0.0.1:3033/run-command",
				headers: { "Content-Type": "application/json", "x-gemini-thread-saver-key": secret },
				data: JSON.stringify({ command: `rm "${files[0].filePath}"` }),
				onload: () => {
					header.querySelector('div').textContent = "Note deleted."
					listEl.remove()
					globalActions.remove()
				}
			}
			if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) gm.xmlHttpRequest(reqData)
			else if (typeof GM_xmlhttpRequest !== "undefined") GM_xmlhttpRequest(reqData)
		}
		globalActions.appendChild(undoBtn)
		notif.appendChild(globalActions)
	}

	document.body.appendChild(notif)

	setTimeout(() => {
		if (document.body.contains(notif)) {
			notif.style.animation = "fadeOut 0.3s ease-out forwards"
			setTimeout(() => notif.remove(), 300)
		}
	}, 12000)
}

function ensureToolCallStyles() {
	if (document.getElementById("gmt-tool-call-styles")) return
	const style = document.createElement("style")
	style.id = "gmt-tool-call-styles"
	style.textContent = `
		:root {
			--gmt-pill-bg: rgba(64, 160, 43, 0.12);
			--gmt-pill-border: rgba(64, 160, 43, 0.35);
			--gmt-pill-text: #2e7d1d;
			--gmt-pill-hover: rgba(64, 160, 43, 0.22);
			
			--gmt-btn-bg: rgba(64, 160, 43, 0.15);
			--gmt-btn-border: rgba(64, 160, 43, 0.4);
			--gmt-btn-hover: rgba(64, 160, 43, 0.3);
			
			--gmt-error-bg: rgba(210, 40, 40, 0.12);
			--gmt-error-border: rgba(210, 40, 40, 0.35);
			--gmt-error-text: #b31d1d;
			--gmt-error-hover: rgba(210, 40, 40, 0.22);
			
			--gmt-auto-bg: rgba(26, 115, 232, 0.12);
			--gmt-auto-border: rgba(26, 115, 232, 0.35);
			--gmt-auto-text: #174ea6;
			--gmt-auto-hover: rgba(26, 115, 232, 0.22);

			--gmt-success-bg: rgba(128, 128, 128, 0.1);
			--gmt-success-border: rgba(128, 128, 128, 0.25);
			--gmt-success-text: #5f6368;
			--gmt-success-hover: rgba(128, 128, 128, 0.15);
		}
		
		body.dark-theme, html.dark-theme, .dark-theme-active {
			--gmt-pill-bg: rgba(166, 227, 161, 0.12);
			--gmt-pill-border: rgba(166, 227, 161, 0.35);
			--gmt-pill-text: #a6e3a1;
			--gmt-pill-hover: rgba(166, 227, 161, 0.22);
			
			--gmt-btn-bg: rgba(166, 227, 161, 0.15);
			--gmt-btn-border: rgba(166, 227, 161, 0.4);
			--gmt-btn-hover: rgba(166, 227, 161, 0.3);

			--gmt-error-bg: rgba(243, 139, 168, 0.12);
			--gmt-error-border: rgba(243, 139, 168, 0.35);
			--gmt-error-text: #f38ba8;
			--gmt-error-hover: rgba(243, 139, 168, 0.22);
			
			--gmt-auto-bg: rgba(137, 180, 250, 0.12);
			--gmt-auto-border: rgba(137, 180, 250, 0.35);
			--gmt-auto-text: #89b4fa;
			--gmt-auto-hover: rgba(137, 180, 250, 0.22);

			--gmt-success-bg: rgba(166, 173, 188, 0.1);
			--gmt-success-border: rgba(166, 173, 188, 0.2);
			--gmt-success-text: #a6adc8;
			--gmt-success-hover: rgba(166, 173, 188, 0.15);
		}
		
		@media (prefers-color-scheme: dark) {
			body:not(.light-theme) {
				--gmt-pill-bg: rgba(166, 227, 161, 0.12);
				--gmt-pill-border: rgba(166, 227, 161, 0.35);
				--gmt-pill-text: #a6e3a1;
				--gmt-pill-hover: rgba(166, 227, 161, 0.22);
				
				--gmt-btn-bg: rgba(166, 227, 161, 0.15);
				--gmt-btn-border: rgba(166, 227, 161, 0.4);
				--gmt-btn-hover: rgba(166, 227, 161, 0.3);

				--gmt-error-bg: rgba(243, 139, 168, 0.12);
				--gmt-error-border: rgba(243, 139, 168, 0.35);
				--gmt-error-text: #f38ba8;
				--gmt-error-hover: rgba(243, 139, 168, 0.22);
				
				--gmt-auto-bg: rgba(137, 180, 250, 0.12);
				--gmt-auto-border: rgba(137, 180, 250, 0.35);
				--gmt-auto-text: #89b4fa;
				--gmt-auto-hover: rgba(137, 180, 250, 0.22);

				--gmt-success-bg: rgba(166, 173, 188, 0.1);
				--gmt-success-border: rgba(166, 173, 188, 0.2);
				--gmt-success-text: #a6adc8;
				--gmt-success-hover: rgba(166, 173, 188, 0.15);
			}
		}

		.gmt-tool-call-pill {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			background: var(--gmt-pill-bg);
			border: 1px solid var(--gmt-pill-border);
			color: var(--gmt-pill-text);
			border-radius: 6px;
			padding: 4px 10px;
			font-family: "Google Sans", sans-serif;
			font-size: 12px;
			font-weight: 500;
			cursor: pointer;
			user-select: none;
			margin: 4px 0;
			transition: background 0.15s, border-color 0.15s, color 0.15s;
		}
		.gmt-tool-call-pill:hover {
			background: var(--gmt-pill-hover);
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
			background: var(--gmt-btn-bg);
			border: 1px solid var(--gmt-btn-border);
			color: var(--gmt-pill-text);
			border-radius: 4px;
			padding: 2px 8px;
			font-size: 11px;
			cursor: pointer;
			font-family: "Google Sans", sans-serif;
			margin-left: 6px;
			transition: background 0.15s;
		}
		.gmt-run-btn:hover { background: var(--gmt-btn-hover); }
		.gmt-run-btn:disabled { opacity: 0.7; cursor: not-allowed; }

		.gmt-tool-call-pill.error {
			background: var(--gmt-error-bg);
			border-color: var(--gmt-error-border);
			color: var(--gmt-error-text);
		}
		.gmt-tool-call-pill.error:hover { background: var(--gmt-error-hover); }
		.gmt-tool-call-pill.error .gmt-run-btn { color: var(--gmt-error-text); border-color: var(--gmt-error-border); background: transparent; }
		
		.gmt-tool-call-pill.auto {
			background: var(--gmt-auto-bg);
			border-color: var(--gmt-auto-border);
			color: var(--gmt-auto-text);
		}
		.gmt-tool-call-pill.auto:hover { background: var(--gmt-auto-hover); }
		.gmt-tool-call-pill.auto .gmt-run-btn { color: var(--gmt-auto-text); border-color: var(--gmt-auto-border); background: transparent; }

		.gmt-tool-call-pill.success {
			background: var(--gmt-success-bg);
			border-color: var(--gmt-success-border);
			color: var(--gmt-success-text);
		}
		.gmt-tool-call-pill.success:hover { background: var(--gmt-success-hover); }
		.gmt-tool-call-pill.success .gmt-run-btn { color: var(--gmt-success-text); border-color: var(--gmt-success-border); background: transparent; }
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
			const wasSeenIncomplete = pre.dataset.wasSeenIncomplete === "true"

			const summary = toolCallSummary(parsed.tool, parsed.args)
			const wrapper = findCodeBlockWrapper(pre)

			ensureToolCallStyles()

			// Build pill
			const pill = document.createElement("span")
			pill.className = "gmt-tool-call-pill"
			if (parsed.run_automatically) {
				pill.classList.add("auto")
			}

			const arrow = document.createElement("span")
			arrow.className = "gmt-pill-arrow"
			arrow.textContent = "▶"
			pill.appendChild(arrow)

			const label = document.createElement("span")
			label.textContent = ` ⚡ ${summary}`
			pill.appendChild(label)

			const runBtn = document.createElement("button")
			runBtn.className = "gmt-run-btn"
			runBtn.title = "Execute this tool call"
			
			let hasRun = false;
			let isRunning = false;
			let hasErrored = false;
			
			const updateBtnState = () => {
				if (isRunning) {
					runBtn.textContent = "Running…"
					runBtn.disabled = true
				} else if (hasErrored) {
					runBtn.textContent = "Retry"
					runBtn.disabled = false
				} else if (hasRun) {
					runBtn.textContent = "Run Again"
					runBtn.disabled = false
				} else {
					runBtn.textContent = parsed.run_automatically ? "Auto-Run" : "Run"
					runBtn.disabled = false
				}
			}
			updateBtnState();
			
			const triggerExecution = () => {
				if (isRunning) return;
				isRunning = true;
				hasErrored = false;
				updateBtnState();
				
				window.executeToolCall(parsed.tool, parsed.args)
					.then(() => {
						isRunning = false;
						hasRun = true;
						updateBtnState();
						pill.className = "gmt-tool-call-pill success"
					})
					.catch(() => {
						isRunning = false;
						hasErrored = true;
						updateBtnState();
						pill.className = "gmt-tool-call-pill error"
					});
			}

			runBtn.onclick = (e) => {
				e.stopPropagation()
				triggerExecution()
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

			// Only auto-execute if we explicitly witnessed the AI streaming this block (failed to parse previously)
			// This prevents historical messages from auto-executing when the page is refreshed or history is loaded.
			if (!isInitialScan && parsed.run_automatically === true && wasSeenIncomplete) {
				triggerExecution()
			}

		} catch (e) {
			// Not valid JSON or still streaming — skip
			// Flag it so we know it was actively streaming when it finally succeeds
			pre.dataset.wasSeenIncomplete = "true"
		}
	})
	// Mark initial scan done after first pass
	if (isInitialScan) {
		document.body.dataset.gmtInitialScanDone = "true"
	}
}
