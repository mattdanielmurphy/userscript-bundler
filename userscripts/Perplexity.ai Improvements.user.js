// ==UserScript==
// @name         Perplexity.ai Improvements
// @version      0.1
// @description  Various improvements to Perplexity.ai
// @author       You
// @icon         https://www.google.com/s2/favicons?sz=64&domain=perplexity.ai
// @namespace    http://tampermonkey.net/
// @match        https://www.perplexity.ai/*
// @grant unsafeWindow
// @run-at       document-start
// ==/UserScript==

// IMPROVEMENTS
//     1. Text Selection Follow-Up Tooltip to follow-up with selected text, optionally with a question
//     2. Code Box Copy button at the bottom of code
//     3. Change Thread Dropdown Menu Buttons to Delete Buttons
//     4. Remove sidebar and set main content to full-width
//     5. Remove Perplexity for Mac Ad
//     6. Autofocus when input changes to body (when new thread is created)

//// THE FOLLOWING IS TEMPORARILY DISABLED BECAUSE PERPLEXITY IN SAFARI WILL CRASH OTHERWISE
// //!		 1. Text Selection Follow-Up Tooltip
// ;(() => {
// 	// Create tooltip element
// 	const tooltip = document.createElement("div")
// 	tooltip.id = "selection-tooltip"
// 	tooltip.style.cssText = `
//       position: absolute;
//       background: var(--tooltip-bg);
//       color: var(--text-main);
//       padding: 8px;
//       border-radius: 8px;
//       font-size: 14px;
//       display: none;
//       z-index: 9999;
//       box-shadow: 0 2px 10px rgba(0,0,0,0.1);
//       border: 1px solid var(--border-main);
//     `
// 	document.body.appendChild(tooltip)

// 	// Create button function
// 	const createButton = (text, onClick) => {
// 		const button = document.createElement("button")
// 		button.textContent = text
// 		button.className = "font-sans"
// 		button.style.cssText = `
//         background: var(--bg-main);
//         border: 1px solid var(--border-main);
//         color: var(--text-main);
//         padding: 6px 10px;
//         margin: 2px;
//         cursor: pointer;
//         border-radius: 6px;
//         font-size: 14px;
//         transition: background 0.3s;
//       `
// 		button.onmouseover = () => (button.style.background = "var(--bg-hover)")
// 		button.onmouseout = () => (button.style.background = "var(--bg-main)")
// 		button.onclick = onClick
// 		return button
// 	}

// 	// Handle action function
// 	const handleAction = (withQuestion = false) => {
// 		const selectedText = window.getSelection().toString()
// 		const textarea = document.querySelector('textarea[placeholder="Ask follow-up"]')
// 		if (textarea) {
// 			textarea.focus()
// 			const textToInsert = `You said: "${selectedText}"${withQuestion ? "; " : ""}`
// 			document.execCommand("insertText", false, textToInsert)
// 			textarea.dispatchEvent(new Event("input", { bubbles: true }))
// 			if (!withQuestion) {
// 				setTimeout(() => {
// 					const submitButton = document.querySelector('button[aria-label="Submit"]')
// 					if (submitButton && !submitButton.disabled) {
// 						submitButton.click()
// 					}
// 				}, 100)
// 			}
// 		}
// 		tooltip.style.display = "none"
// 	}

// 	// Add buttons to tooltip
// 	tooltip.appendChild(createButton("Follow-up", () => handleAction(false)))
// 	tooltip.appendChild(createButton("With question", () => handleAction(true)))

// 	// Handle selection function
// 	function handleSelection() {
// 		const selection = window.getSelection()
// 		const answerDivs = document.querySelectorAll(".prose")
// 		if (selection.toString() && Array.from(answerDivs).some((div) => div.contains(selection.anchorNode) || div.contains(selection.focusNode))) {
// 			const range = selection.getRangeAt(0).getBoundingClientRect()
// 			const scrollX = window.scrollX || window.pageXOffset
// 			const scrollY = window.scrollY || window.pageYOffset
// 			tooltip.style.left = `${range.left + scrollX}px`
// 			tooltip.style.top = `${range.bottom + scrollY}px`
// 			tooltip.style.display = "block"
// 		} else {
// 			tooltip.style.display = "none"
// 		}
// 	}

