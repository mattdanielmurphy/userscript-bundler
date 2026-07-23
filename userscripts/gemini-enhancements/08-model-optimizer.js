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
