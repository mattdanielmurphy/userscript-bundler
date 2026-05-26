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

;(() => {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window

    function isHomepage() {
        const path = location.pathname.replace(/\/+$/, '')
        return path === '' || path === '/'
    }

    /** Run off `/` only; teardown when user returns home (SPA + new tab). */
    function whenNotHomepage(run) {
        if (typeof run !== 'function') return
        let active = false
        let stop = null

        const sync = () => {
            if (!isHomepage()) {
                if (!active) {
                    active = true
                    stop = run() || null
                }
            } else if (active) {
                active = false
                if (typeof stop === 'function') stop()
                stop = null
            }
        }

        sync()
        const onRoute = () => sync()
        window.addEventListener('popstate', onRoute)
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method]
            if (typeof original !== 'function') continue
            history[method] = function (...args) {
                const out = original.apply(this, args)
                onRoute()
                return out
            }
        }
        setInterval(sync, 500)
    }

    /** Run on `/` only; optional teardown when user navigates away (SPA). */
    function whenHomepage(run) {
        if (typeof run !== 'function') return
        let active = false
        let stop = null

        const sync = () => {
            if (isHomepage()) {
                if (!active) {
                    active = true
                    stop = run() || null
                }
            } else if (active) {
                active = false
                if (typeof stop === 'function') stop()
                stop = null
            }
        }

        sync()
        const onRoute = () => sync()
        window.addEventListener('popstate', onRoute)
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method]
            if (typeof original !== 'function') continue
            history[method] = function (...args) {
                const out = original.apply(this, args)
                onRoute()
                return out
            }
        }
        setInterval(sync, 500)
    }

    const HIDDEN_CLASS = 'pplx-userscript-hidden'
    const HIDDEN_STYLE_ID = 'pplx-userscript-hidden-style'

    function ensureHiddenStyles() {
        if (document.getElementById(HIDDEN_STYLE_ID)) return
        const style = document.createElement('style')
        style.id = HIDDEN_STYLE_ID
        style.textContent = `
        .${HIDDEN_CLASS} {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }
        `
        const root = document.head || document.documentElement
        if (root) root.appendChild(style)
    }

    function hideElement(el) {
        if (!el || el.classList.contains(HIDDEN_CLASS)) return
        ensureHiddenStyles()
        el.classList.add(HIDDEN_CLASS)
        el.setAttribute('aria-hidden', 'true')
        el.style.setProperty('display', 'none', 'important')
        el.style.setProperty('visibility', 'hidden', 'important')
        el.style.setProperty('pointer-events', 'none', 'important')
    }

    win.__pplxIsHomepage = isHomepage
    win.__pplxWhenNotHomepage = whenNotHomepage
    win.__pplxWhenHomepage = whenHomepage
    win.__pplxHideElement = hideElement

    /** Set to empty to enable all features; or add ids to limit (bisect). */
    win.__PPLX_BISECT = null
})()

//!    7b. Homepage — hide Computer setup / starter promos
;(() => {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
    if (win.__PPLX_BISECT && !win.__PPLX_BISECT.has('7b')) return
    const whenHome = win.__pplxWhenHomepage
    const hideElement = win.__pplxHideElement
    if (!whenHome || !hideElement) return

    whenHome(() => {
        const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()

        function hideSetupComputerDock() {
            const docks = document.querySelectorAll(
                'div.fixed.bottom-0.right-0, div.fixed[class*="bottom-0"][class*="right-0"]'
            )
            for (const dock of docks) {
                const text = norm(dock.textContent)
                if (
                    !text.includes('set up computer') ||
                    !text.includes('connect your apps')
                ) {
                    continue
                }
                const card = dock.querySelector('.bg-raised.rounded-xl, .rounded-xl.bg-raised')
                if (!card && !dock.querySelector('.ring-1')) continue
                hideElement(dock)
            }
        }

        function hideComputerStarterGrid() {
            const shuffle = document.querySelector(
                'button[aria-label="Shuffle starter cards"]'
            )
            if (!shuffle) return

            const block =
                shuffle.closest('div.mt-lg.absolute') ||
                shuffle.closest('div.mt-lg') ||
                shuffle.closest('div.absolute.w-full')
            if (!block) return

            const text = norm(block.textContent)
            if (!text.includes('try out perplexity computer')) return
            if (!block.querySelector('button[aria-label="Shuffle starter cards"]')) return

            hideElement(block)
        }

        const purge = () => {
            if (!win.__pplxIsHomepage?.()) return
            hideSetupComputerDock()
            hideComputerStarterGrid()
        }

        let scheduled = false
        const schedulePurge = () => {
            if (scheduled) return
            scheduled = true
            requestAnimationFrame(() => {
                scheduled = false
                purge()
            })
        }

        purge()

        let observer = null
        const attachObserver = () => {
            const root = document.body || document.documentElement
            if (!root) return
            observer = new MutationObserver(schedulePurge)
            observer.observe(root, { childList: true, subtree: true })
        }

        if (document.body) attachObserver()
        else document.addEventListener('DOMContentLoaded', attachObserver, { once: true })

        const intervalId = setInterval(purge, 250)

        return () => {
            observer?.disconnect()
            clearInterval(intervalId)
        }
    })
})()

