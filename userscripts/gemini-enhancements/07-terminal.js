// ═══════════════════════════════════════════════════════════
// LOCAL TERMINAL EXECUTION & INLINE OUTPUT
// ═══════════════════════════════════════════════════════════

// Scan for and Inject "Execute Locally" buttons next to Phase 3 blocks
function scanExecutionPayloads() {
	// The former “Execute Locally” button POSTed to the retired localhost API.
	// It is intentionally disabled in this backend-free version.
}

function injectRunButtons() {
	const preElements = document.querySelectorAll("model-response pre, pre")

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
			const secret = gm.getValue("gmt_archive_secret")
			if (!secret) {
				alert("Please set your gmt_archive_secret first via the userscript settings menu.")
				return
			}

			if (window.gmtPolicy) {
				runBtn.innerHTML = window.gmtPolicy.createHTML(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`)
			} else {
				runBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`
			}

			if (!gm.isXmlHttpRequestSupported) {
				alert("Run command is disabled: this userscript manager does not support cross-origin HTTP requests (GM.xmlHttpRequest).");
				return;
			}

			gm.xmlHttpRequest({
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
								terminalManager.startInline(pre, data.session, code)
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

window.gmtContexts = window.gmtContexts || {}

const terminalManager = {
	pollers: {},
	contexts: window.gmtContexts,


	startInline(pre, session, command) {
		if (!this.contexts[session]) {
			this.contexts[session] = { active: true, output: "", command: command }
		} else {
			this.contexts[session].command = command
		}
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
			"display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; color: #89b4fa; font-weight: bold;"
		
		const titleSpan = document.createElement("span")
		titleSpan.innerText = `Terminal Output (tmux: ${session})`
		header.appendChild(titleSpan)
		
		const attachBtn = document.createElement("button")
		attachBtn.innerText = "+ Context"
		attachBtn.style.cssText = "background: rgba(137, 180, 250, 0.15); border: 1px solid rgba(137, 180, 250, 0.3); color: #89b4fa; border-radius: 4px; padding: 2px 8px; font-size: 10px; cursor: pointer;"
		attachBtn.onclick = () => {
			if (this.contexts[session]) {
				this.contexts[session].active = true
				this.renderContextPills()
			}
		}
		header.appendChild(attachBtn)

		const outputEl = document.createElement("pre")
		outputEl.style.cssText =
			"margin: 0; white-space: pre-wrap; word-wrap: break-word;"
		outputEl.innerText = "Loading..."
		outputEl.style.whiteSpace = "pre-wrap"

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
			setTimeout(() => this.poll(session, outputEl), 100)
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
		if (gm.isXmlHttpRequestSupported) {
			gm.xmlHttpRequest({
				method: "GET",
				url: `http://127.0.0.1:3033/session-output?session=${session}`,
				onload: (res) => {
					try {
						const data = JSON.parse(res.responseText)
						if (data.ok && typeof data.output === "string") {
							outputEl.innerText = data.output.trimEnd()
							outputEl.scrollTop = outputEl.scrollHeight
							this.updateContextPill(session, data.output.trimEnd())
						}
					} catch (e) {}
				},
			})
		}
	},

	sendInput(session, text) {
		if (gm.isXmlHttpRequestSupported) {
			gm.xmlHttpRequest({
				method: "POST",
				url: "http://127.0.0.1:3033/send-input",
				headers: {
					"Content-Type": "application/json",
					"x-gemini-thread-saver-key": gm.getValue("gmt_archive_secret", ""),
				},
				data: JSON.stringify({ session: session, text: text }),
			})
		}
	},

	updateContextPill(session, output) {
		if (!this.contexts[session]) {
			this.contexts[session] = { active: true, output: output, command: session }
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
			if (ctx.isKeyword) {
				pill.style.cssText = `
					background: rgba(166, 227, 161, 0.15);
					border: 1px solid rgba(166, 227, 161, 0.3);
					color: #a6e3a1;
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
			} else {
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
			}

			const textNode = document.createElement("span")
			if (ctx.isKeyword) {
				textNode.innerText = `Context: ${ctx.title}`
			} else {
				let shortCmd = ctx.command || session
				if (shortCmd.includes("\n")) shortCmd = shortCmd.split("\n")[0]
				shortCmd = shortCmd.trim()
				if (shortCmd.length > 25) shortCmd = shortCmd.substring(0, 25) + "..."
				textNode.innerText = `Terminal: "${shortCmd}"`
			}
			pill.appendChild(textNode)

			const removeBtn = document.createElement("span")
			removeBtn.textContent = "\u00D7"
			removeBtn.style.cssText =
				"font-size: 14px; font-weight: bold; opacity: 0.7; cursor: pointer;"
			removeBtn.onclick = (e) => {
				e.stopPropagation()
				ctx.active = false
				ctx.userDismissed = true
				if (window.gmtTooltipHideTimeout) {
					clearTimeout(window.gmtTooltipHideTimeout)
					window.gmtTooltipHideTimeout = null
				}
				const tooltip = document.getElementById("gmt-context-tooltip")
				if (tooltip) tooltip.remove()
				this.renderContextPills()
			}
			pill.appendChild(removeBtn)

			// Hover tooltip
			pill.onmouseenter = (e) => {
				if (window.gmtTooltipHideTimeout) {
					clearTimeout(window.gmtTooltipHideTimeout)
					window.gmtTooltipHideTimeout = null
				}
				
				let tooltip = document.getElementById("gmt-context-tooltip")
				if (!tooltip) {
					tooltip = document.createElement("div")
					tooltip.id = "gmt-context-tooltip"
					tooltip.style.cssText = `
						position: fixed;
						background: #1e1e2e;
						border: 1px solid rgba(255,255,255,0.1);
						border-radius: 8px;
						padding: 8px;
						color: #cdd6f4;
						font-family: monospace;
						font-size: 11px;
						max-width: 500px;
						max-height: 300px;
						overflow-y: auto;
						white-space: pre-wrap;
						box-shadow: 0 4px 12px rgba(0,0,0,0.5);
						z-index: 2147483647;
						pointer-events: auto;
					`
					document.body.appendChild(tooltip)
					
					tooltip.onmouseenter = () => {
						if (window.gmtTooltipHideTimeout) {
							clearTimeout(window.gmtTooltipHideTimeout)
							window.gmtTooltipHideTimeout = null
						}
					}
					tooltip.onmouseleave = () => {
						window.gmtTooltipHideTimeout = setTimeout(() => {
							tooltip.remove()
						}, 350)
					}
				}
				
				const rect = pill.getBoundingClientRect()
				tooltip.style.left = Math.max(10, rect.left) + "px"
				tooltip.style.bottom = (window.innerHeight - rect.top + 8) + "px"

				// Show the last 2000 chars roughly
				const snippet =
					ctx.output.length > 2000 ?
						"..." + ctx.output.slice(-2000)
					:	ctx.output
				tooltip.innerText = snippet
				tooltip.onclick = (e) => e.stopPropagation()
			}
			pill.onmouseleave = (e) => {
				const tooltip = document.getElementById("gmt-context-tooltip")
				if (tooltip) {
					window.gmtTooltipHideTimeout = setTimeout(() => {
						tooltip.remove()
					}, 350)
				}
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
						const label = ctx.title || session
						allContext += `\n\n[Attached Context: ${label}]\n\`\`\`text\n${ctx.output}\n\`\`\`\n`
						ctx.active = false
						ctx.userDismissed = false
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
