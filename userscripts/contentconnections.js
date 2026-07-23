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
    'use strict'

    console.log(
        '[Userscript] ContentConnections Practice Enhancements loaded! 3:13pm thu'
    )

    const LAYOUT_CSS = `
        html {
            min-width: fit-content !important;
        }
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
            // width: auto !important;
            // height: auto !important;
            // max-width: 100% !important;
            // max-height: 95% !important;
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
        /* Ensure tables are scrollable and don't cut off on the left */
        .contentContainer table {
            display: block !important;
            overflow-x: auto !important;
            max-width: 100% !important;
            -webkit-overflow-scrolling: touch !important;
        }
        .custom-yes-show, .custom-no-skip {
            margin-left: 5px;
            margin-right: 5px;
        }
				.mediaPlayer__bottom {
					bottom: 1em !important;
					left: 1em !important;
				}
				#automation-control-bar {
					position: fixed;
					bottom: 20px;
					left: 50%;
					transform: translateX(-50%);
					background: rgba(30, 30, 30, 0.95);
					backdrop-filter: blur(10px);
					border: 1px solid #444;
					border-radius: 12px;
					padding: 10px 20px;
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					justify-content: center;
					gap: 10px 15px;
					width: auto;
					max-width: calc(100% - 40px);
					box-sizing: border-box;
					z-index: 10000;
					box-shadow: 0 8px 32px rgba(0,0,0,0.6);
					color: white;
					font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
					pointer-events: auto;
					user-select: none;
					cursor: move;
					transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
				}
				#automation-control-bar.paused {
					background: rgba(130, 20, 60, 0.95) !important; /* Deep Premium Pink/Wine */
					border-color: #ff3385 !important;
					box-shadow: 0 8px 32px rgba(255, 51, 133, 0.3);
				}
				#automation-control-bar.hidden {
					opacity: 0;
					pointer-events: none;
					transform: translate(var(--x, -50%), 40px);
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
				}
				.ac-status {
					font-size: 13px;
					font-weight: 600;
					color: #00ff00;
					min-width: 140px;
					text-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
				}
				.ac-input-group {
					display: flex;
					align-items: center;
					gap: 8px;
					padding-left: 5px;
				}
				.ac-label {
					font-size: 11px;
					text-transform: uppercase;
					letter-spacing: 0.5px;
					color: #aaa;
				}
				.ac-input {
					background: #1a1a1a;
					border: 1px solid #555;
					color: white;
					padding: 4px 8px;
					border-radius: 6px;
					width: 55px;
					text-align: center;
					font-size: 13px;
					outline: none;
					transition: border-color 0.2s;
				}
				.ac-input:focus {
					border-color: #bb86fc;
				}
				.ac-btn {
					background: #3d3d3d;
					border: 1px solid #555;
					color: white;
					padding: 6px 14px;
					border-radius: 8px;
					cursor: pointer;
					font-size: 13px;
					font-weight: 500;
					transition: all 0.2s;
					min-width: 80px;
				}
				.ac-btn:hover {
					background: #4d4d4d;
					border-color: #666;
				}
				.ac-btn.paused {
					background: #bb86fc;
					border-color: #bb86fc;
					color: #121212;
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
                const style = doc.createElement('style')
                style.id = id
                style.textContent = css
                doc.head.appendChild(style)
            }
            const iframes = doc.querySelectorAll('iframe')
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
        injectStylesRecursive(window, 'userscript-layout-styles', LAYOUT_CSS)
    }

    // Monitor specifically the print button click
    const monitorPrintButton = () => {
        const printBtn = document.querySelector('a[onclick*="showPrint"]')
        if (printBtn && !printBtn.dataset.monitored) {
            printBtn.dataset.monitored = 'true'
            printBtn.style.border = '2px solid red' // Temporary visual debug
            printBtn.addEventListener(
                'click',
                (e) => {
                    console.log(
                        '[Userscript] Print button CLICKED in corner menu!'
                    )
                },
                true
            )
        }
    }

    const addCustomButtons = () => {
        const { el: buttonGroup, doc } = findInIframes(
            window,
            '.questionSlide__buttonGroup--correctness'
        )
        if (
            !buttonGroup ||
            buttonGroup.querySelector('.custom-button-added-marker')
        )
            return

        // Mark as processed to avoid double addition
        const marker = doc.createElement('span')
        marker.className = 'custom-button-added-marker'
        marker.style.display = 'none'
        buttonGroup.appendChild(marker)

        const yesBtn = buttonGroup.querySelector(
            '.questionSlide__button--correct'
        )
        const noBtn = buttonGroup.querySelector(
            '.questionSlide__button--notCorrect'
        )

        if (!yesBtn || !noBtn) return

        // Create "Yes (Show Solution)"
        const yesShowSolBtn = doc.createElement('button')
        yesShowSolBtn.className =
            'questionSlide__button questionSlide__button--correct custom-yes-show'
        yesShowSolBtn.innerHTML =
            '<i class="fas fa-check-circle"></i> Yes (Show Sol.)'

        // Create "No (Skip Solution)"
        const noSkipSolBtn = doc.createElement('button')
        noSkipSolBtn.className =
            'questionSlide__button questionSlide__button--notCorrect custom-no-skip'
        noSkipSolBtn.innerHTML =
            '<i class="fas fa-times-circle"></i> No (Skip Sol.)'

        // Insert order: Yes, Yes (Show Sol.), No, No (Skip Sol.)
        yesBtn.after(yesShowSolBtn)
        noBtn.after(noSkipSolBtn)

        // Helper to perform automated clicks with a slight delay
        const autoClick = (selector) => {
            setTimeout(() => {
                const btn = document.querySelector(selector)
                if (btn) {
                    console.log(
                        `[Userscript] Automatically clicking: ${selector}`
                    )
                    btn.click()
                } else {
                    console.warn(
                        `[Userscript] Could not find button to auto-click: ${selector}`
                    )
                }
            }, 150) // Slightly longer delay to allow site state to update
        }

        // When Yes (.questionSlide__button--correct) is clicked, automatically click ".questionSlide__button--understand"
        yesBtn.addEventListener('click', (e) => {
            if (e.isTrusted || e.detail === 999) {
                console.log(
                    '[Userscript] Yes (original) clicked -> Auto-clicking Understand'
                )
                autoClick('.questionSlide__button--understand')
            }
        })

        // When Yes (Show Sol) is clicked, click ".questionSlide__button--showSolution" automatically
        yesShowSolBtn.addEventListener('click', () => {
            console.log(
                '[Userscript] Yes (Show Sol.) clicked -> Clicking original Yes then Show Solution'
            )
            yesBtn.click() // Selects "Yes" without triggering the original's auto-click
            autoClick('.questionSlide__button--showSolution')
            triggerVideoAutoplay()
        })

        // When No (.questionSlide__button--notCorrect) is clicked, click ".questionSlide__button--showSolution" automatically
        noBtn.addEventListener('click', (e) => {
            if (e.isTrusted || e.detail === 999) {
                console.log(
                    '[Userscript] No (original) clicked -> Auto-clicking Show Solution'
                )
                autoClick('.questionSlide__button--showSolution')
                triggerVideoAutoplay()
            }
        })

        // When No (skip sol.) is clicked, automatically click ".questionSlide__button--understand"
        noSkipSolBtn.addEventListener('click', () => {
            console.log(
                '[Userscript] No (Skip Sol.) clicked -> Clicking original No then Understand'
            )
            noBtn.click() // Selects "No" without triggering the original's auto-click
            autoClick('.questionSlide__button--understand')
        })
    }

    // 4. Auto-play video when solution is shown
    // 4. Trigger video autoplay (called on specific button clicks)
    const triggerVideoAutoplay = () => {
        console.log('[Userscript] Attempting to auto-play solution video...')
        let attempts = 0
        // Poll for the video for ~2 seconds (Show Solution click reaction time)
        const interval = setInterval(() => {
            const { el: video } = findInIframes(
                window,
                '.questionSlide__container--solution video'
            )
            if (video) {
                if (video.paused) {
                    // Attempt play
                    video
                        .play()
                        .then(() => {
                            console.log('[Userscript] Video started playing.')
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
        const allAnsCheckbox = document.getElementById('AllQuestionsAnswers')
        if (allAnsCheckbox && allAnsCheckbox.checked) {
            console.log('[Userscript] Unchecking AllQuestionsAnswers on load')
            allAnsCheckbox.click()
        }
    }

    // Chain the corner menu print click to the form's final print action
    const setupPrintChaining = () => {
        const { el: cornerPrintBtn, doc } = findInIframes(
            window,
            'a[onclick*="showPrint"], ul.cornerMenu a[title="Print"]'
        )
        if (cornerPrintBtn && !cornerPrintBtn.dataset.chained) {
            cornerPrintBtn.dataset.chained = 'true'
            cornerPrintBtn.addEventListener('click', (e) => {
                console.log(
                    '[Userscript] Corner Print clicked, triggering form Print sequentially...'
                )

                // Give the site a moment to show the form
                setTimeout(() => {
                    const { el: finalPrintBtn } = findInIframes(
                        window,
                        '#PrintQuestions button[onclick*="PrintPractice"]'
                    )
                    if (finalPrintBtn) {
                        console.log(
                            '[Userscript] Triggering final Print button'
                        )
                        finalPrintBtn.click()
                    } else {
                        console.warn(
                            '[Userscript] Final print button not found in form'
                        )
                    }
                }, 300) // Wait for potential site animation/show logic
            })
        }
    }

    const AUTO_SHOW_KEY = 'cc_auto_show_answer'

    // 6. "Automatically show next answer" Checkbox
    const addAutoShowCheckbox = () => {
        const { el: buttonGroup, doc } = findInIframes(
            window,
            '.questionSlide__buttonGroup--correctness'
        )
        if (!buttonGroup) return // Not visible yet

        // Check if parent already has it (we append to parent to be "below" the group)
        const parent = buttonGroup.parentNode
        if (parent.querySelector('.auto-show-answer-container')) return

        const container = doc.createElement('div')
        container.className = 'auto-show-answer-container'
        container.style.marginTop = '15px'
        container.style.display = 'flex'
        container.style.alignItems = 'center'
        container.style.justifyContent = 'center'
        container.style.gap = '10px'
        container.style.fontFamily = 'inherit'
        container.style.fontSize = '14px'

        const checkbox = doc.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.id = 'cb_auto_show_answer'
        checkbox.style.cursor = 'pointer'
        checkbox.style.width = '16px'
        checkbox.style.height = '16px'

        // Load state
        const savedState = safeStorageGet(AUTO_SHOW_KEY) === 'true'
        checkbox.checked = savedState

        checkbox.addEventListener('change', (e) => {
            safeStorageSet(AUTO_SHOW_KEY, e.target.checked)
            // If enabled, try triggering immediately in case we are waiting on one
            if (e.target.checked) attemptAutoShowAnswer()
        })

        const label = doc.createElement('label')
        label.htmlFor = 'cb_auto_show_answer'
        label.textContent = 'Automatically show next answer'
        label.style.cursor = 'pointer'
        label.style.userSelect = 'none'

        container.appendChild(checkbox)
        container.appendChild(label)

        parent.appendChild(container)
    }

    const attemptAutoShowAnswer = () => {
        // Check if feature is enabled
        const rawState = safeStorageGet(AUTO_SHOW_KEY)
        const isEnabled = rawState === 'true'

        if (!isEnabled) return

        // NEW: Don't automatically show next answer for the FIRST question of the entire list
        const { el: slidesTitle } = findInIframes(window, '#SlidesTitle')
        const { el: slidesList } = findInIframes(window, '#slidesList')
        if (slidesTitle && slidesList) {
            const titleText = slidesTitle.textContent.trim()
            const firstItem = slidesList.querySelector('li a')
            if (firstItem) {
                const firstTitle = (
                    firstItem.getAttribute('title') || firstItem.textContent
                ).trim()
                if (titleText === firstTitle) {
                    return
                }
            }
        }

        // Try class selector first
        let { el: showAnswerBtn, doc: btnDoc } = findInIframes(
            window,
            '.questionSlide__button--showAnswer'
        )

        if (!showAnswerBtn) {
            // If not found, try text-based search (case-insensitive) for ANY button/input containing "Show Answer" in all iframes
            const searchAllDocs = (win) => {
                try {
                    const allButtons = win.document.querySelectorAll(
                        'button, .questionSlide__button, input[type="button"]'
                    )
                    for (const btn of allButtons) {
                        const text = (
                            btn.textContent ||
                            btn.value ||
                            ''
                        ).toLowerCase()
                        if (text.includes('show answer'))
                            return { el: btn, doc: win.document }
                    }
                    const iframes = win.document.querySelectorAll('iframe')
                    for (const f of iframes) {
                        const found = searchAllDocs(f.contentWindow)
                        if (found) return found
                    }
                } catch (e) {}
                return null
            }
            const res = searchAllDocs(window)
            if (res) {
                showAnswerBtn = res.el
                btnDoc = res.doc
            }
        }

        // Check if button exists and hasn't been clicked by us yet
        if (showAnswerBtn && !showAnswerBtn.dataset.autoClicked) {
            showAnswerBtn.dataset.autoClicked = 'true'
            const targetDoc = btnDoc || document

            // Try clicking multiple times to ensure the framework catches it
            // (Listeners might not be attached immediately upon DOM insertion)
            const clickSequence = [100, 500, 1000]

            clickSequence.forEach((delay) => {
                setTimeout(() => {
                    if (targetDoc.body.contains(showAnswerBtn)) {
                        showAnswerBtn.click()
                        // Dispatch generic mouse events just in case
                        showAnswerBtn.dispatchEvent(
                            new MouseEvent('mousedown', { bubbles: true })
                        )
                        showAnswerBtn.dispatchEvent(
                            new MouseEvent('mouseup', { bubbles: true })
                        )
                    }
                }, delay)
            })
        }
    }

    let isAutomationRunning = false
    let isAutomationPaused = false
    const DELAY_KEY = 'cc_automation_delay'
    const DWELL_KEY = 'cc_automation_dwell'
    const RUNNING_KEY = 'cc_automation_running_state'
    const SPEED_KEY = 'cc_automation_speed'
    const MUTE_KEY = 'cc_automation_mute'
    const safeStorageGet = (key, fallback = null) => {
        try {
            return typeof window !== 'undefined' && window.localStorage
                ? window.localStorage.getItem(key)
                : fallback
        } catch (e) {
            return fallback
        }
    }

    const safeStorageSet = (key, value) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, value)
            }
        } catch (e) {}
    }

    let automationDelay = parseInt(safeStorageGet(DELAY_KEY, '500'))
    let useDwellTime = safeStorageGet(DWELL_KEY) !== 'false' // Default to true
    let automationSpeed = parseFloat(safeStorageGet(SPEED_KEY, '10'))
    let isAutomationMuted = safeStorageGet(MUTE_KEY) === 'true'

    let lastCurrentSlide = -1
    let initialSyncDone = false
    let lastSyncLogTime = 0
    let initialJumpTriggered = false
    let isSkipRequested = false
    let keepControlBarVisibleAfterRun = false

    const setAutomationPaused = (paused) => {
        isAutomationPaused = paused
        const bar = document.getElementById('automation-control-bar')
        if (bar) {
            bar.classList.toggle('paused', isAutomationPaused)
            const pauseBtn = bar.querySelector('#ac-pause-btn')
            if (pauseBtn) {
                pauseBtn.textContent = isAutomationPaused ? 'Resume' : 'Pause'
                pauseBtn.classList.toggle('paused', isAutomationPaused)
            }
        }
        console.log(
            `[Userscript] Automation ${isAutomationPaused ? 'PAUSED' : 'RESUMED'}`
        )
    }

    const showControlBar = (downloading) => {
        let bar = document.getElementById('automation-control-bar')
        if (bar) {
            bar.classList.remove('hidden')
            return
        }

        bar = document.createElement('div')
        bar.id = 'automation-control-bar'

        // Restore position
        const posStr = safeStorageGet(POS_KEY)
        if (posStr) {
            try {
                const pos = JSON.parse(posStr)
                bar.style.left = pos.x + 'px'
                bar.style.top = pos.y + 'px'
                bar.style.bottom = 'auto'
                bar.style.transform = 'none'
                bar.style.setProperty('--x', '0px')
            } catch (e) {}
        }

        bar.innerHTML = `
            <div class="ac-status">Initializing...</div>
            <div class="ac-input-group">
                <span class="ac-label">Delay (ms)</span>
                <input type="number" class="ac-input" id="ac-delay-input" value="${automationDelay}" min="0" step="50">
            </div>
            <div class="ac-input-group">
                <span class="ac-label">Speed (x)</span>
                <input type="number" class="ac-input" id="ac-speed-input" value="${automationSpeed}" min="0.1" max="16" step="0.1">
            </div>
            <div class="ac-input-group">
                <input type="checkbox" id="ac-dwell-check" ${useDwellTime ? 'checked' : ''}>
                <label for="ac-dwell-check" class="ac-label" title="Wait for duration/speed to satisfy progress tracking">Trick Progress</label>
            </div>
            <div class="ac-input-group">
                <input type="checkbox" id="ac-mute-check" ${isAutomationMuted ? 'checked' : ''}>
                <label for="ac-mute-check" class="ac-label">Mute</label>
            </div>
			<div class="ac-btn-group" style="display: flex; gap: 8px; align-items: center;">
                <button class="ac-btn" id="ac-skip-btn" style="background: #007aff; border-color: #007aff; color: white;">Skip</button>
                <button class="ac-btn" id="ac-pause-btn">Pause</button>
                <button class="ac-btn" id="ac-stop-btn" style="background: #cc2222; border-color: #990000;">Stop</button>
            </div>
        `

        const delayInput = bar.querySelector('#ac-delay-input')
        delayInput.addEventListener('change', (e) => {
            automationDelay = parseInt(e.target.value) || 0
            safeStorageSet(DELAY_KEY, automationDelay)
        })

        const speedInput = bar.querySelector('#ac-speed-input')
        speedInput.addEventListener('change', (e) => {
            automationSpeed = parseFloat(e.target.value) || 1.0
            safeStorageSet(SPEED_KEY, automationSpeed)
            console.log(
                `[Userscript] Automation speed updated to: ${automationSpeed}x`
            )

            // Apply immediately if automation is running
            if (isAutomationRunning) {
                const { el: audio } = findInIframes(window, 'audio#n')
                if (audio) {
                    audio.playbackRate = automationSpeed
                }
            }
        })

        const dllCheck = bar.querySelector('#ac-dwell-check')
        dllCheck.addEventListener('change', (e) => {
            useDwellTime = e.target.checked
            safeStorageSet(DWELL_KEY, useDwellTime)
            console.log(`[Userscript] Trick Progress mode: ${useDwellTime}`)
        })

        const muteCheck = bar.querySelector('#ac-mute-check')
        muteCheck.addEventListener('change', (e) => {
            isAutomationMuted = e.target.checked
            safeStorageSet(MUTE_KEY, isAutomationMuted)
            console.log(
                `[Userscript] Automation Mute state: ${isAutomationMuted}`
            )

            // If automation is running, immediately application the mute state to any existing audio element
            if (isAutomationRunning) {
                const { el: audio } = findInIframes(window, 'audio#n')
                if (audio) {
                    audio.muted = isAutomationMuted
                }
            }
        })

        const skipBtn = bar.querySelector('#ac-skip-btn')
        skipBtn.addEventListener('click', () => {
            isSkipRequested = true
            setAutomationPaused(false) // Ensure unpaused on skip
            scheduleForceResumeAutomationPlayback()
            console.log('[Userscript] Skip requested for current slide.')
        })

        const pauseBtn = bar.querySelector('#ac-pause-btn')
        pauseBtn.addEventListener('click', () => {
            setAutomationPaused(!isAutomationPaused)
        })

        const stopBtn = bar.querySelector('#ac-stop-btn')
        stopBtn.addEventListener('click', () => {
            console.log('[Userscript] Stopping automation and clearing state.')
            sessionStorage.removeItem(RUNNING_KEY)
            isAutomationRunning = false
            setAutomationPaused(false)
            hideControlBar()
        })

        document.body.appendChild(bar)

        // Handle dragging logic
        let isDragging = false
        let startX, startY, initialLeft, initialTop

        bar.addEventListener('mousedown', (e) => {
            // Don't drag if clicking inputs or buttons
            if (['INPUT', 'BUTTON', 'LABEL'].includes(e.target.tagName)) return

            isDragging = true
            startX = e.clientX
            startY = e.clientY
            const rect = bar.getBoundingClientRect()
            initialLeft = rect.left
            initialTop = rect.top
            bar.style.transition = 'none' // Disable transitions while dragging
            e.preventDefault()
        })

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return
            const dx = e.clientX - startX
            const dy = e.clientY - startY

            bar.style.left = initialLeft + dx + 'px'
            bar.style.top = initialTop + dy + 'px'
            bar.style.bottom = 'auto'
            bar.style.transform = 'none'
            bar.style.setProperty('--x', '0px')
        })

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false
                const rect = bar.getBoundingClientRect()
                safeStorageSet(
                    POS_KEY,
                    JSON.stringify({ x: rect.left, y: rect.top })
                )
                // Re-enable transitions for hidden state
                bar.style.transition = ''
            }
        })
    }

    let resumeScheduled = false
    const tryResumeAutomation = () => {
        if (isAutomationRunning || resumeScheduled) return
        const stateStr = sessionStorage.getItem(RUNNING_KEY)
        if (!stateStr) return

        try {
            const state = JSON.parse(stateStr)
            if (state && state.active) {
                console.log(`[Userscript] Resuming ${state.type} automation...`)
                resumeScheduled = true
                showControlBar(state.type === 'download')
                updateControlBarStatus('Resuming automation...')

                setTimeout(() => {
                    ;(async () => {
                        await waitForUrlSlideSync()
                        if (resumeScheduled && !isAutomationRunning) {
                            performAutomation(state.type === 'download').catch(
                                console.error
                            )
                        }
                    })().catch(console.error)
                }, 1500)
            }
        } catch (e) {
            sessionStorage.removeItem(RUNNING_KEY)
        }
    }

    const hideControlBar = () => {
        const bar = document.getElementById('automation-control-bar')
        if (bar) bar.classList.add('hidden')
    }

    const updateControlBarStatus = (text) => {
        const bar = document.getElementById('automation-control-bar')
        if (bar) {
            const status = bar.querySelector('.ac-status')
            if (status) status.textContent = text
        }
    }

    const waitIfPaused = async () => {
        while (isAutomationPaused && isAutomationRunning && !isSkipRequested) {
            await new Promise((r) => setTimeout(r, 200))
        }
    }

    // Capture target slide from URL once at the very beginning
    const urlParams = new URLSearchParams(window.location.search)
    const initialTargetSlide = urlParams.get('slide')
    const initialTargetNum = initialTargetSlide
        ? parseInt(initialTargetSlide)
        : null
    console.log(
        `[Userscript] Target slide from URL: ${initialTargetSlide || 'none'}`
    )

    /**
     * Updates the '?slide=n' parameter in the URL without reloading the page.
     */
    const updateUrlSlide = (slideNum) => {
        try {
            const url = new URL(window.location.href)
            if (url.searchParams.get('slide') !== String(slideNum)) {
                console.log(
                    `[Userscript] Updating URL parameter: ?slide=${slideNum}`
                )
                url.searchParams.set('slide', slideNum)
                window.history.replaceState({}, '', url.toString())
            }
        } catch (e) {
            console.error(
                '[Userscript] Failed to update URL slide parameter:',
                e
            )
        }
    }

    // --- Canvas Discovery & Utilities ---

    /**
     * Finds the main slide canvas by searching for an iframe with a URL containing '/Files/Slides/'
     * and looking for a canvas ('du', 'dw', or generic) inside it.
     */
    const findMainCanvas = (win) => {
        try {
            // 1. Check current window if it's a slide iframe
            if (win.location.href.includes('/Files/Slides/')) {
                const doc = win.document
                const canvas =
                    doc.getElementById('du') ||
                    doc.getElementById('dw') ||
                    doc.querySelector('canvas')
                if (canvas) return { el: canvas, doc: win.document }
            }

            // 2. Search iframes recursively
            const iframes = win.document.querySelectorAll('iframe')
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

            const iframes = win.document.querySelectorAll('iframe')
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

    const isAutomationActive = () => {
        if (typeof isAutomationRunning !== 'undefined' && isAutomationRunning)
            return true
        const stateStr = sessionStorage.getItem(RUNNING_KEY)
        if (!stateStr) return false
        try {
            const state = JSON.parse(stateStr)
            return state && state.active
        } catch (e) {
            return false
        }
    }

    const automationWantsPlayback = () =>
        isAutomationRunning && !isAutomationPaused && !isSkipRequested

    const patchedAutomationWindows = new WeakSet()
    let documentVisibilitySpoofInstalled = false

    const installDocumentVisibilitySpoof = () => {
        if (documentVisibilitySpoofInstalled) return
        documentVisibilitySpoofInstalled = true
        try {
            const hiddenDesc = Object.getOwnPropertyDescriptor(
                Document.prototype,
                'hidden'
            )
            const stateDesc = Object.getOwnPropertyDescriptor(
                Document.prototype,
                'visibilityState'
            )
            if (hiddenDesc?.get) {
                Object.defineProperty(Document.prototype, 'hidden', {
                    get() {
                        if (isAutomationActive()) return false
                        return hiddenDesc.get.call(this)
                    },
                    configurable: true,
                    enumerable: hiddenDesc.enumerable,
                })
            }
            if (stateDesc?.get) {
                Object.defineProperty(Document.prototype, 'visibilityState', {
                    get() {
                        if (isAutomationActive()) return 'visible'
                        return stateDesc.get.call(this)
                    },
                    configurable: true,
                    enumerable: stateDesc.enumerable,
                })
            }
        } catch (e) {
            console.warn(
                '[Userscript] Could not install document visibility spoof:',
                e
            )
        }
    }

    const getMediaPlayPauseButton = () =>
        findInIframes(window, '.mediaPlayer__playPause').el

    /** Paused UI: #togglePlay still has icon-play-button. */
    const clickPlayIfIconShowsPlay = () => {
        const { el: icon } = findInIframes(window, '#togglePlay')
        const { el: button } = findInIframes(
            window,
            'button.mediaPlayer__button--play'
        )
        if (icon?.classList.contains('icon-play-button') && button) {
            button.click()
        }
    }

    const isMediaPlayerUiPaused = () => {
        const { el: icon } = findInIframes(window, '#togglePlay')
        if (icon?.classList.contains('icon-play-button')) return true
        const playBtn = getMediaPlayPauseButton()
        if (!playBtn) return false
        const title = (playBtn.getAttribute('title') || '')
            .trim()
            .toLowerCase()
        return title === 'play'
    }

    const activateMediaPlayButton = (playBtn) => {
        if (!playBtn) return false
        const title = (playBtn.getAttribute('title') || '')
            .trim()
            .toLowerCase()
        if (title !== 'play') return false
        const doc = playBtn.ownerDocument
        const view = doc.defaultView || window
        try {
            playBtn.click()
        } catch (e) {}
        const rect = playBtn.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const opts = {
            view,
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
            button: 0,
        }
        ;['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(
            (type) => {
                playBtn.dispatchEvent(new MouseEvent(type, opts))
            }
        )
        return true
    }

    const clickMediaPlayButton = () => {
        const playBtn = getMediaPlayPauseButton()
        return activateMediaPlayButton(playBtn)
    }

    const isSlidePlaybackPaused = (audio) => {
        if (isMediaPlayerUiPaused()) return true
        if (!audio) return false
        return audio.paused
    }

    const clickCanvasToPlay = (canvas, canvasDoc) => {
        if (!canvas || !canvasDoc) return false
        const rect = canvas.getBoundingClientRect()
        const clickOpts = {
            view: canvasDoc.defaultView || window,
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 0,
        }
        canvas.dispatchEvent(new MouseEvent('mousedown', clickOpts))
        canvas.dispatchEvent(new MouseEvent('mouseup', clickOpts))
        canvas.dispatchEvent(new MouseEvent('click', clickOpts))
        return true
    }

    const forceResumeAutomationPlayback = () => {
        if (!automationWantsPlayback()) return
        clickPlayIfIconShowsPlay()
    }

    const scheduleForceResumeAutomationPlayback = () => {
        forceResumeAutomationPlayback()
        setTimeout(forceResumeAutomationPlayback, 0)
        setTimeout(forceResumeAutomationPlayback, 50)
        setTimeout(forceResumeAutomationPlayback, 200)
        setTimeout(forceResumeAutomationPlayback, 600)
    }

    const ensureAutomationSlidePlayback = (audio, canvasDoc = null) => {
        if (!automationWantsPlayback()) return
        if (!isSlidePlaybackPaused(audio)) return
        forceResumeAutomationPlayback()
    }

    let automationPlaybackWatchdogId = null

    const stopAutomationPlaybackWatchdog = () => {
        if (automationPlaybackWatchdogId != null) {
            clearInterval(automationPlaybackWatchdogId)
            automationPlaybackWatchdogId = null
        }
    }

    const patchAutomationFocusGuards = (win) => {
        if (!win || patchedAutomationWindows.has(win)) return
        try {
            patchedAutomationWindows.add(win)
            const doc = win.document

            const onVisibilityOrFocus = () => {
                if (!isAutomationActive()) return
                scheduleForceResumeAutomationPlayback()
            }
            doc.addEventListener('visibilitychange', onVisibilityOrFocus, true)
            win.addEventListener('blur', onVisibilityOrFocus, true)
            win.addEventListener('focus', onVisibilityOrFocus, true)
            win.addEventListener('pageshow', onVisibilityOrFocus, true)
            win.addEventListener('pagehide', onVisibilityOrFocus, true)

            doc.querySelectorAll('iframe').forEach((iframe) => {
                try {
                    if (iframe.contentWindow) {
                        patchAutomationFocusGuards(iframe.contentWindow)
                    }
                } catch (e) {}
            })
        } catch (e) {}
    }

    const startAutomationPlaybackWatchdog = () => {
        stopAutomationPlaybackWatchdog()
        installDocumentVisibilitySpoof()
        patchAutomationFocusGuards(window)
        const tick = () => {
            if (!automationWantsPlayback()) return
            clickPlayIfIconShowsPlay()
        }
        tick()
        automationPlaybackWatchdogId = setInterval(tick, 1000)
    }

    if (window.self === window.top) {
        installDocumentVisibilitySpoof()
        patchAutomationFocusGuards(window)
    }

    const isPlayerBuffering = (canvasDoc = null) => {
        const search = (root) => {
            if (!root) return false
            const loadDiv =
                root.querySelector && root.querySelector('#loading')
            if (loadDiv && loadDiv.style.display !== 'none') return true
            const target = root.body || root
            const txt =
                target && target.innerText
                    ? target.innerText.toLowerCase()
                    : ''
            if (txt.includes('buffer')) return true
            const clock =
                root.querySelector &&
                root.querySelector('.current-time')
            if (
                clock &&
                (clock.textContent.includes('N/A') ||
                    clock.textContent === '0:00')
            )
                return true
            const all = root.querySelectorAll ? root.querySelectorAll('*') : []
            for (const el of all) {
                if (el.shadowRoot && search(el.shadowRoot)) return true
            }
            return false
        }
        if (search(document)) return true
        if (canvasDoc && search(canvasDoc)) return true
        const iframes = document.querySelectorAll('iframe')
        for (const f of iframes) {
            try {
                if (f.contentDocument && search(f.contentDocument)) return true
            } catch (e) {}
        }
        return false
    }

    const tryResumeAutomationPlayback = (audio, canvasDoc = null) => {
        if (!automationWantsPlayback()) return
        if (isPlayerBuffering(canvasDoc)) return
        if (isSlidePlaybackPaused(audio)) {
            ensureAutomationSlidePlayback(audio, canvasDoc)
        }
    }

    const scheduleResumeAutomationPlayback = (audio, canvasDoc = null) => {
        tryResumeAutomationPlayback(audio, canvasDoc)
        setTimeout(() => tryResumeAutomationPlayback(audio, canvasDoc), 150)
        setTimeout(() => tryResumeAutomationPlayback(audio, canvasDoc), 600)
        setTimeout(() => tryResumeAutomationPlayback(audio, canvasDoc), 1500)
        scheduleForceResumeAutomationPlayback()
    }

    const injectAutomationPlaybackGuard = (audio) => {
        if (!audio || audio._playbackGuardInjected) return
        audio._playbackGuardInjected = true
        const resumeFromEvent = () => {
            scheduleForceResumeAutomationPlayback()
        }
        audio.addEventListener('pause', resumeFromEvent)
        audio.addEventListener('stalled', () =>
            setTimeout(resumeFromEvent, 250)
        )
        audio.addEventListener('canplay', resumeFromEvent)
        audio.addEventListener('suspend', resumeFromEvent)
        audio.addEventListener('waiting', () =>
            setTimeout(resumeFromEvent, 300)
        )
        audio.addEventListener('play', () => {
            if (isAutomationRunning && isAutomationPaused) {
                console.log(
                    '[Userscript] Audio PLAY detected - syncing automation state.'
                )
                setAutomationPaused(false)
            }
        })
    }

    const applyDarkMode = () => {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (!isDark) return

        // 1. Target the canvas specifically inside its iframe
        const { el: canvas, doc: canvasDoc } = findMainCanvas(window)
        if (canvas && !canvas.dataset.darkModeApplied) {
            console.log(
                '[Userscript] Applying dark mode filter to the main slide canvas.'
            )
            canvas.style.filter = 'invert(1) hue-rotate(180deg) contrast(0.9)'
            canvas.dataset.darkModeApplied = 'true'
            if (canvasDoc && canvasDoc.body) {
                canvasDoc.body.style.backgroundColor = 'black'
                canvasDoc.body.style.color = '#ececec'
            }
        }

        // 2. Recursive Iframe Dark Mode Injection
        injectStylesRecursive(window, 'userscript-dm-overlay', DARK_MODE_CSS)
    }

    const playCanvas = () => {
        console.log('[Userscript] [playCanvas] Triggered.')
        const { el: canvas, doc: canvasDoc } = findMainCanvas(window)
        if (canvas && canvasDoc) {
            clickCanvasToPlay(canvas, canvasDoc)
            console.log('[Userscript] [playCanvas] Click sequence dispatched.')
        } else {
            console.warn(
                '[Userscript] [playCanvas] FAILED: Could not find canvas in any iframe.'
            )
        }
    }

    const syncSlideState = () => {
        const { el: slideIndicator } = findInIframes(
            window,
            'button.mediaPlayer__button--showslides'
        )

        // Periodic status log (every 10s if not finding anything)
        const now = Date.now()
        if (!slideIndicator) {
            if (now - lastSyncLogTime > 10000) {
                console.log(
                    '[Userscript] [syncSlideState] Still searching for slide indicator...'
                )
                lastSyncLogTime = now
            }
            return
        }

        const text = slideIndicator.textContent.trim()
        const match = text.match(/Slide (\d+) of (\d+)/i)
        if (!match) {
            if (now - lastSyncLogTime > 10000) {
                console.log(
                    `[Userscript] [syncSlideState] Found indicator but text doesn't match: "${text}"`
                )
                lastSyncLogTime = now
            }
            return
        }

        const currentSlide = parseInt(match[1])

        // Perform initial sync verification
        if (!initialSyncDone && initialTargetNum) {
            if (currentSlide === initialTargetNum) {
                console.log(
                    `[Userscript] [syncSlideState] Target reached (${currentSlide}). Initial sync COMPLETE.`
                )
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
            updateUrlSlide(currentSlide)
        }

        // Handle playback on slide change (excluding automation and initial load jump)
        if (currentSlide !== lastCurrentSlide) {
            console.log(
                `[Userscript] [syncSlideState] SLIDE CHANGE DETECTED: ${lastCurrentSlide} -> ${currentSlide}`
            )
            lastCurrentSlide = currentSlide

            // Only trigger auto-play if we are finished with initial navigation
            if (
                !isAutomationRunning &&
                !isAutomationActive() &&
                initialSyncDone
            ) {
                console.log(
                    '[Userscript] [syncSlideState] Triggering auto-playback sequence in 1.5s...'
                )
                setTimeout(() => {
                    if (!isAutomationRunning) {
                        console.log(
                            '[Userscript] [syncSlideState] Executing delayed playCanvas call...'
                        )
                        playCanvas()
                    } else {
                        console.log(
                            '[Userscript] [syncSlideState] Automation running, skipping auto-playback.'
                        )
                    }
                }, 1500)
            } else if (!initialSyncDone) {
                console.log(
                    '[Userscript] [syncSlideState] Slide found, but initial sync jump is still pending. Skipping playback for now.'
                )
            }
        }
    }

    const getCurrentSlideFromUi = () => {
        const { el: slideIndicator } = findInIframes(
            window,
            'button.mediaPlayer__button--showslides'
        )
        if (!slideIndicator) return null
        const match = slideIndicator.textContent
            .trim()
            .match(/Slide (\d+) of (\d+)/i)
        return match ? parseInt(match[1], 10) : null
    }

    /** ?slide= in URL is source of truth; automation must not run until this completes. */
    const waitForUrlSlideSync = async (maxMs = 15000) => {
        const target = initialTargetNum
        if (!target) {
            initialSyncDone = true
            return
        }

        if (initialSyncDone && getCurrentSlideFromUi() === target) return

        if (initialSyncDone && getCurrentSlideFromUi() !== target) {
            initialSyncDone = false
            initialJumpTriggered = false
        }

        const start = Date.now()
        while (Date.now() - start < maxMs) {
            const cur = getCurrentSlideFromUi()
            if (cur === target) {
                initialSyncDone = true
                lastCurrentSlide = cur
                console.log(
                    `[Userscript] URL slide sync complete: slide ${target}`
                )
                return
            }
            performInitialSync()
            await new Promise((r) => setTimeout(r, 250))
        }
        console.warn('[Userscript] URL slide sync timed out; continuing anyway.')
        initialSyncDone = true
    }

    const performInitialSync = () => {
        if (initialSyncDone || initialJumpTriggered) return

        if (!initialTargetNum) {
            initialSyncDone = true
            return
        }

        const { el: slidesList } = findInIframes(window, '#slidesList')
        if (!slidesList) return // Retry on next driver iteration

        console.log(
            `[Userscript] [performInitialSync] Attempting to navigate to Slide ${initialTargetNum}`
        )
        const links = Array.from(slidesList.querySelectorAll('li a'))
        if (links.length === 0) return

        // 1. Precise text-based search (e.g., "Page 12")
        let linkToClick = links.find((a) => {
            const txt = (a.getAttribute('title') || a.textContent || '')
                .trim()
                .toLowerCase()
            return (
                txt === `page ${initialTargetNum}` ||
                txt === String(initialTargetNum)
            )
        })

        // 2. Handle "Last Page" specifically if the target matches total known slides
        if (!linkToClick) {
            const { el: ind } = findInIframes(
                window,
                'button.mediaPlayer__button--showslides'
            )
            const totalMatch = ind ? ind.textContent.match(/of (\d+)/i) : null
            if (totalMatch && initialTargetNum === parseInt(totalMatch[1])) {
                linkToClick = links.find((a) =>
                    (a.getAttribute('title') || a.textContent || '')
                        .toLowerCase()
                        .includes('last')
                )
            }
        }

        // 3. Positional fallback
        if (!linkToClick) {
            console.log(
                '[Userscript] [performInitialSync] No text match. Using index-based selection.'
            )
            linkToClick = links[initialTargetNum - 1]
        }

        if (linkToClick) {
            const label = (
                linkToClick.getAttribute('title') ||
                linkToClick.textContent ||
                ''
            ).trim()
            console.log(
                `[Userscript] [performInitialSync] EXPLICIT CLICK: Link for Slide ${initialTargetNum} ("${label}")`
            )
            console.log(
                `[Userscript] [performInitialSync] Target HTML: ${linkToClick.outerHTML}`
            )

            initialJumpTriggered = true
            linkToClick.click()

            // Safety timeout: If we don't arrive at target in 5s, release the lock
            setTimeout(() => {
                if (!initialSyncDone) {
                    console.warn(
                        '[Userscript] [performInitialSync] Jump timeout! Releasing initialSync lock.'
                    )
                    initialSyncDone = true
                }
            }, 5000)
        } else {
            console.warn(
                `[Userscript] [performInitialSync] CRITICAL: Could not find any suitable link for Slide ${initialTargetNum}`
            )
            initialSyncDone = true
        }
    }

    const moveCornerMenu = () => {
        const { el: controls, doc: controlsDoc } = findInIframes(
            window,
            '.mediaPlayer__controls'
        )
        const { el: cornerMenu } = findInIframes(window, '.cornerMenu')

        if (controls && cornerMenu && cornerMenu.parentNode !== controls) {
            console.log(
                '[Userscript] Moving cornerMenu into mediaPlayer__controls'
            )
            // Insert before rewind button if it exists, otherwise append
            const rewindBtn = controls.querySelector(
                '.mediaPlayer__button--rewind'
            )
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
            console.log(
                `[Userscript] Modifier Keydown: code=${e.code}, alt=${e.altKey}, meta=${e.metaKey}, ctrl=${e.ctrlKey}, key=${e.key}`
            )
        }

        const isInput =
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) ||
            e.target.isContentEditable
        if (isInput) return

        // Space for Play/Pause
        if (e.code === 'Space') {
            e.preventDefault()
            const { el: playBtn } = findInIframes(
                window,
                '.mediaPlayer__playPause'
            )
            if (playBtn) {
                console.log(
                    '[Userscript] Space pressed: clicking play/pause button'
                )
                playBtn.click()
            } else {
                console.log(
                    '[Userscript] Space pressed: play/pause button not found, falling back to canvas'
                )
                playCanvas()
            }
        }

        // Left/Right arrows for Seek (5s)
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            const { el: audio } = findInIframes(window, 'audio#n')
            if (audio) {
                e.preventDefault()
                const delta = e.code === 'ArrowLeft' ? -5 : 5
                const newTime = Math.max(
                    0,
                    Math.min(
                        audio.duration || Infinity,
                        audio.currentTime + delta
                    )
                )
                audio.currentTime = newTime
                console.log(
                    `[Userscript] ${e.code} pressed: seeking to ${newTime.toFixed(2)}s`
                )

                // Sync seekbar if possible
                const { el: seekbar } = findInIframes(window, 'input#seekbar')
                if (seekbar) {
                    // Audio might be in one iframe, seekbar in another
                    seekbar.value = newTime
                    seekbar.dispatchEvent(new Event('input', { bubbles: true }))
                    seekbar.dispatchEvent(
                        new Event('change', { bubbles: true })
                    )
                }
            }
        }

        // 'y' key for "Yes" button
        if (
            (e.code === 'KeyY' || e.key === 'Enter') &&
            !e.altKey &&
            !e.metaKey &&
            !e.ctrlKey
        ) {
            let yesBtnRes = findInIframes(
                window,
                '.questionSlide__button--correctNoSolution'
            )
            if (!yesBtnRes.el) {
                yesBtnRes = findInIframes(
                    window,
                    '.questionSlide__button--correct'
                )
            }
            const yesBtn = yesBtnRes.el

            if (yesBtn) {
                e.preventDefault()
                console.log("[Userscript] 'y' pressed: clicking Yes button")

                // Dispatch sequence to guarantee framework catches it
                const clickOpts = {
                    bubbles: true,
                    cancelable: true,
                    detail: 999,
                }
                yesBtn.dispatchEvent(new MouseEvent('mousedown', clickOpts))
                yesBtn.dispatchEvent(new MouseEvent('mouseup', clickOpts))
                yesBtn.dispatchEvent(new MouseEvent('click', clickOpts))
            }
        }

        // Use e.code for physical key detection (KeyD) which is more reliable than e.key with modifiers
        if (e.altKey && e.code === 'KeyD') {
            console.log('[Userscript] Opt+D Trigger Match Found!')
            e.preventDefault()
            e.stopPropagation()

            if (isAutomationRunning) {
                console.warn('[Userscript] Automation is already running.')
                return
            }

            if (confirm('Start Canvas Capture Automation?')) {
                console.log(
                    '[Userscript] Starting Canvas Capture Automation...'
                )
                startAutomation().catch(console.error)
            }
        }

        if (e.altKey && e.code === 'KeyS') {
            console.log('[Userscript] Opt+S Trigger Match Found!')
            e.preventDefault()
            e.stopPropagation()

            if (isAutomationRunning) {
                console.warn('[Userscript] Automation is already running.')
                return
            }

            if (confirm('Start Canvas Skipping Automation?')) {
                console.log(
                    '[Userscript] Starting Canvas Skipping Automation...'
                )
                startSkippingAutomation().catch(console.error)
            }
        }
    }

    const setupKeydownListeners = (win) => {
        try {
            if (!win) return

            if (!win._keydownInjected) {
                win._keydownInjected = true
                win.addEventListener('keydown', onKeydown, true)
                console.log(
                    `[Userscript] Keydown listener injected into: ${win.location.href}`
                )
            }

            const doc = win.document
            if (!doc) return

            const iframes = doc.querySelectorAll('iframe')
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
        applyDarkMode()
        applyLayout()
        setupKeydownListeners(window)

        // Only run active UI and automation logic in the top-level window
        if (window.self === window.top) {
            addCustomButtons()
            addAutoShowCheckbox()
            attemptAutoShowAnswer()
            syncSlideState()
            performInitialSync()
            setupPrintChaining()
            moveCornerMenu()
            tryResumeAutomation()
        }
    }

    const observer = new MutationObserver(drive)
    observer.observe(document.body, { childList: true, subtree: true })
    setInterval(drive, 1000) // Poll every 1s to catch iframe changes that observer miss

    // Initial call
    uncheckAllAnswers()
    drive()

    // Canvas Capture Automation logic below
    // (Listeners now managed recursively in setupKeydownListeners)

    const UNIT_EXCLUDES = ['overview', 'project', 'exam', 'review', 'midterm']
    const LESSON_EXCLUDES = [
        'quiz',
        'test',
        'assignment',
        'review',
        'exam',
        'project',
    ]

    function getIndexInList(listSelector, titleValue, excludeKeywords = []) {
        const { el: list } = findInIframes(window, listSelector)
        if (!list) return ''

        const anchors = Array.from(list.querySelectorAll('li a'))
        let index = 1

        for (const a of anchors) {
            const itemText = (a.getAttribute('title') || a.textContent).trim()

            const shouldExclude = excludeKeywords.some((kw) =>
                itemText.toLowerCase().includes(kw.toLowerCase())
            )
            if (shouldExclude) continue

            const itemTextClean = itemText.replace(/\s+/g, ' ')
            const titleValueClean = titleValue.replace(/\s+/g, ' ')

            if (
                itemTextClean === titleValueClean ||
                titleValueClean.includes(itemTextClean)
            ) {
                return index
            }
            index++
        }
        return ''
    }

    function getNextLessonLink(currentLessonTitleRaw, excludeKeywords = []) {
        const { el: list } = findInIframes(window, '#lessonsList')
        if (!list) return null

        const anchors = Array.from(list.querySelectorAll('li a'))
        let currentClean = currentLessonTitleRaw
            .replace(/\s+/g, ' ')
            .toLowerCase()
        let foundCurrent = false

        for (const a of anchors) {
            const itemText = (a.getAttribute('title') || a.textContent).trim()
            const shouldExclude = excludeKeywords.some((kw) =>
                itemText.toLowerCase().includes(kw.toLowerCase())
            )

            const itemTextClean = itemText.replace(/\s+/g, ' ').toLowerCase()

            if (!foundCurrent) {
                if (
                    itemTextClean === currentClean ||
                    currentClean.includes(itemTextClean)
                ) {
                    foundCurrent = true
                }
                continue
            }

            if (shouldExclude) continue

            // First non-excluded item after current is the next lesson
            return a
        }
        return null
    }

    function getMetadata() {
        const clean = (selector) => {
            const { el } = findInIframes(window, selector)
            if (!el) return ''
            return el.textContent
                .replace(/\s*\([^)]*\)/g, '') // Remove (Lauzon) etc. anywhere
                .replace(/\s+/g, ' ') // Collapse whitespace
                .trim()
        }

        const unitTitleRaw = (() => {
            const { el } = findInIframes(window, '#UnitTitle')
            return el ? el.textContent.trim() : ''
        })()

        const lessonTitleRaw = (() => {
            const { el } = findInIframes(window, '#LessonTitle')
            return el ? el.textContent.trim() : ''
        })()

        return {
            course: clean('#CourseTitle') || 'Course',
            unit: clean('#UnitTitle') || 'Unit',
            lesson: clean('#LessonTitle') || 'Lesson',
            unitIndex: unitTitleRaw
                ? getIndexInList('#unitsList', unitTitleRaw, UNIT_EXCLUDES)
                : '',
            lessonIndex: lessonTitleRaw
                ? getIndexInList(
                      '#lessonsList',
                      lessonTitleRaw,
                      LESSON_EXCLUDES
                  )
                : '',
        }
    }

    function getLessonPrintStorageKey(meta) {
        return (
            LESSON_PRINT_DONE_PREFIX +
            [location.pathname, meta.course, meta.unit, meta.lesson].join('|')
        )
    }

    function parseSlideBarWidthPercent(barEl) {
        if (!barEl) return 0
        const style = barEl.getAttribute('style') || ''
        const m = style.match(/width:\s*([\d.]+)%/i)
        if (m) return parseFloat(m[1])
        const w = barEl.style.width
        if (w && w.endsWith('%')) return parseFloat(w)
        return 0
    }

    function collectSlideItemsFromDom() {
        const { el: slidesRoot } = findInIframes(window, '.slides')
        if (!slidesRoot) return []
        return Array.from(slidesRoot.querySelectorAll('ul > li.slide'))
    }

    function slideIndexFromLi(li) {
        const title = li.querySelector('h3.slide__title')
        if (!title) return null
        const m = title.textContent.match(/Slide\s+(\d+)\s+of\s+(\d+)/i)
        return m ? parseInt(m[1], 10) : null
    }

    async function ensureSlidesPanelReady() {
        let items = collectSlideItemsFromDom()
        if (items.length > 0) return items
        const { el: showBtn } = findInIframes(
            window,
            'button.mediaPlayer__button--showslides'
        )
        if (showBtn) {
            showBtn.click()
            await new Promise((r) => setTimeout(r, 400))
            items = collectSlideItemsFromDom()
        }
        return items
    }

    async function getSlideProgressReportAsync(totalSlides) {
        const items = await ensureSlidesPanelReady()
        const all = []
        for (const li of items) {
            const slide = slideIndexFromLi(li)
            if (slide == null) continue
            const bar = li.querySelector('span.slide__bar')
            all.push({ slide, percent: parseSlideBarWidthPercent(bar) })
        }
        const contentSlides = all.filter(
            (s) => s.slide >= 1 && s.slide <= totalSlides - 1
        )
        const failing = contentSlides.filter(
            (s) => s.percent < SLIDE_PROGRESS_MIN_PERCENT
        )
        const ok =
            contentSlides.length === 0 || failing.length === 0
        return { ok, failing, all: contentSlides }
    }

    function formatIncompleteProgressMessage(failing) {
        const parts = failing
            .sort((a, b) => a.slide - b.slide)
            .map((s) => {
                const pct =
                    s.percent % 1 === 0
                        ? String(s.percent)
                        : s.percent.toFixed(1)
                return `slide ${s.slide} (${pct}%)`
            })
        let msg = `Incomplete progress: ${parts.join(', ')} need ≥${SLIDE_PROGRESS_MIN_PERCENT}%`
        if (msg.length > 500) {
            msg =
                `Incomplete progress: ${failing.length} slides below ${SLIDE_PROGRESS_MIN_PERCENT}% — ` +
                parts.slice(0, 8).join(', ') +
                (parts.length > 8 ? '…' : '')
        }
        return msg
    }

    async function triggerCornerPrintOnce(meta) {
        const key = getLessonPrintStorageKey(meta)
        if (safeStorageGet(key) === 'true') {
            console.log('[Userscript] Lesson print already done, skipping.')
            return false
        }
        const printBtn = findInIframes(
            window,
            'ul.cornerMenu a[title="Print"]'
        ).el
        if (printBtn) {
            updateControlBarStatus('Downloading Notes...')
            console.log(
                '[Userscript] Incomplete progress — triggering one-time Notes download.'
            )
            printBtn.click()
            safeStorageSet(key, 'true')
            await new Promise((r) => setTimeout(r, 1500))
            return true
        }
        return false
    }

    async function finishLessonWithProgressGate(meta, totalSlides) {
        const report = await getSlideProgressReportAsync(totalSlides)
        console.log('[Userscript] Slide progress report:', report)

        if (report.ok) {
            updateControlBarStatus('Lesson Complete!')

            const printBtn = findInIframes(
                window,
                'ul.cornerMenu a[title="Print"]'
            ).el
            const practiceBtn = findInIframes(
                window,
                'ul.cornerMenu a[title="Practice"]'
            ).el

            if (printBtn) {
                updateControlBarStatus('Downloading Notes...')
                console.log(
                    '[Userscript] Lesson complete. Triggering Notes download.'
                )
                printBtn.click()
                await new Promise((r) => setTimeout(r, 1500))
            }

            if (practiceBtn) {
                updateControlBarStatus('Going to Practice...')
                console.log(
                    '%cLesson complete. Clicking Practice link.',
                    'color: #ff3385; font-weight: bold;'
                )
                practiceBtn.click()
            } else {
                updateControlBarStatus('Practice link not found.')
                console.warn(
                    '[Userscript] Could not find Practice link to click.'
                )
            }

            updateControlBarStatus('Finished!')
            console.log('Automation complete.')
        } else {
            keepControlBarVisibleAfterRun = true
            await triggerCornerPrintOnce(meta)
            updateControlBarStatus(
                formatIncompleteProgressMessage(report.failing)
            )
            console.warn(
                '[Userscript] Lesson incomplete — not navigating to Practice.',
                report.failing
            )
        }
        sessionStorage.removeItem(RUNNING_KEY)
    }

    async function performAutomation(downloadSlides = true) {
        await waitForUrlSlideSync()

        keepControlBarVisibleAfterRun = false
        isAutomationRunning = true
        isAutomationPaused = false
        resumeScheduled = false
        startAutomationPlaybackWatchdog()
        showControlBar(downloadSlides)
        sessionStorage.setItem(
            RUNNING_KEY,
            JSON.stringify({
                active: true,
                type: downloadSlides ? 'download' : 'skip',
            })
        )

        // Sync UI with current state
        const muteCheck = document.getElementById('ac-mute-check')
        if (muteCheck) muteCheck.checked = isAutomationMuted

        try {
            updateControlBarStatus('Loading Metadata...')
            console.log('Waiting for metadata elements to load...')
            let meta = { course: 'Course', unit: 'Unit', lesson: 'Lesson' }

            // Fast poll for metadata (50ms interval)
            for (let i = 0; i < 60; i++) {
                const found = getMetadata()
                if (found.course !== 'Course' || found.unit !== 'Unit') {
                    meta = found
                    break
                }
                await new Promise((r) => setTimeout(r, 50))
            }

            console.log('Metadata detected:', meta)

            while (true) {
                isSkipRequested = false
                await waitIfPaused()
                let canvas, canvasDoc, seekbar, nextBtn, slideIndicator, audio
                let retryCount = 0
                updateControlBarStatus('Searching Elements...')
                while (retryCount < 20) {
                    const canvasRes = findMainCanvas(window)
                    canvas = canvasRes.el
                    canvasDoc = canvasRes.doc
                    seekbar = findInIframes(window, 'input#seekbar').el
                    nextBtn = findInIframes(
                        window,
                        'button.mediaPlayer__button--forward'
                    ).el
                    slideIndicator = findInIframes(
                        window,
                        'button.mediaPlayer__button--showslides'
                    ).el
                    audio = findInIframes(window, 'audio#n').el

                    if (canvas && seekbar && audio) {
                        if (isAutomationMuted) audio.muted = true

                        injectAutomationPlaybackGuard(audio)
                        break
                    }
                    retryCount++
                    await new Promise((r) => setTimeout(r, 500))
                }

                if (!canvas || !seekbar || !audio) {
                    console.warn(
                        'Required elements (canvas, seekbar, or audio) not found. Stopping.'
                    )
                    break
                }

                // Apply mute state immediately if requested
                if (isAutomationMuted) {
                    audio.muted = true
                }

                const slideText = slideIndicator
                    ? slideIndicator.textContent.trim()
                    : ''
                const match = slideText.match(/Slide (\d+) of (\d+)/i)
                const currentSlide = match ? parseInt(match[1]) : 1
                const totalSlides = match ? parseInt(match[2]) : 1

                if (initialSyncDone || !initialTargetNum) {
                    updateUrlSlide(currentSlide)
                }

                const actionText = downloadSlides ? 'Capturing' : 'Skipping'
                updateControlBarStatus(`${actionText} ${slideText}...`)
                console.log(
                    `%cProcessing ${slideText}...`,
                    'color: #00ff00; font-weight: bold; font-size: 14px;'
                )

                // --- FLIGHT RECORDER START ---
                const flightLog = []
                const slideStartTime = Date.now()
                const recorder = (msg, extra = {}) => {
                    const timestamp = (
                        (Date.now() - slideStartTime) /
                        1000
                    ).toFixed(3)
                    flightLog.push({
                        T: timestamp,
                        Task: msg,
                        Ready: audio.readyState,
                        Time: audio.currentTime.toFixed(2),
                        Max: seekbar.max,
                        ...extra,
                    })
                }

                const checkLoadingState = () => isPlayerBuffering(canvasDoc)

                const events = [
                    'waiting',
                    'seeking',
                    'seeked',
                    'playing',
                    'pause',
                    'canplay',
                    'stalled',
                    'error',
                ]
                const handlers = events.map((evt) => {
                    const h = () =>
                        recorder(`EVENT: ${evt}`, { buf: checkLoadingState() })
                    audio.addEventListener(evt, h)
                    return { evt, h }
                })

                // Force mute persistence via listener
                const forceMute = () => {
                    if (isAutomationMuted && !audio.muted) {
                        audio.muted = true
                    }
                }
                audio.addEventListener('volumechange', forceMute)
                handlers.push({ evt: 'volumechange', h: forceMute })
                const pollId = setInterval(
                    () => recorder('POLL', { buf: checkLoadingState() }),
                    100
                )
                // --- FLIGHT RECORDER END ---

                // 2. Start playback
                recorder('CLICK TO PLAY')
                const rect = canvas.getBoundingClientRect()
                const clickOpts = {
                    view: canvasDoc.defaultView || window,
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    button: 0,
                }
                canvas.dispatchEvent(new MouseEvent('mousedown', clickOpts))
                canvas.dispatchEvent(new MouseEvent('mouseup', clickOpts))
                canvas.dispatchEvent(new MouseEvent('click', clickOpts))

                // Explicitly call play() to ensure autoplay even if canvas click didn't trigger it
                audio.play().catch(() => {})

                // 3a. Wait for initial readiness and setup trickery
                recorder('WAITING FOR INITIAL READY')
                for (let i = 0; i < 100; i++) {
                    if (isAutomationMuted) audio.muted = true
                    tryResumeAutomationPlayback(audio, canvasDoc)
                    if (audio.readyState >= 3 && !checkLoadingState()) break
                    await new Promise((r) => setTimeout(r, 100))
                }

                if (useDwellTime) {
                    console.log(
                        `[Userscript] Setting playbackRate to ${automationSpeed}x for progress tricking.`
                    )
                    audio.playbackRate = automationSpeed
                }

                // NOTE: requiredDwellMs is computed dynamically each poll tick so
                // speed/delay changes take effect immediately.
                const audioDuration = audio.duration || 0
                const slideStartTimeActual = Date.now()

                // 3b. Wait for seekbar.max to be stable
                recorder('WAITING FOR MAX STABILITY')
                let lastMax = ''
                let maxStable = 0
                for (let i = 0; i < 60; i++) {
                    tryResumeAutomationPlayback(audio, canvasDoc)
                    const currentMax = seekbar.max
                    if (
                        currentMax &&
                        parseFloat(currentMax) > 0 &&
                        currentMax === lastMax
                    ) {
                        maxStable++
                        if (maxStable >= 3) break
                    } else {
                        maxStable = 0
                        lastMax = currentMax
                    }
                    await new Promise((r) => setTimeout(r, 100))
                }

                // 3c. Seek to end (if downloading, we do this immediately to get the frame)
                if (downloadSlides) {
                    recorder('SEEKING TO END FOR CAPTURE')
                    await new Promise((resolve) => {
                        const onSeeked = () => {
                            audio.removeEventListener('seeked', onSeeked)
                            recorder('SEEKED SIGNAL RECEIVED')
                            resolve()
                        }
                        audio.addEventListener('seeked', onSeeked)
                        seekbar.value = seekbar.max
                        try {
                            seekbar.valueAsNumber = parseFloat(seekbar.max)
                        } catch (e) {}
                        const seekEvents = [
                            'input',
                            'change',
                            'mousedown',
                            'mouseup',
                            'pointerdown',
                            'pointerup',
                        ]
                        seekEvents.forEach((type) =>
                            seekbar.dispatchEvent(
                                new Event(type, { bubbles: true })
                            )
                        )
                        setTimeout(() => {
                            audio.removeEventListener('seeked', onSeeked)
                            resolve()
                        }, 4000)
                    })
                }

                if (downloadSlides) {
                    // 3d. Stability Probe: Wait for Canvas to stop changing (Anti-Spinner)
                    recorder('STABILITY PROBE START')
                    let lastFrame = ''
                    let stableFrames = 0
                    for (let i = 0; i < 50; i++) {
                        await waitIfPaused()
                        tryResumeAutomationPlayback(audio, canvasDoc)

                        // Ensure mute persistence
                        if (isAutomationMuted) {
                            audio.muted = true
                        }

                        const currentFrame = canvas.toDataURL('image/png', 0.1) // Low quality for speed
                        const isBuffering = checkLoadingState()
                        const isAnimating = currentFrame !== lastFrame

                        recorder(`PROBE ${i}`, {
                            buf: isBuffering,
                            anim: isAnimating,
                        })

                        if (!isBuffering && !isAnimating && i > 3) {
                            stableFrames++
                            if (stableFrames >= 3) {
                                recorder('STABILITY REACHED')
                                break
                            }
                        } else {
                            stableFrames = 0
                        }
                        lastFrame = currentFrame
                        await new Promise((r) => setTimeout(r, 400))
                    }
                    recorder('STABILITY PROBE END')

                    // 3e. Final render buffer
                    recorder('FINAL RENDER DELAY')
                    await new Promise((r) =>
                        requestAnimationFrame(() => setTimeout(r, 300))
                    )

                    // 4. Download
                    recorder('CAPTURE & DOWNLOAD')
                    const dataURL = canvas.toDataURL('image/png')
                    const link = document.createElement('a')
                    const uStr = meta.unitIndex ? `U${meta.unitIndex} ` : ''
                    const lStr = meta.lessonIndex ? `L${meta.lessonIndex} ` : ''
                    const filename = `${meta.course} - ${uStr}${meta.unit} - ${lStr}${meta.lesson} - S${currentSlide}.png`
                    link.download = filename
                    link.href = dataURL
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                }

                // CLEANUP RECORDER
                clearInterval(pollId)
                handlers.forEach(({ evt, h }) =>
                    audio.removeEventListener(evt, h)
                )
                console.log(
                    `%cFlight Log for Slide ${currentSlide}:`,
                    'color: #00ffff; font-weight: bold;'
                )
                console.table(flightLog)

                // Calculate remaining dwell time.
                // requiredDwellMs is re-evaluated each tick so speed/delay
                // changes from the control bar apply immediately.
                while (true) {
                    if (!isAutomationRunning) break // Stop button was pressed
                    await waitIfPaused()
                    if (!isAutomationRunning) break // Stop button pressed while paused

                    const elapsedOnSlide = Date.now() - slideStartTimeActual

                    // Re-read live values every tick so control-bar edits take effect now
                    const currentRequiredDwellMs = useDwellTime
                        ? audioDuration * (1000 / automationSpeed)
                        : 0
                    // Also sync playback rate if it changed
                    if (
                        useDwellTime &&
                        audio.playbackRate !== automationSpeed
                    ) {
                        audio.playbackRate = automationSpeed
                    }

                    const minTotalWait = Math.max(
                        automationDelay,
                        currentRequiredDwellMs
                    )
                    const remainingWait = minTotalWait - elapsedOnSlide

                    if (remainingWait <= 0 || isSkipRequested) break

                    tryResumeAutomationPlayback(audio, canvasDoc)

                    // Ensure mute persistence
                    if (isAutomationMuted) {
                        audio.muted = true
                    }

                    const reason =
                        useDwellTime && currentRequiredDwellMs > automationDelay
                            ? 'Tricking progress'
                            : 'User delay'
                    updateControlBarStatus(
                        `${reason}: ${Math.ceil(remainingWait)}ms...`
                    )
                    await new Promise((r) => setTimeout(r, 500)) // Poll every 500ms
                }

                // Final seek for skipping mode if we haven't reached end yet
                if (
                    !downloadSlides &&
                    audio.currentTime < (audio.duration || 0) * 0.95
                ) {
                    recorder('FINAL SEEK TO END')
                    seekbar.value = seekbar.max
                    const seekEvents = ['input', 'change']
                    seekEvents.forEach((type) =>
                        seekbar.dispatchEvent(
                            new Event(type, { bubbles: true })
                        )
                    )
                }

                if (!isAutomationRunning) break // Stop pressed during dwell
                await waitIfPaused()
                if (!isAutomationRunning) break // Stop pressed while paused

                // 5. After the final slide, gate on sidebar progress before Print → Practice
                const atLessonEnd =
                    currentSlide >= totalSlides ||
                    (!nextBtn && currentSlide >= totalSlides - 1)
                if (atLessonEnd) {
                    await finishLessonWithProgressGate(meta, totalSlides)
                    break
                }

                // 6. Go to next slide
                updateControlBarStatus('Checking for Auto-Advance...')

                // Verify if we have already advanced automatically
                const { el: indicatorFinal } = findInIframes(
                    window,
                    'button.mediaPlayer__button--showslides'
                )
                const textFinal = indicatorFinal
                    ? indicatorFinal.textContent.trim()
                    : ''
                const matchFinal = textFinal.match(/Slide (\d+) of (\d+)/i)
                const currentSlideNow = matchFinal
                    ? parseInt(matchFinal[1])
                    : currentSlide

                if (!isAutomationRunning) break // Stop pressed before next-slide click
                await waitIfPaused() // Honour Pause before advancing
                if (!isAutomationRunning) break // Stop pressed while paused

                if (currentSlideNow === currentSlide) {
                    updateControlBarStatus('Next Slide...')
                    nextBtn.click()
                } else {
                    recorder(
                        `AUTO-ADVANCE DETECTED: Already on slide ${currentSlideNow}`
                    )
                    console.log(
                        `[Userscript] Site auto-advanced to slide ${currentSlideNow}. Skipping manual next click.`
                    )
                }

                // Wait for slide indicator to change
                await new Promise((resolve) => {
                    if (!slideIndicator) return resolve()
                    const observer = new MutationObserver((mutations, obs) => {
                        const newMatch =
                            slideIndicator.textContent.match(
                                /Slide (\d+) of (\d+)/i
                            )
                        if (
                            newMatch &&
                            parseInt(newMatch[1]) !== currentSlide
                        ) {
                            obs.disconnect()
                            requestAnimationFrame(() =>
                                setTimeout(resolve, 300)
                            )
                        }
                    })
                    observer.observe(slideIndicator, {
                        childList: true,
                        characterData: true,
                        subtree: true,
                    })
                    setTimeout(() => {
                        observer.disconnect()
                        resolve()
                    }, 3000)
                })
            }
        } finally {
            stopAutomationPlaybackWatchdog()
            isAutomationRunning = false
            isAutomationPaused = false
            resumeScheduled = false
            sessionStorage.removeItem(RUNNING_KEY)

            // Restore audio state
            try {
                const { el: audio } = findInIframes(window, 'audio#n')
                if (audio) {
                    audio.playbackRate = 1.0
                    // We only unmute if the user hasn't explicitly enabled automation mute
                    if (!isAutomationMuted) {
                        audio.muted = false
                    }
                }
            } catch (e) {
                // Ignore errors during final cleanup
            }

            if (!keepControlBarVisibleAfterRun) {
                setTimeout(hideControlBar, 2000)
            }
            console.log('[Userscript] Automation sequence ended.')
        }
    }

    async function startAutomation() {
        return performAutomation(true)
    }

    async function startSkippingAutomation() {
        return performAutomation(false)
    }

    // Expose to global scope for console access
    window.performAutomation = performAutomation
    window.startAutomation = startAutomation
    window.startSkippingAutomation = startSkippingAutomation
    window.getAllCanvases = () => {
        const results = []
        const search = (win) => {
            try {
                const canvases = Array.from(
                    win.document.querySelectorAll('canvas')
                )
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
                const frames = win.document.querySelectorAll('iframe')
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
