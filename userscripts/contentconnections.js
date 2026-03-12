// ==UserScript==
// @name        ContentConnections Practice Enhancements
// @match       *://contentconnections.ca/Practice/*
// @match       *://resources.contentconnections.ca/Practice/*
// @match       *://resources.contentconnections.ca/PlayerView/*
// @grant       none
// @version     1.0
// @author      Antigravity
// @description Enhancements for ContentConnections Practice pages: hides whiteboard/menu, and adds automatic solution/understand buttons.
// ==/UserScript==

;(function () {
	"use strict"

	console.log("[Userscript] ContentConnections Practice Enhancements loaded! 3:13pm thu")

	const LAYOUT_CSS = `
        #whiteBoard, .mainMenu, ul[class="mainMenu"], .questionSlide__container--showSolution {
            display: none !important;
        }
        .contentContainer {
            margin-left: 1em !important;
            margin-right: 1em !important;
            max-width: none !important;
        }
        .pageTitle {
            margin-left: 1em !important;
        }
        .mediaPlayer__iframe {
            /* Width removed: conflicts with site's internal scaling logic */
        }
        /* Target main slide canvas while avoiding whiteboard/graphs */
        canvas:not(#whiteBoard__canvas):not(.dcg-graph-inner) {
            width: auto !important;
            height: auto !important;
            max-width: 100% !important;
            max-height: 95% !important;
        }
        .cornerMenu {
            display: flex !important;
            flex-direction: row !important;
            gap: 6px !important;
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 10px !important;
            position: static !important;
            pointer-events: auto !important;
            z-index: 9999 !important;
            list-style: none !important;
        }
        .cornerMenu__item {
            width: 30px !important;
            height: 30px !important;
            min-width: 30px !important;
            background: #2a2a2a !important;
            border: 1px solid #444 !important;
            border-radius: 4px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .cornerMenu__item a {
            font-size: 14px !important;
            color: #ffffff !important;
            display: flex !important;
            width: 100% !important;
            height: 100% !important;
            align-items: center !important;
            justify-content: center !important;
            pointer-events: auto !important;
        }
        .mediaPlayer__controls {
            display: flex !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
            justify-content: flex-start !important;
            height: auto !important;
            padding: 5px 10px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
						margin-bottom: 1em !important;
        }
        .mediaPlayer__button--showslides {
            margin-left: auto !important; /* Push the slide counter to the far right */
            position: static !important;
            flex-shrink: 0 !important;
        }
        .mediaPlayer__button {
            flex-shrink: 0 !important;
        }
        .mediaPlayer__track {
            flex-grow: 1 !important;
            flex-shrink: 1 !important;
            min-width: 100px !important;
            margin: 0 15px !important;
        }
        .custom-yes-show, .custom-no-skip {
            margin-left: 5px;
            margin-right: 5px;
        }
				.mediaPlayer__bottom {
					bottom: 1em !important;
					left: 1em !important;
				}
    `

	const DARK_MODE_CSS = `
        /* Dark Mode Extensions - Refined 2026-03-08 */
        @media (prefers-color-scheme: dark) {
            body, html { background-color: #121212 !important; color: #e0e0e0 !important; }
            .contentContainer, .mainMenu, .questionSlide, section, header, footer, div, span, p, label, li, a {
                color: #e0e0e0 !important;
            }
            .contentContainer { background-color: #121212 !important; }

            /* Page Title & Breadcrumbs */
            .pageTitle, .breadCumb, .breadCumbTitle, .breadCumbMenu__item a, #CourseTitle, #UnitTitle, #LessonTitle, #SlidesTitle {
                color: #ffffff !important;
            }
            .breadCumb i { color: #8ab4f8 !important; } /* Blueish icons for breadcrumbs */
            .breadCumbMenu {
                background-color: #2a2a2a !important;
                border: 1px solid #444 !important;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4) !important;
            }
            .breadCumbMenu__item a { color: #ffffff !important; }
            .breadCumbMenu__item:hover { background-color: #3d3d3d !important; }

            /* Player Controls */
            .mediaPlayer__controls {
                background-color: #1e1e1e !important;
                border: 1px solid #333 !important;
                border-radius: 8px !important;
                margin-top: 5px !important;
                padding: 5px !important;
            }
            .mediaPlayer__button {
                background-color: transparent !important;
                border: none !important;
                color: #ffffff !important;
                transition: background-color 0.2s !important;
            }
            .mediaPlayer__button i, .mediaPlayer__button--showslides i {
                color: #ffffff !important;
            }
            .mediaPlayer__button:hover {
                background-color: #333 !important;
                border-radius: 4px !important;
            }
            .mediaPlayer__button--showslides {
                background-color: #2a2a2a !important;
                border: 1px solid #444 !important;
                border-radius: 4px !important;
                padding: 2px 10px !important;
            }
            .mediaPlayer__track { background-color: transparent !important; }

            /* Seekbar & Volume Range inputs */
            input[type="range"] {
                accent-color: #bb86fc !important;
                background-color: #444 !important;
            }

            /* Generic text colors for dark mode */
            h1, h2, h3, h4, h5, h6 { color: #ffffff !important; }
            a { color: #bb86fc !important; }

            /* Buttons and Inputs */
            input[type="text"], input[type="number"], select, textarea {
                background-color: #1e1e1e !important;
                color: #ffffff !important;
                border-color: #444 !important;
            }

            /* Custom button color tweaks for visibility */
            .questionSlide__button {
                background-color: #2a2a2a !important;
                border-color: #444 !important;
                color: #e0e0e0 !important;
            }
            .questionSlide__button:hover {
                background-color: #3d3d3d !important;
            }
            .auto-show-answer-container label {
                color: #e0e0e0 !important;
            }

            /* Practice Question Buttons */
            .questionsList {
                margin-bottom: 20px !important;
            }
            .questionsItems {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 8px !important;
                padding: 0 !important;
                list-style: none !important;
            }
            .questionsItem {
                background-color: #2a2a2a !important;
                border: 1px solid #444 !important;
                border-radius: 4px !important;
                width: 32px !important;
                height: 32px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.2s ease !important;
            }
            .questionsItem:hover {
                background-color: #3d3d3d !important;
                border-color: #666 !important;
                transform: translateY(-1px) !important;
            }
            .questionsItem a {
                color: #bb86fc !important;
                text-decoration: none !important;
                font-weight: bold !important;
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .questionsItem--active {
                background-color: #bb86fc !important;
                border-color: #bb86fc !important;
            }
            .questionsItem--active a {
                color: #121212 !important;
            }

            /* Image Inversion */
            img {
                filter: invert(1) hue-rotate(180deg) !important;
                border-radius: 4px !important;
            }
            /* Don't invert images that are already dark or transparent icons */
            img[src*="icon"], img[src*="logo"] {
                filter: none !important;
            }
        }
    `

	// Utility to inject CSS into all accessible iframes
	const injectStylesRecursive = (win, id, css) => {
		try {
			const doc = win.document
			if (doc && doc.body && !doc.querySelector(`#${id}`)) {
				const style = doc.createElement("style")
				style.id = id
				style.innerHTML = css
				doc.head.appendChild(style)
			}
			const iframes = doc.querySelectorAll("iframe")
			for (const frame of iframes) {
				try {
					injectStylesRecursive(frame.contentWindow, id, css)
				} catch (e) {
					// Cross-origin
				}
			}
		} catch (e) {
			// Cross-origin
		}
	}

	const applyLayout = () => {
		injectStylesRecursive(window, "userscript-layout-styles", LAYOUT_CSS)
	}

	// Monitor specifically the print button click
	const monitorPrintButton = () => {
		const printBtn = document.querySelector('a[onclick*="showPrint"]')
		if (printBtn && !printBtn.dataset.monitored) {
			printBtn.dataset.monitored = "true"
			printBtn.style.border = "2px solid red" // Temporary visual debug
			printBtn.addEventListener(
				"click",
				(e) => {
					console.log("[Userscript] Print button CLICKED in corner menu!")
				},
				true,
			)
		}
	}

	const addCustomButtons = () => {
		const buttonGroup = document.querySelector(".questionSlide__buttonGroup--correctness")
		if (!buttonGroup || buttonGroup.querySelector(".custom-button-added-marker")) return

		// Mark as processed to avoid double addition
		const marker = document.createElement("span")
		marker.className = "custom-button-added-marker"
		marker.style.display = "none"
		buttonGroup.appendChild(marker)

		const yesBtn = buttonGroup.querySelector(".questionSlide__button--correct")
		const noBtn = buttonGroup.querySelector(".questionSlide__button--notCorrect")

		if (!yesBtn || !noBtn) return

		// Create "Yes (Show Solution)"
		const yesShowSolBtn = document.createElement("button")
		yesShowSolBtn.className = "questionSlide__button questionSlide__button--correct custom-yes-show"
		yesShowSolBtn.innerHTML = '<i class="fas fa-check-circle"></i> Yes (Show Sol.)'

		// Create "No (Skip Solution)"
		const noSkipSolBtn = document.createElement("button")
		noSkipSolBtn.className = "questionSlide__button questionSlide__button--notCorrect custom-no-skip"
		noSkipSolBtn.innerHTML = '<i class="fas fa-times-circle"></i> No (Skip Sol.)'

		// Insert order: Yes, Yes (Show Sol.), No, No (Skip Sol.)
		yesBtn.after(yesShowSolBtn)
		noBtn.after(noSkipSolBtn)

		// Helper to perform automated clicks with a slight delay
		const autoClick = (selector) => {
			setTimeout(() => {
				const btn = document.querySelector(selector)
				if (btn) {
					console.log(`[Userscript] Automatically clicking: ${selector}`)
					btn.click()
				} else {
					console.warn(`[Userscript] Could not find button to auto-click: ${selector}`)
				}
			}, 150) // Slightly longer delay to allow site state to update
		}

		// When Yes (.questionSlide__button--correct) is clicked, automatically click ".questionSlide__button--understand"
		yesBtn.addEventListener("click", (e) => {
			if (e.isTrusted) {
				console.log("[Userscript] Yes (original) clicked -> Auto-clicking Understand")
				autoClick(".questionSlide__button--understand")
			}
		})

		// When Yes (Show Sol) is clicked, click ".questionSlide__button--showSolution" automatically
		yesShowSolBtn.addEventListener("click", () => {
			console.log("[Userscript] Yes (Show Sol.) clicked -> Clicking original Yes then Show Solution")
			yesBtn.click() // Selects "Yes" without triggering the original's auto-click
			autoClick(".questionSlide__button--showSolution")
			triggerVideoAutoplay()
		})

		// When No (.questionSlide__button--notCorrect) is clicked, click ".questionSlide__button--showSolution" automatically
		noBtn.addEventListener("click", (e) => {
			if (e.isTrusted) {
				console.log("[Userscript] No (original) clicked -> Auto-clicking Show Solution")
				autoClick(".questionSlide__button--showSolution")
				triggerVideoAutoplay()
			}
		})

		// When No (skip sol.) is clicked, automatically click ".questionSlide__button--understand"
		noSkipSolBtn.addEventListener("click", () => {
			console.log("[Userscript] No (Skip Sol.) clicked -> Clicking original No then Understand")
			noBtn.click() // Selects "No" without triggering the original's auto-click
			autoClick(".questionSlide__button--understand")
		})
	}

	// 4. Auto-play video when solution is shown
	// 4. Trigger video autoplay (called on specific button clicks)
	const triggerVideoAutoplay = () => {
		console.log("[Userscript] Attempting to auto-play solution video...")
		let attempts = 0
		// Poll for the video for ~2 seconds (Show Solution click reaction time)
		const interval = setInterval(() => {
			const video = document.querySelector(".questionSlide__container--solution video")
			if (video) {
				if (video.paused) {
					// Attempt play
					video
						.play()
						.then(() => {
							console.log("[Userscript] Video started playing.")
							clearInterval(interval)
						})
						.catch((err) => {
							// Ignore abort errors or if it's not ready
						})
				} else if (video.currentTime > 0 && !video.paused) {
					// Already playing
					clearInterval(interval)
				}
			}
			attempts++
			if (attempts > 20) clearInterval(interval)
		}, 100)
	}

	// 5. Automate Print workflow (Simplified)

	// Uncheck "All Questions Answers" on initial load
	const uncheckAllAnswers = () => {
		const allAnsCheckbox = document.getElementById("AllQuestionsAnswers")
		if (allAnsCheckbox && allAnsCheckbox.checked) {
			console.log("[Userscript] Unchecking AllQuestionsAnswers on load")
			allAnsCheckbox.click()
		}
	}

	// Chain the corner menu print click to the form's final print action
	const setupPrintChaining = () => {
		const cornerPrintBtn = document.querySelector('a[onclick*="showPrint"]')
		if (cornerPrintBtn && !cornerPrintBtn.dataset.chained) {
			cornerPrintBtn.dataset.chained = "true"
			cornerPrintBtn.addEventListener("click", (e) => {
				console.log("[Userscript] Corner Print clicked, triggering form Print sequentially...")

				// Give the site a moment to show the form
				setTimeout(() => {
					const finalPrintBtn = document.querySelector('#PrintQuestions button[onclick*="PrintPractice"]')
					if (finalPrintBtn) {
						console.log("[Userscript] Triggering final Print button")
						finalPrintBtn.click()
					} else {
						console.warn("[Userscript] Final print button not found in form")
					}
				}, 300) // Wait for potential site animation/show logic
			})
		}
	}

	const AUTO_SHOW_KEY = "cc_auto_show_answer"

	// 6. "Automatically show next answer" Checkbox
	const addAutoShowCheckbox = () => {
		const buttonGroup = document.querySelector(".questionSlide__buttonGroup--correctness")
		if (!buttonGroup) return // Not visible yet

		// Check if parent already has it (we append to parent to be "below" the group)
		const parent = buttonGroup.parentNode
		if (parent.querySelector(".auto-show-answer-container")) return

		const container = document.createElement("div")
		container.className = "auto-show-answer-container"
		container.style.marginTop = "15px"
		container.style.display = "flex"
		container.style.alignItems = "center"
		container.style.justifyContent = "center"
		container.style.gap = "10px"
		container.style.fontFamily = "inherit"
		container.style.fontSize = "14px"

		const checkbox = document.createElement("input")
		checkbox.type = "checkbox"
		checkbox.id = "cb_auto_show_answer"
		checkbox.style.cursor = "pointer"
		checkbox.style.width = "16px"
		checkbox.style.height = "16px"

		// Load state
		const savedState = localStorage.getItem(AUTO_SHOW_KEY) === "true"
		checkbox.checked = savedState

		checkbox.addEventListener("change", (e) => {
			localStorage.setItem(AUTO_SHOW_KEY, e.target.checked)
			// If enabled, try triggering immediately in case we are waiting on one
			if (e.target.checked) attemptAutoShowAnswer()
		})

		const label = document.createElement("label")
		label.htmlFor = "cb_auto_show_answer"
		label.textContent = "Automatically show next answer"
		label.style.cursor = "pointer"
		label.style.userSelect = "none"

		container.appendChild(checkbox)
		container.appendChild(label)

		parent.appendChild(container)
	}

	const attemptAutoShowAnswer = () => {
		// Check if feature is enabled
		const rawState = localStorage.getItem(AUTO_SHOW_KEY)
		const isEnabled = rawState === "true"

		if (!isEnabled) return

		// NEW: Don't automatically show next answer for the FIRST question of the entire list
		const { el: slidesTitle } = findInIframes(window, "#SlidesTitle")
		const { el: slidesList } = findInIframes(window, "#slidesList")
		if (slidesTitle && slidesList) {
			const titleText = slidesTitle.textContent.trim()
			const firstItem = slidesList.querySelector("li a")
			if (firstItem) {
				const firstTitle = (firstItem.getAttribute("title") || firstItem.textContent).trim()
				if (titleText === firstTitle) {
					return
				}
			}
		}

		// Try class selector first
		let showAnswerBtn = document.querySelector(".questionSlide__button--showAnswer")

		if (!showAnswerBtn) {
			// If not found, try text-based search (case-insensitive) for ANY button/input containing "Show Answer"
			const allButtons = document.querySelectorAll('button, .questionSlide__button, input[type="button"]')
			for (const btn of allButtons) {
				const text = (btn.textContent || btn.value || "").toLowerCase()
				if (text.includes("show answer")) {
					showAnswerBtn = btn
					break
				}
			}
		}

		// Check if button exists and hasn't been clicked by us yet
		if (showAnswerBtn && !showAnswerBtn.dataset.autoClicked) {
			showAnswerBtn.dataset.autoClicked = "true"

			// Try clicking multiple times to ensure the framework catches it
			// (Listeners might not be attached immediately upon DOM insertion)
			const clickSequence = [100, 500, 1000]

			clickSequence.forEach((delay) => {
				setTimeout(() => {
					if (document.body.contains(showAnswerBtn)) {
						showAnswerBtn.click()
						// Dispatch generic mouse events just in case
						showAnswerBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
						showAnswerBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
					}
				}, delay)
			})
		}
	}

	let isAutomationRunning = false
	let lastCurrentSlide = -1
	let initialSyncDone = false
	let lastSyncLogTime = 0
	let initialJumpTriggered = false

	// Capture target slide from URL once at the very beginning
	const urlParams = new URLSearchParams(window.location.search)
	const initialTargetSlide = urlParams.get("slide")
	const initialTargetNum = initialTargetSlide ? parseInt(initialTargetSlide) : null
	console.log(`[Userscript] Target slide from URL: ${initialTargetSlide || "none"}`)

	// --- Canvas Discovery & Utilities ---

	/**
	 * Finds the main slide canvas by searching for an iframe with a URL containing '/Files/Slides/'
	 * and looking for a canvas ('du', 'dw', or generic) inside it.
	 */
	const findMainCanvas = (win) => {
		try {
			// 1. Check current window if it's a slide iframe
			if (win.location.href.includes("/Files/Slides/")) {
				const doc = win.document
				const canvas = doc.getElementById("du") || doc.getElementById("dw") || doc.querySelector("canvas")
				if (canvas) return { el: canvas, doc: win.document }
			}

			// 2. Search iframes recursively
			const iframes = win.document.querySelectorAll("iframe")
			for (const iframe of iframes) {
				try {
					const res = findMainCanvas(iframe.contentWindow)
					if (res.el) return res
				} catch (e) {
					// Ignore cross-origin
				}
			}
		} catch (e) {
			// Ignore cross-origin
		}
		return { el: null, doc: null }
	}

	/**
	 * Generic bread-first search for an element in all accessible iframes.
	 */
	const findInIframes = (win, selector) => {
		try {
			const el = win.document.querySelector(selector)
			if (el) return { el, doc: win.document }

			const iframes = win.document.querySelectorAll("iframe")
			for (const iframe of iframes) {
				try {
					const res = findInIframes(iframe.contentWindow, selector)
					if (res.el) return res
				} catch (e) {
					// Ignore cross-origin errors
				}
			}
		} catch (e) {
			// Ignore cross-origin errors
		}
		return { el: null, doc: null }
	}

	const applyDarkMode = () => {
		const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
		if (!isDark) return

		// 1. Target the canvas specifically inside its iframe
		const { el: canvas, doc: canvasDoc } = findMainCanvas(window)
		if (canvas && !canvas.dataset.darkModeApplied) {
			console.log("[Userscript] Applying dark mode filter to the main slide canvas.")
			canvas.style.filter = "invert(1) hue-rotate(180deg) contrast(0.9)"
			canvas.dataset.darkModeApplied = "true"
			if (canvasDoc && canvasDoc.body) {
				canvasDoc.body.style.backgroundColor = "black"
				canvasDoc.body.style.color = "#ececec"
			}
		}

		// 2. Recursive Iframe Dark Mode Injection
		injectStylesRecursive(window, "userscript-dm-overlay", DARK_MODE_CSS)
	}

	const playCanvas = () => {
		console.log("[Userscript] [playCanvas] Triggered.")
		const { el: canvas, doc: canvasDoc } = findMainCanvas(window)
		if (canvas && canvasDoc) {
			console.log("[Userscript] [playCanvas] Found main slide canvas. Calculating center...")
			const rect = canvas.getBoundingClientRect()
			const width = rect.width || canvas.offsetWidth || 300
			const height = rect.height || canvas.offsetHeight || 200
			const centerX = rect.left + width / 2
			const centerY = rect.top + height / 2
			console.log(`[Userscript] [playCanvas] Center coordinates: ${centerX.toFixed(2)}, ${centerY.toFixed(2)} (using ${width}x${height})`)

			const clickOpts = {
				view: canvasDoc.defaultView || window,
				bubbles: true,
				cancelable: true,
				clientX: centerX,
				clientY: centerY,
				button: 0,
			}

			console.log("[Userscript] [playCanvas] Dispatching mousedown/mouseup/click sequence...")
			canvas.dispatchEvent(new MouseEvent("mousedown", clickOpts))
			canvas.dispatchEvent(new MouseEvent("mouseup", clickOpts))
			canvas.dispatchEvent(new MouseEvent("click", clickOpts))
			console.log("[Userscript] [playCanvas] All events dispatched.")
		} else {
			console.warn("[Userscript] [playCanvas] FAILED: Could not find canvas in any iframe.")
		}
	}

	const syncSlideState = () => {
		const { el: slideIndicator } = findInIframes(window, "button.mediaPlayer__button--showslides")

		// Periodic status log (every 10s if not finding anything)
		const now = Date.now()
		if (!slideIndicator) {
			if (now - lastSyncLogTime > 10000) {
				console.log("[Userscript] [syncSlideState] Still searching for slide indicator...")
				lastSyncLogTime = now
			}
			return
		}

		const text = slideIndicator.textContent.trim()
		const match = text.match(/Slide (\d+) of (\d+)/i)
		if (!match) {
			if (now - lastSyncLogTime > 10000) {
				console.log(`[Userscript] [syncSlideState] Found indicator but text doesn't match: "${text}"`)
				lastSyncLogTime = now
			}
			return
		}

		const currentSlide = parseInt(match[1])

		// Perform initial sync verification
		if (!initialSyncDone && initialTargetNum) {
			if (currentSlide === initialTargetNum) {
				console.log(`[Userscript] [syncSlideState] Target reached (${currentSlide}). Initial sync COMPLETE.`)
				initialSyncDone = true
			} else if (initialJumpTriggered) {
				// We triggered a jump but haven't arrived yet. Stay quiet.
				return
			}
		} else if (!initialTargetNum) {
			initialSyncDone = true
		}

		// Perform URL persistence (ONLY after initial jump is confirmed and settled)
		if (initialSyncDone) {
			const url = new URL(window.location.href)
			if (url.searchParams.get("slide") !== String(currentSlide)) {
				console.log(`[Userscript] [syncSlideState] Updating URL parameter: ?slide=${currentSlide}`)
				url.searchParams.set("slide", currentSlide)
				window.history.replaceState({}, "", url)
			}
		}

		// Handle playback on slide change (excluding automation and initial load jump)
		if (currentSlide !== lastCurrentSlide) {
			console.log(`[Userscript] [syncSlideState] SLIDE CHANGE DETECTED: ${lastCurrentSlide} -> ${currentSlide}`)
			lastCurrentSlide = currentSlide

			// Only trigger auto-play if we are finished with initial navigation
			if (!isAutomationRunning && initialSyncDone) {
				console.log("[Userscript] [syncSlideState] Triggering auto-playback sequence in 1.5s...")
				setTimeout(() => {
					if (!isAutomationRunning) {
						console.log("[Userscript] [syncSlideState] Executing delayed playCanvas call...")
						playCanvas()
					} else {
						console.log("[Userscript] [syncSlideState] Automation running, skipping auto-playback.")
					}
				}, 1500)
			} else if (!initialSyncDone) {
				console.log("[Userscript] [syncSlideState] Slide found, but initial sync jump is still pending. Skipping playback for now.")
			}
		}
	}

	const performInitialSync = () => {
		if (initialSyncDone || initialJumpTriggered) return

		if (!initialTargetNum) {
			initialSyncDone = true
			return
		}

		const { el: slidesList } = findInIframes(window, "#slidesList")
		if (!slidesList) return // Retry on next driver iteration

		console.log(`[Userscript] [performInitialSync] Attempting to navigate to Slide ${initialTargetNum}`)
		const links = Array.from(slidesList.querySelectorAll("li a"))
		if (links.length === 0) return

		// 1. Precise text-based search (e.g., "Page 12")
		let linkToClick = links.find((a) => {
			const txt = (a.getAttribute("title") || a.textContent || "").trim().toLowerCase()
			return txt === `page ${initialTargetNum}` || txt === String(initialTargetNum)
		})

		// 2. Handle "Last Page" specifically if the target matches total known slides
		if (!linkToClick) {
			const { el: ind } = findInIframes(window, "button.mediaPlayer__button--showslides")
			const totalMatch = ind ? ind.textContent.match(/of (\d+)/i) : null
			if (totalMatch && initialTargetNum === parseInt(totalMatch[1])) {
				linkToClick = links.find((a) => (a.getAttribute("title") || a.textContent || "").toLowerCase().includes("last"))
			}
		}

		// 3. Positional fallback
		if (!linkToClick) {
			console.log("[Userscript] [performInitialSync] No text match. Using index-based selection.")
			linkToClick = links[initialTargetNum - 1]
		}

		if (linkToClick) {
			const label = (linkToClick.getAttribute("title") || linkToClick.textContent || "").trim()
			console.log(`[Userscript] [performInitialSync] EXPLICIT CLICK: Link for Slide ${initialTargetNum} ("${label}")`)
			console.log(`[Userscript] [performInitialSync] Target HTML: ${linkToClick.outerHTML}`)

			initialJumpTriggered = true
			linkToClick.click()

			// Safety timeout: If we don't arrive at target in 5s, release the lock
			setTimeout(() => {
				if (!initialSyncDone) {
					console.warn("[Userscript] [performInitialSync] Jump timeout! Releasing initialSync lock.")
					initialSyncDone = true
				}
			}, 5000)
		} else {
			console.warn(`[Userscript] [performInitialSync] CRITICAL: Could not find any suitable link for Slide ${initialTargetNum}`)
			initialSyncDone = true
		}
	}

	const moveCornerMenu = () => {
		const { el: controls, doc: controlsDoc } = findInIframes(window, ".mediaPlayer__controls")
		const { el: cornerMenu } = findInIframes(window, ".cornerMenu")

		if (controls && cornerMenu && cornerMenu.parentNode !== controls) {
			console.log("[Userscript] Moving cornerMenu into mediaPlayer__controls")
			// Insert before rewind button if it exists, otherwise append
			const rewindBtn = controls.querySelector(".mediaPlayer__button--rewind")
			if (rewindBtn) {
				controls.insertBefore(cornerMenu, rewindBtn)
			} else {
				controls.appendChild(cornerMenu)
			}
		}
	}

	const onKeydown = (e) => {
		// Log ALL keydowns with Alt or Command to verify the listener is even firing
		if (e.altKey || e.metaKey || e.ctrlKey) {
			console.log(`[Userscript] Modifier Keydown: code=${e.code}, alt=${e.altKey}, meta=${e.metaKey}, ctrl=${e.ctrlKey}, key=${e.key}`)
		}

		// Use e.code for physical key detection (KeyD) which is more reliable than e.key with modifiers
		if (e.altKey && e.code === "KeyD") {
			console.log("[Userscript] Opt+D Trigger Match Found!")
			e.preventDefault()
			e.stopPropagation()

			if (isAutomationRunning) {
				console.warn("[Userscript] Automation is already running.")
				return
			}

			if (confirm("Start Canvas Capture Automation?")) {
				console.log("[Userscript] Starting Canvas Capture Automation...")
				startAutomation().catch(console.error)
			}
		}
	}

	const setupKeydownListeners = (win) => {
		try {
			if (!win) return
			
			if (!win._keydownInjected) {
				win._keydownInjected = true
				win.addEventListener("keydown", onKeydown, true)
				console.log(`[Userscript] Keydown listener injected into: ${win.location.href}`)
			}

			const doc = win.document
			if (!doc) return

			const iframes = doc.querySelectorAll("iframe")
			for (const frame of iframes) {
				try {
					if (frame.contentWindow) {
						// Always recurse, even if parent is done, because new iframes might appear
						setupKeydownListeners(frame.contentWindow)
					}
				} catch (e) {
					// Cross-origin
				}
			}
		} catch (e) {
			// Cross-origin
		}
	}

	// Combined drive (Observer + Periodic Poll)
	const drive = () => {
		addCustomButtons()
		addAutoShowCheckbox()
		attemptAutoShowAnswer()
		syncSlideState()
		performInitialSync()
		setupPrintChaining()
		applyDarkMode()
		applyLayout()
		moveCornerMenu()
		setupKeydownListeners(window)
	}

	const observer = new MutationObserver(drive)
	observer.observe(document.body, { childList: true, subtree: true })
	setInterval(drive, 1000) // Poll every 1s to catch iframe changes that observer miss

	// Initial call
	uncheckAllAnswers()
	drive()

	// Canvas Capture Automation logic below
	// (Listeners now managed recursively in setupKeydownListeners)

	function getIndexInList(listSelector, titleValue, excludeKeywords = []) {
		const { el: list } = findInIframes(window, listSelector)
		if (!list) return ""

		const anchors = Array.from(list.querySelectorAll("li a"))
		let index = 1

		for (const a of anchors) {
			const itemText = (a.getAttribute("title") || a.textContent).trim()

			const shouldExclude = excludeKeywords.some((kw) => itemText.toLowerCase().includes(kw.toLowerCase()))
			if (shouldExclude) continue

			const itemTextClean = itemText.replace(/\s+/g, " ")
			const titleValueClean = titleValue.replace(/\s+/g, " ")

			if (itemTextClean === titleValueClean || titleValueClean.includes(itemTextClean)) {
				return index
			}
			index++
		}
		return ""
	}

	function getMetadata() {
		const clean = (selector) => {
			const { el } = findInIframes(window, selector)
			if (!el) return ""
			return el.textContent
				.replace(/\s*\([^)]*\)/g, "") // Remove (Lauzon) etc. anywhere
				.replace(/\s+/g, " ") // Collapse whitespace
				.trim()
		}

		const unitTitleRaw = (() => {
			const { el } = findInIframes(window, "#UnitTitle")
			return el ? el.textContent.trim() : ""
		})()

		const lessonTitleRaw = (() => {
			const { el } = findInIframes(window, "#LessonTitle")
			return el ? el.textContent.trim() : ""
		})()

		const unitExcludes = ["overview", "project", "exam", "review", "midterm"]
		const lessonExcludes = ["quiz", "test", "assignment", "review", "exam", "project"]

		return {
			course: clean("#CourseTitle") || "Course",
			unit: clean("#UnitTitle") || "Unit",
			lesson: clean("#LessonTitle") || "Lesson",
			unitIndex: unitTitleRaw ? getIndexInList("#unitsList", unitTitleRaw, unitExcludes) : "",
			lessonIndex: lessonTitleRaw ? getIndexInList("#lessonsList", lessonTitleRaw, lessonExcludes) : "",
		}
	}

	async function startAutomation() {
		isAutomationRunning = true
		try {
			console.log("Waiting for metadata elements to load...")
			let meta = { course: "Course", unit: "Unit", lesson: "Lesson" }

			// Fast poll for metadata (50ms interval)
			for (let i = 0; i < 60; i++) {
				const found = getMetadata()
				if (found.course !== "Course" || found.unit !== "Unit") {
					meta = found
					break
				}
				await new Promise((r) => setTimeout(r, 50))
			}

			console.log("Metadata detected:", meta)

			while (true) {
				const { el: canvas, doc: canvasDoc } = findMainCanvas(window)
				const { el: seekbar, doc: seekbarDoc } = findInIframes(window, "input#seekbar")
				const { el: nextBtn } = findInIframes(window, "button.mediaPlayer__button--forward")
				const { el: slideIndicator } = findInIframes(window, "button.mediaPlayer__button--showslides")
				const { el: audio } = findInIframes(window, "audio#n")

				if (!canvas || !seekbar || !audio) {
					console.warn("Required elements (canvas, seekbar, or audio) not found. Stopping.")
					break
				}

				const slideText = slideIndicator ? slideIndicator.textContent.trim() : ""
				const match = slideText.match(/Slide (\d+) of (\d+)/i)
				const currentSlide = match ? parseInt(match[1]) : 1
				const totalSlides = match ? parseInt(match[2]) : 1

				console.log(`%cProcessing ${slideText}...`, "color: #00ff00; font-weight: bold; font-size: 14px;")

				// --- FLIGHT RECORDER START ---
				const flightLog = []
				const slideStartTime = Date.now()
				const recorder = (msg, extra = {}) => {
					const timestamp = ((Date.now() - slideStartTime) / 1000).toFixed(3)
					flightLog.push({
						T: timestamp,
						Task: msg,
						Ready: audio.readyState,
						Time: audio.currentTime.toFixed(2),
						Max: seekbar.max,
						...extra,
					})
				}

				const checkLoadingState = () => {
					const search = (root) => {
						if (!root) return false
						// 1. Check for specific #loading div
						const loadDiv = root.querySelector && root.querySelector("#loading")
						if (loadDiv && loadDiv.style.display !== "none") return true
						// 2. Check for "buffer" text (defensively)
						const target = root.body || root
						const txt = target && target.innerText ? target.innerText.toLowerCase() : ""
						if (txt.includes("buffer")) return true
						// 3. Check for N/A clock
						const clock = root.querySelector && root.querySelector(".current-time")
						if (clock && (clock.textContent.includes("N/A") || clock.textContent === "0:00")) return true
						// 4. Recursive Shadow DOM search
						const all = root.querySelectorAll ? root.querySelectorAll("*") : []
						for (const el of all) {
							if (el.shadowRoot && search(el.shadowRoot)) return true
						}
						return false
					}
					if (search(document)) return true
					if (canvasDoc && search(canvasDoc)) return true
					const iframes = document.querySelectorAll("iframe")
					for (const f of iframes) {
						try {
							if (f.contentDocument && search(f.contentDocument)) return true
						} catch (e) {}
					}
					return false
				}

				const events = ["waiting", "seeking", "seeked", "playing", "pause", "canplay", "stalled", "error"]
				const handlers = events.map((evt) => {
					const h = () => recorder(`EVENT: ${evt}`, { buf: checkLoadingState() })
					audio.addEventListener(evt, h)
					return { evt, h }
				})
				const pollId = setInterval(() => recorder("POLL", { buf: checkLoadingState() }), 100)
				// --- FLIGHT RECORDER END ---

				// 2. Start playback
				recorder("CLICK TO PLAY")
				const rect = canvas.getBoundingClientRect()
				const clickOpts = {
					view: canvasDoc.defaultView || window,
					bubbles: true,
					cancelable: true,
					clientX: rect.left + rect.width / 2,
					clientY: rect.top + rect.height / 2,
					button: 0,
				}
				canvas.dispatchEvent(new MouseEvent("mousedown", clickOpts))
				canvas.dispatchEvent(new MouseEvent("mouseup", clickOpts))
				canvas.dispatchEvent(new MouseEvent("click", clickOpts))

				// 3a. Wait for initial readiness
				recorder("WAITING FOR INITIAL READY")
				for (let i = 0; i < 100; i++) {
					if (audio.readyState >= 3 && !checkLoadingState()) break
					await new Promise((r) => setTimeout(r, 100))
				}

				// 3b. Wait for seekbar.max to be stable
				recorder("WAITING FOR MAX STABILITY")
				let lastMax = ""
				let maxStable = 0
				for (let i = 0; i < 60; i++) {
					const currentMax = seekbar.max
					if (currentMax && parseFloat(currentMax) > 0 && currentMax === lastMax) {
						maxStable++
						if (maxStable >= 3) break
					} else {
						maxStable = 0
						lastMax = currentMax
					}
					await new Promise((r) => setTimeout(r, 100))
				}

				// 3c. Seek to end
				recorder("SEEKING TO END")
				await new Promise((resolve) => {
					const onSeeked = () => {
						audio.removeEventListener("seeked", onSeeked)
						recorder("SEEKED SIGNAL RECEIVED")
						resolve()
					}
					audio.addEventListener("seeked", onSeeked)
					seekbar.value = seekbar.max
					try {
						seekbar.valueAsNumber = parseFloat(seekbar.max)
					} catch (e) {}
					const seekEvents = ["input", "change", "mousedown", "mouseup", "pointerdown", "pointerup"]
					seekEvents.forEach((type) => seekbar.dispatchEvent(new Event(type, { bubbles: true })))
					setTimeout(() => {
						audio.removeEventListener("seeked", onSeeked)
						resolve()
					}, 4000)
				})

				// 3d. Stability Probe: Wait for Canvas to stop changing (Anti-Spinner)
				recorder("STABILITY PROBE START")
				let lastFrame = ""
				let stableFrames = 0
				for (let i = 0; i < 50; i++) {
					const currentFrame = canvas.toDataURL("image/png", 0.1) // Low quality for speed
					const isBuffering = checkLoadingState()
					const isAnimating = currentFrame !== lastFrame

					recorder(`PROBE ${i}`, { buf: isBuffering, anim: isAnimating })

					if (!isBuffering && !isAnimating && i > 3) {
						stableFrames++
						if (stableFrames >= 3) {
							recorder("STABILITY REACHED")
							break
						}
					} else {
						stableFrames = 0
					}
					lastFrame = currentFrame
					await new Promise((r) => setTimeout(r, 400))
				}
				recorder("STABILITY PROBE END")

				// 3e. Final render buffer
				recorder("FINAL RENDER DELAY")
				await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 300)))

				// 4. Download
				recorder("CAPTURE & DOWNLOAD")
				const dataURL = canvas.toDataURL("image/png")
				const link = document.createElement("a")
				const uStr = meta.unitIndex ? `U${meta.unitIndex} ` : ""
				const lStr = meta.lessonIndex ? `L${meta.lessonIndex} ` : ""
				const filename = `${meta.course} - ${uStr}${meta.unit} - ${lStr}${meta.lesson} - S${currentSlide}.png`
				link.download = filename
				link.href = dataURL
				document.body.appendChild(link)
				link.click()
				document.body.removeChild(link)

				// CLEANUP RECORDER
				clearInterval(pollId)
				handlers.forEach(({ evt, h }) => audio.removeEventListener(evt, h))
				console.log(`%cFlight Log for Slide ${currentSlide}:`, "color: #00ffff; font-weight: bold;")
				console.table(flightLog)

				// 5. Check if we're done
				if (currentSlide >= totalSlides - 1 || !nextBtn) {
					console.log("Automation complete.")
					break
				}

				// 6. Go to next slide
				nextBtn.click()

				// Wait for slide indicator to change
				await new Promise((resolve) => {
					if (!slideIndicator) return resolve()
					const observer = new MutationObserver((mutations, obs) => {
						const newMatch = slideIndicator.textContent.match(/Slide (\d+) of (\d+)/i)
						if (newMatch && parseInt(newMatch[1]) !== currentSlide) {
							obs.disconnect()
							requestAnimationFrame(() => setTimeout(resolve, 300))
						}
					})
					observer.observe(slideIndicator, { childList: true, characterData: true, subtree: true })
					setTimeout(() => {
						observer.disconnect()
						resolve()
					}, 3000)
				})
			}
		} finally {
			isAutomationRunning = false
			console.log("[Userscript] Automation sequence ended.")
		}
	}

	// Expose to global scope for console access
	window.startAutomation = startAutomation
	window.getAllCanvases = () => {
		const results = []
		const search = (win) => {
			try {
				const canvases = Array.from(win.document.querySelectorAll("canvas"))
				canvases.forEach((c) => {
					results.push({
						element: c,
						width: c.width,
						height: c.height,
						id: c.id,
						className: c.className,
						frameUrl: win.location.href,
					})
				})
				const frames = win.document.querySelectorAll("iframe")
				for (const f of frames) {
					try {
						if (f.contentWindow) search(f.contentWindow)
					} catch (e) {}
				}
			} catch (e) {}
		}
		search(window)
		console.table(results)
		return results
	}
})()
