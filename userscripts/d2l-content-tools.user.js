// ==UserScript==
// @name        D2L / StudyForge Content Tools
// @match       https://*.onlinelearningbc.com/d2l/*
// @match       https://*.onlinelearningbc.com/content/*
// @match       https://*.studyforge.net/*
// @match       https://d2l.sd44.bc.ca/*
// @match       *://*.contentconnections.ca/*
// @require     https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require     https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @require     https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @grant       none
// @version     1.7
// @author      Antigravity
// @description Download images as ZIP, take snapshots, extract scripts, and copy prompts for D2L/StudyForge/contentconnections.
// ==/UserScript==

;(function () {
    'use strict'
    console.log(
        `[D2L-DL] Userscript initialized in ${window.location.href} (Top: ${window === window.top})`
    )

    const IS_TOP = window === window.top

    // Custom checkbox feature for lesson titles
    console.log('checking location', window.location.href)
    if (window.location.href.includes('/lessons/')) {
        console.log('running checkbox insertion')
        ;(function () {
            const runScript = () => {
                const iframe = document.querySelector(
                    'iframe[src*="smart-curriculum"]'
                )
                if (!iframe) return

                let iframeDoc
                try {
                    iframeDoc =
                        iframe.contentDocument || iframe.contentWindow.document
                } catch (e) {
                    return
                }

                if (!iframeDoc || iframeDoc.readyState !== 'complete') return

                const processItems = () => {
                    const titles = iframeDoc.querySelectorAll(
                        '.title-text, .topic-box span[id*="label"]'
                    )

                    titles.forEach((el) => {
                        // Remove disruptive .text-wrapper divs
                        el.querySelectorAll('.text-wrapper').forEach(
                            (wrapper) => wrapper.remove()
                        )

                        const win = iframe.contentWindow
                        const style = win.getComputedStyle(el)
                        const isHidden =
                            style.width === '1px' ||
                            style.height === '1px' ||
                            el.classList.contains('screen-reader-only')

                        if (isHidden && el.tagName === 'SPAN') return

                        // --- LAYOUT FIXES FOR LONG TITLES ---
                        el.style.display = 'flex'
                        el.style.alignItems = 'flex-start' // Align checkbox to top of text
                        el.style.maxWidth = '100%'
                        el.style.overflow = 'visible' // Prevent scrollbars
                        el.style.whiteSpace = 'normal' // Allow text to wrap
                        el.style.height = 'auto' // Let it grow vertically

                        // Ensure child spans also wrap properly
                        const textSpan = el.querySelector('span')
                        if (textSpan) {
                            textSpan.style.whiteSpace = 'normal'
                            textSpan.style.display = 'inline'
                        }
                        // ------------------------------------

                        if (el.querySelector('.custom-check')) return

                        const text = el.innerText.trim()
                        if (!text) return
                        const key = `check_state_${text.replace(/\s+/g, '_')}`

                        const cb = iframeDoc.createElement('input')
                        cb.type = 'checkbox'
                        cb.className = 'custom-check'
                        // margin-top: 3px aligns the checkbox with the first line of text
                        cb.style.cssText =
                            'margin-right: 10px; margin-top: 3px; width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; position: relative; z-index: 10;'

                        cb.checked = localStorage.getItem(key) === 'true'
                        if (cb.checked) el.style.opacity = '0.5'

                        cb.onclick = (e) => e.stopPropagation()
                        cb.onchange = () => {
                            localStorage.setItem(key, cb.checked)
                            el.style.opacity = cb.checked ? '0.5' : '1'
                        }

                        el.prepend(cb)
                    })
                }

                processItems()

                if (!iframeDoc._hasCheckboxObserver) {
                    const observer = new MutationObserver(processItems)
                    observer.observe(iframeDoc.body, {
                        childList: true,
                        subtree: true,
                    })
                    iframeDoc._hasCheckboxObserver = true
                }
            }

            const pollInterval = setInterval(runScript, 1000)
            runScript()
        })()
    }

    function findInShadow(selector, root = document) {
        const el = root.querySelector(selector)
        if (el) return el

        const walkers = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) =>
                    node.shadowRoot
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP,
            }
        )

        let node
        while ((node = walkers.nextNode())) {
            const found = findInShadow(selector, node.shadowRoot)
            if (found) return found
        }
        return null
    }

    function findIframes(root = document, list = []) {
        list.push(...Array.from(root.querySelectorAll('iframe')))

        const walkers = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) =>
                    node.shadowRoot
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP,
            }
        )

        let node
        while ((node = walkers.nextNode())) {
            findIframes(node.shadowRoot, list)
        }
        return list
    }

    function findImages(root = document, list = []) {
        list.push(...Array.from(root.querySelectorAll('img')))

        const walkers = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) =>
                    node.shadowRoot
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP,
            }
        )

        let node
        while ((node = walkers.nextNode())) {
            findImages(node.shadowRoot, list)
        }
        return list
    }

    function checkQMode() {
        let isQMode = false
        try {
            isQMode =
                /\/lesson\/\d+#Q\d+/.test(window.location.href) ||
                (window.top &&
                    /\/lesson\/\d+#Q\d+/.test(window.top.location.href))
        } catch (err) {
            isQMode = /\/lesson\/\d+#Q\d+/.test(window.location.href)
        }
        return isQMode
    }

    function findInDocumentOrIframes(selector, doc = document) {
        const found = findInShadow(selector, doc)
        if (found) return found

        const iframes = findIframes(doc)
        for (const iframe of iframes) {
            try {
                if (iframe.contentDocument) {
                    const el = findInDocumentOrIframes(
                        selector,
                        iframe.contentDocument
                    )
                    if (el) return el
                }
            } catch (e) {
                // Cross-origin iframe, ignore
            }
        }
        return null
    }

    function findAllInShadow(selector, root = document, list = []) {
        list.push(...Array.from(root.querySelectorAll(selector)))

        const walkers = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) =>
                    node.shadowRoot
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP,
            }
        )

        let node
        while ((node = walkers.nextNode())) {
            findAllInShadow(selector, node.shadowRoot, list)
        }
        return list
    }

    function findAllInDocumentOrIframes(selector, doc = document) {
        let list = findAllInShadow(selector, doc)

        const iframes = findIframes(doc)
        for (const iframe of iframes) {
            try {
                if (iframe.contentDocument) {
                    list = list.concat(
                        findAllInDocumentOrIframes(
                            selector,
                            iframe.contentDocument
                        )
                    )
                }
            } catch (e) {
                // Cross-origin iframe, ignore
            }
        }
        return list
    }

    function getCurrentQuestionYesButton() {
        const answers = findAllInDocumentOrIframes(
            'div.qf-answer.qf-answer-text, div.qf-answer-text[role="button"]'
        )
        const visible = answers.filter(
            (el) => el.getAttribute('aria-hidden') === 'false'
        )
        if (!visible.length) return null
        const current = visible[visible.length - 1]
        return (
            current.querySelector(
                '.qf-cell.qf-answer-option.yes[role="button"]'
            ) || current.querySelector('.qf-cell.qf-answer-option.yes')
        )
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    function getActiveQuestionRoot() {
        const all = findAllInDocumentOrIframes('.qf-question')
        if (all.length) {
            const visible = all.filter((el) => {
                const r = el.getBoundingClientRect()
                return r.width > 0 && r.height > 0
            })
            return visible[visible.length - 1] || all[all.length - 1]
        }
        return findInDocumentOrIframes('[id^="question-display-"]')
    }

    function letterFromPart(partEl) {
        const li = partEl.querySelector('ol[type="a"] > li, ol[type="A"] > li')
        if (li) {
            const v = parseInt(li.getAttribute('value'), 10)
            if (!Number.isNaN(v) && v >= 1) {
                return String.fromCharCode(96 + v)
            }
        }
        const label = partEl.querySelector('.qf-paragraph span span')
        const text = (label && label.textContent) || ''
        const m = text.match(/^\s*([a-z])\)/i)
        return m ? m[1].toLowerCase() : '?'
    }

    const ANSWER_REVEAL_SELECTOR =
        'div.qf-answer[role="button"], div.qf-answer-text[role="button"]'

    function isAnswerRevealControl(el) {
        if (!el || el.nodeType !== 1) return false
        const label = (el.getAttribute('aria-label') || '').toLowerCase()
        return label.includes('show') && label.includes('answer')
    }

    function findAllAnswerRevealControls(doc = document) {
        return findAllInDocumentOrIframes(ANSWER_REVEAL_SELECTOR).filter(
            isAnswerRevealControl
        )
    }

    function isAnswerRevealed(el) {
        return (
            el.classList.contains('show') ||
            el.getAttribute('aria-hidden') === 'false'
        )
    }

    function findAnswerElementInPart(partEl) {
        if (!partEl) return null
        return (
            partEl.querySelector('.qf-answer') ||
            partEl.querySelector('.qf-answer-text[role="button"]')
        )
    }

    function getAnswerContentRoot(answerEl) {
        if (!answerEl) return null
        const nested = answerEl.querySelector('.qf-answer-content')
        if (nested) return nested

        const clone = answerEl.cloneNode(true)
        clone
            .querySelectorAll(
                '.qf-feedback-question, .qf-table, .qf-row, .qf-cell, .qf-answer-option'
            )
            .forEach((el) => el.remove())
        clone.querySelectorAll(':scope > div').forEach((div) => {
            if (
                !div.querySelector(
                    'script[type^="math/tex"], .MathJax_SVG, .mjx-container, span.MathJax'
                )
            ) {
                div.remove()
            }
        })
        return clone
    }

    function getQuestionPartsWithAnswers(questionRoot) {
        if (!questionRoot) return []
        const parts = questionRoot.querySelectorAll('.qf-part')
        const withAnswers = Array.from(parts).filter((p) =>
            findAnswerElementInPart(p)
        )
        if (withAnswers.length) return withAnswers
        if (findAnswerElementInPart(questionRoot)) return [questionRoot]
        return []
    }

    function isMultiPartQuestion(partEl) {
        const questionRoot =
            partEl.closest('.qf-question') ||
            partEl.closest('[id^="question-display-"]') ||
            partEl
        return getQuestionPartsWithAnswers(questionRoot).length > 1
    }

    function getShowAnswerControl(partEl) {
        return (
            partEl.querySelector('.qf-answer[role="button"]') ||
            partEl.querySelector('.qf-answer-text[role="button"]') ||
            partEl.querySelector('.qf-answer[tabindex="0"]') ||
            findAnswerElementInPart(partEl)
        )
    }

    const MATH_NODE_SELECTOR =
        'script[type^="math/tex"], .mjx-container, .MathJax_SVG, .MathJax_Display, span.MathJax'

    const MATH_RENDERED_REMOVE_SELECTOR =
        '.MathJax_SVG, .MathJax_Display, .mjx-container, span.MathJax, .MathJax_Preview'

    function removeRenderedMathIfTexPresent(root) {
        if (!root?.querySelector('script[type^="math/tex"]')) return false
        root.querySelectorAll(MATH_RENDERED_REMOVE_SELECTOR).forEach((el) =>
            el.remove()
        )
        return true
    }

    /** TeX script(s) only — never mix with MathJax SVG innerText (speech duplicate). */
    function extractLatexFromMathRoot(root) {
        if (!root) return ''
        const clone = root.cloneNode(true)
        clone
            .querySelectorAll(
                '.qf-feedback-question, .qf-table, .MathJax_Preview'
            )
            .forEach((el) => el.remove())
        removeRenderedMathIfTexPresent(clone)
        const scripts = [...clone.querySelectorAll('script[type^="math/tex"]')]
            .map((s) => s.textContent.trim())
            .filter(Boolean)
        if (scripts.length) return scripts.join(' ')
        return ''
    }

    function mathReplacementText(el) {
        if (!el || el.nodeType !== 1) return ''
        if (
            el.tagName === 'SCRIPT' &&
            (el.getAttribute('type') || '').startsWith('math/tex')
        ) {
            return el.textContent.trim()
        }
        const nestedTex = el.querySelector('script[type^="math/tex"]')
        if (nestedTex && nestedTex.textContent.trim()) {
            return nestedTex.textContent.trim()
        }
        let prev = el.previousElementSibling
        while (prev) {
            if (
                prev.tagName === 'SCRIPT' &&
                (prev.getAttribute('type') || '').startsWith('math/tex')
            ) {
                const t = prev.textContent.trim()
                if (t) return t
            }
            if (
                prev.matches?.(
                    '.MathJax_SVG, .MathJax_Display, .mjx-container, span.MathJax'
                )
            ) {
                prev = prev.previousElementSibling
                continue
            }
            break
        }
        const aria = el.getAttribute('aria-label')
        if (aria && aria.trim() && aria.includes('\\')) {
            return aria.trim()
        }
        if (
            el.matches?.(
                '.MathJax_SVG, .MathJax_Display, .mjx-container, span.MathJax'
            )
        ) {
            const inRoot = el
                .closest('.qf-answer-content, .qf-answer, .qf-answer-text')
                ?.querySelector('script[type^="math/tex"]')
            if (inRoot) return ''
            const inner = el.innerText.replace(/\s+/g, ' ').trim()
            if (inner) return inner
        }
        return ''
    }

    function filterMathCandidatesPreferTex(candidates, root) {
        const texInRoot = root.querySelectorAll('script[type^="math/tex"]')
        if (texInRoot.length > 0) {
            return candidates.filter(
                (el) =>
                    el.tagName === 'SCRIPT' &&
                    (el.getAttribute('type') || '').startsWith('math/tex')
            )
        }

        const drop = new Set()
        for (const el of candidates) {
            if (el.tagName !== 'SCRIPT') continue
            let sib = el.nextElementSibling
            while (sib) {
                if (
                    sib.matches?.(
                        '.MathJax_SVG, .MathJax_Display, .mjx-container, span.MathJax'
                    )
                ) {
                    drop.add(sib)
                    break
                }
                if (sib.tagName === 'SCRIPT') break
                sib = sib.nextElementSibling
            }
        }
        for (const el of candidates) {
            if (!el.querySelector?.('script[type^="math/tex"]')) continue
            if (
                el.matches?.(
                    '.MathJax_SVG, .MathJax_Display, .mjx-container, span.MathJax'
                )
            ) {
                drop.add(el)
            }
        }
        return candidates.filter((el) => !drop.has(el))
    }

    function scoreAnswerLatexChunk(chunk) {
        if (!chunk) return -999
        let score = 0
        if (chunk.includes('\u2061')) score -= 50
        if (!chunk.includes('\\')) score -= 40
        score += (chunk.match(/\\/g) || []).length * 10
        score += (chunk.match(/\^/g) || []).length * 3
        score += (chunk.match(/frac|dfrac|tfrac/gi) || []).length * 8
        score += (chunk.match(/\{/g) || []).length * 2
        return score
    }

    function splitMergedMathChunks(line) {
        const trimmed = line.trim()
        const byLatexBoundary = trimmed
            .split(/\s+(?=(?:[+-]?\d+(?:\.\d+)?\s*)?\\[a-zA-Z{])/)
            .map((c) => c.trim())
            .filter(Boolean)
        if (byLatexBoundary.length >= 2) return byLatexBoundary

        const byBackslashCmd = trimmed
            .split(/\s+(?=\\[a-zA-Z]+)/)
            .map((c) => c.trim())
            .filter(Boolean)
        if (byBackslashCmd.length >= 2) return byBackslashCmd

        return [trimmed]
    }

    function dedupeSpokenAndLatexDuplicates(line) {
        const trimmed = line.trim()
        if (!trimmed) return trimmed

        const chunks = splitMergedMathChunks(trimmed)
        if (chunks.length < 2) return chooseBestDuplicateEquation(trimmed)

        const best = chunks.reduce((a, b) =>
            scoreAnswerLatexChunk(b) > scoreAnswerLatexChunk(a) ? b : a
        )
        return chooseBestDuplicateEquation(best)
    }

    function getTopLevelMathCandidates(root) {
        root
            .querySelectorAll(
                '.qf-feedback-question, .qf-table, .MathJax_Preview'
            )
            .forEach((el) => el.remove())

        const candidates = Array.from(
            root.querySelectorAll(MATH_NODE_SELECTOR)
        ).filter((el) => {
            if (el.tagName === 'SCRIPT') return true
            if (el.classList.contains('MathJax_Preview')) return false
            return true
        })
        const topLevel = candidates.filter(
            (el) =>
                !candidates.some(
                    (other) => other !== el && other.contains(el)
                )
        )
        return filterMathCandidatesPreferTex(topLevel, root)
    }

    function extractPlainTextWithMath(root) {
        if (!root) return ''
        const fromTexOnly = extractLatexFromMathRoot(root)
        if (fromTexOnly) return dedupeSpokenAndLatexDuplicates(fromTexOnly)

        const clone = root.cloneNode(true)
        const topLevel = getTopLevelMathCandidates(clone)

        for (const el of topLevel) {
            const replacement = mathReplacementText(el)
            el.replaceWith(
                document.createTextNode(replacement ? ` ${replacement} ` : '')
            )
        }

        const merged = clone.textContent.replace(/\s+/g, ' ').trim()
        return dedupeSpokenAndLatexDuplicates(merged)
    }

    const LATEX_SUPER_MAP = {
        '0': '⁰',
        '1': '¹',
        '2': '²',
        '3': '³',
        '4': '⁴',
        '5': '⁵',
        '6': '⁶',
        '7': '⁷',
        '8': '⁸',
        '9': '⁹',
        '+': '⁺',
        '-': '⁻',
    }

    function latexToSuperscript(exp) {
        exp = String(exp).trim()
        if (/^[+-]?\d$/.test(exp)) {
            return [...exp]
                .map((ch) => LATEX_SUPER_MAP[ch] || ch)
                .join('')
        }
        return '^(' + exp + ')'
    }

    function stripLatexCodeFences(s) {
        return s
            .replace(/^```[a-zA-Z]*\n?/, '')
            .replace(/\n?```$/, '')
    }

    function normalizeLatexLhs(lhs) {
        return lhs.replace(/′/g, "'").replace(/\s+/g, '').trim()
    }

    function chooseBestDuplicateEquation(line) {
        const re = /(^|\s)([A-Za-z][A-Za-z0-9']*(?:\([^)]*\))?)\s*=/g
        const matches = []
        let m
        while ((m = re.exec(line)) !== null) {
            matches.push({
                lhs: normalizeLatexLhs(m[2]),
                index: m.index + m[1].length,
            })
        }
        if (matches.length < 2) return line
        for (let i = 0; i < matches.length; i++) {
            for (let j = matches.length - 1; j > i; j--) {
                if (matches[i].lhs === matches[j].lhs) {
                    return line.slice(matches[j].index).trim()
                }
            }
        }
        return line
    }

    function hasMultipleTerms(s) {
        s = s.trim()
        if (!s) return false

        let pDepth = 0
        let bDepth = 0
        let brDepth = 0

        let startIdx = 0
        if (s.startsWith('+') || s.startsWith('-')) {
            startIdx = 1
        } else if (s.startsWith('\\pm') || s.startsWith('\\mp')) {
            startIdx = 3
        }

        for (let i = startIdx; i < s.length; i++) {
            const char = s[i]
            if (char === '(') pDepth++
            else if (char === ')') pDepth--
            else if (char === '{') bDepth++
            else if (char === '}') bDepth--
            else if (char === '[') brDepth++
            else if (char === ']') brDepth--
            else if (pDepth === 0 && bDepth === 0 && brDepth === 0) {
                if (char === '+' || char === '-') {
                    return true
                }
                if (
                    s.substring(i).startsWith('\\pm') ||
                    s.substring(i).startsWith('\\mp') ||
                    s.substring(i).startsWith('\\to') ||
                    s.substring(i).startsWith('\\approx') ||
                    s.substring(i).startsWith('\\le') ||
                    s.substring(i).startsWith('\\ge')
                ) {
                    return true
                }
            }
        }
        return false
    }

    function hasMultipleFactors(s) {
        s = s.replace(/\^([a-zA-Z0-9]+)/g, '')
        s = s.replace(/\^\{[^{}]*\}/g, '')
        s = s.trim()
        if (!s) return false

        let pDepth = 0
        let bDepth = 0
        let brDepth = 0

        let factorCount = 0
        let lastType = null // 'num', 'word', 'group'

        for (let i = 0; i < s.length; i++) {
            const char = s[i]

            if (char === '(' || char === '{' || char === '[') {
                if (char === '(') pDepth++
                if (char === '{') bDepth++
                if (char === '[') brDepth++

                if (pDepth + bDepth + brDepth === 1) {
                    factorCount++
                    lastType = 'group'
                }
            } else if (char === ')' || char === '}' || char === ']') {
                if (char === ')') pDepth--
                if (char === '}') bDepth--
                if (char === ']') brDepth--
            } else if (pDepth === 0 && bDepth === 0 && brDepth === 0) {
                if (/\s/.test(char)) {
                    lastType = null
                } else if (/[+\-*/=,]/.test(char)) {
                    return true
                } else if (/\d/.test(char)) {
                    if (lastType !== 'num') {
                        factorCount++
                        lastType = 'num'
                    }
                } else {
                    if (lastType !== 'word') {
                        factorCount++
                        lastType = 'word'
                    }
                }
            }
        }

        return factorCount > 1
    }

    function wrapParensOrBrackets(expr) {
        if (/[(){}[\]]/.test(expr)) {
            return `[${expr}]`
        }
        return `(${expr})`
    }

    function shouldWrapFraction(left, right) {
        const safeLatexOps = [
            'pm', 'mp', 'to', 'times', 'cdot', 'approx',
            'le', 'leq', 'ge', 'geq', 'ne', 'neq', 'approx', 'rightarrow'
        ]

        if (left.length > 0) {
            const lastChar = left[left.length - 1]
            const isStandardSafe = /[=+\-*/,]/.test(lastChar)
            if (!isStandardSafe) {
                const match = left.match(/\\([a-zA-Z]+)$/)
                const endsWithSafeCmd = match && safeLatexOps.includes(match[1])
                if (!endsWithSafeCmd) {
                    return true
                }
            }
        }

        if (right.length > 0) {
            const firstChar = right[0]
            const isStandardSafe = /[=+\-*/,]/.test(firstChar)
            if (!isStandardSafe) {
                const match = right.match(/^\\([a-zA-Z]+)/)
                const startsWithSafeCmd = match && safeLatexOps.includes(match[1])
                if (!startsWithSafeCmd) {
                    return true
                }
            }
        }

        return false
    }

    function findMatchingBrace(s, startIdx) {
        let braceIdx = s.indexOf('{', startIdx)
        if (braceIdx === -1) return null

        let depth = 0
        for (let i = braceIdx; i < s.length; i++) {
            if (s[i] === '{') {
                depth++
            } else if (s[i] === '}') {
                depth--
                if (depth === 0) {
                    return {
                        content: s.substring(braceIdx + 1, i),
                        start: braceIdx,
                        end: i + 1,
                    }
                }
            }
        }
        return null
    }

    function replaceSimpleFractions(s) {
        let index = 0
        while (true) {
            const rest = s.substring(index)
            const match = rest.match(/\\(?:d|t)?frac\b/)
            if (!match) break

            const matchIdx = index + match.index
            const afterFrac = matchIdx + match[0].length

            let ws1 = s.substring(afterFrac).match(/^\s*/)
            let numStart = afterFrac + ws1[0].length
            const numMatch = findMatchingBrace(s, numStart)

            if (numMatch && numMatch.start === numStart) {
                let denStart = numMatch.end
                let ws2 = s.substring(denStart).match(/^\s*/)
                let denMatchStart = denStart + ws2[0].length
                const denMatch = findMatchingBrace(s, denMatchStart)

                if (denMatch && denMatch.start === denMatchStart) {
                    const left = s.substring(0, matchIdx).trim()
                    const right = s.substring(denMatch.end).trim()

                    let num = numMatch.content.trim()
                    let den = denMatch.content.trim()

                    // Process inner fractions first
                    num = replaceSimpleFractions(num)
                    den = replaceSimpleFractions(den)

                    if (hasMultipleTerms(num)) {
                        num = wrapParensOrBrackets(num)
                    }
                    if (hasMultipleTerms(den) || hasMultipleFactors(den)) {
                        den = wrapParensOrBrackets(den)
                    }

                    let replacement = `${num}/${den}`
                    if (shouldWrapFraction(left, right)) {
                        replacement = wrapParensOrBrackets(replacement)
                    }

                    s = s.substring(0, matchIdx) + replacement + s.substring(denMatch.end)
                    index = 0
                    continue
                }
            }

            index = matchIdx + 1
        }
        return s
    }

    function replaceSimpleSqrt(s) {
        let index = 0
        while (true) {
            const rest = s.substring(index)
            const match = rest.match(/\\sqrt\b/)
            if (!match) break

            const matchIdx = index + match.index
            const afterSqrt = matchIdx + match[0].length

            let ws = s.substring(afterSqrt).match(/^\s*/)
            let argStart = afterSqrt + ws[0].length
            const argMatch = findMatchingBrace(s, argStart)

            if (argMatch && argMatch.start === argStart) {
                let arg = argMatch.content.trim()
                arg = replaceSimpleSqrt(arg)
                const replacement = `√(${arg})`
                s = s.substring(0, matchIdx) + replacement + s.substring(argMatch.end)
                index = 0
                continue
            }

            index = matchIdx + 1
        }
        return s
    }

    function stripLatexLeftRight(s) {
        s = s.replace(/\\left\s*([([{|.])/g, '$1')
        s = s.replace(/\\right\s*([)\]}|.])/g, '$1')
        s = s.replace(/\\left\s*/g, '')
        s = s.replace(/\\right\s*/g, '')
        return s
    }

    function collapseRedundantParenPairs(s) {
        let prev = ''
        while (s !== prev) {
            prev = s
            s = s.replace(/\(\(([^()]*)\)\)/g, '($1)')
        }
        return s
    }

    function replaceLatexCommands(s) {
        s = stripLatexLeftRight(s)

        const symbolMap = {
            '\\pm': '±',
            '\\infty': '∞',
            '\\neq': '≠',
            '\\ne': '≠',
            '\\approx': '≈',
            '\\pi': 'π',
            '\\Delta': '∆',
            '\\mu': 'µ',
            '\\to': '→',
            '\\rightarrow': '→',
            '\\le': '≤',
            '\\leq': '≤',
            '\\ge': '≥',
            '\\geq': '≥',
            '\\degree': '˚',
        }
        const symbolKeys = Object.keys(symbolMap).sort(
            (a, b) => b.length - a.length
        )
        for (const k of symbolKeys) {
            s = s.split(k).join(symbolMap[k])
        }
        s = s.replace(/\\,/g, ' ')
        s = s.replace(/\\!/g, '')
        s = s.replace(/\\;/g, ' ')
        s = s.replace(/\\:/g, ' ')
        s = s.replace(/\\cdot/g, '*')
        s = s.replace(/\\times/g, '*')
        s = s.replace(
            /\\(sin|cos|tan|csc|sec|cot|log|ln|arcsin|arccos|arctan)\b/g,
            '$1'
        )
        s = s.replace(/\\theta/g, 'θ')
        s = s.replace(/\\alpha/g, 'α')
        s = s.replace(/\\beta/g, 'β')
        s = s.replace(/\\gamma/g, 'γ')
        return s
    }

    function replaceLatexExponents(s) {
        s = s.replace(/\^\s*(?:\{\s*([+-]?\d+)\s*\}|([+-]?\d+))/g, (match, p1, p2) => {
            const exp = p1 !== undefined ? p1 : p2
            if (/^[+-]?\d$/.test(exp)) return latexToSuperscript(exp)
            if (/^[+-]?\d{2}$/.test(exp)) {
                return '^(' + exp + ')'
            }
            return match
        })
        s = s.replace(/\^\s*\(\s*([+-]?\d)\s*\)/g, (_, exp) =>
            latexToSuperscript(exp)
        )
        s = s.replace(
            /\b(sin|cos|tan|csc|sec|cot|log|ln)\^([+-]?\d)\b/g,
            (_, fn, exp) => fn + latexToSuperscript(exp)
        )
        s = s.replace(
            /\b(sin|cos|tan|csc|sec|cot|log|ln)([23])\(/g,
            (_, fn, exp) => fn + latexToSuperscript(exp) + '('
        )
        return s
    }

    function replaceBareFracCalls(s) {
        let prev = ''
        while (s !== prev) {
            prev = s
            s = s.replace(
                /\bfrac\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi,
                (_, a, b) => `${a.trim()}/${b.trim()}`
            )
        }
        return s
    }

    function cleanupPlaintextMath(s) {
        s = s.replace(/[\u2061\u200B-\u200D\uFEFF]/g, '')
        s = s.replace(/′/g, "'")
        s = s.replace(/−/g, '-')
        s = s.replace(/–/g, '-')
        s = replaceSimpleFractions(s)
        s = replaceBareFracCalls(s)
        s = replaceSimpleSqrt(s)
        s = replaceLatexCommands(s)
        s = replaceLatexExponents(s)
        s = s.replace(/\{/g, '(').replace(/\}/g, ')')
        s = s.replace(/\\([A-Za-z]+)/g, '$1')
        s = collapseRedundantParenPairs(s)
        s = replaceLatexExponents(s)
        s = s.replace(/\s+/g, ' ').trim()
        s = s.replace(/\s*\/\s*/g, '/')
        s = s.replace(/\s*([=+])\s*/g, ' $1 ')
        s = s.replace(/\s*-\s*/g, ' - ')
        s = s.replace(/(^|[(=+/*,])\s-\s/g, '$1-')
        s = s.replace(/\(\s+/g, '(')
        s = s.replace(/\s+\)/g, ')')
        s = s.replace(/\b([A-Za-z]+)\s+\(/g, '$1(')
        s = s.replace(/\s+/g, ' ').trim()
        return s
    }

    const TRIG_PLAIN_NAMES =
        'arcsin|arccos|arctan|sin|cos|tan|csc|sec|cot|ln|log'
    const TRIG_FN_SUPERS = '[²³⁴⁵⁶⁷⁸⁹⁰¹⁺⁻]+'
    const TRIG_SIMPLE_ARG = '(?:[a-zA-Zθπ][a-zA-Z0-9θπ]*|\\d+)'

    function postProcessTrigPlaintext(s) {
        const trigLead = `(?<![a-zA-Z])(${TRIG_PLAIN_NAMES})`
        const trigParenRe = new RegExp(
            `${trigLead}(${TRIG_FN_SUPERS})?\\s*\\(\\s*(${TRIG_SIMPLE_ARG})\\s*\\)`,
            'g'
        )
        s = s.replace(trigParenRe, (_, fn, sup, arg) => fn + (sup || '') + arg)

        const trigAdjacentRe = new RegExp(
            `${trigLead}(${TRIG_FN_SUPERS})?(${TRIG_SIMPLE_ARG})(?=${TRIG_PLAIN_NAMES}\\b)`,
            'g'
        )
        s = s.replace(trigAdjacentRe, (_, fn, sup, arg) => fn + (sup || '') + arg + ' ')
        return s
    }

    function convertLatexLineToPlaintext(line) {
        let s = stripLatexCodeFences(line).trim()
        if (!s) return ''
        s = dedupeSpokenAndLatexDuplicates(s)
        s = chooseBestDuplicateEquation(s)
        s = cleanupPlaintextMath(s)
        s = postProcessTrigPlaintext(s)
        s = collapseRedundantParenPairs(s)
        return s
    }

    function convertAnswerBlockToWorksheetPlaintext(input) {
        return stripLatexCodeFences(input)
            .split(/\r?\n/)
            .map(convertLatexLineToPlaintext)
            .filter(Boolean)
            .join('\n')
    }

    function stripMathDollarDelimiters(s) {
        return String(s)
            .replace(/\$\$/g, ' ')
            .replace(/\$/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    }

    function formatExtractedAnswer(raw) {
        if (!raw || !String(raw).trim()) return raw
        const stripped = stripMathDollarDelimiters(raw)
        return convertAnswerBlockToWorksheetPlaintext(stripped)
    }

    function collectMathNodeSources(root) {
        if (!root) return []
        const clone = root.cloneNode(true)
        removeRenderedMathIfTexPresent(clone)
        const topLevel = getTopLevelMathCandidates(clone)

        return topLevel.map((el) => {
            const texEl = el.querySelector?.('script[type^="math/tex"]')
            const aria = el.getAttribute?.('aria-label') || null
            return {
                tag: el.tagName,
                className: el.className || '',
                texScript:
                    (el.tagName === 'SCRIPT'
                        ? el.textContent
                        : texEl?.textContent) || null,
                ariaLabel: aria,
                ariaSkipped:
                    aria && !aria.includes('\\') && !!texEl ? true : false,
                usedForMerge: mathReplacementText(el) || null,
            }
        })
    }

    function extractRawAnswerTextFromPart(partEl) {
        const answer = findAnswerElementInPart(partEl)
        if (!answer) return ''

        const content = getAnswerContentRoot(answer)
        const img = content.querySelector('img')
        if (img && img.alt && img.alt.trim()) {
            const withoutImg = content.cloneNode(true)
            withoutImg.querySelectorAll('img').forEach((n) => n.remove())
            const rest =
                extractLatexFromMathRoot(withoutImg) ||
                extractPlainTextWithMath(withoutImg)
            const alt = img.alt.trim()
            return rest ? `${alt} ${rest}` : alt
        }

        const fromTex = extractLatexFromMathRoot(content)
        if (fromTex) return fromTex

        const text = extractPlainTextWithMath(content)
        if (text) return text

        const aria = answer.getAttribute('aria-label') || ''
        if (/show/i.test(aria)) return ''
        return aria.trim()
    }

    function formatMathSpacesAndBrackets(str, isLatex) {
        if (!str) return str;

        // Helper to strip outer $$ for latex
        let strippedStr = str;
        if (isLatex) {
            if (strippedStr.startsWith('$$') && strippedStr.endsWith('$$')) {
                strippedStr = strippedStr.slice(2, -2).trim();
            } else if (strippedStr.startsWith('$') && strippedStr.endsWith('$')) {
                strippedStr = strippedStr.slice(1, -1).trim();
            }
        }

        // Standardize = spacing first
        strippedStr = strippedStr.replace(/\s*=\s*/g, ' = ');

        // Tokenizer
        function tokenize(s) {
            const tokens = [];
            let i = 0;
            const latexDelims = ['\\left(', '\\right)', '\\left[', '\\right]', '\\left\\{', '\\right\\}', '(', ')', '[', ']'];
            const plainDelims = ['(', ')', '[', ']'];
            const delims = isLatex ? latexDelims : plainDelims;

            while (i < s.length) {
                let matchedDelim = null;
                for (const delim of delims) {
                    if (s.startsWith(delim, i)) {
                        matchedDelim = delim;
                        break;
                    }
                }
                if (matchedDelim) {
                    tokens.push({ type: 'delim', value: matchedDelim, index: i });
                    i += matchedDelim.length;
                } else {
                    let nextDelimIndex = s.length;
                    for (const delim of delims) {
                        const idx = s.indexOf(delim, i);
                        if (idx !== -1 && idx < nextDelimIndex) {
                            nextDelimIndex = idx;
                        }
                    }
                    tokens.push({ type: 'text', value: s.substring(i, nextDelimIndex), index: i });
                    i = nextDelimIndex;
                }
            }
            return tokens;
        }

        const tokens = tokenize(strippedStr);

        // Build Tree
        const root = { type: 'root', children: [] };
        const stack = [root];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === 'delim') {
                const val = token.value;
                if (val === '(' || val === '[' || val === '{' || val.startsWith('\\left')) {
                    const node = { type: 'group', open: val, children: [], close: null };
                    
                    // Check if preceded by caret '^' to mark as exponent group
                    const parent = stack[stack.length - 1];
                    let isExponent = false;
                    if (parent.children.length > 0) {
                        const lastChild = parent.children[parent.children.length - 1];
                        if (lastChild.type === 'text' && lastChild.value.trim().endsWith('^')) {
                            isExponent = true;
                        }
                    }
                    node.isExponent = isExponent;

                    parent.children.push(node);
                    stack.push(node);
                } else if (val === ')' || val === ']' || val === '}' || val.startsWith('\\right')) {
                    const node = stack.pop();
                    if (node && node.type === 'group') {
                        node.close = val;
                    } else {
                        if (node) stack.push(node);
                        stack[stack.length - 1].children.push({ type: 'text', value: val });
                    }
                }
            } else {
                stack[stack.length - 1].children.push({ type: 'text', value: token.value });
            }
        }

        // Determine nesting (isParent)
        function markParents(node) {
            if (node.type === 'group') {
                node.isParent = node.children.some(c => c.type === 'group' && !c.isExponent);
            }
            node.children?.forEach(markParents);
        }
        markParents(root);

        // Recursive Formatting
        function formatNode(node, isDirectlyUnderParent, isInsideExponent) {
            if (node.type === 'root') {
                let res = node.children.map(c => formatNode(c, false, false)).join('');
                
                // Post-processing: Ensure adjacent parenthetical groups like (A)(B) are spaced as (A) (B)
                if (isLatex) {
                    res = res.replace(/(\\right[)\]])(\\left[([\]])/g, '$1 $2');
                    res = res.replace(/(\))(\()/g, '$1 $2');
                } else {
                    res = res.replace(/([)\]])([([\]])/g, '$1 $2');
                }
                return res;
            }

            if (node.type === 'text') {
                let val = node.value;
                // Standardize trig/log functions
                if (isLatex) {
                    val = val.replace(/\\?(ln|log|sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan)\s*([a-zA-Zθαβγπ0-9])/g, '\\$1 $2');
                } else {
                    val = val.replace(/\b(ln|log|sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan)\s*([a-zA-Zθαβγπ0-9])/g, '$1 $2');
                }

                // Standardize operator spacing if directly under parent
                if (isDirectlyUnderParent) {
                    if (isLatex) {
                        val = val.replace(/\s*([+\-])\s*/g, ' \\ $1 \\ ');
                    } else {
                        val = val.replace(/\s*([+\-])\s*/g, '  $1  ');
                    }
                }
                return val;
            }

            if (node.type === 'group') {
                const nextInsideExponent = isInsideExponent || node.isExponent;
                const childrenFormatted = node.children.map(c => formatNode(c, node.isParent, nextInsideExponent)).join('').trim();

                const isSimple = childrenFormatted.length <= 1;

                if (node.isParent) {
                    if (isLatex) {
                        return `\\left[ \\ ${childrenFormatted} \\ \\right]`;
                    } else {
                        return `[ ${childrenFormatted} ]`;
                    }
                } else {
                    let openDelim = node.open;
                    let closeDelim = node.close;
                    if (isLatex) {
                        const innerContent = node.children.map(c => c.value || '').join('');
                        if (openDelim === '(' && (innerContent.length > 1 || innerContent.includes('^'))) {
                            openDelim = '\\left(';
                            closeDelim = '\\right)';
                        }
                    }

                    if (nextInsideExponent || isSimple) {
                        return `${openDelim}${childrenFormatted}${closeDelim}`;
                    } else {
                        return `${openDelim} ${childrenFormatted} ${closeDelim}`;
                    }
                }
            }
            return '';
        }

        let formatted = formatNode(root, false, false);
        return formatted;
    }

    function extractAnswerPayloadFromPart(partEl) {
        const answer = findAnswerElementInPart(partEl)
        const content = answer ? getAnswerContentRoot(answer) : null
        let raw = extractRawAnswerTextFromPart(partEl)
        if (raw) {
            raw = formatMathSpacesAndBrackets(raw, true)
        }
        let plain = raw ? formatExtractedAnswer(raw) : ''
        if (plain) {
            plain = formatMathSpacesAndBrackets(plain, false)
        }
        const mathNodes = content ? collectMathNodeSources(content) : []
        const usedTexScriptOnly = !!(
            content && content.querySelector('script[type^="math/tex"]')
        )
        return { raw, plain, mathNodes, usedTexScriptOnly }
    }

    function logAnswerConversionReadableSummary(raw, plain) {
        const latexBody = raw && raw.trim() ? raw.trim() : '(empty)'
        const plainBody = plain && plain.trim() ? plain.trim() : '(empty)'
        console.log(`latex:\n${latexBody}\n\nplain:\n${plainBody}`)
    }

    function formatAnswerBlockForClipboard({ multiPart, letter, plain }) {
        const body = plain && plain.trim() ? plain.trim() : '(empty)'
        if (multiPart && letter && letter !== '?') {
            return `${letter}. ${body}`
        }
        return body
    }

    function extractAnswerFromPart(partEl) {
        return extractAnswerPayloadFromPart(partEl).plain
    }

    let copyAllAnswersRunning = false

    function isShowAnswerRevealButton(el) {
        if (!el || el.nodeType !== 1) return false
        if (
            !el.matches(
                '.qf-answer.qf-answer-text[role="button"], .qf-answer-text[role="button"], .qf-answer[role="button"]'
            )
        ) {
            return false
        }
        return isAnswerRevealControl(el)
    }

    function findShowAnswerRevealButtonFromEvent(event) {
        const path = event.composedPath?.() || [event.target]
        for (const node of path) {
            if (!(node instanceof Element)) continue
            if (isShowAnswerRevealButton(node)) return node
            const closest = node.closest?.(ANSWER_REVEAL_SELECTOR)
            if (closest && isShowAnswerRevealButton(closest)) return closest
        }
        return null
    }

    async function runCopyAllAnswersWithButtonFeedback(answersBtn) {
        if (copyAllAnswersRunning) return
        if (answersBtn) answersBtn.disabled = true
        try {
            await revealPartsAndCopyAnswers()
            if (answersBtn) {
                answersBtn.classList.add('copied')
                const label = answersBtn.querySelector('.text')
                if (label) label.textContent = 'Copied!'
                setTimeout(() => {
                    answersBtn.classList.remove('copied')
                    if (label) label.textContent = 'Copy All Answers'
                }, 2000)
            }
        } catch (err) {
            console.error('[D2L-DL] Copy all answers failed:', err)
            alert('Could not copy answers. See console for details.')
        } finally {
            if (answersBtn) answersBtn.disabled = false
        }
    }

    function installShowAnswerTriggersCopyAll() {
        if (installShowAnswerTriggersCopyAll.installed) return
        installShowAnswerTriggersCopyAll.installed = true
        document.addEventListener(
            'click',
            (event) => {
                if (copyAllAnswersRunning) return
                if (!findShowAnswerRevealButtonFromEvent(event)) return
                const answersBtn = document.getElementById('d2l-answers-btn')
                void runCopyAllAnswersWithButtonFeedback(answersBtn)
            },
            true
        )
    }

    installShowAnswerTriggersCopyAll()

    async function revealPartsAndCopyAnswers() {
        if (copyAllAnswersRunning) return null
        copyAllAnswersRunning = true
        try {
            console.log('[D2L-DL] Auto-processing all questions...')

            const lines = []
            const processed = new Set()

            while (true) {
                const allControls = findAllAnswerRevealControls()
                const targetQuestion = allControls.find((el) => {
                    const key = el.id || el.getAttribute('data-id') || el
                    return !processed.has(key)
                })

                if (!targetQuestion) {
                    console.log('[D2L-DL] Finished. No more answers to copy.')
                    break
                }

                const key =
                    targetQuestion.id ||
                    targetQuestion.getAttribute('data-id') ||
                    targetQuestion
                processed.add(key)

                targetQuestion.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                })

                const questionRoot =
                    targetQuestion.closest('.qf-question') ||
                    targetQuestion.closest('[id^="question-display-"]') ||
                    targetQuestion.closest('.qf-part') ||
                    document.body
                const solutionHandle = questionRoot.querySelector(
                    '.qf-solution-handle, [aria-label*="show solution" i]'
                )
                if (solutionHandle) {
                    solutionHandle.click()
                    await sleep(100)
                }

                const alreadyRevealed = isAnswerRevealed(targetQuestion)
                if (!alreadyRevealed) {
                    targetQuestion.click()
                    console.log(
                        `[D2L-DL] Revealing answer: ${targetQuestion.id}`
                    )

                    await new Promise((resolve) => {
                        const startTime = Date.now()
                        const checkInterval = setInterval(() => {
                            const yesButton =
                                targetQuestion.querySelector(
                                    '.qf-cell.qf-answer-option.yes, .qf-cell.yes[role="button"]'
                                ) ||
                                questionRoot.querySelector(
                                    '.qf-cell.qf-answer-option.yes, .qf-cell.yes[role="button"]'
                                )

                            if (
                                yesButton &&
                                yesButton.offsetParent !== null
                            ) {
                                clearInterval(checkInterval)
                                yesButton.click()
                                resolve()
                            }

                            if (Date.now() - startTime > 3000) {
                                clearInterval(checkInterval)
                                console.warn(
                                    `[D2L-DL] Timed out waiting for "Yes" in ${targetQuestion.id}`
                                )
                                resolve()
                            }
                        }, 100)
                    })

                    await sleep(400)
                } else {
                    console.log(
                        `[D2L-DL] Answer already shown: ${targetQuestion.id}`
                    )
                }

                const part =
                    targetQuestion.closest('.qf-part') ||
                    targetQuestion.closest('.qf-question') ||
                    targetQuestion.closest('[id^="question-display-"]') ||
                    document.body
                const multiPart = isMultiPartQuestion(part)
                const letter = multiPart ? letterFromPart(part) : '?'

                let payload = extractAnswerPayloadFromPart(part)
                if (!payload.plain && !payload.raw) {
                    await sleep(250)
                    payload = extractAnswerPayloadFromPart(part)
                }
                if (!payload.plain && !payload.raw) {
                    payload = {
                        raw: '',
                        plain: '(no answer text)',
                        mathNodes: payload.mathNodes,
                    }
                }

                console.log('[D2L-DL] Answer conversion debug', {
                    answerId: targetQuestion.id,
                    alreadyRevealed,
                    multiPart,
                    letter,
                    latex: payload.raw,
                    plain: payload.plain,
                    mathNodes: payload.mathNodes,
                    usedTexScriptOnly: payload.usedTexScriptOnly,
                })
                if (
                    payload.raw.includes('\u2061') ||
                    (payload.raw.match(/f['′]?\s*\(/gi) || []).length > 1
                ) {
                    console.warn(
                        '[D2L-DL] Spoken + TeX duplicate still in raw — check DOM',
                        { raw: payload.raw }
                    )
                }

                logAnswerConversionReadableSummary(payload.raw, payload.plain)

                lines.push(
                    formatAnswerBlockForClipboard({
                        multiPart,
                        letter,
                        plain: payload.plain,
                    })
                )
            }

            if (!lines.length) {
                alert('No answer controls found on this question.')
                return null
            }

            const text = lines.join('\n\n')
            await navigator.clipboard.writeText(text)
            console.log('[D2L-DL] Copied answers (plain):\n' + text)
            return text
        } finally {
            copyAllAnswersRunning = false
        }
    }

    function isTypingTarget() {
        const active = document.activeElement
        return (
            active &&
            (active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.isContentEditable)
        )
    }

    async function getTargetImages() {
        const candidates = [
            '.d2l-html-block-rendered',
            '.d2l-fileviewer-render-container',
            '.sf-lesson-content',
            '.sf-page-content',
            '.content-area',
            'main',
            '[role="main"]',
            '.d2l-content-container',
            '#d2l_content',
            '.content-panel',
            '.content-block',
            '.document-container',
            '#app',
        ]

        let container = null
        for (const selector of candidates) {
            container = findInShadow(selector)
            if (container) break
        }
        if (!container) container = document.body

        let images = findImages(container)
        return images.filter((img) => {
            if (
                img.closest(
                    'nav, header, footer, .d2l-navigation-s, .d2l-header, .navigation-menu, .header-button-tray, .sf-nav'
                )
            )
                return false
            const width = img.naturalWidth || img.width
            const height = img.naturalHeight || img.height
            if (width > 0 && height > 0 && width < 30 && height < 30) {
                if (
                    img.classList.contains('d2l-icon') ||
                    img.src.includes('icon')
                )
                    return false
            }
            if (!img.src || img.src.startsWith('data:')) return false
            const srcLower = img.src.toLowerCase()
            if (srcLower.includes('icon') && !srcLower.includes('content')) {
                if (width < 64 && height < 64) return false
            }
            return true
        })
    }

    async function bundleImagesInFrame() {
        const images = await getTargetImages()
        if (images.length === 0) {
            console.log('[D2L-DL] No images found in this frame.')
            return []
        }

        console.log(`[D2L-DL] Bundling ${images.length} images...`)
        const results = []
        for (let i = 0; i < images.length; i++) {
            try {
                const src = images[i].src
                const response = await fetch(src)
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const blob = await response.blob()

                let filename = ''
                try {
                    const url = new URL(src)
                    const pathParts = url.pathname.split('/')
                    filename = pathParts.pop() || 'image'
                    if (!filename.includes('.') && response.type) {
                        const ext =
                            blob.type.split('/')[1]?.replace('jpeg', 'jpg') ||
                            'png'
                        filename += `.${ext}`
                    }
                } catch (e) {
                    filename = `image-${i}.png`
                }

                results.push({ filename, blob })
            } catch (err) {
                console.error(
                    `[D2L-DL] Failed to fetch image:`,
                    images[i].src,
                    err
                )
            }
        }
        return results
    }

    async function takeSnapshotInFrame() {
        // NOTE: StudyForge-specific frame capture now lives in separate script.
        const candidates = [
            '.content-panel',
            '.content-block',
            '.d2l-html-block-rendered',
            'main',
        ]
        let target = null
        for (const s of candidates) {
            target = findInShadow(s)
            if (target) break
        }
        if (!target) target = document.body

        console.log(`[D2L-DL] Taking high-res snapshot of:`, target)
        const canvas = await html2canvas(target, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
        })
        canvas.toBlob((blob) => {
            downloadBlob(blob, `snapshot-${new Date().getTime()}.png`)
        })
    }

    function downloadBlob(blob, filename) {
        try {
            if (typeof saveAs !== 'undefined') {
                saveAs(blob, filename)
            } else {
                console.warn(
                    `[D2L-DL] saveAs not found, using fallback download method.`
                )
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = filename
                a.style.display = 'none'
                document.body.appendChild(a)
                a.click()
                setTimeout(() => {
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                }, 100)
            }
        } catch (err) {
            console.error(`[D2L-DL] Failed to download file:`, err)
            alert(`Download failed: ${err.message}`)
        }
    }

    async function extractScriptInFrame() {
        const elements = Array.from(document.querySelectorAll('.video-script'))
        console.log(
            `[D2L-SCRIPT] Found ${elements.length} .video-script elements in ${window.location.href}`
        )
        if (elements.length === 0) return null

        const scriptParts = elements
            .map((el) => el.textContent.trim())
            .filter((text) => text !== '')

        console.log(
            `[D2L-SCRIPT] Extracted ${scriptParts.length} parts from this frame.`
        )
        return scriptParts.join('\n\n')
    }

    function extractTitleInFrame() {
        const numEl = document.querySelector('.lesson-header-number')
        const nameEl = document.querySelector('.lesson-header-name')
        const videoNameEl = document.querySelector('.video-name')

        const parts = []
        if (numEl) parts.push(numEl.textContent.trim())
        if (nameEl) parts.push(nameEl.textContent.trim())
        else if (videoNameEl) parts.push(videoNameEl.textContent.trim())

        const title = parts.join(' - ')
        return title || document.title || 'script'
    }

    function sanitizeFilename(name) {
        return name.replace(/[<>:"/\\|?*]/g, '').trim()
    }

    window.addEventListener('message', async (event) => {
        if (event.data && event.data.type === 'D2L_SNAPSHOT') {
            await takeSnapshotInFrame()
        } else if (
            event.data &&
            event.data.type === 'D2L_TRIGGER_DOWNLOAD_SINGLE'
        ) {
            const items = await bundleImagesInFrame()
            if (items.length > 0) {
                const zip = new JSZip()
                items.forEach((it) => zip.file(it.filename, it.blob))
                const content = await zip.generateAsync({ type: 'blob' })
                downloadBlob(content, 'images.zip')
            }
        } else if (
            event.data &&
            event.data.type === 'D2L_EXTRACT_SCRIPT_REQUEST'
        ) {
            console.log(
                `[D2L-SCRIPT] Received script extraction request in ${window.location.href}`
            )
            const script = await extractScriptInFrame()
            if (script) {
                console.log(
                    `[D2L-SCRIPT] Sending extraction response from ${window.location.href}`
                )
                window.top.postMessage(
                    {
                        type: 'D2L_EXTRACT_SCRIPT_RESPONSE',
                        script,
                        url: window.location.href,
                        title: extractTitleInFrame(),
                    },
                    '*'
                )
            } else {
                console.log(
                    `[D2L-SCRIPT] No script content found in ${window.location.href}`
                )
            }
            const children = findIframes()
            if (children.length > 0) {
                console.log(
                    `[D2L-SCRIPT] Forwarding request to ${children.length} nested iframes from ${window.location.href}`
                )
                children.forEach((c) =>
                    c.contentWindow.postMessage(
                        { type: 'D2L_EXTRACT_SCRIPT_REQUEST' },
                        '*'
                    )
                )
            }
        }
    })

    if (IS_TOP) {
        const styles = `
            #d2l-dl-btn {
                position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                color: white; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px; width: 48px; height: 48px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(10px); opacity: 0.9; overflow: hidden;
                white-space: nowrap; font-family: -apple-system, sans-serif; font-weight: 600;
            }
            #d2l-dl-btn:hover { width: 180px; opacity: 1; border-radius: 12px; }
            #d2l-dl-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
            #d2l-dl-btn .text { opacity: 0; max-width: 0; transition: all 0.3s.ease; font-size: 14px; }
            #d2l-dl-btn:hover .text { opacity: 1; max-width: 120px; margin-right: 16px; }

            #d2l-script-btn {
                position: fixed; bottom: 20px; right: 80px; z-index: 2147483645;
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px; width: 48px; height: 48px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(10px); opacity: 0.9; overflow: hidden;
                white-space: nowrap; font-family: -apple-system, sans-serif; font-weight: 600;
                display: none;
            }
            #d2l-script-btn:hover { width: 160px; opacity: 1; border-radius: 12px; }
            #d2l-script-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
            #d2l-script-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
            #d2l-script-btn:hover .text { opacity: 1; max-width: 100px; margin-right: 16px; }

            #d2l-dl-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.2); z-index: 2147483646;
                display: none; opacity: 0; transition: opacity 0.3s; backdrop-filter: blur(2px);
            }
            #d2l-dl-overlay.visible { display: block; opacity: 1; }

            #d2l-dl-dialog {
                position: fixed; bottom: 80px; right: 20px;
                z-index: 2147483647; background: #1a1a1a; color: #efefef;
                padding: 20px; border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                font-family: -apple-system, sans-serif;
                max-width: 360px; width: 90%; display: none;
                opacity: 0; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                border: 1px solid #333;
            }
            #d2l-dl-dialog.visible { display: block; opacity: 1; transform: translateY(0) scale(1); }
            #d2l-dl-dialog h2 { margin: 0 0 4px 0; color: #fff; font-size: 16px; }
            #d2l-dl-dialog p { color: #888; margin: 0 0 16px 0; font-size: 12px; }

            .d2l-dl-frame-list { display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto; margin-bottom: 12px; }
            .d2l-dl-frame-item {
                background: #252525; padding: 10px 14px; border-radius: 10px;
                cursor: pointer; transition: all 0.2s ease;
                display: flex; align-items: center; justify-content: space-between;
                border: 1px solid transparent;
            }
            .d2l-dl-frame-item:hover { background: #333; transform: translateX(2px); }
            .d2l-dl-frame-item.all { background: #007aff; color: white; border: none; }
            .d2l-dl-frame-item .title { font-weight: 600; font-size: 13px; }
            .d2l-dl-frame-item .desc { font-size: 10px; color: #777; }

            .d2l-dl-item-actions { display: flex; gap: 8px; }
            .d2l-dl-action-icon {
                width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
                border-radius: 6px; background: rgba(255,255,255,0.05); color: #aaa;
                transition: all 0.2s;
            }
            .d2l-dl-action-icon:hover { background: rgba(255,255,255,0.15); color: #fff; }

            #d2l-iframe-highlighter {
                position: fixed; pointer-events: none; border: 3px solid #007aff;
                background: rgba(0, 122, 255, 0.05); z-index: 2147483645;
                transition: all 0.2s ease; border-radius: 4px; display: none;
            }

            #d2l-prompt-btn {
                position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px; width: 48px; height: 48px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(10px); opacity: 0.9; overflow: hidden;
                white-space: nowrap; font-family: -apple-system, sans-serif; font-weight: 600;
                display: none;
            }
            #d2l-prompt-btn:hover { width: 160px; opacity: 1; border-radius: 12px; }
            #d2l-prompt-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
            #d2l-prompt-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
            #d2l-prompt-btn:hover .text { opacity: 1; max-width: 100px; margin-right: 16px; }
            #d2l-prompt-btn.copied {
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            }

            #d2l-answers-btn {
                position: fixed; bottom: 20px; right: 80px; z-index: 2147483647;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px; width: 48px; height: 48px;
                display: none; align-items: center; justify-content: center;
                cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(10px); opacity: 0.9; overflow: hidden;
                white-space: nowrap; font-family: -apple-system, sans-serif; font-weight: 600;
            }
            #d2l-answers-btn:hover { width: 200px; opacity: 1; border-radius: 12px; }
            #d2l-answers-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
            #d2l-answers-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
            #d2l-answers-btn:hover .text { opacity: 1; max-width: 140px; margin-right: 16px; }
            #d2l-answers-btn.copied {
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            }

            #d2l-automation-bar {
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 2147483647;
                display: none;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-radius: 14px;
                background: rgba(20, 20, 20, 0.88);
                border: 1px solid rgba(255, 255, 255, 0.12);
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
                font-family: -apple-system, sans-serif;
                color: #efefef;
            }
            #d2l-automation-bar .title {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.2px;
                color: #fff;
                margin-right: 4px;
                opacity: 0.95;
            }
            #d2l-automation-bar .status {
                font-size: 12px;
                color: #cfcfcf;
                max-width: 46vw;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                opacity: 0.95;
            }
            #d2l-automation-bar .btn {
                border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.06);
                color: #fff;
                padding: 7px 10px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 650;
                transition: background 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
            }
            #d2l-automation-bar .btn:hover {
                background: rgba(255,255,255,0.12);
                border-color: rgba(255,255,255,0.22);
            }
            #d2l-automation-bar .btn:active { transform: translateY(1px); }
            #d2l-automation-bar .btn.on {
                background: rgba(17, 153, 142, 0.22);
                border-color: rgba(56, 239, 125, 0.35);
            }
        `

        const styleEl = document.createElement('style')
        styleEl.innerHTML = styles
        document.head.appendChild(styleEl)

        function createUI() {
            const btn = document.createElement('button')
            btn.id = 'd2l-dl-btn'
            btn.innerHTML =
                '<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div><div class="text">Content Tools</div>'
            document.body.appendChild(btn)

            const scriptBtn = document.createElement('button')
            scriptBtn.id = 'd2l-script-btn'
            scriptBtn.innerHTML =
                '<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div><div class="text">Save Script</div>'
            document.body.appendChild(scriptBtn)

            const promptBtn = document.createElement('button')
            promptBtn.id = 'd2l-prompt-btn'
            promptBtn.innerHTML =
                '<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg></div><div class="text">Copy Prompt</div>'
            document.body.appendChild(promptBtn)

            const answersBtn = document.createElement('button')
            answersBtn.id = 'd2l-answers-btn'
            answersBtn.innerHTML =
                '<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg></div><div class="text">Copy All Answers</div>'
            document.body.appendChild(answersBtn)

            const automationBar = document.createElement('div')
            automationBar.id = 'd2l-automation-bar'
            automationBar.innerHTML = `
                <span class="title">Automation</span>
                <button class="btn" id="d2l-sim-time-btn" type="button">Sim time</button>
                <span class="status" id="d2l-automation-status">Idle</span>
            `
            document.body.appendChild(automationBar)

            const setAutomationStatus = (text) => {
                const el = document.getElementById('d2l-automation-status')
                if (el) el.textContent = text
            }

            // --- EXACT MINIMAL SCRIPT LOGIC ---
            const CONFIG = {
                canvasSelector: '.qf-canvas-wrapper canvas',
                questionSelector: '.qf-question, #question-display-',
                slideSelector: '.question-fullscreen',
                subquestionSelector: '.qf-answer',
                nextButtonSelector: '.qf-title-button.next',
                baseMs: 30_000,
                extraPerSubquestionMs: 30_000,
                jitterMs: 20_000,
                minDelayMs: 5_000,
                beforeNextDelayMs: 2000,
                holdMs: 50,
                debug: true,
            }

            const state = {
                running: false,
                timerId: null,
                clickIntervalId: null,
                observerDisconnectors: [],
                activeKey: null,
                countdownId: null,
                scheduledAt: 0,
                scheduledDelayMs: 0,
                lastBaseSeconds: 30,
                processedQuestionKeys: new Set(),
            }

            const log = (...args) => {
                if (CONFIG.debug) console.log('[time-metric-sim]', ...args)
            }

            function setStatus(text) {
                const el = document.getElementById('d2l-automation-status')
                if (el) el.textContent = text
                log(text)
            }

            function clearTimer() {
                if (state.timerId !== null) {
                    clearTimeout(state.timerId)
                    state.timerId = null
                }
                if (state.clickIntervalId !== null) {
                    clearInterval(state.clickIntervalId)
                    state.clickIntervalId = null
                }
                if (state.countdownId !== null) {
                    clearInterval(state.countdownId)
                    state.countdownId = null
                }
                state.scheduledAt = 0
                state.scheduledDelayMs = 0
            }

            function isVisible(el) {
                if (!el || !el.isConnected) return false
                const rect = el.getBoundingClientRect()
                return rect.width > 0 && rect.height > 0
            }

            function uniquePush(list, item) {
                if (item && !list.includes(item)) list.push(item)
            }

            function findInShadow(selector, root, out = []) {
                if (!root) return out
                if (root.querySelectorAll) {
                    root.querySelectorAll(selector).forEach((el) =>
                        uniquePush(out, el)
                    )
                }
                const walker = (
                    root.ownerDocument || document
                ).createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
                    acceptNode(node) {
                        return node.shadowRoot
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_SKIP
                    },
                })
                let node
                while ((node = walker.nextNode())) {
                    findInShadow(selector, node.shadowRoot, out)
                }
                return out
            }

            function collectSameOriginDocuments() {
                const docs = []
                const seen = new Set()

                function walk(doc) {
                    if (!doc || !doc.defaultView || seen.has(doc)) return
                    seen.add(doc)
                    docs.push(doc)

                    try {
                        const iframes = [
                            ...doc.querySelectorAll('iframe'),
                            ...findInShadow('iframe', doc),
                        ]

                        for (const iframe of iframes) {
                            try {
                                if (iframe && iframe.contentDocument) {
                                    walk(iframe.contentDocument)
                                }
                            } catch (_) {}
                        }
                    } catch (_) {}
                }

                try {
                    walk(document)
                } catch (_) {}
                return docs
            }

            function getQuestionCandidates() {
                const results = []
                for (const doc of collectSameOriginDocuments()) {
                    for (const selector of CONFIG.questionSelector
                        .split(',')
                        .map((s) => s.trim())) {
                        findInShadow(selector, doc, results)
                    }
                }
                return results
            }

            function getActiveQuestionRootMinimal() {
                const candidates = getQuestionCandidates().filter(isVisible)
                if (!candidates.length) return null
                return candidates[candidates.length - 1]
            }

            function getQuestionKeyMinimal(root) {
                if (!root) return null
                const doc = root.ownerDocument || document
                const slide = root.closest?.(CONFIG.slideSelector) || root
                const ref = slide
                    .querySelector?.('.qf-reference')
                    ?.textContent?.trim()
                const num = slide
                    .querySelector?.('.qf-number')
                    ?.textContent?.trim()
                return (
                    root.id ||
                    ref ||
                    num ||
                    root.textContent?.trim()?.slice(0, 80) ||
                    null
                )
            }

            function getTargetCanvas() {
                const root = getActiveQuestionRootMinimal()
                if (!root) return null

                const doc = root.ownerDocument || document
                const slide = root.closest?.(CONFIG.slideSelector) || root

                let canvas = slide.querySelector(CONFIG.canvasSelector)
                if (!canvas && doc)
                    canvas = doc.querySelector(CONFIG.canvasSelector)
                if (!canvas) return null
                if (!isVisible(canvas)) return null
                return canvas
            }

            function countSubquestions(root) {
                try {
                    if (!root) return 1
                    const slide = root.closest?.(CONFIG.slideSelector) || root
                    const question =
                        slide?.querySelector('.qf-question') || slide
                    if (!question) return 1
                    const count = question.querySelectorAll(
                        CONFIG.subquestionSelector
                    ).length
                    return Math.max(1, count)
                } catch (_) {
                    return 1
                }
            }

            function randInt(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min
            }

            function getDelayMs(subquestions) {
                const base =
                    CONFIG.baseMs +
                    Math.max(0, subquestions - 1) * CONFIG.extraPerSubquestionMs
                const jitter = randInt(-CONFIG.jitterMs, CONFIG.jitterMs)
                return Math.max(CONFIG.minDelayMs, base + jitter)
            }

            function getVisible(el) {
                try {
                    if (!el) return false
                    const r = el.getBoundingClientRect()
                    return r.width > 0 && r.height > 0
                } catch (_) {
                    return false
                }
            }

            function findNextButton(root) {
                try {
                    if (root) {
                        const slide =
                            root.closest?.(CONFIG.slideSelector) || root
                        const btn = slide?.querySelector(
                            CONFIG.nextButtonSelector
                        )
                        if (btn) return btn
                    }
                    const results = []
                    for (const doc of collectSameOriginDocuments()) {
                        findInShadow(CONFIG.nextButtonSelector, doc, results)
                    }
                    const visible = results.filter(getVisible)
                    return (
                        visible[visible.length - 1] ||
                        results[results.length - 1] ||
                        null
                    )
                } catch (_) {
                    return null
                }
            }

            function dispatchWorkingPattern(canvas) {
                const win = canvas.ownerDocument?.defaultView || window
                const rect = canvas.getBoundingClientRect()
                const x = rect.left + rect.width / 2
                const y = rect.top + rect.height / 2

                const mousedownEvent = new win.MouseEvent('mousedown', {
                    view: win,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    buttons: 1,
                })

                const mouseupEvent = new win.MouseEvent('mouseup', {
                    view: win,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    buttons: 0,
                })

                const clickEvent = new win.MouseEvent('click', {
                    view: win,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                })

                canvas.dispatchEvent(mousedownEvent)
                setTimeout(() => {
                    if (!state.running) return
                    canvas.dispatchEvent(mouseupEvent)
                    canvas.dispatchEvent(clickEvent)
                    log('clicked canvas', {
                        x: Math.round(x),
                        y: Math.round(y),
                        sameAsDirectQuery:
                            canvas ===
                            (canvas.ownerDocument || document).querySelector(
                                CONFIG.canvasSelector
                            ),
                    })
                    setStatus(
                        'Click fired; waiting for question change or rescan'
                    )
                }, CONFIG.holdMs)
            }

            function parseTimeSpent(text) {
                if (!text) return 0
                text = text.toLowerCase()
                let seconds = 0
                const minMatch = text.match(/(\d+)\s*min/)
                if (minMatch) {
                    seconds += parseInt(minMatch[1], 10) * 60
                }
                const secMatch = text.match(/(\d+)\s*sec/)
                if (secMatch) {
                    seconds += parseInt(secMatch[1], 10)
                }
                if (!minMatch && !secMatch) {
                    const numMatch = text.match(/(\d+)/)
                    if (numMatch) seconds += parseInt(numMatch[1], 10)
                }
                return seconds * 1000
            }

            const QUESTIONS = {
                containerSelector: 'div.questions-container',
                itemSelector: 'section.question[data-type="question"]',
                timeSpentSelector: '.q-time-spent',
                timeSpentSkipMs: 5 * 60 * 1000,
            }

            function findActiveCloseButton() {
                const results = []
                for (const doc of collectSameOriginDocuments()) {
                    findInShadow(
                        '.qf-title-button.close, [aria-label="close question"]',
                        doc,
                        results
                    )
                }
                return results.filter(isVisible)[0] || null
            }

            const sleep = (ms) =>
                new Promise((resolve) => setTimeout(resolve, ms))

            async function sleepWhileRunning(totalMs) {
                const start = Date.now()
                while (state.running && Date.now() - start < totalMs) {
                    await sleep(Math.min(250, totalMs))
                }
            }

            function getQuestionListItems() {
                const results = []
                for (const doc of collectSameOriginDocuments()) {
                    findInShadow(
                        `${QUESTIONS.containerSelector} ${QUESTIONS.itemSelector}`,
                        doc,
                        results
                    )
                }
                return results.filter(isVisible)
            }

            function getQuestionListTimeMs(item) {
                try {
                    const timeEl = item?.querySelector?.(QUESTIONS.timeSpentSelector)
                    const text = timeEl?.textContent || ''
                    return parseTimeSpent(text)
                } catch (_) {
                    return 0
                }
            }

            function getQuestionListId(item) {
                try {
                    return (
                        item?.getAttribute?.('data-id') ||
                        item?.id ||
                        item?.getAttribute?.('aria-label') ||
                        null
                    )
                } catch (_) {
                    return null
                }
            }

            function getQuestionListKey(item) {
                return getQuestionListId(item) || item?.id || null
            }

            function getQuestionListItemByKey(itemKey) {
                if (!itemKey) return null
                const items = getQuestionListItems()
                return items.find((item) => getQuestionListKey(item) === itemKey) || null
            }

            function getQuestionListPreviewText(item) {
                try {
                    const el =
                        item?.querySelector?.('.q-preview .text') ||
                        item?.querySelector?.('.q-info') ||
                        item
                    return (el?.textContent || '').trim()
                } catch (_) {
                    return ''
                }
            }

            function isExcludedQuestionByText(text) {
                const t = (text || '').trim().toLowerCase()
                if (!t) return false
                if (t.includes('ap prep')) return true
                // "Try this:" variants: "Try this:", "(Try this:)", "(Try this ...", etc
                if (/^\(?\s*try this\b/.test(t)) return true
                return false
            }

            function clickQuestionListItem(item) {
                try {
                    item.scrollIntoView?.({ block: 'center', inline: 'center' })
                } catch (_) {}
                try {
                    item.focus?.()
                } catch (_) {}
                try {
                    item.click()
                    return true
                } catch (_) {
                    return false
                }
            }

            async function waitForActiveQuestionOpen(timeoutMs = 8000) {
                const start = Date.now()
                while (state.running && Date.now() - start < timeoutMs) {
                    const root = getActiveQuestionRootMinimal()
                    if (root && isVisible(root)) return root
                    await sleep(100)
                }
                return null
            }

            async function waitForQuestionClose(prevKey, timeoutMs = 8000) {
                const start = Date.now()
                while (state.running && Date.now() - start < timeoutMs) {
                    const root = getActiveQuestionRootMinimal()
                    const key = getQuestionKeyMinimal(root)
                    if (!root || (prevKey && key && key !== prevKey)) return true
                    await sleep(100)
                }
                return false
            }

            function computeMinMs(baseSeconds, subquestions) {
                return Math.max(
                    60_000,
                    baseSeconds * 1000 +
                        Math.max(0, subquestions - 1) *
                            CONFIG.extraPerSubquestionMs
                )
            }

            function computeWaitMs(baseSeconds, subquestions, alreadyMs) {
                const minMs = computeMinMs(baseSeconds, subquestions)
                const already = Math.max(0, alreadyMs || 0)
                if (already >= minMs) return 0
                // Must exceed minimum with randomness (not exact threshold).
                const randomExtraMs = randInt(3_000, CONFIG.jitterMs)
                const targetMs = minMs + randomExtraMs
                return Math.max(0, targetMs - already)
            }

            function toDisplayedBucketMs(totalMs) {
                const safe = Math.max(0, totalMs || 0)
                if (safe >= 60_000) {
                    return Math.floor(safe / 60_000) * 60_000
                }
                return Math.floor(safe / 1000) * 1000
            }

            async function waitForListTimeRefresh(
                itemKey,
                beforeMs,
                timeoutMs = 30000
            ) {
                const start = Date.now()
                let latestMs = beforeMs
                while (state.running && Date.now() - start < timeoutMs) {
                    const item = getQuestionListItemByKey(itemKey)
                    if (item) {
                        latestMs = getQuestionListTimeMs(item)
                        if (latestMs !== beforeMs) return latestMs
                    }
                    await sleep(200)
                }
                return latestMs
            }

            function findNextEligibleQuestionItem() {
                const items = getQuestionListItems()
                for (const item of items) {
                    const timeMs = getQuestionListTimeMs(item)
                    const itemKey = getQuestionListKey(item)
                    if (!itemKey) continue
                    if (timeMs >= QUESTIONS.timeSpentSkipMs) continue
                    if (state.processedQuestionKeys.has(itemKey)) continue
                    const previewText = getQuestionListPreviewText(item)
                    if (isExcludedQuestionByText(previewText)) continue
                    return item
                }
                return null
            }

            async function runAutoSimLoop() {
                const baseSeconds = Math.round(CONFIG.baseMs / 1000)
                while (state.running) {
                    const nextItem = findNextEligibleQuestionItem()
                    if (!nextItem) {
                        stopSimTime('Done (no more eligible questions)')
                        return
                    }

                    const itemId = getQuestionListId(nextItem)
                    const itemKey = getQuestionListKey(nextItem)
                    const alreadyMs = getQuestionListTimeMs(nextItem)
                    if (!itemKey) {
                        stopSimTime('Question key missing')
                        return
                    }

                    setStatus(
                        `Open Q ${itemId || '?'} (already ${Math.round(alreadyMs / 1000)}s)`
                    )

                    if (!clickQuestionListItem(nextItem)) {
                        stopSimTime('Failed click question item')
                        return
                    }

                    const activeRoot = await waitForActiveQuestionOpen()
                    if (!activeRoot) {
                        stopSimTime('Question did not open (timeout)')
                        return
                    }

                    const subquestions = countSubquestions(activeRoot)
                    const waitMs = computeWaitMs(baseSeconds, subquestions, alreadyMs)
                    const expectedDisplayedMs = toDisplayedBucketMs(
                        alreadyMs + waitMs
                    )

                    state.scheduledAt = Date.now()
                    state.scheduledDelayMs = waitMs
                    startCountdown()
                    setStatus(
                        `Waiting ${Math.ceil(waitMs / 1000)}s (subq ${subquestions}, already ${Math.round(alreadyMs / 1000)}s)`
                    )

                    await sleepWhileRunning(waitMs)
                    if (!state.running) return

                    const closeBtn = findActiveCloseButton()
                    if (!closeBtn) {
                        stopSimTime('Close button not found')
                        return
                    }
                    const keyBeforeClose = getQuestionKeyMinimal(
                        getActiveQuestionRootMinimal()
                    )
                    closeBtn.click()
                    await waitForQuestionClose(keyBeforeClose)
                    clearTimer()
                    if (waitMs > 0) {
                        const finalMs = await waitForListTimeRefresh(
                            itemKey,
                            alreadyMs
                        )
                        if (finalMs < expectedDisplayedMs) {
                            stopSimTime(
                                `Time check failed Q ${itemId || '?'} (${Math.round(finalMs / 1000)}s < expected ${Math.round(expectedDisplayedMs / 1000)}s)`
                            )
                            return
                        }
                    }
                    state.processedQuestionKeys.add(itemKey)

                    // Move fast when no wait was needed.
                    await sleep(waitMs > 0 ? CONFIG.beforeNextDelayMs : 150)
                }
            }

            function startCountdown() {
                if (state.countdownId !== null) clearInterval(state.countdownId)
                state.countdownId = setInterval(() => {
                    if (
                        !state.running ||
                        !state.scheduledAt ||
                        !state.scheduledDelayMs
                    )
                        return
                    const elapsed = Date.now() - state.scheduledAt
                    const remaining = Math.max(
                        0,
                        state.scheduledDelayMs - elapsed
                    )
                    setStatus(`Close in ${Math.ceil(remaining / 1000)}s`)
                }, 500)
            }

            function scheduleForCurrentQuestion() {
                if (!state.running) return
                clearTimer()
                runAutoSimLoop()
            }

            function disconnectObservers() {
                for (const fn of state.observerDisconnectors) {
                    try {
                        fn()
                    } catch (_) {}
                }
                state.observerDisconnectors = []
            }

            function startSimTime() {
                if (state.running) return
                state.running = true
                state.processedQuestionKeys = new Set()
                const btn = document.getElementById('d2l-sim-time-btn')
                if (btn) btn.classList.add('on')
                runAutoSimLoop()
            }

            function stopSimTime(reason = 'Stopped') {
                state.running = false
                state.activeKey = null
                state.processedQuestionKeys = new Set()
                clearTimer()
                disconnectObservers()
                const btn = document.getElementById('d2l-sim-time-btn')
                if (btn) btn.classList.remove('on')
                setStatus(reason)
            }

            const simBtn = document.getElementById('d2l-sim-time-btn')
            if (simBtn) {
                simBtn.addEventListener('click', () => {
                    if (state.running) stopSimTime('Stopped')
                    else startSimTime()
                })
            }

            window.questionTimeSimulator = {
                start: startSimTime,
                stop: stopSimTime,
                rescan: scheduleForCurrentQuestion,
                config: CONFIG,
                state,
            }
            // --- END EXACT MINIMAL SCRIPT LOGIC ---

            answersBtn.onclick = () => {
                void runCopyAllAnswersWithButtonFeedback(answersBtn)
            }

            promptBtn.onclick = () => {
                const promptText = `Provide algebraic solutions in individual code blocks using these formatting rules:
- Simplify all equations and use a "lazy student" style (skip obvious intermediate steps).
- Use a single space on otherwise empty lines to prevent them from being trimmed.
- Include spaces between operators (e.g., y = 5x + 6), but NOT inside fractions (use 1/-5, not 1 /-5).
- Use abbreviations where possible (e.g., // for parallel, perp for perpendicular, pt for point, "all real" instead of "all real numbers").
- Some symbols you can use directly: ±,≠,˚,∆,µ,π,≈,√ (instead of sqrt(x) do √(x))
- If a variable is already defined on a previous line, use "=" on successive lines instead of repeating the variable name.
- EXCEPTION: For the final answer line of an equation, always include the full "y =" or "x =" for clarity.
- Above each code block, include the question numbers in the dual format: Q[Lesson#] ([Ref#]).
- The [Lesson#] is the large number in the top-left; the [Ref#] is the smaller "Reference Q." number in the corner.
- Do not include any question numbers or labels inside the code block itself.

Format the structure exactly like this:

Q9 (87)

\`\`\` 
intersection of 4x + 5y = 13 and 2x - 5y = -1, // to x-axis

(4x + 5y) + (2x - 5y) = 13 + (-1)
6x = 12
x = 2

4(2) + 5y = 13
5y = 5
y = 1

// to x-axis
y = 1

\`\`\``
                navigator.clipboard
                    .writeText(promptText)
                    .then(() => {
                        promptBtn.classList.add('copied')
                        promptBtn.querySelector('.text').textContent = 'Copied!'
                        setTimeout(() => {
                            promptBtn.classList.remove('copied')
                            promptBtn.querySelector('.text').textContent =
                                'Copy Prompt'
                        }, 2000)
                    })
                    .catch((err) => {
                        console.error(
                            '[D2L-DL] Failed to copy prompt to clipboard:',
                            err
                        )
                    })
            }

            async function handleScriptDownload() {
                console.log(`[D2L-SCRIPT] Script download triggered.`)
                const results = []

                let bestTitle = extractTitleInFrame()
                const collectionListener = (event) => {
                    if (
                        event.data &&
                        event.data.type === 'D2L_EXTRACT_SCRIPT_RESPONSE'
                    ) {
                        console.log(
                            `[D2L-SCRIPT] Collected response from ${event.data.url}`
                        )
                        results.push(event.data.script)
                        if (event.data.title && event.data.title !== 'script') {
                            bestTitle = event.data.title
                        }
                    }
                }
                window.addEventListener('message', collectionListener)

                const topScript = await extractScriptInFrame()
                if (topScript) results.push(topScript)

                const iframes = findIframes()
                console.log(
                    `[D2L-SCRIPT] Broadcasting request to ${iframes.length} direct iframes.`
                )
                iframes.forEach((f) =>
                    f.contentWindow.postMessage(
                        { type: 'D2L_EXTRACT_SCRIPT_REQUEST' },
                        '*'
                    )
                )

                setTimeout(() => {
                    window.removeEventListener('message', collectionListener)
                    console.log(
                        `[D2L-SCRIPT] Collection finished. Total scripts: ${results.length}`
                    )
                    if (results.length > 0) {
                        console.log(
                            `[D2L-SCRIPT] Saving combined script file...`
                        )
                        const content = results.join('\n\n---\n\n')
                        const blob = new Blob([content], {
                            type: 'text/plain;charset=utf-8',
                        })
                        const filename = `${sanitizeFilename(bestTitle)}.txt`
                        downloadBlob(blob, filename)
                    } else {
                        console.warn(
                            `[D2L-SCRIPT] No script content found in any frame.`
                        )
                        alert('No script content found to save.')
                    }
                }, 1000)
            }

            scriptBtn.onclick = handleScriptDownload

            const overlay = document.createElement('div')
            overlay.id = 'd2l-dl-overlay'
            document.body.appendChild(overlay)

            const highlighter = document.createElement('div')
            highlighter.id = 'd2l-iframe-highlighter'
            document.body.appendChild(highlighter)

            const dialog = document.createElement('div')
            dialog.id = 'd2l-dl-dialog'
            document.body.appendChild(dialog)

            const hide = () => {
                overlay.classList.remove('visible')
                dialog.classList.remove('visible')
                highlighter.style.display = 'none'
            }

            function showMenu() {
                const iframes = findIframes()
                const frames = [
                    {
                        name: 'Top Page',
                        frame: window,
                        desc: 'Main document container',
                    },
                    ...iframes.map((f, i) => ({
                        name: f.title || f.name || f.id || `Iframe #${i + 1}`,
                        frame: f,
                        desc: f.src.split('/').pop() || 'Embedded frame',
                    })),
                ]

                dialog.innerHTML = `
                    <h2>Content Tools</h2>
                    <p>Select a frame to download images (ZIP) or take a snapshot.</p>
                    <div class="d2l-dl-frame-list">
                        <div class="d2l-dl-frame-item all" id="d2l-dl-all">
                            <div>
                                <div class="title">All Frames (ZIP)</div>
                                <div class="desc">Triggers ZIP download in every frame</div>
                            </div>
                        </div>
                        ${frames
                            .map(
                                (f, i) => `
                            <div class="d2l-dl-frame-item" data-index="${i}">
                                <div class="info">
                                    <div class="title">${f.name}</div>
                                    <div class="desc">${f.desc}</div>
                                </div>
                                <div class="d2l-dl-item-actions">
                                    <div class="d2l-dl-action-icon snapshot-btn" title="Take Snapshot" data-index="${i}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                    </div>
                                    <div class="d2l-dl-action-icon zip-btn" title="ZIP Images" data-index="${i}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                    </div>
                                </div>
                            </div>
                        `
                            )
                            .join('')}
                    </div>
                    <div style="display:flex; justify-content:space-between">
                        <button id="d2l-dl-close" style="background:none; border:none; color:#555; cursor:pointer; font-size:11px">Close</button>
                    </div>
                `

                overlay.classList.add('visible')
                dialog.classList.add('visible')

                dialog
                    .querySelectorAll('.d2l-dl-frame-item')
                    .forEach((item) => {
                        item.addEventListener('mouseenter', () => {
                            const idx = item.getAttribute('data-index')
                            if (!idx) return
                            const f = frames[parseInt(idx)]
                            if (
                                f.frame !== window &&
                                f.frame.getBoundingClientRect
                            ) {
                                const r = f.frame.getBoundingClientRect()
                                highlighter.style.cssText = `top:${r.top}px; left:${r.left}px; width:${r.width}px; height:${r.height}px; display:block;`
                            } else highlighter.style.display = 'none'
                        })
                    })

                dialog.querySelectorAll('.zip-btn').forEach((btn) => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation()
                        const f = frames[parseInt(btn.dataset.index)]
                        hide()
                        if (f.frame === window) {
                            bundleImagesInFrame().then(async (items) => {
                                if (items.length > 0) {
                                    const zip = new JSZip()
                                    items.forEach((it) =>
                                        zip.file(it.filename, it.blob)
                                    )
                                    const content = await zip.generateAsync({
                                        type: 'blob',
                                    })
                                    downloadBlob(content, 'images.zip')
                                }
                            })
                        } else {
                            f.frame.contentWindow.postMessage(
                                { type: 'D2L_TRIGGER_DOWNLOAD_SINGLE' },
                                '*'
                            )
                        }
                    })
                })

                dialog.querySelectorAll('.snapshot-btn').forEach((btn) => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation()
                        const f = frames[parseInt(btn.dataset.index)]
                        hide()
                        if (f.frame === window) takeSnapshotInFrame()
                        else
                            f.frame.contentWindow.postMessage(
                                { type: 'D2L_SNAPSHOT' },
                                '*'
                            )
                    })
                })

                document
                    .getElementById('d2l-dl-all')
                    .addEventListener('click', () => {
                        hide()
                        frames.forEach((f) => {
                            if (f.frame === window) {
                                bundleImagesInFrame().then(async (items) => {
                                    if (items.length > 0) {
                                        const zip = new JSZip()
                                        items.forEach((it) =>
                                            zip.file(it.filename, it.blob)
                                        )
                                        const content = await zip.generateAsync(
                                            {
                                                type: 'blob',
                                            }
                                        )
                                        downloadBlob(content, 'top-images.zip')
                                    }
                                })
                            } else {
                                f.frame.contentWindow.postMessage(
                                    { type: 'D2L_TRIGGER_DOWNLOAD_SINGLE' },
                                    '*'
                                )
                            }
                        })
                    })

                document.getElementById('d2l-dl-close').onclick = hide
                overlay.onclick = hide
            }

            btn.addEventListener('click', showMenu)
        }

        if (document.body) createUI()
        else window.addEventListener('DOMContentLoaded', createUI)

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'D2L_HAS_VIDEO_SCRIPT') {
                const sbtn = document.getElementById('d2l-script-btn')
                if (sbtn) sbtn.style.display = 'flex'
            }
        })

        const updateVisibility = () => {
            const c = document.getElementById('chatFrame')
            if (c) c.remove()

            const isLessonPage = (() => {
                try {
                    return (
                        /\/lesson\/\d+/.test(window.location.href) ||
                        (window.top &&
                            /\/lesson\/\d+/.test(window.top.location.href))
                    )
                } catch (_) {
                    return /\/lesson\/\d+/.test(window.location.href)
                }
            })()
            const hasQuizQuestion = !!findInDocumentOrIframes(
                '.qf-question, [id^="question-display-"]'
            )
            const showQuestionTools = isLessonPage || hasQuizQuestion

            const dlBtn = document.getElementById('d2l-dl-btn')
            const sbtn = document.getElementById('d2l-script-btn')
            const promptBtn = document.getElementById('d2l-prompt-btn')
            const answersBtn = document.getElementById('d2l-answers-btn')
            const automationBar = document.getElementById('d2l-automation-bar')

            if (showQuestionTools) {
                if (dlBtn) dlBtn.style.display = 'none'
                if (sbtn) sbtn.style.display = 'none'
                if (promptBtn) promptBtn.style.display = 'flex'
                if (answersBtn) answersBtn.style.display = 'flex'
                if (automationBar) automationBar.style.display = 'flex'
            } else {
                if (dlBtn) dlBtn.style.display = 'flex'
                if (promptBtn) promptBtn.style.display = 'none'
                if (answersBtn) answersBtn.style.display = 'none'
                if (automationBar) automationBar.style.display = 'none'
                if (sbtn) {
                    if (document.querySelector('.video-script')) {
                        sbtn.style.display = 'flex'
                    } else {
                        sbtn.style.display = 'none'
                    }
                }
            }
        }
        updateVisibility()
        new MutationObserver(updateVisibility).observe(
            document.documentElement,
            {
                childList: true,
                subtree: true,
            }
        )
        window.addEventListener('hashchange', updateVisibility)
    } else {
        const reportPresence = () => {
            if (document.querySelector('.video-script')) {
                console.log(
                    `[D2L-SCRIPT] Found script in iframe: ${window.location.href}, reporting to top...`
                )
                window.top.postMessage({ type: 'D2L_HAS_VIDEO_SCRIPT' }, '*')
            }
        }
        reportPresence()
        new MutationObserver(reportPresence).observe(document.documentElement, {
            childList: true,
            subtree: true,
        })

        const IFRAME_ANSWERS_STYLES = `
            #d2l-answers-btn {
                position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px; width: 48px; height: 48px;
                display: none; align-items: center; justify-content: center;
                cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(10px); opacity: 0.9; overflow: hidden;
                white-space: nowrap; font-family: -apple-system, sans-serif; font-weight: 600;
            }
            #d2l-answers-btn:hover { width: 200px; opacity: 1; border-radius: 12px; }
            #d2l-answers-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
            #d2l-answers-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
            #d2l-answers-btn:hover .text { opacity: 1; max-width: 140px; margin-right: 16px; }
            #d2l-answers-btn.copied {
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            }
        `

        const syncIframeAnswersButton = () => {
            const hasQuestion = !!document.querySelector(
                '.qf-question, [id^="question-display-"]'
            )
            let answersBtn = document.getElementById('d2l-answers-btn')

            if (!hasQuestion) {
                if (answersBtn) answersBtn.style.display = 'none'
                return
            }

            if (!document.getElementById('d2l-answers-btn-styles')) {
                const styleEl = document.createElement('style')
                styleEl.id = 'd2l-answers-btn-styles'
                styleEl.textContent = IFRAME_ANSWERS_STYLES
                document.head.appendChild(styleEl)
            }

            if (!answersBtn) {
                answersBtn = document.createElement('button')
                answersBtn.id = 'd2l-answers-btn'
                answersBtn.innerHTML =
                    '<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg></div><div class="text">Copy All Answers</div>'
                answersBtn.onclick = () => {
                    void runCopyAllAnswersWithButtonFeedback(answersBtn)
                }
                document.body.appendChild(answersBtn)
            }
            answersBtn.style.display = 'flex'
        }

        if (document.body) syncIframeAnswersButton()
        else
            window.addEventListener('DOMContentLoaded', syncIframeAnswersButton)

        new MutationObserver(syncIframeAnswersButton).observe(
            document.documentElement,
            { childList: true, subtree: true }
        )
    }

    window.addEventListener('keydown', (e) => {
        if (isTypingTarget()) return

        if (e.key === 't' || e.key === 'T') {
            if (checkQMode()) {
                const btn = findInDocumentOrIframes(
                    'button.qf-button.text-tool'
                )
                if (btn) {
                    console.log(
                        "[D2L-DL] 'T' key pressed in Q-mode, clicking text tool button."
                    )
                    btn.click()
                    e.preventDefault()
                }
            }
            return
        }

        if (
            checkQMode() &&
            (e.key === 'y' || e.key === 'Y' || e.key === 'Enter')
        ) {
            const yesBtn = getCurrentQuestionYesButton()
            if (yesBtn) {
                console.log(
                    `[D2L-DL] '${e.key}' in Q-mode, clicking current Yes.`
                )
                yesBtn.click()
                e.preventDefault()
            }
        }
    })
})()