// 	// Add event listener
// 	document.addEventListener("mouseup", handleSelection)

// 	// Add styles
// 	const style = document.createElement("style")
// 	style.textContent = `
//       :root {
//         --tooltip-bg: #FCFCF9;
//       }
//       @media (prefers-color-scheme: dark) {
//         :root {
//           --tooltip-bg: #202222;
//         }
//       }
//     `
// 	document.head.appendChild(style)
// })()

// //!		 2. Code Box Copy button at the bottom of code
// ;(() => {
// 	const style = document.createElement("style")
// 	style.textContent = `
//         .codeWrapper > div:nth-of-type(2) button {
//             top: unset !important;
//             bottom: .5em !important;
//         }
//     `
// 	document.head.appendChild(style)

// 	console.log("[Perplexity Improvements - Code Box] Style added successfully")
// })()

// //!		 3. Change Thread Dropdown Menu Buttons to Delete Buttons
// ;(function () {
// 	let dropdownClicked = false
// 	let deleteButtonClicked = false
// 	let confirmButtonClicked = false
// 	const processedDropdowns = new Set() // Track dropdowns that already have listeners attached

// 	// Clear previous intervals and observers
// 	function clearAllIntervals() {
// 		if (window._deleteButtonInterval) {
// 			clearInterval(window._deleteButtonInterval)
// 			window._deleteButtonInterval = null
// 		}
// 		if (window._confirmDialogInterval) {
// 			clearInterval(window._confirmDialogInterval)
// 			window._confirmDialogInterval = null
// 		}
// 		if (window._dropdownOpacityInterval) {
// 			clearInterval(window._dropdownOpacityInterval)
// 			window._dropdownOpacityInterval = null
// 		}
// 		if (window._confirmDialogOpacityInterval) {
// 			clearInterval(window._confirmDialogOpacityInterval)
// 			window._confirmDialogOpacityInterval = null
// 		}
// 	}

// 	// Function to stop all functionality
// 	function stopScript() {
// 		clearAllIntervals() // Stop all ongoing intervals
// 		mutationObserver.disconnect() // Disconnect the mutation observer
// 		console.log("[Perplexity Improvements - Delete Buttons] Script stopped: URL is no longer /library")
// 	}

// 	// Function to start the script
// 	function startScript() {
// 		console.log("[Perplexity Improvements - Delete Buttons] Script started: /library detected.")
// 		// Replace ellipsis with delete icon
// 		replaceEllipsisWithDeleteIcon()
// 		// Attach event listeners to dropdown buttons
// 		attachEventListeners()
// 		// Start monitoring URL changes for navigating away
// 		monitorUrlChange()
// 		// Start observing DOM for new dropdown menus being added
// 		mutationObserver.observe(document.body, { childList: true, subtree: true })
// 	}

// 	// Detect URL changes and stop the script if not on the /library page
// 	function monitorUrlChange() {
// 		let currentUrl = window.location.pathname
// 		setInterval(() => {
// 			if (window.location.pathname !== currentUrl) {
// 				currentUrl = window.location.pathname
// 				if (!currentUrl.includes("/library")) {
// 					stopScript() // Stop the script if the URL is no longer /library
// 				} else {
// 					startScript() // Restart the script when back to /library
// 				}
// 			}
// 		}, 500) // Check every 500ms for URL changes
// 	}