//!    7c. Sidebar — hide Computer section (pinned tasks)
;(() => {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
    if (win.__PPLX_BISECT && !win.__PPLX_BISECT.has('7c')) return
    if (window.self !== window.top) return

    const hideElement =
        (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).__pplxHideElement
    if (!hideElement) return

    function useHref(useEl) {
        return (
            useEl.getAttribute('href') ||
            useEl.getAttribute('xlink:href') ||
            (useEl.href && useEl.href.baseVal) ||
            ''
        ).toLowerCase()
    }

    function hasSidebarComputerIcon(root) {
        if (!root) return false
        return Array.from(root.querySelectorAll('use')).some(u => {
            const href = useHref(u)
            return (
                href.includes('pplx-icon-custom-computer') ||
                href.includes('custom-computer')
            )
        })
    }

    function isSidebarComputerNavLink(a) {
        if (a.tagName !== 'A') return false
        const href = (a.getAttribute('href') || '').toLowerCase()
        if (!/\/computer\/tasks/.test(href)) return false

        const label = (a.getAttribute('aria-label') || '').trim().toLowerCase()
        if (label === 'computer') return true

        const subMenu = a.closest('[class*="sidebar-sub-menu"]')
        return hasSidebarComputerIcon(subMenu)
    }

    function findCollapsibleSidebarSection(el) {
        let node = el
        while (node && node !== document.documentElement) {
            const cls = node.className
            if (typeof cls === 'string' && cls.includes('collapsible-sidebar-section')) {
                return node
            }
            node = node.parentElement
        }
        return null
    }

    function hideSidebarComputerSection() {
        const seen = new Set()
        document.querySelectorAll('a[href*="/computer/tasks"]').forEach(link => {
            if (!isSidebarComputerNavLink(link)) return
            const section = findCollapsibleSidebarSection(link)
            if (!section || seen.has(section)) return
            seen.add(section)
            hideElement(section)
        })
    }

    let scheduled = false
    const schedule = () => {
        if (scheduled) return
        scheduled = true
        requestAnimationFrame(() => {
            scheduled = false
            hideSidebarComputerSection()
        })
    }

    hideSidebarComputerSection()

    let observer = null
    const attachObserver = () => {
        const root = document.body || document.documentElement
        if (!root) return
        observer = new MutationObserver(schedule)
        observer.observe(root, { childList: true, subtree: true })
    }

    if (document.body) attachObserver()
    else document.addEventListener('DOMContentLoaded', attachObserver, { once: true })

    const intervalId = setInterval(hideSidebarComputerSection, 250)

    window.addEventListener('popstate', schedule)
    for (const method of ['pushState', 'replaceState']) {
        const original = history[method]
        if (typeof original !== 'function') continue
        history[method] = function (...args) {
            const out = original.apply(this, args)
            schedule()
            return out
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') hideSidebarComputerSection()
    })
})()

