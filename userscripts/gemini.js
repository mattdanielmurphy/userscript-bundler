// ==UserScript==
// @name         Gemini Conversation Timestamps
// @namespace    http://tampermonkey.net/
// @version      2.2.0
// @description  Message timestamps + sidebar dates. Auto-prepends timestamps to prompts.
// @icon         https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg
// @match        https://gemini.google.com/*
// @run-at       document-start
// ==/UserScript==

;(function () {
    'use strict'

    // ═══════════════════════════════════════════════════════════
    // GM SETTINGS
    // ═══════════════════════════════════════════════════════════

    let currentLayout = GM_getValue('gwd_layout_style', 'split')
    let showAbsolute = GM_getValue('gwd_show_absolute', false)
    let dateFormat = GM_getValue('gwd_date_format', 'yyyy-mm-dd')
    let isMenuExpanded = GM_getValue('gwd_menu_expanded', false)

    let menuIds = []

    function getMenuText(key) {
        const dict = {
            settingsToggle: `⚙️ Sidebar Date Settings (${isMenuExpanded ? 'Click to collapse ⬆️' : 'Click to expand ⬇️'})`,
            layout: ` ├─ 📐 Layout: ${currentLayout === 'split' ? 'Right (Click → Below title)' : 'Below title (Click → Right)'}`,
            absolute: ` ├─ ⏰ Detailed Time: ${showAbsolute ? 'Visible (Click → Hide)' : 'Hidden (Click → Show)'}`,
            format: ` └─ 📅 Date Format: ${dateFormat === 'yyyy-mm-dd' ? 'YYYY-MM-DD (Click → MM/DD/YYYY)' : 'MM/DD/YYYY (Click → YYYY-MM-DD)'}`,
        }
        return dict[key] || ''
    }

    function refreshMenu() {
        menuIds.forEach((id) => GM_unregisterMenuCommand(id))
        menuIds = []
        const opts = { autoClose: false }

        menuIds.push(
            GM_registerMenuCommand(
                getMenuText('settingsToggle'),
                () => {
                    isMenuExpanded = !isMenuExpanded
                    GM_setValue('gwd_menu_expanded', isMenuExpanded)
                    refreshMenu()
                },
                opts
            )
        )

        if (isMenuExpanded) {
            menuIds.push(
                GM_registerMenuCommand(
                    getMenuText('layout'),
                    () => {
                        currentLayout =
                            currentLayout === 'classic' ? 'split' : 'classic'
                        GM_setValue('gwd_layout_style', currentLayout)
                        clearAndReRenderSidebar()
                        refreshMenu()
                    },
                    opts
                )
            )

            menuIds.push(
                GM_registerMenuCommand(
                    getMenuText('absolute'),
                    () => {
                        showAbsolute = !showAbsolute
                        GM_setValue('gwd_show_absolute', showAbsolute)
                        clearAndReRenderSidebar()
                        refreshMenu()
                    },
                    opts
                )
            )

            menuIds.push(
                GM_registerMenuCommand(
                    getMenuText('format'),
                    () => {
                        dateFormat =
                            dateFormat === 'yyyy-mm-dd'
                                ? 'mm/dd/yyyy'
                                : 'yyyy-mm-dd'
                        GM_setValue('gwd_date_format', dateFormat)
                        clearAndReRenderSidebar()
                        refreshMenu()
                    },
                    opts
                )
            )
        }
    }

    refreshMenu()

    // ═══════════════════════════════════════════════════════════
    // SHARED TOOLTIP SINGLETON
    // ═══════════════════════════════════════════════════════════

    const FONT = 'Google Sans, Google Sans Flex, Roboto, sans-serif'
    let tooltipEl = null
    let tooltipTimer = null

    function ensureTooltip() {
        if (tooltipEl || !document.body) return
        tooltipEl = document.createElement('div')
        tooltipEl.style.cssText = `
      position: fixed;
      background: #1e1e2e;
      color: #e2e2f0;
      padding: 7px 13px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-family: ${FONT};
      pointer-events: none;
      z-index: 99999;
      display: none;
      box-shadow: 0 4px 18px rgba(0,0,0,0.4);
      white-space: nowrap;
      line-height: 1.6;
    `
        document.body.appendChild(tooltipEl)
    }

    function showTooltip(e, text) {
        ensureTooltip()
        if (!tooltipEl) return
        tooltipEl.innerText = text
        tooltipEl.style.display = 'block'
        positionTooltip(e)
    }

    function hideTooltip() {
        if (tooltipEl) tooltipEl.style.display = 'none'
    }

    function positionTooltip(e) {
        if (!tooltipEl) return
        tooltipEl.style.left = `${e.clientX + 14}px`
        tooltipEl.style.top = `${e.clientY - 42}px`
    }

    // Used by message timestamp spans
    function attachTooltip(el, getFullText) {
        el.style.cursor = 'default'
        el.addEventListener('mouseenter', (e) => showTooltip(e, getFullText()))
        el.addEventListener('mousemove', positionTooltip)
        el.addEventListener('mouseleave', hideTooltip)
    }

    // ═══════════════════════════════════════════════════════════
    // SHARED TIME UTILITIES
    // ═══════════════════════════════════════════════════════════

    function getLocalTzAbbr() {
        return new Date()
            .toLocaleTimeString('en-US', { timeZoneName: 'short' })
            .split(' ')
            .pop()
    }

    function getLocalTzOffsetHours() {
        return -new Date().getTimezoneOffset() / 60
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    function formatFullDateTime(date) {
        const d = date.toLocaleDateString([], {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        return `${d} at ${formatTime(date)} ${getLocalTzAbbr()}`
    }

    function getRelativeDateLabel(unix, forSidebar = false) {
        const date = new Date(unix * 1000)
        const now = new Date()
        const todayMs = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        ).getTime()
        const targetMs = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        ).getTime()
        const diffDays = Math.floor((todayMs - targetMs) / 86400000)

        if (diffDays <= 0) return forSidebar ? 'Today' : null
        if (diffDays === 1) return 'Yesterday'
        if (diffDays === 2) return '2 days ago'
        if (diffDays < 7) return `${diffDays} days ago`

        const weeks = Math.floor(diffDays / 7)
        if (diffDays < 30)
            return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`

        const months = Math.floor(diffDays / 30.44)
        if (diffDays < 365)
            return months === 1 ? '1 month ago' : `${months} months ago`

        const years = Math.floor(diffDays / 365.25)
        return years === 1 ? '1 year ago' : `${years} years ago`
    }

    // ═══════════════════════════════════════════════════════════
    // EMBED REGEX + MESSAGE TIMESTAMP STATE
    // ═══════════════════════════════════════════════════════════

    const EMBED_RE =
        /^\s*\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) ([A-Z]{2,5})([+-]\d+(?:\.\d+)?)\]\s*/
    const idToTimeMap = new Map()
    const exactContainers = new WeakSet()

    function buildMessageDisplay(unix, isEstimate) {
        const rel = getRelativeDateLabel(unix, false)
        const time = formatTime(new Date(unix * 1000))
        const prefix = isEstimate ? '~ ' : ''
        return rel === null ? `${prefix}${time}` : `${prefix}${rel}, ${time}`
    }

    function injectTimestamp(container, unix, isEstimate) {
        if (container.querySelector('.gm-timestamp')) return
        const stamp = document.createElement('span')
        stamp.className = 'gm-timestamp'
        stamp.innerText = buildMessageDisplay(unix, isEstimate)
        stamp.style.cssText = `
      font-size: 1rem;
      color: #555;
      font-family: ${FONT};
      width: 100%;
      margin-bottom: 8px;
      display: block;
      text-align: right;
    `
        attachTooltip(stamp, () => formatFullDateTime(new Date(unix * 1000)))
        container.prepend(stamp)
        console.log(
            `[GMT] injected "${stamp.innerText}" (estimate=${isEstimate})`
        )
    }

    // ═══════════════════════════════════════════════════════════
    // UNIFIED XHR + FETCH INTERCEPT
    // ═══════════════════════════════════════════════════════════

    function isSidebarUrl(url) {
        return url.includes('batchexecute') && url.includes('rpcids=MaZiqc')
    }

    const _xhrOpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url
        return _xhrOpen.apply(this, arguments)
    }

    const _xhrSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.send = function () {
        this.addEventListener('readystatechange', () => {
            const url = (this._url || '').toString()
            if (!url.includes('batchexecute')) return

            let res
            try {
                if (this.responseType === '' || this.responseType === 'text') {
                    res = this.responseText
                }
            } catch (e) {
                return
            }
            if (!res) return
            if (isSidebarUrl(url)) {
                if (this.readyState === 4) extractSidebarTimestamps(res)
            } else {
                if (this.readyState >= 3 && res.length > 500)
                    extractMessageTimestamps(res)
            }
        })
        return _xhrSend.apply(this, arguments)
    }

    const _fetch = window.fetch
    window.fetch = function (input, init) {
        const url = (typeof input === 'string' ? input : input?.url) || ''
        if (!isSidebarUrl(url)) return _fetch.apply(this, arguments)
        return _fetch.apply(this, arguments).then((res) => {
            res.clone()
                .text()
                .then(extractSidebarTimestamps)
                .catch(() => {})
            return res
        })
    }

    // ═══════════════════════════════════════════════════════════
    // MESSAGE TIMESTAMP EXTRACTION
    // ═══════════════════════════════════════════════════════════

    function extractMessageTimestamps(res) {
        try {
            const hexIds = res.match(/[a-f0-9]{16}/g) || []
            const timestamps = res.match(/\b17\d{8}\b/g) || []
            if (!hexIds.length || !timestamps.length) return

            let added = 0
            hexIds.forEach((id, i) => {
                if (!idToTimeMap.has(id)) {
                    idToTimeMap.set(
                        id,
                        parseInt(timestamps[i] || timestamps[0])
                    )
                    added++
                }
            })

            if (added > 0) {
                console.log(
                    `[GMT] XHR message: processed ${hexIds.length} IDs, added ${added} new timestamps`
                )
                injectHeuristicTimes()
            }
        } catch (e) {
            console.warn('[GMT] message ts error:', e)
        }
    }

    function injectHeuristicTimes() {
        const pending = []
        idToTimeMap.forEach((unix, id) => {
            let el =
                document.getElementById(id) ||
                document
                    .querySelector(`[jslog*="${id}"]`)
                    ?.closest('.conversation-container')
            if (
                el &&
                !el.closest(
                    '.conversation-container, user-query, model-response'
                )
            ) {
                el = null
            }
            if (
                el &&
                !el.querySelector('.gm-timestamp') &&
                !exactContainers.has(el)
            )
                pending.push({ container: el, unix })
        })
        pending.sort((a, b) =>
            a.container.compareDocumentPosition(b.container) &
            Node.DOCUMENT_POSITION_FOLLOWING
                ? -1
                : 1
        )
        let floor = 0
        pending.forEach(({ container, unix }) => {
            const clamped = Math.max(unix, floor)
            floor = clamped
            injectTimestamp(container, clamped, true)
        })
    }

    setInterval(injectHeuristicTimes, 2000)

    // ═══════════════════════════════════════════════════════════
    // EMBEDDED TIMESTAMP EXTRACTION FROM USER MESSAGES
    // ═══════════════════════════════════════════════════════════

    function parseEmbeddedUnix(dateStr, timeStr, offsetHours) {
        const ms = new Date(`${dateStr}T${timeStr}:00Z`).getTime()
        return Math.floor((ms - offsetHours * 3600000) / 1000)
    }

    function processEmbeddedTimestamps() {
        const nodes = document.querySelectorAll('p.query-text-line')
        if (nodes.length === 0) return
        console.log(`[GMT] scan: ${nodes.length} p.query-text-line node(s)`)
        nodes.forEach((p, i) => {
            const raw = p.innerText || p.textContent || ''
            const match = raw.match(EMBED_RE)
            if (!match) return
            console.log(
                `[GMT] [${i}] date=${match[1]} time=${match[2]} tz=${match[3]} offset=${match[4]}`
            )
            const userQuery = p.closest('user-query')
            if (!userQuery) {
                console.warn(`[GMT] [${i}] no user-query ancestor`)
                return
            }
            const container = userQuery.parentElement
            if (!container) {
                console.warn(`[GMT] [${i}] no container`)
                return
            }
            if (
                exactContainers.has(container) ||
                container.querySelector('.gm-timestamp')
            )
                return
            const unix = parseEmbeddedUnix(
                match[1],
                match[2],
                parseFloat(match[4])
            )
            p.innerText = raw.replace(EMBED_RE, '').trim()
            exactContainers.add(container)
            injectTimestamp(container, unix, false)
        })
    }

    // ═══════════════════════════════════════════════════════════
    // SIDEBAR DATES
    // ═══════════════════════════════════════════════════════════

    const conversationDates = new Map()

    function extractSidebarTimestamps(text) {
        if (!text) return
        const blocks = text.split('"c_')
        let found = false
        for (let i = 1; i < blocks.length; i++) {
            const idMatch = blocks[i].match(/^([a-zA-Z0-9_-]+)/)
            if (!idMatch) continue
            const id = idMatch[1]
            const tsMatch = blocks[i].match(/\[(\d{10}),/)
            if (tsMatch && !conversationDates.has(id)) {
                conversationDates.set(id, parseInt(tsMatch[1], 10))
                found = true
            }
        }
        if (found) {
            console.log(
                `[GMT] sidebar: ${conversationDates.size} conversation dates`
            )
            updateSidebarDOM()
        }
    }

    function formatAbsoluteTime(d) {
        const yyyy = d.getFullYear()
        const MM = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        const min = String(d.getMinutes()).padStart(2, '0')
        if (dateFormat === 'mm/dd/yyyy') {
            const h12 = d.getHours() % 12 || 12
            const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
            return `${MM}/${dd}/${yyyy} ${h12}:${min} ${ampm}`
        }
        return `${yyyy}-${MM}-${dd} ${String(d.getHours()).padStart(2, '0')}:${min}`
    }

    function clearAndReRenderSidebar() {
        document
            .querySelectorAll('.gwd-sidebar-date-wrapper')
            .forEach((el) => el.remove())
        document
            .querySelectorAll('a[data-test-id="conversation"]')
            .forEach((item) => {
                item.removeAttribute('data-date-injected')
                item.classList.remove('gwd-split-mode')
                const title = item.querySelector('.conversation-title')
                if (title) title.style.paddingRight = ''
            })
        updateSidebarDOM()
    }

    function updateSidebarDOM() {
        if (!document.body) return
        const currentPath = window.location.pathname

        document
            .querySelectorAll('a[data-test-id="conversation"]')
            .forEach((item) => {
                const href = item.getAttribute('href')
                item.classList.toggle('gwd-is-active', href === currentPath)

                // Suppress Gemini's native Angular tooltip on the item itself
                if (!item.hasAttribute('data-gwd-hover-bound')) {
                    const blockNative = (e) => e.stopImmediatePropagation()
                    item.addEventListener('mouseover', blockNative, true)
                    item.addEventListener(
                        'mouseenter',
                        () => item.removeAttribute('mattooltip'),
                        true
                    )
                    item.setAttribute('data-gwd-hover-bound', 'true')
                }

                if (item.hasAttribute('data-date-injected')) return
                if (!href) return

                const idMatch = href.match(/\/app\/([a-zA-Z0-9_-]+)/)
                if (!idMatch || !conversationDates.has(idMatch[1])) return

                const id = idMatch[1]
                const d = new Date(conversationDates.get(id) * 1000)
                const ts = conversationDates.get(id)
                const rel = getRelativeDateLabel(ts, true)
                const abs = formatAbsoluteTime(d)
                const titleContainer = item.querySelector('.conversation-title')

                item.style.position = 'relative'
                const wrapper = document.createElement('div')
                wrapper.className = 'gwd-sidebar-date-wrapper'

                // Tooltip is bound to the wrapper only — not the whole item
                wrapper.style.cursor = 'default'
                wrapper.addEventListener('mouseenter', (e) => {
                    clearTimeout(tooltipTimer)
                    tooltipTimer = setTimeout(
                        () => showTooltip(e, formatFullDateTime(d)),
                        100
                    )
                })
                wrapper.addEventListener('mousemove', positionTooltip)
                wrapper.addEventListener('mouseleave', () => {
                    clearTimeout(tooltipTimer)
                    hideTooltip()
                })

                if (currentLayout === 'classic') {
                    wrapper.style.cssText = `
          font-size: 11px;
          font-family: ${FONT};
          color: var(--gmpx-color-on-surface-variant, #888);
          line-height: 1.2;
          font-weight: normal;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: default;
        `
                    wrapper.textContent = showAbsolute ? `${rel} · ${abs}` : rel
                    if (titleContainer) titleContainer.appendChild(wrapper)
                } else {
                    item.classList.add('gwd-split-mode')
                    wrapper.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          flex-shrink: 0;
          margin-left: auto;
          padding-left: 8px;
          cursor: default;
        `
                    const relDiv = document.createElement('div')
                    relDiv.textContent = rel
                    relDiv.style.cssText = `
          font-size: 13px;
          font-weight: 500;
          font-family: ${FONT};
          color: var(--gmpx-color-on-surface-variant, #888);
          line-height: 1.2;
          pointer-events: none;
        `
                    wrapper.appendChild(relDiv)

                    if (showAbsolute) {
                        const absDiv = document.createElement('div')
                        absDiv.textContent = abs
                        absDiv.style.cssText = `
            position: absolute;
            bottom: -6px;
            left: 14px;
            font-size: 11px;
            font-family: ${FONT};
            font-weight: var(--gem-sys-typography-type-scale--label-l-font-weight);
            letter-spacing: var(--gem-sys-typography-type-scale--label-l-font-tracking);
            line-height: var(--gem-sys-typography-type-scale--label-l-line-height);
            color: var(--gmpx-color-on-surface-variant, #888);
            white-space: nowrap;
            pointer-events: none;
          `
                        wrapper.appendChild(absDiv)
                    }

                    const trailingIcon = item.querySelector(
                        '.trailing-icon-container'
                    )
                    if (trailingIcon) item.insertBefore(wrapper, trailingIcon)
                    else item.appendChild(wrapper)
                }

                item.setAttribute('data-date-injected', 'true')
            })
    }

    // ═══════════════════════════════════════════════════════════
    // PROMPT TIMESTAMP PREPEND
    // ═══════════════════════════════════════════════════════════

    function getNowTimestamp() {
        const now = new Date()
        const date = now.toLocaleDateString('en-CA')
        const hh = String(now.getHours()).padStart(2, '0')
        const mm = String(now.getMinutes()).padStart(2, '0')
        const tz = getLocalTzAbbr()
        const off = getLocalTzOffsetHours()
        return `[${date} ${hh}:${mm} ${tz}${off >= 0 ? '+' + off : off}]`
    }

    function getSendButton(target) {
        if (!target) return null
        const btn = target.closest('button')
        if (!btn) return null
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase()
        const title = (btn.getAttribute('title') || '').toLowerCase()
        const dataTestId = (btn.getAttribute('data-test-id') || btn.getAttribute('data-testid') || '').toLowerCase()
        const hasSendClass = Array.from(btn.classList).some(c => c.toLowerCase().includes('send') || c.toLowerCase().includes('submit'))
        
        if (
            ariaLabel.includes('send') || 
            ariaLabel.includes('submit') || 
            title.includes('send') || 
            title.includes('submit') ||
            dataTestId.includes('send') ||
            dataTestId.includes('submit') ||
            hasSendClass ||
            btn.querySelector('mat-icon[fonticon="send"], mat-icon[fonticon="arrow_upward"], mat-icon[data-mat-icon-name="send"], mat-icon[data-mat-icon-name="arrow_upward"]')
        ) {
            return btn
        }
        return null
    }

    document.addEventListener(
        'click',
        function (e) {
            const btn = getSendButton(e.target)
            if (!btn) return
            const editor = document.querySelector(
                '.ql-editor[contenteditable="true"]'
            )
            if (!editor) return

            // Avoid the read-replace cycle that can double newlines in contenteditable
            const currentText = editor.innerText || ''
            if (!currentText.trim() || EMBED_RE.test(currentText)) return

            e.stopImmediatePropagation()
            e.preventDefault()

            // Prepend timestamp by moving cursor to start and inserting text
            editor.focus()
            const sel = window.getSelection()
            const range = document.createRange()
            range.setStart(editor, 0)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)

            const timestamp = getNowTimestamp() + ' '
            document.execCommand('insertText', false, timestamp)
            console.log(`[GMT] prepended: "${timestamp}"`)

            // Re-trigger click after a short delay
            setTimeout(() => {
                const freshBtn = getSendButton(e.target) || btn
                if (freshBtn) freshBtn.click()
            }, 80)
        },
        true
    )

    document.addEventListener(
        'keydown',
        function (e) {
            if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
            
            const editor = e.target.closest('.ql-editor[contenteditable="true"]')
            if (!editor) return

            const currentText = editor.innerText || ''
            if (!currentText.trim() || EMBED_RE.test(currentText)) return

            e.stopImmediatePropagation()
            e.preventDefault()

            // Prepend timestamp
            editor.focus()
            const sel = window.getSelection()
            const range = document.createRange()
            range.setStart(editor, 0)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)

            const timestamp = getNowTimestamp() + ' '
            document.execCommand('insertText', false, timestamp)
            console.log(`[GMT] keydown prepended: "${timestamp}"`)

            // Dispatch enter key to trigger angular submission
            setTimeout(() => {
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                })
                editor.dispatchEvent(event)
            }, 80)
        },
        true
    )

    // ═══════════════════════════════════════════════════════════
    // TAB TITLE SYNC
    // ═══════════════════════════════════════════════════════════

    function updateTabTitle() {
        const titleEl = document.querySelector(
            '[data-test-id="conversation-title"]'
        )
        if (titleEl) {
            const newTitle = titleEl.innerText.trim()
            if (newTitle && document.title !== newTitle) {
                document.title = newTitle
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // OBSERVERS
    // ═══════════════════════════════════════════════════════════

    let lastUrl = location.href

    function startObservers() {
        if (!document.body) {
            requestAnimationFrame(startObservers)
            return
        }
        ensureTooltip()
        new MutationObserver(() => {
            processEmbeddedTimestamps()
            updateSidebarDOM()
            updateTabTitle()
            const url = location.href
            if (url !== lastUrl) {
                lastUrl = url
                updateSidebarDOM()
                updateTabTitle()
            }
        }).observe(document.body, { childList: true, subtree: true })
        processEmbeddedTimestamps()
        updateSidebarDOM()
        updateTabTitle()
        console.log('[GMT] observers started')
    }

    startObservers()

    // ═══════════════════════════════════════════════════════════
    // GEMINI MODEL OPTIMIZER
    // ═══════════════════════════════════════════════════════════

    const OPTIMIZER_SCRIPT_ID = 'gemini_optimizer_final_v11'

    if (window[OPTIMIZER_SCRIPT_ID]) {
        window[OPTIMIZER_SCRIPT_ID].observer.disconnect()
    }

    function getModelDetails(item) {
        const clone = item.cloneNode(true)
        // Remove icons, SVGs, and other non-text decorative components
        clone
            .querySelectorAll('mat-icon, g-icon, svg, .icon, img')
            .forEach((el) => el.remove())

        // Try to find known title elements or classes
        const titleEl = clone.querySelector(
            '.bard-mode-menu-item-title, .model-title, [class*="title"], strong, b'
        )
        const descEl = clone.querySelector(
            '.bard-mode-menu-item-description, .model-description, [class*="description"], [class*="subtitle"], .description'
        )

        let name = titleEl ? titleEl.innerText.trim() : ''
        let description = descEl ? descEl.innerText.trim() : ''

        if (!name) {
            const lines = clone.innerText
                .split('\n')
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
                .replace(/\bgemini\b/g, '')
                .replace(/\bgoogle\b/g, '')
                .replace(/[^a-z0-9.-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()

        const cleanModel = clean(modelName)
        const cleanLabel = clean(labelText)

        if (!cleanModel || !cleanLabel) return false

        const hasLite = (str) => str.includes('lite')
        if (hasLite(cleanModel) !== hasLite(cleanLabel)) {
            return false
        }

        return (
            cleanLabel.includes(cleanModel) || cleanModel.includes(cleanLabel)
        )
    }

    async function performSelection(modelName, targetThinking) {
        const originalModelBtn = Array.from(
            document.querySelectorAll(
                '.mat-mdc-menu-item.bard-mode-list-button'
            )
        ).find(
            (el) => getModelDetails(el).name.toLowerCase() === modelName.toLowerCase()
        )

        if (!originalModelBtn) return

        const trigger = document.querySelector('button.input-area-switch')
        const currentLabel = trigger?.innerText.toLowerCase() || ''
        const isTargetModelSelected = isModelMatch(modelName, currentLabel)
        const isCurrentlyExtended =
            currentLabel.includes('extended') ||
            currentLabel.includes('thinking')

        const overlayContainer = document.querySelector(
            '.cdk-overlay-container'
        )
        const hideOverlay = () => {
            if (overlayContainer) overlayContainer.style.opacity = '0'
        }
        const showOverlay = () => {
            if (overlayContainer) overlayContainer.style.opacity = '1'
        }

        if (targetThinking === 'extended') {
            if (isTargetModelSelected && isCurrentlyExtended) {
                document.body.click()
                return
            }

            hideOverlay()
            originalModelBtn.click()

            setTimeout(async () => {
                const newTrigger = document.querySelector(
                    'button.input-area-switch'
                )
                if (newTrigger) newTrigger.click()
                await new Promise((r) => setTimeout(r, 60))

                const header = document.querySelector('.thinking-level-header')
                if (header) {
                    header.click()
                    await new Promise((r) => setTimeout(r, 40))
                    const opt = Array.from(
                        document.querySelectorAll(
                            '.thinking-level-option-title'
                        )
                    ).find((o) =>
                        o.innerText.toLowerCase().includes('extended')
                    )
                    if (opt) opt.click()
                }
                showOverlay()
            }, 180)
        } else {
            if (isTargetModelSelected && isCurrentlyExtended) {
                hideOverlay()
                const header = document.querySelector('.thinking-level-header')
                if (header) {
                    header.click()
                    await new Promise((r) => setTimeout(r, 40))
                    const opt = Array.from(
                        document.querySelectorAll(
                            '.thinking-level-option-title'
                        )
                    ).find((o) =>
                        o.innerText.toLowerCase().includes('standard')
                    )
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
                '.thinking-level-divider, .upgrade-container.g1-upsell-container'
            )
            .forEach((el) =>
                el.style.setProperty('display', 'none', 'important')
            )

        const panels = document.querySelectorAll('.mat-mdc-menu-panel')
        panels.forEach((panel) => {
            if (panel.querySelector('.custom-menu-grid-row')) return

            const menuItems = Array.from(
                panel.querySelectorAll(
                    '.mat-mdc-menu-item.bard-mode-list-button'
                )
            )
            if (menuItems.length === 0) return

            const header = panel.querySelector('.thinking-level-header')
            if (header) {
                header.style.cssText =
                    'width: 0; height: 0; opacity: 0; overflow: hidden; padding: 0; margin: 0; border: none; min-height: 0; position: absolute; pointer-events: auto;'
            }

            const trigger = document.querySelector('button.input-area-switch')
            const currentLabelText = trigger?.innerText.toLowerCase() || ''

            menuItems.forEach((item) => {
                const { name: modelName, description } = getModelDetails(item)
                if (!modelName) return

                const isThisModelSelected = isModelMatch(
                    modelName,
                    currentLabelText
                )
                const isExtended =
                    currentLabelText.includes('extended') ||
                    currentLabelText.includes('thinking')

                const grid = document.createElement('div')
                grid.className = 'custom-menu-grid-row'
                grid.style.cssText =
                    'display: grid; grid-template-columns: 1.8fr 1fr; gap: 0; margin: 6px 12px; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.2s ease;'

                const isStandardActive = isThisModelSelected && !isExtended
                const isThinkingActive = isThisModelSelected && isExtended

                // Create standard button
                const btnStandard = document.createElement('button')
                btnStandard.style.cssText =
                    'display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 12px 10px; margin: 0; border: none; background: transparent; cursor: pointer; font-family: "Google Sans Flex", sans-serif; text-align: center; transition: all 0.2s ease; border-right: 1px solid rgba(255, 255, 255, 0.06); outline: none;'

                const nameDiv = document.createElement('div')
                nameDiv.innerText = modelName
                nameDiv.style.cssText =
                    'font-weight: 500; font-size: 14px; color: #e3e3e3;'
                btnStandard.appendChild(nameDiv)

                let descDiv = null
                if (description) {
                    descDiv = document.createElement('div')
                    descDiv.innerText = description
                    descDiv.style.cssText =
                        'font-weight: 400; font-size: 11px; margin-top: 3px; transition: color 0.2s ease;'
                    btnStandard.appendChild(descDiv)
                }

                // Create thinking button
                const btnThinking = document.createElement('button')
                btnThinking.style.cssText =
                    'display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 12px 10px; margin: 0; border: none; background: transparent; cursor: pointer; font-family: "Google Sans Flex", sans-serif; text-align: center; transition: all 0.2s ease; outline: none;'

                const thinkingDiv = document.createElement('div')
                thinkingDiv.innerText = 'Thinking'
                thinkingDiv.style.cssText =
                    'font-weight: 500; font-size: 14px; color: #e3e3e3; transition: color 0.2s ease;'
                btnThinking.appendChild(thinkingDiv)

                // Style based on active state
                if (isStandardActive) {
                    btnStandard.style.backgroundColor =
                        'rgba(255, 255, 255, 0.12)'
                    if (descDiv) descDiv.style.color = '#c4c7c5'
                } else if (isThinkingActive) {
                    btnThinking.style.backgroundColor =
                        'rgba(168, 199, 250, 0.2)'
                    thinkingDiv.style.color = '#a8c7fa'

                    // Subtle highlight for base button to show connection
                    btnStandard.style.backgroundColor =
                        'rgba(255, 255, 255, 0.04)'
                    if (descDiv) descDiv.style.color = '#a8c7fa'
                } else {
                    if (descDiv) descDiv.style.color = '#8e918f'
                }

                // Hover interaction logic
                btnStandard.onmouseenter = () => {
                    if (!isStandardActive && !isThinkingActive) {
                        btnStandard.style.backgroundColor =
                            'rgba(255, 255, 255, 0.08)'
                        if (descDiv) descDiv.style.color = '#c4c7c5'
                    }
                }
                btnStandard.onmouseleave = () => {
                    if (!isStandardActive && !isThinkingActive) {
                        btnStandard.style.backgroundColor = 'transparent'
                        if (descDiv) descDiv.style.color = '#8e918f'
                    }
                }

                btnThinking.onmouseenter = () => {
                    if (!isThinkingActive) {
                        btnThinking.style.backgroundColor =
                            'rgba(168, 199, 250, 0.12)'
                        thinkingDiv.style.color = '#a8c7fa'
                    }
                    // Hovering thinking highlights standard as an extension
                    if (!isStandardActive && !isThinkingActive) {
                        btnStandard.style.backgroundColor =
                            'rgba(255, 255, 255, 0.04)'
                        if (descDiv) descDiv.style.color = '#c4c7c5'
                    }
                }
                btnThinking.onmouseleave = () => {
                    if (!isThinkingActive) {
                        btnThinking.style.backgroundColor = 'transparent'
                        thinkingDiv.style.color = '#e3e3e3'
                    }
                    if (!isStandardActive && !isThinkingActive) {
                        btnStandard.style.backgroundColor = 'transparent'
                        if (descDiv) descDiv.style.color = '#8e918f'
                    }
                }

                btnStandard.onclick = (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    performSelection(modelName, 'standard')
                }

                btnThinking.onclick = (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    performSelection(modelName, 'extended')
                }

                grid.appendChild(btnStandard)
                grid.appendChild(btnThinking)

                item.style.display = 'none'
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
        console.log('Gemini Optimizer Active (Dynamic Models).')
    }

    startOptimizer()
})()