// 	// Replace ellipsis with the delete icon
// 	function replaceEllipsisWithDeleteIcon() {
// 		const dropdowns = document.querySelectorAll('button[data-testid="thread-dropdown-menu"]')
// 		dropdowns.forEach((dropdown) => {
// 			if (!processedDropdowns.has(dropdown)) {
// 				const ellipsisIcon = dropdown.querySelector('div > svg[data-icon="ellipsis"]')
// 				if (ellipsisIcon) {
// 					const deleteIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
// 					deleteIcon.setAttribute("aria-hidden", "true")
// 					deleteIcon.setAttribute("focusable", "false")
// 					deleteIcon.setAttribute("data-prefix", "far")
// 					deleteIcon.setAttribute("data-icon", "trash")
// 					deleteIcon.setAttribute("class", "svg-inline--fa fa-trash fa-fw")
// 					deleteIcon.setAttribute("role", "img")
// 					deleteIcon.setAttribute("viewBox", "0 0 448 512")

// 					const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
// 					path.setAttribute("fill", "currentColor")
// 					path.setAttribute(
// 						"d",
// 						"M177.1 48h93.7c2.7 0 5.2 1.3 6.7 3.6l19 28.4h-145l19-28.4c1.5-2.2 4-3.6 6.7-3.6zM354.2 80L317.5 24.9C307.1 9.4 289.6 0 270.9 0H177.1c-18.7 0-36.2 9.4-46.6 24.9L93.8 80H80.1 32 24C10.7 80 0 90.7 0 104s10.7 24 24 24H35.6L59.6 452.7c2.5 33.4 30.3 59.3 63.8 59.3H324.6c33.5 0 61.3-25.9 63.8-59.3L412.4 128H424c13.3 0 24-10.7 24-24s-10.7-24-24-24h-8H367.9 354.2zm10.1 48L340.5 449.2c-.6 8.4-7.6 14.8-16 14.8H123.4c-8.4 0-15.3-6.5-16-14.8L83.7 128H364.3z",
// 					)

// 					deleteIcon.appendChild(path)
// 					ellipsisIcon.parentNode.replaceChild(deleteIcon, ellipsisIcon)
// 					processedDropdowns.add(dropdown) // Mark as processed
// 				}
// 			}
// 		})
// 	}

// 	// Add event listeners to dropdown buttons
// 	function attachEventListeners() {
// 		document.querySelectorAll('button[data-testid="thread-dropdown-menu"]:not([data-listener="added"])').forEach((dropdownMenu) => {
// 			dropdownMenu.addEventListener("click", () => {
// 				if (dropdownClicked) return // Prevent multiple clicks on the same dropdown
// 				dropdownClicked = true
// 				clearAllIntervals() // Clear any previous intervals before starting the process

// 				console.log("[Perplexity Improvements - Delete Buttons] Dropdown menu clicked.")

// 				// Start looking for the delete button
// 				setTimeout(checkDeleteButton, 50) // Reduced initial delay to 50ms

// 				// Mark the dropdown as having had a listener added
// 				dropdownMenu.setAttribute("data-listener", "added")

// 				// Start hiding dropdown and confirm dialog elements
// 				startHidingElements()
// 			})
// 		})
// 	}

// 	// Observe DOM mutations for adding new dropdowns dynamically
// 	const mutationObserver = new MutationObserver(() => {
// 		// Only handle mutations that are adding new dropdown menus
// 		if (dropdownClicked) return // Ignore mutations that happen during ongoing thread deletion

// 		console.log("[Perplexity Improvements - Delete Buttons] Mutation detected: Checking for new dropdowns...")
// 		replaceEllipsisWithDeleteIcon() // Check for new dropdowns added to the page
// 		attachEventListeners() // Add listeners to new dropdowns
// 	})

// 	// Function to check for the delete button
// 	function checkDeleteButton() {
// 		if (deleteButtonClicked) return // Prevent multiple clicks on the delete button

// 		window._deleteButtonInterval = setInterval(() => {
// 			const deleteButton = document.querySelector('div[data-testid="thread-delete"]')
// 			if (deleteButton) {
// 				const child = deleteButton.querySelector("*")
// 				if (child) {
// 					child.click()
// 					deleteButtonClicked = true
// 					console.log("[Perplexity Improvements - Delete Buttons] Delete button clicked.")
// 					clearInterval(window._deleteButtonInterval) // Stop checking for the delete button