//!    7d. Homepage — hide composer Computer chip & topic shortcut nav
;(() => {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
    if (win.__PPLX_BISECT && !win.__PPLX_BISECT.has('7d')) return
    if (window.self !== window.top) return

    const whenHome = win.__pplxWhenHomepage
    const hideElement = win.__pplxHideElement
    if (!whenHome || !hideElement) return

    const STYLE_ID = 'pplx-chrome-hidden-style'
    const COUNCIL_SUPPRESS_CLASS = 'pplx-suppress-model-council'
    const COMPUTER_MODE_SUPPRESS_CLASS = 'pplx-suppress-computer-mode'
    const MAX_MODEL_SUPPRESS_CLASS = 'pplx-suppress-max-model'
    const TOPIC_NAV_PATHS = ['/discover', '/finance', '/health', '/academic', '/patents']
    const TOPIC_NAV_LABELS = ['discover', 'finance', 'health', 'academic', 'patents']

    function useHref(useEl) {
        return (
            useEl.getAttribute('href') ||
            useEl.getAttribute('xlink:href') ||
            (useEl.href && useEl.href.baseVal) ||
            ''
        ).toLowerCase()
    }

    function pathnameFromAnchor(a) {
        const raw = (a.getAttribute('href') || '').trim()
        if (!raw) return ''
        try {
            return new URL(raw, location.origin).pathname.replace(/\/+$/, '') || '/'
        } catch {
            return raw.split('?')[0].replace(/\/+$/, '') || '/'
        }
    }

    function norm(s) {
        return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
    }

    /** Never hide a subtree that contains the main ask / prompt UI. */
    function containsComposer(node) {
        if (!node?.querySelector) return false
        return !!(
            node.querySelector('#ask-input') ||
            node.querySelector('[data-testid="ask-input"]') ||
            node.querySelector('textarea') ||
            node.querySelector('[contenteditable="true"]')
        )
    }

    /** Query including open shadow roots (Perplexity mounts UI in shadow trees). */
    function queryAllDeep(selector) {
        const out = []
        const visit = (node) => {
            if (!node?.querySelectorAll) return
            try {
                node.querySelectorAll(selector).forEach(el => out.push(el))
            } catch {
                /* invalid selector in some roots */
            }
            node.querySelectorAll('*').forEach(el => {
                if (el.shadowRoot) visit(el.shadowRoot)
            })
        }
        if (document.body) visit(document.body)
        else visit(document.documentElement)
        return out
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = `
        button[aria-label="Computer"]:has(use[*|href*="custom-computer"]),
        span:has(> span > span > button[aria-label="Computer"]:has(use[*|href*="custom-computer"])),
        span:has(> span > button[aria-label="Computer"]:has(use[*|href*="custom-computer"])),
        div:has(> a[href*="/discover"]):has(> a[href*="/finance"]):has(> a[href*="/patents"]),
        [data-testid="ask-input-mode-toggle-indicator"],
        .${COUNCIL_SUPPRESS_CLASS},
        .${COMPUTER_MODE_SUPPRESS_CLASS},
        .${MAX_MODEL_SUPPRESS_CLASS} {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }
        `
        ;(document.head || document.documentElement).appendChild(style)
    }

    function hideAskInputModeToggleIndicator() {
        for (const el of queryAllDeep('[data-testid="ask-input-mode-toggle-indicator"]')) {
            hideElement(el)
        }
    }

    function modeMenuItemRow(item) {
        return (
            item.closest('[class*="group/search-mode"]') ||
            item.closest('[class*="group/item"]') ||
            item
        )
    }

    function isModelCouncilMenuItem(el) {
        if (!el || el.getAttribute('role') !== 'menuitem') return false
        if (!norm(el.textContent).includes('model council')) return false
        return Array.from(el.querySelectorAll('use')).some(u => useHref(u).includes('gavel'))
    }

    function isComputerModeMenuItem(el) {
        if (!el || el.getAttribute('role') !== 'menuitem') return false
        if (!Array.from(el.querySelectorAll('use')).some(u => useHref(u).includes('custom-computer')))
            return false
        const text = norm(el.textContent)
        return text === 'computer' || text.endsWith(' computer')
    }

    function spanIsMaxPlanBadge(span) {
        if (!span || span.tagName !== 'SPAN') return false
        if (norm(span.textContent) !== 'max') return false
        const only = [...span.childNodes].every(
            n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'SPAN')
        )
        if (!only) return false
        const inner = span.querySelector(':scope > span')
        return inner ? norm(inner.textContent) === 'max' : true
    }

    /** Locked Max-tier models use menuitem (not menuitemradio) + lock icon + Max badge. */
    function isMaxOnlyModelMenuItem(el) {
        if (!el || el.getAttribute('role') !== 'menuitem') return false
        if (!el.closest('[role="menu"]')) return false
        const hasLock = Array.from(el.querySelectorAll('use')).some(u => useHref(u).includes('lock'))
        if (!hasLock) return false
        return Array.from(el.querySelectorAll('span')).some(spanIsMaxPlanBadge)
    }

    function modelMenuItemRow(item) {
        let node = item
        while (node && node !== document.documentElement) {
            const parent = node.parentElement
            if (parent?.getAttribute('role') === 'group') return node
            node = parent
        }
        return item
    }

    /** Hide only — do not remove DOM (Radix/React menu breaks on remove). */
    function suppressModelCouncilMenuItem() {
        for (const item of queryAllDeep('[role="menuitem"]')) {
            if (!isModelCouncilMenuItem(item)) continue
            const row = modeMenuItemRow(item)
            if (row.classList.contains(COUNCIL_SUPPRESS_CLASS)) continue
            row.classList.add(COUNCIL_SUPPRESS_CLASS)
            row.setAttribute('aria-hidden', 'true')
            row.style.setProperty('display', 'none', 'important')
            row.style.setProperty('pointer-events', 'none', 'important')
        }
    }

    function suppressComputerModeMenuItem() {
        for (const item of queryAllDeep('[role="menuitem"]')) {
            if (!isComputerModeMenuItem(item)) continue
            const row = modeMenuItemRow(item)
            if (row.classList.contains(COMPUTER_MODE_SUPPRESS_CLASS)) continue
            row.classList.add(COMPUTER_MODE_SUPPRESS_CLASS)
            row.setAttribute('aria-hidden', 'true')
            row.style.setProperty('display', 'none', 'important')
            row.style.setProperty('pointer-events', 'none', 'important')
        }
    }

    function suppressMaxOnlyModelMenuItems() {
        for (const item of queryAllDeep('[role="menuitem"]')) {
            if (!isMaxOnlyModelMenuItem(item)) continue
            const row = modelMenuItemRow(item)
            if (row.classList.contains(MAX_MODEL_SUPPRESS_CLASS)) continue
            row.classList.add(MAX_MODEL_SUPPRESS_CLASS)
            row.setAttribute('aria-hidden', 'true')
            row.style.setProperty('display', 'none', 'important')
            row.style.setProperty('pointer-events', 'none', 'important')
        }
    }

    function blockHiddenModeMenuClicks(isMatch) {
        const handler = (e) => {
            const item = e.target.closest?.('[role="menuitem"]')
            if (!item || !isMatch(item)) return
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
        }
        document.addEventListener('click', handler, true)
        document.addEventListener('pointerdown', handler, true)
    }

    function blockModelCouncilClicks() {
        blockHiddenModeMenuClicks(isModelCouncilMenuItem)
    }

    function blockComputerModeClicks() {
        blockHiddenModeMenuClicks(isComputerModeMenuItem)
    }

    function blockMaxOnlyModelClicks() {
        blockHiddenModeMenuClicks(isMaxOnlyModelMenuItem)
    }

    function hasComposerComputerIcon(root) {
        if (!root) return false
        return Array.from(root.querySelectorAll('use')).some(u =>
            useHref(u).includes('custom-computer')
        )
    }

    function isComposerComputerToggle(btn) {
        if (!btn || btn.tagName !== 'BUTTON') return false
        if (!hasComposerComputerIcon(btn)) return false
        const label = (btn.getAttribute('aria-label') || '').trim().toLowerCase()
        return label === 'computer'
    }

    function hideComputerChip() {
        const seen = new Set()
        const buttons = new Set()
        for (const btn of queryAllDeep('button[aria-label="Computer"]')) buttons.add(btn)
        for (const use of queryAllDeep('use')) {
            if (!useHref(use).includes('custom-computer')) continue
            const btn = use.closest('button')
            if (btn) buttons.add(btn)
        }
        for (const btn of buttons) {
            if (!isComposerComputerToggle(btn)) continue
            const wrap =
                btn.closest('span.relative') ||
                btn.closest('span.inline-flex.rounded-full') ||
                btn.closest('span[style*="width: 36px"]') ||
                btn.parentElement?.parentElement?.parentElement
            if (!wrap || seen.has(wrap) || containsComposer(wrap)) continue
            seen.add(wrap)
            hideElement(wrap)
        }
    }

    function isTopicShortcutNav(container) {
        if (!container || container.tagName !== 'DIV') return false
        const anchors = container.querySelectorAll(':scope > a[href]')
        if (anchors.length < TOPIC_NAV_PATHS.length) return false
        const paths = new Set()
        for (const a of anchors) {
            const p = pathnameFromAnchor(a)
            if (p) paths.add(p)
        }
        if (!TOPIC_NAV_PATHS.every(p => paths.has(p))) return false
        const labels = new Set()
        for (const a of anchors) {
            const t = norm(a.textContent)
            if (t) labels.add(t)
        }
        return TOPIC_NAV_LABELS.every(l => labels.has(l))
    }

    function findTopicNavFromAnchor(a) {
        let node = a.parentElement
        let best = null
        while (node && node !== document.documentElement) {
            if (isTopicShortcutNav(node)) best = node
            node = node.parentElement
        }
        return best
    }

    function hideTopicNav() {
        const seen = new Set()
        for (const a of queryAllDeep('a[href]')) {
            const path = pathnameFromAnchor(a)
            if (path !== '/discover') continue
            const nav = findTopicNavFromAnchor(a)
            if (!nav || seen.has(nav) || containsComposer(nav)) continue
            seen.add(nav)
            hideElement(nav)
        }
    }

    let scheduledGlobal = false
    const scheduleGlobal = () => {
        if (scheduledGlobal) return
        scheduledGlobal = true
        requestAnimationFrame(() => {
            scheduledGlobal = false
            suppressModelCouncilMenuItem()
            suppressComputerModeMenuItem()
            suppressMaxOnlyModelMenuItems()
            hideAskInputModeToggleIndicator()
        })
    }

    const attachGlobalObserver = () => {
        const root = document.body || document.documentElement
        if (!root) return
        new MutationObserver(scheduleGlobal).observe(root, { childList: true, subtree: true })
    }

    injectStyles()
    blockModelCouncilClicks()
    blockComputerModeClicks()
    blockMaxOnlyModelClicks()
    scheduleGlobal()
    if (document.body) attachGlobalObserver()
    else document.addEventListener('DOMContentLoaded', attachGlobalObserver, { once: true })
    setInterval(() => {
        suppressModelCouncilMenuItem()
        suppressComputerModeMenuItem()
        suppressMaxOnlyModelMenuItems()
        hideAskInputModeToggleIndicator()
    }, 250)

    whenHome(() => {
        const purge = () => {
            if (!win.__pplxIsHomepage?.()) return
            hideComputerChip()
            hideAskInputModeToggleIndicator()
            hideTopicNav()
        }

        let scheduled = false
        const schedule = () => {
            if (scheduled) return
            scheduled = true
            requestAnimationFrame(() => {
                scheduled = false
                purge()
            })
        }

        purge()

        let observer = null
        const attachObserver = () => {
            const root = document.body || document.documentElement
            if (!root) return
            observer = new MutationObserver(schedule)
            observer.observe(root, { childList: true, subtree: true })
        }

        if (document.body) attachObserver()
        else document.addEventListener('DOMContentLoaded', attachObserver, { once: true })

        const intervalId = setInterval(purge, 250)

        return () => {
            observer?.disconnect()
            clearInterval(intervalId)
        }
    })
})()

