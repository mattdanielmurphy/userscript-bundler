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

//!    7. Text Selection Popup: Search with Google
;(() => {
    // =============================================================================
    // DEBUG: Check execution context FIRST
    // =============================================================================
    console.log(`[Perplexity Debug] Script running in: ${window.location.href}`)
    console.log(`[Perplexity Debug] Is iframe? ${window.self !== window.top}`)

    // Skip if we're inside an iframe (like GTM)
    if (window.self !== window.top) {
        console.log('[Perplexity] Skipping - inside iframe')
        return
    }

    const PREFIX = '[Perplexity - Google Search Button]'
    console.log(`${PREFIX} Initializing in main window...`)

    // =============================================================================
    // CORE FUNCTION: Add Google Search Button
    // =============================================================================
    function addGoogleSearchButton(triggerType) {
        triggerType = triggerType || 'interval'
        const buttons = document.querySelectorAll('button')
        const verbose = triggerType !== 'interval'

        if (verbose) {
            console.log(`${PREFIX} Scan triggered by: ${triggerType}`)
            console.log(`${PREFIX} Found ${buttons.length} buttons`)
            console.log(
                `${PREFIX} Current selection: "${window.getSelection().toString().slice(0, 50)}"`
            )
        }

        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i]

            // Look for the "Check sources" button
            if (
                button.textContent &&
                button.textContent.includes('Check sources')
            ) {
                const container = button.parentElement
                if (!container) continue

                // Don't add duplicate buttons
                if (container.querySelector('.google-search-btn')) {
                    if (verbose)
                        console.log(`${PREFIX} Google button already exists`)
                    continue
                }

                console.log(
                    `${PREFIX} ✅ FOUND "Check sources" button! Adding Google Search...`
                )

                // Clone the button and modify it
                const googleButton = button.cloneNode(true)
                googleButton.classList.add('google-search-btn')

                // Adjust styling to make it part of a button group
                button.classList.remove('rounded-r-lg', 'dark:rounded-r-lg')
                button.classList.add('rounded-r-none')

                // Update button text
                const textNode = googleButton.querySelector('.truncate')
                if (textNode) {
                    textNode.textContent = 'Search with Google'
                } else {
                    googleButton.textContent = 'Search with Google'
                }

                // Add click handler
                googleButton.addEventListener('click', function (e) {
                    e.stopPropagation()
                    e.preventDefault()
                    const selection = window.getSelection().toString().trim()
                    if (selection) {
                        console.log(
                            `${PREFIX} Opening Google search for: "${selection}"`
                        )
                        window.open(
                            'https://www.google.com/search?q=' +
                                encodeURIComponent(selection),
                            '_blank'
                        )
                    } else {
                        console.log(`${PREFIX} No text selected`)
                    }
                })

                // Add to DOM
                container.appendChild(googleButton)
                console.log(
                    `${PREFIX} ✅ Google Search button added successfully!`
                )
            }
        }
    }

    // =============================================================================
    // EVENT LISTENERS & OBSERVERS
    // =============================================================================
    function setupListeners() {
        console.log(`${PREFIX} Setting up event listeners...`)
        console.log(`${PREFIX} - document.readyState: ${document.readyState}`)
        console.log(
            `${PREFIX} - document.body: ${document.body ? 'exists' : 'null'}`
        )

        if (!document.body) {
            console.warn(
                `${PREFIX} document.body not ready yet, retrying in 100ms...`
            )
            setTimeout(setupListeners, 100)
            return
        }

        // Listen for text selection events (capture phase)
        document.addEventListener(
            'mouseup',
            function (e) {
                console.log(
                    `${PREFIX} mouseup event - target: ${e.target.tagName}`
                )
                setTimeout(() => addGoogleSearchButton('mouseup'), 200)
            },
            true
        )

        document.addEventListener(
            'keyup',
            function (e) {
                setTimeout(() => addGoogleSearchButton('keyup'), 200)
            },
            true
        )

        console.log(`${PREFIX} ✅ Event listeners attached`)

        // MutationObserver for dynamically added elements
        const observer = new MutationObserver(function (mutations) {
            for (let mutation of mutations) {
                for (let node of mutation.addedNodes) {
                    if (
                        node.nodeType === Node.ELEMENT_NODE &&
                        node.textContent &&
                        node.textContent.includes('Check sources')
                    ) {
                        console.log(
                            `${PREFIX} MutationObserver detected "Check sources" button`
                        )
                        setTimeout(() => addGoogleSearchButton('mutation'), 100)
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
        setInterval(() => addGoogleSearchButton('interval'), 2000)
        console.log(`${PREFIX} ✅ Polling interval started`)

        // Self-test: trigger a scan immediately
        console.log(`${PREFIX} Running initial scan...`)
        addGoogleSearchButton('initial')

        // Expose test function globally
        window._testGoogleSearch = function () {
            console.log(`${PREFIX} 🧪 Manual test triggered!`)
            addGoogleSearchButton('manual')
        }
        console.log(
            `${PREFIX} ✅ Setup complete! Try window._testGoogleSearch() to test manually`
        )
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================
    if (document.readyState === 'complete') {
        console.log(`${PREFIX} Document already loaded, setting up now...`)
        setupListeners()
    } else if (document.readyState === 'interactive') {
        console.log(`${PREFIX} Document interactive, waiting for full load...`)
        window.addEventListener('load', function () {
            console.log(`${PREFIX} window.load fired, waiting 1s for React...`)
            setTimeout(setupListeners, 1000)
        })
    } else {
        console.log(
            `${PREFIX} Document still loading, waiting for DOMContentLoaded...`
        )
        document.addEventListener('DOMContentLoaded', function () {
            console.log(`${PREFIX} DOMContentLoaded fired, waiting 500ms...`)
            setTimeout(setupListeners, 500)
        })
    }

    console.log(`${PREFIX} Initialization complete`)
})()

//!		 8. Hide Upsell Banners (Upgrade, Try Computer, etc.)
;(() => {
    // Add CSS rule for immediate hiding
    const style = document.createElement('style')
    style.textContent = `
        /* Hide Upsell Banners via CSS selector engine */
        .rounded-2xl:has(use[href*="computer"]),
        .rounded-2xl:has(use[*|href*="computer"]),
        .rounded-2xl:has(button[aria-label="Try Computer"]),
        .rounded-2xl:has(img[src*="computer"]),
        .bg-raised:has(use[href*="computer"]),
        .bg-raised:has(use[*|href*="computer"]),
        
        /* Hide the wrappers too if possible */
        div:has(> div > .rounded-2xl:has(use[href*="computer"])),
        div:has(> div > .bg-raised:has(use[href*="computer"])),
        
        /* General hidden class applied dynamically by JS scanner */
        .pplx-hidden-banner {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            overflow: hidden !important;
        }
    `
    document.head.appendChild(style)

    const BANNER_KEYWORDS = [
        'try computer',
        'perplexity computer',
        'computer writes sql',
        'turn your data questions',
        'put computer to work',
        'ship faster with computer',
        'computer connects to',
        'upgrade to max',
        'upgrade now',
        'try this answer with'
    ];

    const BANNER_ICON_ATTRS = [
        'computer',
        'custom-computer',
        'perplexity_computer_upsell'
    ];

    function findBannerContainer(el) {
        // Find the closest card container first
        let card = el.closest('.rounded-2xl, .bg-raised, .shadow-xl, .shadow-md, [role="dialog"], .modal, .border-subtlest');
        if (!card) {
            card = el.parentElement;
            if (!card) return null;
        }

        // Walk up to hide simple outer wrappers (opacity: 1, transitions, etc.)
        let current = card;
        while (current.parentElement) {
            const parent = current.parentElement;
            if (parent === document.body || parent === document.documentElement || parent.tagName === 'MAIN') {
                break;
            }
            
            // Count visible/active children in the parent
            const siblingCount = Array.from(parent.children).filter(c => {
                if (c === current) return true;
                // If a sibling is already hidden, don't count it
                if (c.classList.contains('pplx-hidden-banner') || c.style.display === 'none') return false;
                return true;
            }).length;

            const isWrapper = siblingCount === 1 && (
                parent.style.opacity === '1' ||
                parent.style.transform !== '' ||
                parent.className === '' ||
                parent.tagName === 'DIV'
            );

            if (isWrapper) {
                current = parent;
            } else {
                break;
            }
        }
        return current;
    }

    function isMatch(el) {
        // Skip already hidden elements or their children to avoid double-processing
        if (el.classList.contains('pplx-hidden-banner') || el.closest('.pplx-hidden-banner')) {
            return false;
        }

        // Avoid matching elements inside user chat messages or query inputs
        if (el.closest('[data-testid="user-message"], .message-container, #ask-input')) {
            return false;
        }

        // 1. Check text content
        const text = (el.textContent || '').toLowerCase().trim();
        if (text) {
            for (const kw of BANNER_KEYWORDS) {
                if (text.includes(kw)) {
                    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || text.length < 150) {
                        return true;
                    }
                    if (el.tagName === 'DIV') {
                        const children = Array.from(el.children);
                        const hasMatchingChild = children.some(child => {
                            const childText = (child.textContent || '').toLowerCase();
                            return BANNER_KEYWORDS.some(k => childText.includes(k));
                        });
                        if (!hasMatchingChild) {
                            return true;
                        }
                    }
                }
            }
        }

        // 2. Check SVG / Use elements
        if (el.tagName === 'use' || el.tagName === 'USE') {
            const href = el.getAttribute('href') || el.getAttribute('xlink:href') || (el.href && el.href.baseVal) || '';
            if (BANNER_ICON_ATTRS.some(attr => href.toLowerCase().includes(attr))) {
                return true;
            }
        }

        // 3. Check Image elements
        if (el.tagName === 'IMG') {
            const src = el.getAttribute('src') || '';
            if (BANNER_ICON_ATTRS.some(attr => src.toLowerCase().includes(attr))) {
                return true;
            }
        }

        // 4. Check button attributes
        if (el.tagName === 'BUTTON') {
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            if (BANNER_KEYWORDS.some(kw => ariaLabel.includes(kw))) {
                return true;
            }
        }

        return false;
    }

    const removeBanners = () => {
        // Fast path: scan card-like containers
        const containers = document.querySelectorAll(
            '.rounded-2xl, .bg-raised, .shadow-xl, .shadow-md, [role="dialog"], .modal, .border-subtlest'
        );
        containers.forEach(container => {
            if (container.classList.contains('pplx-hidden-banner')) return;
            if (container.closest('[data-testid="user-message"], .message-container')) return;

            const text = (container.textContent || '').toLowerCase();
            const hasKeyword = BANNER_KEYWORDS.some(kw => text.includes(kw));

            if (hasKeyword) {
                // Ensure it's a promotional banner and not real content by confirming UI markers
                const isUpsell = 
                    container.querySelector('button') ||
                    container.querySelector('use') ||
                    container.querySelector('img') ||
                    container.querySelector('[aria-label="Dismiss"]');
                    
                if (isUpsell) {
                    const target = findBannerContainer(container);
                    if (target && !target.classList.contains('pplx-hidden-banner')) {
                        target.classList.add('pplx-hidden-banner');
                        console.log('[Perplexity Improvements] Hidden container via fast path:', target);
                    }
                    return;
                }
            }

            // Check icons/images inside the container
            const uses = container.querySelectorAll('use');
            for (const use of uses) {
                const href = use.getAttribute('href') || use.getAttribute('xlink:href') || (use.href && use.href.baseVal) || '';
                if (BANNER_ICON_ATTRS.some(attr => href.toLowerCase().includes(attr))) {
                    const target = findBannerContainer(container);
                    if (target && !target.classList.contains('pplx-hidden-banner')) {
                        target.classList.add('pplx-hidden-banner');
                        console.log('[Perplexity Improvements] Hidden container via SVG path:', target);
                    }
                    return;
                }
            }

            const imgs = container.querySelectorAll('img');
            for (const img of imgs) {
                const src = img.getAttribute('src') || '';
                if (BANNER_ICON_ATTRS.some(attr => src.toLowerCase().includes(attr))) {
                    const target = findBannerContainer(container);
                    if (target && !target.classList.contains('pplx-hidden-banner')) {
                        target.classList.add('pplx-hidden-banner');
                        console.log('[Perplexity Improvements] Hidden container via Image path:', target);
                    }
                    return;
                }
            }
        });

        // Fallback/Standalone path
        const candidates = document.querySelectorAll('button, use, img');
        candidates.forEach(el => {
            if (isMatch(el)) {
                const target = findBannerContainer(el);
                if (target && !target.classList.contains('pplx-hidden-banner')) {
                    target.classList.add('pplx-hidden-banner');
                    console.log('[Perplexity Improvements] Hidden standalone element:', target);
                }
            }
        });
    }

    // Use MutationObserver for instant removal
    const observer = new MutationObserver(removeBanners)
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true })

    // Fallback interval for SPA navigation or items that don't trigger subtree mutations correctly
    setInterval(removeBanners, 1000)

    // Initial run
    if (
        document.readyState === 'complete' ||
        document.readyState === 'interactive'
    ) {
        removeBanners()
    }
})()

//!	9. Rate Limit Display
;(() => {
    'use strict'

    const BADGE_ID = 'pplx-rate-limit-badge'
    const REFRESH_MS = 300_000 // 5 minutes
    const CACHE_KEY = 'pplx-rate-limit-cache'
    const TS_KEY = 'pplx-rate-limit-ts'

    async function fetchLimits(force = false) {
        const now = Date.now()
        if (!force) {
            const cached = localStorage.getItem(CACHE_KEY)
            const lastTS = parseInt(localStorage.getItem(TS_KEY) || '0')
            if (cached && now - lastTS < REFRESH_MS) {
                try {
                    return JSON.parse(cached)
                } catch (e) {}
            }
        }

        try {
            const r = await fetch('/rest/rate-limit/all')
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const d = await r.json()
            const limits = {
                pro: d.remaining_pro ?? '?',
                research: d.remaining_research ?? '?',
            }
            localStorage.setItem(CACHE_KEY, JSON.stringify(limits))
            localStorage.setItem(TS_KEY, now.toString())
            return limits
        } catch (e) {
            console.error('[pplx-rate-limit] Fetch error:', e)
            const cached = localStorage.getItem(CACHE_KEY)
            if (cached) {
                try {
                    return JSON.parse(cached)
                } catch (err) {}
            }
            return { pro: '!', research: '!' }
        }
    }

    function buildBadge() {
        const wrap = document.createElement('div')
        wrap.id = BADGE_ID
        wrap.title = 'Pro / Research queries remaining — click to refresh'
        Object.assign(wrap.style, {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            lineHeight: '1',
            color: 'var(--text-quiet, #888)',
            fontFamily: 'inherit',
            height: '32px',
            padding: '0 10px',
            borderRadius: '999px',
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
            border: '1px solid transparent',
        })

        wrap.onmouseenter = () => {
            wrap.style.background = 'var(--bg-quiet, rgba(0,0,0,0.04))'
            wrap.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.1))'
        }
        wrap.onmouseleave = () => {
            wrap.style.background = 'transparent'
            wrap.style.borderColor = 'transparent'
        }

        wrap.innerHTML = `
            <span title="Pro queries remaining" style="display:inline-flex;align-items:center;gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <span id="pplx-rl-pro" style="font-weight: 500;">…</span>
            </span>
            <span style="opacity:.3; font-size: 10px;">|</span>
            <span title="Research queries remaining" style="display:inline-flex;align-items:center;gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span id="pplx-rl-research" style="font-weight: 500;">…</span>
            </span>
        `

        wrap.onclick = async (e) => {
            e.stopPropagation()
            setValues('…', '…')
            const { pro, research } = await fetchLimits(true)
            setValues(pro, research)
        }

        return wrap
    }

    function setValues(pro, research) {
        const p = document.getElementById('pplx-rl-pro')
        const r = document.getElementById('pplx-rl-research')
        if (p) p.textContent = pro
        if (r) r.textContent = research
    }

    function getModelButton() {
        // Use the stable ID of the input to find the local context
        const input = document.getElementById('ask-input')
        if (!input) return null

        // The container is the grand-parent of the input area (uid 5077)
        const container =
            input.closest('div:has(> .px-3 #ask-input)') ||
            input.closest('.grid')
        if (!container) return null

        // Find the model selection button (it has text and a menu popup)
        // It's usually the first button with text inside the bottom right action area
        const buttons = Array.from(
            container.querySelectorAll('button[aria-haspopup="menu"]')
        )
        return buttons.find((btn) => btn.innerText.length > 0) || null
    }

    async function tryInject() {
        if (document.getElementById(BADGE_ID)) return
        const modelBtn = getModelButton()
        if (!modelBtn) return

        const badge = buildBadge()
        // Inject before the model button's wrapper to keep it in the same flex row
        modelBtn.parentElement.parentElement.insertBefore(
            badge,
            modelBtn.parentElement
        )

        const { pro, research } = await fetchLimits()
        setValues(pro, research)
    }

    const mo = new MutationObserver(() => {
        if (!document.getElementById(BADGE_ID)) {
            tryInject()
        }
    })

    function start() {
        mo.observe(document.body, { childList: true, subtree: true })
        tryInject()

        // Periodic refresh (throttled by fetchLimits)
        setInterval(async () => {
            const { pro, research } = await fetchLimits()
            setValues(pro, research)
        }, 60_000)

        // Sync with other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === CACHE_KEY && e.newValue) {
                try {
                    const { pro, research } = JSON.parse(e.newValue)
                    setValues(pro, research)
                } catch (err) {}
            }
        })
    }

    if (
        document.readyState === 'complete' ||
        document.readyState === 'interactive'
    ) {
        start()
    } else {
        window.addEventListener('DOMContentLoaded', start)
    }
})()