// 					// Wait 50ms before checking for the confirmation dialog
// 					setTimeout(checkConfirmationDialog, 50) // Reduced delay to 50ms
// 				}
// 			}
// 		}, 50) // Reduced interval to 50ms for checking delete button
// 	}

// 	// Function to check for the confirmation dialog
// 	function checkConfirmationDialog() {
// 		if (confirmButtonClicked) return // Prevent multiple clicks on the confirm button

// 		window._confirmDialogInterval = setInterval(() => {
// 			const confirmButton = Array.from(document.querySelectorAll("div")).find((div) => div.textContent.trim() === "Confirm")

// 			if (confirmButton) {
// 				confirmButton.click()
// 				confirmButtonClicked = true
// 				console.log("[Perplexity Improvements - Delete Buttons] Confirm button clicked.")
// 				clearInterval(window._confirmDialogInterval) // Stop checking for the confirm dialog

// 				// Reset the flags for the next dropdown click
// 				resetFlags()
// 			}
// 		}, 150) // Reduced interval to 150ms for checking the confirm button
// 	}

// 	// Reset flags after completing a thread deletion process
// 	function resetFlags() {
// 		dropdownClicked = false
// 		deleteButtonClicked = false
// 		confirmButtonClicked = false
// 	}

// 	// Start the process of hiding elements after dropdown click
// 	function startHidingElements() {
// 		window._dropdownOpacityInterval = setInterval(() => {
// 			const deleteButton = document.querySelector('div[data-testid="thread-delete"]')
// 			if (deleteButton) {
// 				const dropdownMenuParent = deleteButton.parentElement.parentElement.parentElement
// 				if (dropdownMenuParent && dropdownMenuParent.style.opacity !== "0") {
// 					dropdownMenuParent.style.opacity = "0"
// 					console.log("[Perplexity Improvements - Delete Buttons] Dropdown menu hidden.")
// 				}
// 			}

// 			const confirmButton = Array.from(document.querySelectorAll("div")).find((div) => div.textContent.trim() === "Confirm")
// 			if (confirmButton) {
// 				const confirmDialogParent = confirmButton.closest("div")
// 				if (confirmDialogParent && confirmDialogParent.style.opacity !== "0") {
// 					confirmDialogParent.style.opacity = "0"
// 					console.log("[Perplexity Improvements - Delete Buttons] Confirm dialog hidden.")
// 				}
// 			}
// 		}, 1) // Use 1ms interval to hide elements immediately
// 	}

// 	// Initially check if we're on /library
// 	if (window.location.pathname.includes("/library")) {
// 		startScript() // Start the script if we're on the /library page
// 	} else {
// 		monitorUrlChange() // Otherwise, monitor URL changes
// 	}

// 	//!     4. Remove Annoyances

// 	// Function to modify and remove elements
// 	function removeAnnoyances() {
// 		console.log("[Perplexity Improvements - Annoyances] DOM updated; Removing annoyances...")
// 		// removeSidebar() //? sidebar should be removed by separate script that does google searches
// 		removePerplexityMacPromo()
// 		removeFreePlanNotice()
// 	}

// 	// Create a MutationObserver to watch for DOM mutations
// 	const observer = new MutationObserver(removeAnnoyances)

// 	// Start observing the document for child changes (additions/removals)
// 	observer.observe(document.body, {
// 		childList: true,
// 		subtree: true,
// 	})

// 	// Run the function once initially to cover any existing elements
// 	removeAnnoyances()

// 	function removeSidebar() {
// 		// Change class of div.col-span-8 to col-span-12
// 		document.querySelectorAll("div.col-span-8").forEach((el) => {
// 			el.classList.remove("col-span-8")
// 			el.classList.add("col-span-12")
// 			el.style.maxWidth = "42rem"
// 		})

// 		// Remove any div.col-span-4.isolate elements
// 		document.querySelectorAll("div.col-span-4.isolate").forEach((el) => {
// 			el.remove()
// 		})
// 	}