//!		 8. Hide Upsell Banners (Upgrade, Try Computer, etc.)
;(() => {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
    if (win.__PPLX_BISECT && !win.__PPLX_BISECT.has('8')) return
    const run = win.__pplxWhenNotHomepage
    if (!run) return
    run(() => {
    const isHome = () => win.__pplxIsHomepage?.() === true

    // Perplexity labels live upsell wrappers with class "pplx-hidden-banner" — do NOT reuse that name.
    const SUPPRESS_CLASS = 'pplx-upsell-suppressed'
    const STYLE_ID = 'pplx-upsell-suppress-style'

    function containsComposer(node) {
        if (!node?.querySelector) return false
        return !!(
            node.querySelector('#ask-input') ||
            node.querySelector('[data-testid="ask-input"]') ||
            node.querySelector('textarea') ||
            node.querySelector('[contenteditable="true"]')
        )
    }

    const injectStyles = () => {
        if (isHome()) return
        if (document.getElementById(STYLE_ID)) return
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = `
        /* Upsell cards only — avoid href*="computer" (matches unrelated sprites) */
        .rounded-2xl:has(use[*|href*="custom-computer"]),
        .rounded-2xl:has(use[*|href*="pplx-icon-custom-computer"]),
        .bg-raised:has(use[*|href*="custom-computer"]),
        .bg-raised:has(use[*|href*="pplx-icon-custom-computer"]),
        div.pplx-hidden-banner:has(use[*|href*="custom-computer"]),
        div.pplx-hidden-banner:has(use[*|href*="pplx-icon-custom-computer"]),
        div:has(> div > .rounded-2xl:has(use[*|href*="custom-computer"])),
        div:has(> div > .bg-raised:has(use[*|href*="custom-computer"])),

        .${SUPPRESS_CLASS},
        .${SUPPRESS_CLASS} * {
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
        ;(document.head || document.documentElement).appendChild(style)
    }
    injectStyles()

    const BANNER_KEYWORDS = [
        'try computer',
        'let computer build',
        'computer generates full',
        'perplexity computer',
        'computer writes sql',
        'turn your data questions',
        'put computer to work',
        'ship faster with computer',
        'computer connects to',
        'upgrade to max',
        'upgrade now',
        'try this answer with'
    ]

    const BANNER_ICON_ATTRS = [
        'custom-computer',
        'perplexity_computer',
        'perplexity_computer_upsell',
        'pplx-icon-custom-computer'
    ]

    const COMPUTER_CTA_RE = /^\s*try\s+computer\s*$/i

    function useHref(useEl) {
        return (
            useEl.getAttribute('href') ||
            useEl.getAttribute('xlink:href') ||
            (useEl.href && useEl.href.baseVal) ||
            ''
        ).toLowerCase()
    }

    function isComputerUpsellIcon(href) {
        return BANNER_ICON_ATTRS.some(attr => href.includes(attr))
    }

    function isSuppressed(el) {
        return el && (el.classList.contains(SUPPRESS_CLASS) || el.closest(`.${SUPPRESS_CLASS}`))
    }

    function isProtectedContent(el) {
        return el.closest(
            '[data-testid="user-message"], .message-container, #ask-input, textarea, [contenteditable="true"]'
        )
    }

    function suppressNode(node) {
        if (!node || isSuppressed(node) || containsComposer(node)) return
        node.classList.add(SUPPRESS_CLASS)
        node.style.setProperty('display', 'none', 'important')
        node.style.setProperty('visibility', 'hidden', 'important')
        node.style.setProperty('pointer-events', 'none', 'important')
    }

    function findBannerContainer(el) {
        let card = el.closest(
            '.rounded-2xl, .bg-raised, .shadow-xl, .shadow-md, [role="dialog"], .modal, .border-subtlest, div.pplx-hidden-banner'
        )
        if (!card) {
            card = el.parentElement
            if (!card) return null
        }

        let current = card
        while (current.parentElement) {
            if (containsComposer(current)) return null
            const parent = current.parentElement
            if (
                parent === document.body ||
                parent === document.documentElement ||
                parent.tagName === 'MAIN'
            ) {
                break
            }

            const siblingCount = Array.from(parent.children).filter(c => {
                if (c === current) return true
                if (c.classList.contains(SUPPRESS_CLASS) || c.style.display === 'none')
                    return false
                return true
            }).length

            const isWrapper =
                siblingCount === 1 &&
                (parent.classList.contains('pplx-hidden-banner') ||
                    parent.style.opacity === '1' ||
                    parent.style.transform !== '' ||
                    parent.tagName === 'DIV')

            if (isWrapper) current = parent
            else break
        }
        return current
    }

    function isTryComputerButton(el) {
        if (el.tagName !== 'BUTTON') return false
        const label = (el.getAttribute('aria-label') || '').toLowerCase()
        if (label.includes('try computer')) return true
        const truncate = el.querySelector('.truncate')
        const text = (truncate ? truncate.textContent : el.textContent) || ''
        return COMPUTER_CTA_RE.test(text)
    }

    function isMatch(el) {
        if (isSuppressed(el) || isProtectedContent(el)) return false

        if (isTryComputerButton(el)) return true

        if (el.tagName === 'use' || el.tagName === 'USE') {
            if (isComputerUpsellIcon(useHref(el))) return true
        }

        if (el.tagName === 'IMG') {
            const src = (el.getAttribute('src') || '').toLowerCase()
            if (BANNER_ICON_ATTRS.some(attr => src.includes(attr))) return true
        }

        if (el.tagName === 'BUTTON') {
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase()
            if (BANNER_KEYWORDS.some(kw => ariaLabel.includes(kw))) return true
        }

        const text = (el.textContent || '').toLowerCase().trim()
        if (!text) return false
        for (const kw of BANNER_KEYWORDS) {
            if (!text.includes(kw)) continue
            if (
                el.tagName === 'BUTTON' ||
                el.tagName === 'A' ||
                el.tagName === 'H1' ||
                el.tagName === 'H2' ||
                el.tagName === 'H3' ||
                text.length < 200
            ) {
                return true
            }
        }
        return false
    }

    const removeBanners = () => {
        if (isHome()) return
        injectStyles()

        document.querySelectorAll('use').forEach(use => {
            if (isProtectedContent(use) || isSuppressed(use)) return
            if (!isComputerUpsellIcon(useHref(use))) return
            const target = findBannerContainer(use)
            if (target) suppressNode(target)
        })

        document.querySelectorAll('button').forEach(btn => {
            if (isProtectedContent(btn) || isSuppressed(btn)) return
            if (!isTryComputerButton(btn) && !isMatch(btn)) return
            const target = findBannerContainer(btn)
            if (target) suppressNode(target)
        })

        const containers = document.querySelectorAll(
            '.rounded-2xl, .bg-raised, .shadow-xl, div.pplx-hidden-banner'
        )
        containers.forEach(container => {
            if (isSuppressed(container) || isProtectedContent(container)) return

            const text = (container.textContent || '').toLowerCase()
            const hasKeyword = BANNER_KEYWORDS.some(kw => text.includes(kw))
            const hasComputerIcon = Array.from(container.querySelectorAll('use')).some(u =>
                isComputerUpsellIcon(useHref(u))
            )
            const hasTryCta = Array.from(container.querySelectorAll('button')).some(isTryComputerButton)

            if (!hasKeyword && !hasComputerIcon && !hasTryCta) return

            const isUpsell =
                hasComputerIcon ||
                hasTryCta ||
                container.querySelector('[aria-label="Dismiss"]') ||
                (hasKeyword &&
                    (container.querySelector('use') || container.querySelector('button.bg-button-bg')))

            if (!isUpsell) return
            const target = findBannerContainer(container)
            if (target) suppressNode(target)
        })
    }

    let scheduled = false
    const scheduleRemove = () => {
        if (scheduled) return
        scheduled = true
        requestAnimationFrame(() => {
            scheduled = false
            removeBanners()
        })
    }

    let observer = null
    let intervalId = null

    const startObserver = () => {
        const root = document.body || document.documentElement
        if (!root) return
        observer = new MutationObserver(scheduleRemove)
        observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden']
        })
        removeBanners()
    }

    if (document.body) startObserver()
    else document.addEventListener('DOMContentLoaded', startObserver, { once: true })

    intervalId = setInterval(removeBanners, 200)
    document.addEventListener('visibilitychange', onVis)

    function onVis() {
        if (document.visibilityState === 'visible') removeBanners()
    }

    return () => {
        observer?.disconnect()
        observer = null
        if (intervalId) clearInterval(intervalId)
        intervalId = null
        document.removeEventListener('visibilitychange', onVis)
        document.getElementById(STYLE_ID)?.remove()
        document.querySelectorAll(`.${SUPPRESS_CLASS}`).forEach((el) => {
            el.classList.remove(SUPPRESS_CLASS)
            el.style.removeProperty('display')
            el.style.removeProperty('visibility')
            el.style.removeProperty('pointer-events')
        })
    }
    })
})()

//!	9. Rate Limit Display
;(() => {
    'use strict'

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
    if (win.__PPLX_BISECT && !win.__PPLX_BISECT.has('9')) return

    const BADGE_ID = 'pplx-rate-limit-badge'
    const REFRESH_MS = 300_000 // 5 minutes
    const CACHE_KEY = 'pplx-rate-limit-cache'
    const TS_KEY = 'pplx-rate-limit-ts'

    function queryAllDeep(selector) {
        const out = []
        const visit = (node) => {
            if (!node?.querySelectorAll) return
            try {
                node.querySelectorAll(selector).forEach((el) => out.push(el))
            } catch {
                /* invalid selector in some roots */
            }
            node.querySelectorAll('*').forEach((el) => {
                if (el.shadowRoot) visit(el.shadowRoot)
            })
        }
        if (document.body) visit(document.body)
        else visit(document.documentElement)
        return out
    }

    function useHref(useEl) {
        return (
            useEl.getAttribute('href') ||
            useEl.getAttribute('xlink:href') ||
            (useEl.href && useEl.href.baseVal) ||
            ''
        ).toLowerCase()
    }

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

        const fallback = () => {
            const cached = localStorage.getItem(CACHE_KEY)
            if (cached) {
                try {
                    return JSON.parse(cached)
                } catch (err) {}
            }
            return { pro: '!', research: '!', uploadLimit: '!' }
        }

        try {
            const [rateRes, settingsRes] = await Promise.all([
                fetch('/rest/rate-limit/all'),
                fetch('/rest/user/settings', { credentials: 'include' }),
            ])
            if (!rateRes.ok) throw new Error(`rate-limit HTTP ${rateRes.status}`)
            const d = await rateRes.json()
            const limits = {
                pro: d.remaining_pro ?? '?',
                research: d.remaining_research ?? '?',
                uploadLimit: '?',
            }
            if (settingsRes.ok) {
                const settings = await settingsRes.json()
                limits.uploadLimit = settings.upload_limit ?? '?'
            }
            localStorage.setItem(CACHE_KEY, JSON.stringify(limits))
            localStorage.setItem(TS_KEY, now.toString())
            return limits
        } catch (e) {
            console.error('[pplx-rate-limit] Fetch error:', e)
            return fallback()
        }
    }

    function buildBadge() {
        const wrap = document.createElement('div')
        wrap.id = BADGE_ID
        wrap.title =
            'Pro / Research / document uploads remaining — click to refresh'
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
            <span style="opacity:.3; font-size: 10px;">|</span>
            <span title="Document uploads remaining" style="display:inline-flex;align-items:center;gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span id="pplx-rl-docs" style="font-weight: 500;">…</span>
            </span>
        `

        wrap.onclick = async (e) => {
            e.stopPropagation()
            setValues('…', '…', '…')
            const limits = await fetchLimits(true)
            setValues(limits.pro, limits.research, limits.uploadLimit ?? '?')
        }

        return wrap
    }

    function setValues(pro, research, docs) {
        const p = document.getElementById('pplx-rl-pro')
        const r = document.getElementById('pplx-rl-research')
        const doc = document.getElementById('pplx-rl-docs')
        if (p) p.textContent = pro
        if (r) r.textContent = research
        if (doc) doc.textContent = docs
    }

    function getModelButton() {
        const input = document.getElementById('ask-input')
        if (!input) return null

        const container =
            input.closest('div:has(> .px-3 #ask-input)') ||
            input.closest('.grid')
        if (!container) return null

        const buttons = Array.from(
            container.querySelectorAll('button[aria-haspopup="menu"]')
        )
        return buttons.find((btn) => btn.innerText.length > 0) || null
    }

    function getHomepageSearchButton() {
        for (const btn of queryAllDeep('button[aria-haspopup="menu"]')) {
            const hasSearchIcon = Array.from(btn.querySelectorAll('use')).some(
                (u) => useHref(u).includes('pplx-icon-search')
            )
            if (!hasSearchIcon) continue
            if (!/\bsearch\b/i.test(btn.textContent)) continue
            return btn
        }
        return null
    }

    function getAnchorButton() {
        return getModelButton() || getHomepageSearchButton()
    }

    function injectBadgeBeforeControl(controlBtn, badge) {
        const outer =
            controlBtn.parentElement?.parentElement ||
            controlBtn.parentElement
        const inner = controlBtn.parentElement
        if (!outer || !inner) return false
        outer.insertBefore(badge, inner)
        return true
    }

    async function tryInject() {
        const existing = document.getElementById(BADGE_ID)
        if (existing && !document.body.contains(existing)) existing.remove()
        if (document.getElementById(BADGE_ID)) return

        const anchorBtn = getAnchorButton()
        if (!anchorBtn) return

        const badge = buildBadge()
        if (!injectBadgeBeforeControl(anchorBtn, badge)) return

        const limits = await fetchLimits()
        setValues(limits.pro, limits.research, limits.uploadLimit ?? '?')
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
            const limits = await fetchLimits()
            setValues(
                limits.pro,
                limits.research,
                limits.uploadLimit ?? '?'
            )
        }, 60_000)

        window.addEventListener('storage', (e) => {
            if (e.key === CACHE_KEY && e.newValue) {
                try {
                    const limits = JSON.parse(e.newValue)
                    setValues(
                        limits.pro,
                        limits.research,
                        limits.uploadLimit ?? '?'
                    )
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

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
    if (win.__PPLX_BISECT && !win.__PPLX_BISECT.has('10')) return
    const run = win.__pplxWhenNotHomepage
    if (!run) return
    run(() => {

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
    })
})()