//!    10. Auto Reset "Learn step by step" Mode to "Search" on Submit
;(() => {
    'use strict'

    const PREFIX = '[Perplexity - Auto Reset Mode]'
    let isResetting = false
    let isSubmittingProgrammatically = false

    // Helper to select the mode selector button
    function getModeSelectorButton() {
        return document.querySelector(
            'div:has(> [data-testid="ask-input-mode-toggle-indicator"]) button'
        )
    }

    // Helper to select the "Search" mode button inside the opened Radix dropdown menu
    function getSearchModeButton() {
        return Array.from(
            document.querySelectorAll('[role="menuitemradio"]')
        ).find((el) => {
            const text = el.textContent.trim()
            if (text === 'Search') return true
            // Fallback checking if it contains "Search" and the search icon
            if (text.includes('Search')) {
                const hasSearchIcon = el.querySelector(
                    'use[href*="search"], use[*|href*="search"]'
                )
                if (hasSearchIcon) return true
            }
            return false
        })
    }

    // Helper to find the submit button
    function getSubmitButton() {
        return document.querySelector('button[aria-label="Submit"]')
    }

    // Helper to click/trigger an element using pointer events (specifically for Radix)
    function clickElementWithPointer(element) {
        element.focus()

        // Dispatch keydown/keyup Enter
        const keydown = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true,
        })
        const keyup = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true,
        })
        element.dispatchEvent(keydown)
        element.dispatchEvent(keyup)

        // Dispatch pointerdown event
        const pointerDown = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
        })
        element.dispatchEvent(pointerDown)

        // Also trigger click just in case
        element.click()
    }

    function changeModeToSearch(callback) {
        if (isResetting) return

        const modeBtn = getModeSelectorButton()
        if (!modeBtn) {
            if (callback) callback()
            return
        }

        if (modeBtn.innerText.includes('Learn step by step')) {
            console.log(
                `${PREFIX} Mode is "Learn step by step". Reverting back to "Search" before submit...`
            )
            isResetting = true

            // Click the mode selector button to open the dropdown menu
            clickElementWithPointer(modeBtn)

            // Wait/poll for the "Search" mode button to appear in the opened dropdown menu
            let attempts = 0
            const pollInterval = setInterval(() => {
                const searchBtn = getSearchModeButton()
                if (searchBtn) {
                    clearInterval(pollInterval)
                    console.log(
                        `${PREFIX} Found Search button in menu. Clicking...`
                    )
                    clickElementWithPointer(searchBtn)

                    // Reset the flag after a delay to let DOM stabilize
                    setTimeout(() => {
                        isResetting = false
                        console.log(
                            `${PREFIX} Successfully reverted mode to "Search".`
                        )
                        if (callback) callback()
                    }, 500)
                } else {
                    attempts++
                    if (attempts > 25) {
                        // 500ms maximum wait
                        clearInterval(pollInterval)
                        isResetting = false
                        console.warn(
                            `${PREFIX} Failed to find "Search" button inside the open menu.`
                        )
                        if (callback) callback()
                    }
                }
            }, 20)
        } else {
            if (callback) callback()
        }
    }

    function handleCaptureClick(e) {
        if (isSubmittingProgrammatically) return

        const btn = e.target.closest('button[aria-label="Submit"]')
        if (!btn || btn.disabled) return

        const modeBtn = getModeSelectorButton()
        if (modeBtn && modeBtn.innerText.includes('Learn step by step')) {
            e.preventDefault()
            e.stopPropagation()

            console.log(
                `${PREFIX} Intercepted submit click. Reverting and submitting...`
            )
            changeModeToSearch(() => {
                isSubmittingProgrammatically = true
                clickElementWithPointer(btn)
                isSubmittingProgrammatically = false
            })
        }
    }

    function handleCaptureKeydown(e) {
        if (isSubmittingProgrammatically) return

        if (e.key === 'Enter' && !e.shiftKey) {
            const target = e.target
            if (
                target &&
                (target.id === 'ask-input' || target.tagName === 'TEXTAREA')
            ) {
                const modeBtn = getModeSelectorButton()
                if (
                    modeBtn &&
                    modeBtn.innerText.includes('Learn step by step')
                ) {
                    e.preventDefault()
                    e.stopPropagation()

                    console.log(
                        `${PREFIX} Intercepted Enter keydown. Reverting and submitting...`
                    )
                    changeModeToSearch(() => {
                        const submitBtn = getSubmitButton()
                        if (submitBtn) {
                            isSubmittingProgrammatically = true
                            clickElementWithPointer(submitBtn)
                            isSubmittingProgrammatically = false
                        } else {
                            // Fallback: re-dispatch the Enter event
                            isSubmittingProgrammatically = true
                            const newEvent = new KeyboardEvent('keydown', {
                                key: 'Enter',
                                code: 'Enter',
                                keyCode: 13,
                                bubbles: true,
                                cancelable: true,
                            })
                            target.dispatchEvent(newEvent)
                            isSubmittingProgrammatically = false
                        }
                    })
                }
            }
        }
    }

    function init() {
        console.log(`${PREFIX} Monitoring active (Submit Interception)...`)
        document.addEventListener('click', handleCaptureClick, true)
        document.addEventListener('keydown', handleCaptureKeydown, true)
    }

    if (
        document.readyState === 'complete' ||
        document.readyState === 'interactive'
    ) {
        init()
    } else {
        window.addEventListener('DOMContentLoaded', init)
    }
})()