// 	function removePerplexityMacPromo() {
// 		const element = document.querySelector("img[alt*='Perplexity for Mac']")
// 		if (element && element.parentElement) {
// 			element.parentElement.remove()
// 		}
// 	}

// 	function removeFreePlanNotice() {
// 		const upgradeButton = Array.from(document.querySelectorAll("button")).find((button) => button.innerText.includes("Upgrade"))
// 		if (upgradeButton?.parentElement) {
// 			upgradeButton.parentElement.remove()
// 		}
// 	}
// 	// find div.grid with 4 divs inside it
// 	const grid = document.querySelector("div.grid")
// 	if (grid && grid.children.length === 4) {
// 		grid.remove()
// 	}
// })()

// //!		 6. Autofocus when input changes to body (when new thread is created)
// ;(() => {
// 	const style = document.createElement("style")
// 	style.textContent = `
// 		#debug-console {
// 			position: fixed;
// 			top: 20px;
// 			right: 20px;
// 			z-index: 99999;
// 			padding: 12px 20px;
// 			background: rgba(0, 0, 0, 0.85);
// 			color: #fff;
// 			border-radius: 8px;
// 			font-family: monospace;
// 			font-size: 13px;
// 			box-shadow: 0 4px 15px rgba(0,0,0,0.3);
// 			pointer-events: none;
// 			transition: opacity 0.3s ease;
// 			opacity: 0;
// 			max-width: 400px;
// 			white-space: pre-wrap;
// 		}
// 	`
// 	document.head.appendChild(style)

// 	function flashLog(message) {
// 		let consoleEl = document.querySelector("#debug-console")
// 		if (!consoleEl) {
// 			consoleEl = document.createElement("div")
// 			consoleEl.id = "debug-console"
// 			document.body.appendChild(consoleEl)
// 		}

// 		const text = typeof message === "object" ? JSON.stringify(message, null, 2) : String(message)
// 		consoleEl.innerText = text
// 		consoleEl.style.opacity = "1"

// 		if (window._flashLogTimeout) clearTimeout(window._flashLogTimeout)
// 		window._flashLogTimeout = setTimeout(() => {
// 			consoleEl.style.opacity = "0"
// 		}, 1500)
// 	}

// 	let focusSearchInterval = null
// 	function startFocusSearch() {
// 		if (focusSearchInterval) clearInterval(focusSearchInterval)
// 		let attempts = 0
// 		focusSearchInterval = setInterval(() => {
// 			const input = document.querySelector("#ask-input")
// 			if (input) {
// 				input.focus()
// 				if (document.activeElement === input) {
// 					clearInterval(focusSearchInterval)
// 					focusSearchInterval = null
// 					flashLog("Focused input")
// 				}
// 			}
// 			if (++attempts > 30) {
// 				clearInterval(focusSearchInterval)
// 				focusSearchInterval = null
// 			}
// 		}, 100)
// 	}

// 	document.addEventListener("keydown", (e) => {
// 		if (e.key === "k" && e.metaKey) {
// 			// Wait for 200ms before starting search to allow Perplexity to handle the keypress/navigation
// 			setTimeout(startFocusSearch, 200)
// 		}
// 	})
// })()

