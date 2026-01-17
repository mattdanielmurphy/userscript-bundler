// ==UserScript==
// @name        ContentConnections Practice Enhancements
// @match       *://contentconnections.ca/Practice/*
// @match       *://resources.contentconnections.ca/Practice/*
// @grant       none
// @version     1.0
// @author      Antigravity
// @description Enhancements for ContentConnections Practice pages: hides whiteboard/menu, and adds automatic solution/understand buttons.
// ==/UserScript==

;(function () {
	"use strict"

	console.log("[Userscript] ContentConnections Practice Enhancements loaded! 10:45am")

	// 1. Hide #whiteBoard and .mainMenu
	const style = document.createElement("style")
	style.innerHTML = `
        #whiteBoard, .mainMenu, .questionSlide__container--showSolution {
            display: none !important;
        }
        .contentContainer {
            margin-left: 2rem !important;
            margin-right: auto !important;
            margin-left: auto !important; /* Centering */
            max-width: 1200px;
            padding-left: 2rem; /* Using padding to satisfy the 2rem left space while maintaining center */
        }
        .cornerMenu {
            right: calc((100vw - 1200px) / 2 + 20px) !important;
            bottom: 20px !important;
            z-index: 999999 !important; /* Ensure it is above everything */
            pointer-events: auto !important;
        }
        .cornerMenu li, .cornerMenu a {
            pointer-events: auto !important;
        }
        @media (max-width: 1280px) {
            .cornerMenu {
                right: 20px !important;
            }
        }
        .custom-yes-show, .custom-no-skip {
            margin-left: 5px;
            margin-right: 5px;
        }
    `
	document.head.appendChild(style)

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
				true
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

	// Use MutationObserver because these slides might be loaded dynamically
	const observer = new MutationObserver(() => {
		addCustomButtons()
		addAutoShowCheckbox()
		attemptAutoShowAnswer()
		// Video play moved to click handlers
		setupPrintChaining()
	})

	observer.observe(document.body, { childList: true, subtree: true })

	// Initial call
	uncheckAllAnswers()
	addCustomButtons()
	addAutoShowCheckbox()
	attemptAutoShowAnswer()
	// Video play moved to click handlers
	setupPrintChaining()
})()
