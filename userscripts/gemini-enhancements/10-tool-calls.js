// ═══════════════════════════════════════════════════════════
// TOOL CALL EXECUTION & PARSING
// ═══════════════════════════════════════════════════════════

window.executeToolCall = function(tool, args) {
	if (tool === "save_note") {
		const title = args.title || "Untitled Note"
		const content = args.content || ""
		
		const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim()
		const dirPath = "/Users/matt/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal/Development/Project Notes"
		const filePath = \`\${dirPath}/\${safeTitle}.md\`

		// Base64 encode the content to avoid quoting/escaping issues in bash
		const base64Content = btoa(unescape(encodeURIComponent(content)))

		// Create the bash command
		const cmd = \`echo "\${base64Content}" | base64 --decode > "\${filePath}"\`

		const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""

		if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) {
			gm.xmlHttpRequest({
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
							showToolNotification(\`Note Saved: \${safeTitle}\`, filePath)
						} else {
							showToolNotification(\`Error saving note: \${safeTitle}\`, null, true)
						}
					} catch (e) {
						showToolNotification(\`Error saving note: \${safeTitle}\`, null, true)
					}
				},
				onerror: () => {
					showToolNotification(\`Connection error saving note\`, null, true)
				}
			})
		} else if (typeof GM_xmlhttpRequest !== "undefined") {
			// fallback for standard userscript managers
            GM_xmlhttpRequest({
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
							showToolNotification(\`Note Saved: \${safeTitle}\`, filePath)
						} else {
							showToolNotification(\`Error saving note: \${safeTitle}\`, null, true)
						}
					} catch (e) {
						showToolNotification(\`Error saving note: \${safeTitle}\`, null, true)
					}
				},
				onerror: () => {
					showToolNotification(\`Connection error saving note\`, null, true)
				}
			})
        }
	}
}

function showToolNotification(message, filePath = null, isError = false) {
	const notif = document.createElement("div")
	notif.style.cssText = \`
		position: fixed;
		bottom: 24px;
		right: 24px;
		background: \${isError ? '#f38ba8' : '#a6e3a1'};
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
	\`

	// Add keyframes if not exists
	if (!document.getElementById("gmt-notif-styles")) {
		const style = document.createElement("style")
		style.id = "gmt-notif-styles"
		style.textContent = \`
			@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
			@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
		\`
		document.head.appendChild(style)
	}

	const textEl = document.createElement("div")
	textEl.textContent = message
	notif.appendChild(textEl)

	if (filePath && !isError) {
		const openBtn = document.createElement("button")
		openBtn.textContent = "Open"
		openBtn.style.cssText = "background: rgba(0,0,0,0.1); border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit;"
		openBtn.onclick = () => {
			const cmd = \`open "\${filePath}"\`
			const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
			
            const reqData = {
				method: "POST",
				url: "http://127.0.0.1:3033/run-command",
				headers: {
					"Content-Type": "application/json",
					"x-gemini-thread-saver-key": secret,
				},
				data: JSON.stringify({ command: cmd })
			}
            
            if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) {
                gm.xmlHttpRequest(reqData)
            } else if (typeof GM_xmlhttpRequest !== "undefined") {
                GM_xmlhttpRequest(reqData)
            }
		}
		notif.appendChild(openBtn)

		const undoBtn = document.createElement("button")
		undoBtn.textContent = "Undo"
		undoBtn.style.cssText = "background: rgba(0,0,0,0.1); border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; color: inherit;"
		undoBtn.onclick = () => {
			const cmd = \`rm "\${filePath}"\`
			const secret = typeof gm !== "undefined" ? gm.getValue("gmt_archive_secret") : ""
			
            const reqData = {
				method: "POST",
				url: "http://127.0.0.1:3033/run-command",
				headers: {
					"Content-Type": "application/json",
					"x-gemini-thread-saver-key": secret,
				},
				data: JSON.stringify({ command: cmd }),
				onload: () => {
					textEl.textContent = "Note deleted."
					openBtn.remove()
					undoBtn.remove()
				}
			}
            
            if (typeof gm !== "undefined" && gm.isXmlHttpRequestSupported) {
                gm.xmlHttpRequest(reqData)
            } else if (typeof GM_xmlhttpRequest !== "undefined") {
                GM_xmlhttpRequest(reqData)
            }
		}
		notif.appendChild(undoBtn)
	}

	const closeBtn = document.createElement("div")
	closeBtn.innerHTML = "&times;"
	closeBtn.style.cssText = "cursor: pointer; font-size: 18px; font-weight: bold; opacity: 0.6;"
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
	}, 8000)
}

window.scanToolCalls = function() {
	const preElements = document.querySelectorAll("model-response pre, pre")

	preElements.forEach((pre) => {
		if (pre.dataset.toolCallProcessed) return

		let headerText = ""
		let container = pre.parentElement
		for (let i = 0; i < 5; i++) {
			if (!container || container.tagName === "BODY") break
			
			const copyBtn = container.querySelector(
				'button[aria-label*="Copy" i], button[aria-label*="copy" i], button[data-tooltip*="Copy" i], button.copy-button'
			)
			if (copyBtn) {
				headerText = container.innerText.toLowerCase()
				break
			}
			container = container.parentElement
		}

		let isToolCall = false
		if (headerText.includes("tool_call") || headerText.includes("json")) {
			isToolCall = true
		} else {
			const codeClass = (pre.querySelector("code") || pre).className || ""
			if (codeClass.toLowerCase().includes("tool_call") || codeClass.toLowerCase().includes("json")) {
				isToolCall = true
			}
		}

		if (!isToolCall) return

		const code = (pre.querySelector("code") || pre).innerText

		try {
			// Check if it's our schema
			const parsed = JSON.parse(code)
			if (parsed && parsed.tool && parsed.args) {
				pre.dataset.toolCallProcessed = "true"
				
				// Optional: Dim the tool call block so it doesn't distract the user
				pre.style.opacity = "0.5"
				const badge = document.createElement("div")
				badge.textContent = "⚡ Tool Call Executed"
				badge.style.cssText = "background: rgba(166, 227, 161, 0.2); color: #a6e3a1; font-size: 11px; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 4px;"
				pre.parentNode.insertBefore(badge, pre)

				window.executeToolCall(parsed.tool, parsed.args)
			}
		} catch (e) {
			// Not a valid JSON or not fully streamed yet
		}
	})
}