//!    7. Text Selection Popup: Search with Google
;(() => {
	// =============================================================================
	// DEBUG: Check execution context FIRST
	// =============================================================================
	console.log(`[Perplexity Debug] Script running in: ${window.location.href}`)
	console.log(`[Perplexity Debug] Is iframe? ${window.self !== window.top}`)

	// Skip if we're inside an iframe (like GTM)
	if (window.self !== window.top) {
		console.log("[Perplexity] Skipping - inside iframe")
		return
	}

	const PREFIX = "[Perplexity - Google Search Button]"
	console.log(`${PREFIX} Initializing in main window...`)

	// =============================================================================
	// CORE FUNCTION: Add Google Search Button
	// =============================================================================
	function addGoogleSearchButton(triggerType) {
		triggerType = triggerType || "interval"
		const buttons = document.querySelectorAll("button")
		const verbose = triggerType !== "interval"

		if (verbose) {
			console.log(`${PREFIX} Scan triggered by: ${triggerType}`)
			console.log(`${PREFIX} Found ${buttons.length} buttons`)
			console.log(`${PREFIX} Current selection: "${window.getSelection().toString().slice(0, 50)}"`)
		}

		for (let i = 0; i < buttons.length; i++) {
			const button = buttons[i]

			// Look for the "Check sources" button
			if (button.textContent && button.textContent.includes("Check sources")) {
				const container = button.parentElement
				if (!container) continue

				// Don't add duplicate buttons
				if (container.querySelector(".google-search-btn")) {
					if (verbose) console.log(`${PREFIX} Google button already exists`)
					continue
				}

				console.log(`${PREFIX} ✅ FOUND "Check sources" button! Adding Google Search...`)

				// Clone the button and modify it
				const googleButton = button.cloneNode(true)
				googleButton.classList.add("google-search-btn")

				// Adjust styling to make it part of a button group
				button.classList.remove("rounded-r-lg", "dark:rounded-r-lg")
				button.classList.add("rounded-r-none")

				// Update button text
				const textNode = googleButton.querySelector(".truncate")
				if (textNode) {
					textNode.textContent = "Search with Google"
				} else {
					googleButton.textContent = "Search with Google"
				}

				// Add click handler
				googleButton.addEventListener("click", function (e) {
					e.stopPropagation()
					e.preventDefault()
					const selection = window.getSelection().toString().trim()
					if (selection) {
						console.log(`${PREFIX} Opening Google search for: "${selection}"`)
						window.open("https://www.google.com/search?q=" + encodeURIComponent(selection), "_blank")
					} else {
						console.log(`${PREFIX} No text selected`)
					}
				})

				// Add to DOM
				container.appendChild(googleButton)
				console.log(`${PREFIX} ✅ Google Search button added successfully!`)
			}
		}
	}

	// =============================================================================
	// EVENT LISTENERS & OBSERVERS
	// =============================================================================
	function setupListeners() {
		console.log(`${PREFIX} Setting up event listeners...`)
		console.log(`${PREFIX} - document.readyState: ${document.readyState}`)
		console.log(`${PREFIX} - document.body: ${document.body ? "exists" : "null"}`)

		if (!document.body) {
			console.warn(`${PREFIX} document.body not ready yet, retrying in 100ms...`)
			setTimeout(setupListeners, 100)
			return
		}

		// Listen for text selection events (capture phase)
		document.addEventListener(
			"mouseup",
			function (e) {
				console.log(`${PREFIX} mouseup event - target: ${e.target.tagName}`)
				setTimeout(() => addGoogleSearchButton("mouseup"), 200)
			},
			true,
		)

		document.addEventListener(
			"keyup",
			function (e) {
				setTimeout(() => addGoogleSearchButton("keyup"), 200)
			},
			true,
		)

		console.log(`${PREFIX} ✅ Event listeners attached`)

		// MutationObserver for dynamically added elements
		const observer = new MutationObserver(function (mutations) {
			for (let mutation of mutations) {
				for (let node of mutation.addedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE && node.textContent && node.textContent.includes("Check sources")) {
						console.log(`${PREFIX} MutationObserver detected "Check sources" button`)
						setTimeout(() => addGoogleSearchButton("mutation"), 100)
						return
					}
				}
			}
		})

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		})
		console.log(`${PREFIX} ✅ MutationObserver active`)

		// Backup polling (runs every 2 seconds as fallback)
		setInterval(() => addGoogleSearchButton("interval"), 2000)
		console.log(`${PREFIX} ✅ Polling interval started`)

		// Self-test: trigger a scan immediately
		console.log(`${PREFIX} Running initial scan...`)
		addGoogleSearchButton("initial")

		// Expose test function globally
		window._testGoogleSearch = function () {
			console.log(`${PREFIX} 🧪 Manual test triggered!`)
			addGoogleSearchButton("manual")
		}
		console.log(`${PREFIX} ✅ Setup complete! Try window._testGoogleSearch() to test manually`)
	}

	// =============================================================================
	// INITIALIZATION
	// =============================================================================
	if (document.readyState === "complete") {
		console.log(`${PREFIX} Document already loaded, setting up now...`)
		setupListeners()
	} else if (document.readyState === "interactive") {
		console.log(`${PREFIX} Document interactive, waiting for full load...`)
		window.addEventListener("load", function () {
			console.log(`${PREFIX} window.load fired, waiting 1s for React...`)
			setTimeout(setupListeners, 1000)
		})
	} else {
		console.log(`${PREFIX} Document still loading, waiting for DOMContentLoaded...`)
		document.addEventListener("DOMContentLoaded", function () {
			console.log(`${PREFIX} DOMContentLoaded fired, waiting 500ms...`)
			setTimeout(setupListeners, 500)
		})
	}

	console.log(`${PREFIX} Initialization complete`)
})()

