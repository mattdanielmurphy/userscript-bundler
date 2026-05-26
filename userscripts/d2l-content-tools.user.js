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
            'div.qf-answer.qf-answer-text'
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
        const text = (label && label.textContent) || partEl.textContent || ''
        const m = text.match(/^\s*([a-z])\)/i) || text.match(/\b([a-z])\)/i)
        return m ? m[1].toLowerCase() : '?'
    }

    function getShowAnswerControl(partEl) {
        return (
            partEl.querySelector('.qf-answer[role="button"]') ||
            partEl.querySelector('.qf-answer[tabindex="0"]') ||
            partEl.querySelector('.qf-answer')
        )
    }

    function extractAnswerFromPart(partEl) {
        const answer = partEl.querySelector('.qf-answer')
        if (!answer) return ''

        const tex = answer.querySelector('script[type="math/tex"]')
        if (tex && tex.textContent.trim()) {
            return tex.textContent.trim()
        }

        const img = answer.querySelector('.qf-answer-content img')
        if (img && img.alt && img.alt.trim()) {
            return img.alt.trim()
        }

        const content = answer.querySelector('.qf-answer-content')
        if (content) {
            const text = content.innerText.replace(/\s+/g, ' ').trim()
            if (text) return text
        }

        const aria = answer.getAttribute('aria-label') || ''
        if (/show/i.test(aria)) return ''
        return aria.trim()
    }

    async function revealPartsAndCopyAnswers() {
        console.log('[D2L-DL] Auto-processing all questions...')

        const lines = []

        while (true) {
            const targetQuestion = Array.from(
                document.querySelectorAll('.qf-answer')
            ).find((q) => !q.classList.contains('show'))

            if (!targetQuestion) {
                console.log(
                    '[D2L-DL] Finished. No more unclicked questions found.'
                )
                break
            }

            targetQuestion.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            })

            // Expand solution UI (if present) before clicking answer reveal controls.
            const questionRoot =
                targetQuestion.closest('.qf-question') ||
                targetQuestion.closest('.qf-part') ||
                document.body
            const solutionHandle = questionRoot.querySelector(
                '.qf-solution-handle'
            )
            if (solutionHandle) {
                solutionHandle.click()
                await sleep(100)
            }

            targetQuestion.click()
            console.log(
                `[D2L-DL] Processing answer container: ${targetQuestion.id}`
            )

            const part =
                targetQuestion.closest('.qf-part') ||
                targetQuestion.closest('.qf-question') ||
                document.body
            const letter = letterFromPart(part)

            await new Promise((resolve) => {
                const startTime = Date.now()
                const checkInterval = setInterval(() => {
                    const yesButton = targetQuestion.querySelector(
                        '.qf-cell.qf-answer-option.yes'
                    )

                    if (yesButton && yesButton.offsetParent !== null) {
                        clearInterval(checkInterval)
                        yesButton.click()
                        resolve()
                    }

                    if (Date.now() - startTime > 3000) {
                        clearInterval(checkInterval)
                        console.warn(
                            `[D2L-DL] Timed out waiting for "Yes" button in ${targetQuestion.id}`
                        )
                        resolve()
                    }
                }, 100)
            })

            await sleep(400)

            let answer = extractAnswerFromPart(part)
            if (!answer) {
                await sleep(250)
                answer = extractAnswerFromPart(part)
            }
            if (!answer) answer = '(no answer text)'

            if (letter === '?') {
                lines.push(answer)
            } else {
                lines.push(`${letter}. ${answer}`)
            }
        }

        if (!lines.length) {
            alert('No unanswered questions found.')
            return null
        }

        const text = lines.join('\n')
        await navigator.clipboard.writeText(text)
        console.log('[D2L-DL] Copied answers:\n' + text)
        return text
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
                <button class="btn" id="d2l-sim-advance-btn" type="button" disabled>Advance now</button>
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
                baseMs: 60_000,
                extraPerSubquestionMs: 30_000,
                jitterMs: 10_000,
                minDelayMs: 5_000,
                beforeNextDelayMs: 2000,
                holdMs: 50,
                debug: true,
            };

            const state = {
                running: false,
                timerId: null,
                clickIntervalId: null,
                observerDisconnectors: [],
                activeKey: null,
                countdownId: null,
                scheduledAt: 0,
                scheduledDelayMs: 0,
            };

            const log = (...args) => {
                if (CONFIG.debug) console.log('[time-metric-sim]', ...args);
            };

            function setStatus(text) {
                const el = document.getElementById('d2l-automation-status');
                if (el) el.textContent = text;
                log(text);
            }

            function clearTimer() {
                if (state.timerId !== null) {
                    clearTimeout(state.timerId);
                    state.timerId = null;
                }
                if (state.clickIntervalId !== null) {
                    clearInterval(state.clickIntervalId);
                    state.clickIntervalId = null;
                }
                if (state.countdownId !== null) {
                    clearInterval(state.countdownId);
                    state.countdownId = null;
                }
                state.scheduledAt = 0;
                state.scheduledDelayMs = 0;
            }

            function isVisible(el) {
                if (!el || !el.isConnected) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            }

            function uniquePush(list, item) {
                if (item && !list.includes(item)) list.push(item);
            }

            function findInShadow(selector, root, out = []) {
                if (!root) return out;
                if (root.querySelectorAll) {
                    root.querySelectorAll(selector).forEach(el => uniquePush(out, el));
                }
                const walker = (root.ownerDocument || document).createTreeWalker(
                    root,
                    NodeFilter.SHOW_ELEMENT,
                    {
                        acceptNode(node) {
                            return node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                        }
                    }
                );
                let node;
                while ((node = walker.nextNode())) {
                    findInShadow(selector, node.shadowRoot, out);
                }
                return out;
            }

            function collectSameOriginDocuments() {
                const docs = [];
                const seen = new Set();

                function walk(doc) {
                    if (!doc || !doc.defaultView || seen.has(doc)) return;
                    seen.add(doc);
                    docs.push(doc);

                    try {
                        const iframes = [
                            ...doc.querySelectorAll('iframe'),
                            ...findInShadow('iframe', doc)
                        ];

                        for (const iframe of iframes) {
                            try {
                                if (iframe && iframe.contentDocument) {
                                    walk(iframe.contentDocument);
                                }
                            } catch (_) {}
                        }
                    } catch (_) {}
                }

                try {
                    walk(document);
                } catch (_) {}
                return docs;
            }

            function getQuestionCandidates() {
                const results = [];
                for (const doc of collectSameOriginDocuments()) {
                    for (const selector of CONFIG.questionSelector.split(',').map(s => s.trim())) {
                        findInShadow(selector, doc, results);
                    }
                }
                return results;
            }

            function getActiveQuestionRootMinimal() {
                const candidates = getQuestionCandidates().filter(isVisible);
                if (!candidates.length) return null;
                return candidates[candidates.length - 1];
            }

            function getQuestionKeyMinimal(root) {
                if (!root) return null;
                const doc = root.ownerDocument || document;
                const slide = root.closest?.(CONFIG.slideSelector) || root;
                const ref = slide.querySelector?.('.qf-reference')?.textContent?.trim();
                const num = slide.querySelector?.('.qf-number')?.textContent?.trim();
                return root.id || ref || num || root.textContent?.trim()?.slice(0, 80) || null;
            }

            function getTargetCanvas() {
                const root = getActiveQuestionRootMinimal();
                if (!root) return null;

                const doc = root.ownerDocument || document;
                const slide = root.closest?.(CONFIG.slideSelector) || root;

                let canvas = slide.querySelector(CONFIG.canvasSelector);
                if (!canvas && doc) canvas = doc.querySelector(CONFIG.canvasSelector);
                if (!canvas) return null;
                if (!isVisible(canvas)) return null;
                return canvas;
            }

             function countSubquestions(root) {
                 try {
                     if (!root) return 1;
                     const slide = root.closest?.(CONFIG.slideSelector) || root;
                     const question = slide?.querySelector('.qf-question') || slide;
                     if (!question) return 1;
                     const count = question.querySelectorAll(CONFIG.subquestionSelector).length;
                     return Math.max(1, count);
                 } catch (_) {
                     return 1;
                 }
             }

             function randInt(min, max) {
                 return Math.floor(Math.random() * (max - min + 1)) + min;
             }

             function getDelayMs(subquestions) {
                 const base = CONFIG.baseMs + Math.max(0, subquestions - 1) * CONFIG.extraPerSubquestionMs;
                 const jitter = randInt(-CONFIG.jitterMs, CONFIG.jitterMs);
                 return Math.max(CONFIG.minDelayMs, base + jitter);
             }

             function getVisible(el) {
                 try {
                     if (!el) return false;
                     const r = el.getBoundingClientRect();
                     return r.width > 0 && r.height > 0;
                 } catch (_) {
                     return false;
                 }
             }

             function findNextButton(root) {
                 try {
                     if (root) {
                         const slide = root.closest?.(CONFIG.slideSelector) || root;
                         const btn = slide?.querySelector(CONFIG.nextButtonSelector);
                         if (btn) return btn;
                     }
                     const results = [];
                     for (const doc of collectSameOriginDocuments()) {
                         findInShadow(CONFIG.nextButtonSelector, doc, results);
                     }
                     const visible = results.filter(getVisible);
                     return visible[visible.length - 1] || results[results.length - 1] || null;
                 } catch (_) {
                     return null;
                 }
             }

             function dispatchWorkingPattern(canvas) {
                const win = canvas.ownerDocument?.defaultView || window;
                const rect = canvas.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;

                const mousedownEvent = new win.MouseEvent('mousedown', {
                    view: win,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    buttons: 1
                });

                const mouseupEvent = new win.MouseEvent('mouseup', {
                    view: win,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    buttons: 0
                });

                const clickEvent = new win.MouseEvent('click', {
                    view: win,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                });

                canvas.dispatchEvent(mousedownEvent);
                setTimeout(() => {
                    if (!state.running) return;
                    canvas.dispatchEvent(mouseupEvent);
                    canvas.dispatchEvent(clickEvent);
                    log('clicked canvas', {
                        x: Math.round(x),
                        y: Math.round(y),
                        sameAsDirectQuery: canvas === (canvas.ownerDocument || document).querySelector(CONFIG.canvasSelector)
                    });
                    setStatus('Click fired; waiting for question change or rescan');
                }, CONFIG.holdMs);
            }

            function startCountdown() {
                if (state.countdownId !== null) clearInterval(state.countdownId);
                state.countdownId = setInterval(() => {
                    if (!state.running || !state.scheduledAt || !state.scheduledDelayMs) return;
                    const elapsed = Date.now() - state.scheduledAt;
                    const remaining = Math.max(0, state.scheduledDelayMs - elapsed);
                    setStatus(`Click in ${Math.ceil(remaining / 1000)}s`);
                }, 500);
            }

            function scheduleForCurrentQuestion() {
                 if (!state.running) return;
 
                 const root = getActiveQuestionRootMinimal();
                 if (!root) {
                     clearTimer();
                     setStatus('No visible question found');
                     return;
                 }
 
                 const key = getQuestionKeyMinimal(root);
                 if (!key) {
                     clearTimer();
                     setStatus('Question found but key unavailable');
                     return;
                 }
 
                 if (key === state.activeKey && state.timerId !== null) return;
 
                 state.activeKey = key;
                 clearTimer();
 
                 const canvas = getTargetCanvas();
                 if (!canvas) {
                     setStatus('No visible .qf-canvas-wrapper canvas found');
                     return;
                 }
 
                 const subquestions = countSubquestions(root);
                 const advanceDelayMs = getDelayMs(subquestions);

                 state.scheduledAt = Date.now();
                 state.scheduledDelayMs = advanceDelayMs;
                 setStatus(`Scheduled advance in ${Math.ceil(advanceDelayMs / 1000)}s for ${key}`);
                 startCountdown();
 
                 // Click immediately on entering to record initial activity
                 dispatchWorkingPattern(canvas);

                 // Set 30s repeating interval to click the canvas to maintain active status
                 state.clickIntervalId = setInterval(() => {
                     if (!state.running) return;
                     const latestRoot = getActiveQuestionRootMinimal();
                     const latestKey = getQuestionKeyMinimal(latestRoot);
                     if (latestKey !== key) {
                         clearInterval(state.clickIntervalId);
                         state.clickIntervalId = null;
                         return;
                     }
                     const latestCanvas = getTargetCanvas();
                     if (latestCanvas) {
                         dispatchWorkingPattern(latestCanvas);
                     }
                 }, 30 * 1000);

                 // Set timeout to auto-advance to next question
                 state.timerId = setTimeout(() => {
                     if (!state.running) return;
                     const latestRoot = getActiveQuestionRootMinimal();
                     const latestKey = getQuestionKeyMinimal(latestRoot);
                     if (latestKey !== key) {
                         setStatus('Question changed before auto-advance; rescheduling');
                         scheduleForCurrentQuestion();
                         return;
                     }
                     
                     const latestCanvas = getTargetCanvas();
                     if (latestCanvas) {
                         dispatchWorkingPattern(latestCanvas);
                     }
 
                     const nextBtn = findNextButton(latestRoot);
                     if (!nextBtn || nextBtn.classList.contains('disabled')) {
                         stopSimTime('Done (no more questions)');
                         return;
                     }
 
                     setStatus('Advancing to next question...');
                     setTimeout(() => {
                         if (!state.running) return;
                         nextBtn.click();
                     }, CONFIG.beforeNextDelayMs);
                 }, advanceDelayMs);
             }

            function disconnectObservers() {
                for (const fn of state.observerDisconnectors) {
                    try { fn(); } catch (_) {}
                }
                state.observerDisconnectors = [];
            }

            function setupCloseInterception() {
                for (const doc of collectSameOriginDocuments()) {
                    try {
                        const win = doc.defaultView;
                        if (!win) continue;
                        if (win.__d2lCloseIntercepted) continue;
                        win.__d2lCloseIntercepted = true;

                        win.addEventListener('click', (e) => {
                            if (!state.running) return;
                            const closeBtn = e.target && e.target.closest && e.target.closest('.qf-title-button.close, [aria-label="close question"]');
                            if (closeBtn) {
                                log('Close button click detected, stopping simulator.');
                                stopSimTime('Stopped (closed)');
                            }
                        }, true);
                    } catch (_) {}
                }
            }

            function startObservers() {
                disconnectObservers();
                setupCloseInterception();
                for (const doc of collectSameOriginDocuments()) {
                    if (!doc.documentElement && !doc.body) continue;
                    const observer = new MutationObserver(() => {
                        if (!state.running) return;
                        if (!doc.defaultView) {
                            observer.disconnect();
                            return;
                        }
                        setupCloseInterception();
                        scheduleForCurrentQuestion();
                    });
                    try {
                        observer.observe(doc.documentElement || doc.body, {
                            childList: true,
                            subtree: true,
                            attributes: true,
                            attributeFilter: ['class', 'style', 'aria-hidden']
                        });
                        state.observerDisconnectors.push(() => observer.disconnect());
                    } catch (_) {}
                }
            }

            function startSimTime() {
                if (state.running) return;
                state.running = true;
                const btn = document.getElementById('d2l-sim-time-btn');
                if (btn) btn.classList.add('on');
                const advanceBtn = document.getElementById('d2l-sim-advance-btn');
                if (advanceBtn) advanceBtn.disabled = false;
                startObservers();
                scheduleForCurrentQuestion();
            }

            function stopSimTime(reason = 'Stopped') {
                state.running = false;
                state.activeKey = null;
                clearTimer();
                disconnectObservers();
                const btn = document.getElementById('d2l-sim-time-btn');
                if (btn) btn.classList.remove('on');
                const advanceBtn = document.getElementById('d2l-sim-advance-btn');
                if (advanceBtn) advanceBtn.disabled = true;
                setStatus(reason);
            }

            const simBtn = document.getElementById('d2l-sim-time-btn');
            if (simBtn) {
                simBtn.addEventListener('click', () => {
                    if (state.running) stopSimTime('Stopped');
                    else startSimTime();
                });
            }

            const advanceBtn = document.getElementById('d2l-sim-advance-btn');
            if (advanceBtn) {
                advanceBtn.textContent = 'Advance now';
                advanceBtn.addEventListener('click', () => {
                    if (!state.running) return;
                    clearTimer();
                    setStatus('Advancing now...');

                    const root = getActiveQuestionRootMinimal();
                    if (!root) return;
                    
                    const canvas = getTargetCanvas();
                    if (canvas) {
                        dispatchWorkingPattern(canvas);
                    }

                    const nextBtn = findNextButton(root);
                    if (!nextBtn || nextBtn.classList.contains('disabled')) {
                        stopSimTime('Done (no more questions)');
                        return;
                    }

                    setStatus('Advancing to next question...');
                    setTimeout(() => {
                        if (!state.running) return;
                        nextBtn.click();
                    }, CONFIG.beforeNextDelayMs);
                });
            }

            window.questionTimeSimulator = {
                start: startSimTime,
                stop: stopSimTime,
                rescan: scheduleForCurrentQuestion,
                config: CONFIG,
                state,
            }
            // --- END EXACT MINIMAL SCRIPT LOGIC ---

            answersBtn.onclick = async () => {
                answersBtn.disabled = true
                try {
                    await revealPartsAndCopyAnswers()
                    answersBtn.classList.add('copied')
                    answersBtn.querySelector('.text').textContent = 'Copied!'
                    setTimeout(() => {
                        answersBtn.classList.remove('copied')
                        answersBtn.querySelector('.text').textContent =
                            'Copy All Answers'
                    }, 2000)
                } catch (err) {
                    console.error('[D2L-DL] Copy all answers failed:', err)
                    alert('Could not copy answers. See console for details.')
                } finally {
                    answersBtn.disabled = false
                }
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

            const isQMode = checkQMode()
            const hasQuizQuestion = !!findInDocumentOrIframes(
                '.qf-question, [id^="question-display-"]'
            )
            const showQuestionTools = isQMode || hasQuizQuestion

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
                answersBtn.onclick = async () => {
                    answersBtn.disabled = true
                    try {
                        await revealPartsAndCopyAnswers()
                        answersBtn.classList.add('copied')
                        answersBtn.querySelector('.text').textContent =
                            'Copied!'
                        setTimeout(() => {
                            answersBtn.classList.remove('copied')
                            answersBtn.querySelector('.text').textContent =
                                'Copy All Answers'
                        }, 2000)
                    } catch (err) {
                        console.error('[D2L-DL] Copy all answers failed:', err)
                        alert(
                            'Could not copy answers. See console for details.'
                        )
                    } finally {
                        answersBtn.disabled = false
                    }
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