// //!		 8. Hide Upgrade to Max banner
// ;(() => {
// 	console.log("[Perplexity Improvements - Banners] removing banners")
// 	const removeBanners = () => {
// 		removeUpgradeToMaxBanner()
// 		removeUpgradeNowBanner()
// 		removeTryThisAnswerBanner()
// 	}
// 	const removeUpgradeToMaxBanner = () => {
// 		// Find the element containing "Upgrade to Max"
// 		const upgradeBtn = Array.from(document.querySelectorAll("div")).find((el) => el.textContent.trim() === "Upgrade to Max")

// 		if (!upgradeBtn) return

// 		// Closest ancestor with shadow-xl likely marks full banner
// 		const banner = upgradeBtn.closest(".shadow-xl")
// 		if (banner) {
// 			banner.remove()
// 		} else {
// 			// Fallback: Remove parent stack if .shadow-xl not found
// 			let parent = upgradeBtn
// 			for (let i = 0; i < 3; i++) {
// 				if (parent.parentElement & (parent.id !== "root")) parent = parent.parentElement
// 			}
// 			parent.remove()
// 		}
// 	}
// 	const removeUpgradeNowBanner = () => {
// 		// Find the element containing "Upgrade now"
// 		const upgradeBtn = Array.from(document.querySelectorAll("div")).find((el) => el.textContent.trim() === "Upgrade now")

// 		if (!upgradeBtn) return

// 		// Closest ancestor with shadow-xl likely marks full banner
// 		const banner = upgradeBtn.closest(".shadow-md")
// 		if (banner) {
// 			banner.remove()
// 		} else {
// 			// Fallback: Remove parent stack if .shadow-xl not found
// 			let parent = upgradeBtn
// 			for (let i = 0; i < 3; i++) {
// 				if (parent.parentElement & (parent.id !== "root")) parent = parent.parentElement
// 			}
// 			parent.remove()
// 		}
// 	}

// 	const getOwnText = (el) => {
// 		return Array.from(el.childNodes)
// 			.filter((n) => n.nodeType === Node.TEXT_NODE)
// 			.map((n) => n.textContent)
// 			.join("")
// 			.trim()
// 	}

// 	const removeTryThisAnswerBanner = () => {
// 		const target = Array.from(document.querySelectorAll("*")).find((el) => {
// 			const own = getOwnText(el)
// 			if (!own.startsWith("Try this answer with")) return false

// 			// ensure no descendant is a more specific match
// 			return !Array.from(el.querySelectorAll("*")).some((child) => getOwnText(child).startsWith("Try this answer with"))
// 		})

// 		if (target && target.parentElement && target.parentElement.parentElement) {
// 			target.parentElement.parentElement.remove()
// 		}
// 	}

// 	// Run the remover every 500ms in case the banner reappears via SPA navigation
// 	setInterval(removeBanners, 500)
// })()
