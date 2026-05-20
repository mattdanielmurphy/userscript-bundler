// ==UserScript==
// @name        D2L Image Downloader
// @match       https://*.onlinelearningbc.com/d2l/*
// @match       https://*.onlinelearningbc.com/content/*
// @match       https://*.studyforge.net/*
// @match       https://d2l.sd44.bc.ca/*
// @match       *://*.contentconnections.ca/*
// @require     https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require     https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @require     https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @grant       none
// @version     1.5
// @author      Antigravity
// @description Adds a button to download all images as a ZIP or take a high-res snapshot of D2L/StudyForge content.
// ==/UserScript==

;(function () {
    'use strict'
    console.log(
        `[D2L-DL] Userscript initialized in ${window.location.href} (Top: ${window === window.top})`
    )

    const IS_TOP = window === window.top
    const downloadCounts = {}

    // 1. Optimized helper function to find the element across Shadow boundaries
    function findInShadow(selector, root = document) {
        const el = root.querySelector(selector)
        if (el) return el

        // Only iterate over elements that could potentially have a shadowRoot
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

    // Helper to find all iframes even inside shadow roots
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

    // Helper to find all images even inside shadow roots
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

    async function getTargetImages() {
        const candidates = [
            '.d2l-html-block-rendered',
            '.d2l-fileviewer-render-container',
            '.sf-lesson-content', // StudyForge
            '.sf-page-content', // StudyForge
            '.content-area', // Generic StudyForge/ContentConnections
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
            // Allow small images if they are in a content block but not icons
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

                // Smart filename extraction
                let filename = ''
                try {
                    const url = new URL(src)
                    const pathParts = url.pathname.split('/')
                    filename = pathParts.pop() || 'image'
                    if (!filename.includes('.') && response.type) {
                        // Try to get extension from mime type
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

    function getCurrentTitle() {
        const nav = document.querySelector('nav.relative.mx-auto.my-0.flex')
        let lessonHeaderEl = document.querySelector('h1.lesson-header-number')
        if (!lessonHeaderEl) {
            const h1s = Array.from(document.querySelectorAll('h1'))
            lessonHeaderEl = h1s.find((h) => h.textContent.includes('Lesson'))
        }
        const selectedTabEl = document.querySelector('li.tab.viewed.selected')

        let navParts = []
        if (nav) {
            const navItemsContainer = nav.querySelector('.overflow-hidden')
            if (navItemsContainer) {
                navParts = navItemsContainer.innerText
                    .split('\n')
                    .map((t) => t.trim())
                    .filter(
                        (t) =>
                            t.length > 0 &&
                            ![
                                'Search',
                                'Next Lesson',
                                'Welcome',
                                'Matthew Murphy',
                            ].includes(t)
                    )
                if (navParts.length > 3) navParts.pop()
            }
        }

        const lessonText = lessonHeaderEl
            ? lessonHeaderEl.textContent.trim()
            : ''
        const lessonNum = (lessonText.match(/\d+/) || ['1'])[0]

        let videoNum = '1'
        let videoTitle = 'Unknown Video'
        if (selectedTabEl) {
            const lines = selectedTabEl.textContent
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
            const titleLine = lines.find((l) => l.includes(' - '))
            if (titleLine) {
                const parts = titleLine.split(' - ')
                videoNum = parts[0].trim()
                videoTitle = parts[1].trim()
            } else if (lines.length > 0) {
                videoNum = lines[0]
            }
        } else {
            const videoNameEl = document.querySelector('.video-name')
            if (videoNameEl) {
                videoTitle = videoNameEl.textContent.trim()
            } else {
                const lessonHeaderNameEl = document.querySelector(
                    '.lesson-header-name'
                )
                if (lessonHeaderNameEl)
                    videoTitle = lessonHeaderNameEl.textContent.trim()
            }
        }

        if (navParts.length > 0) {
            navParts[navParts.length - 1] =
                `${navParts[navParts.length - 1]} (${lessonNum})`
        } else {
            navParts.push(`(${lessonNum})`)
        }

        return [...navParts, `${videoTitle} (${videoNum})`].join(' - ')
    }

    // ── CC helpers ──────────────────────────────────────────────────────

    function getCCTrack(video) {
        const track = Array.from(video.textTracks).find(
            (t) => t.kind === 'captions' || t.kind === 'subtitles'
        )
        if (!track) return null
        if (track.mode === 'disabled') track.mode = 'hidden'
        return track
    }

    function getAllCCCues(video) {
        const track = getCCTrack(video)
        if (!track || !track.cues) return []
        return Array.from(track.cues).sort((a, b) => a.startTime - b.startTime)
    }

    function getCurrentCCText(video) {
        const track = getCCTrack(video)
        if (!track || !track.cues) return null
        const time = video.currentTime
        const match = Array.from(track.cues)
            .filter((c) => c.startTime <= time)
            .sort((a, b) => b.startTime - a.startTime)[0]
        return match ? match.text.replace(/\n/g, ' ') : null
    }

    function fmtTime(sec) {
        const m = Math.floor(sec / 60)
        const s = String(Math.floor(sec % 60)).padStart(2, '0')
        return `${m}:${s}`
    }

    // Renders text onto an already-drawn canvas and triggers download
    function renderCCAndDownload(canvas, ccText, scaleFactor, fileName) {
        const ctx = canvas.getContext('2d')
        if (ccText && ccText.trim()) {
            const fontSize = Math.max(14, Math.round(canvas.height * 0.025))
            ctx.font = `bold ${fontSize}px Roboto, sans-serif`
            ctx.textAlign = 'center'
            const padding = Math.round(fontSize * 0.5)
            const lineY = canvas.height - padding * 1.2
            const bgHeight = fontSize + padding * 1.5
            ctx.fillStyle = 'rgba(0, 0, 0, 0.40)'
            ctx.fillRect(0, canvas.height - bgHeight, canvas.width, bgHeight)
            ctx.shadowColor = 'rgba(0,0,0,0.9)'
            ctx.shadowBlur = 4 * scaleFactor
            ctx.fillStyle = '#ffffff'
            ctx.fillText(ccText.trim(), canvas.width / 2, lineY, canvas.width - padding * 2)
            ctx.shadowBlur = 0
        }
        const dataUrl = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.download = fileName
        link.href = dataUrl
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        console.log(`[D2L-DL] Saved: ${fileName}`)
    }

    // Shows the CC picker modal; resolves with the final text string (possibly empty)
    // or null if the user dismissed.
    function showCCPicker(video, currentCueIdx, cues) {
        return new Promise((resolve) => {
            // ── backdrop + modal ──────────────────────────────────────
            const backdrop = document.createElement('div')
            backdrop.id = 'd2l-cc-backdrop'

            backdrop.innerHTML = `
                <div id="d2l-cc-modal">
                    <div id="d2l-cc-modal-header">
                        <div>
                            <h3>Caption Text</h3>
                            <p>Select lines to burn into the image, then edit if needed.</p>
                        </div>
                        <button id="d2l-cc-close" title="Cancel">✕</button>
                    </div>
                    <div id="d2l-cc-cue-list"></div>
                    <div id="d2l-cc-editor-wrap">
                        <label id="d2l-cc-editor-label" for="d2l-cc-editor">Edit text</label>
                        <textarea id="d2l-cc-editor" rows="3" spellcheck="false"></textarea>
                    </div>
                    <div id="d2l-cc-footer">
                        <button class="d2l-cc-btn secondary" id="d2l-cc-skip">No caption</button>
                        <button class="d2l-cc-btn primary" id="d2l-cc-confirm">Download</button>
                    </div>
                </div>
            `

            document.body.appendChild(backdrop)
            requestAnimationFrame(() => backdrop.classList.add('visible'))

            const list = backdrop.querySelector('#d2l-cc-cue-list')
            const editor = backdrop.querySelector('#d2l-cc-editor')
            const checked = new Set()

            // Pre-select current cue
            if (currentCueIdx >= 0) checked.add(currentCueIdx)

            function rebuildEditor() {
                const lines = [...checked]
                    .sort((a, b) => a - b)
                    .map((i) => cues[i].text.replace(/\n/g, ' '))
                editor.value = lines.join(' ')
            }

            // Render cue rows
            cues.forEach((cue, i) => {
                const row = document.createElement('div')
                row.className =
                    'D2L-cc-cue-row d2l-cc-cue-row' +
                    (i === currentCueIdx ? ' current' : '') +
                    (checked.has(i) ? ' checked' : '')

                const cb = document.createElement('input')
                cb.type = 'checkbox'
                cb.checked = checked.has(i)

                const textEl = document.createElement('div')
                textEl.className = 'd2l-cc-cue-text'
                textEl.textContent = cue.text.replace(/\n/g, ' ')

                const badge = document.createElement('div')
                badge.className = 'd2l-cc-time-badge'
                badge.textContent = fmtTime(cue.startTime)

                row.append(cb, textEl, badge)
                list.appendChild(row)

                function toggle() {
                    if (checked.has(i)) {
                        checked.delete(i)
                        row.classList.remove('checked')
                        cb.checked = false
                    } else {
                        checked.add(i)
                        row.classList.add('checked')
                        cb.checked = true
                    }
                    rebuildEditor()
                }
                row.addEventListener('click', (e) => {
                    if (e.target !== cb) toggle()
                })
                cb.addEventListener('change', toggle)
            })

            rebuildEditor()

            // Scroll current cue into view
            const currentRow = list.children[currentCueIdx]
            if (currentRow) {
                currentRow.scrollIntoView({ block: 'center', behavior: 'instant' })
            }

            function dismiss(result) {
                backdrop.classList.remove('visible')
                setTimeout(() => backdrop.remove(), 250)
                resolve(result)
            }

            backdrop.querySelector('#d2l-cc-close').addEventListener('click', () => dismiss(null))
            backdrop.querySelector('#d2l-cc-skip').addEventListener('click', () => dismiss(''))
            backdrop.querySelector('#d2l-cc-confirm').addEventListener('click', () => dismiss(editor.value))

            // Click outside modal to cancel
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) dismiss(null)
            })
        })
    }

    async function downloadStudyForgeFrame() {
        const container = document.querySelector('.video-wrapper')
        const nav = document.querySelector('nav.relative.mx-auto.my-0.flex')

        if (!container) {
            console.error('[D2L-DL] Video wrapper not found.')
            return
        }

        const videos = Array.from(document.querySelectorAll('video'))
        const video = videos.find((v) => {
            const style = window.getComputedStyle(v)
            const parentStyle = window.getComputedStyle(v.parentElement)
            return (
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                parentStyle.visibility !== 'hidden' &&
                v.offsetWidth > 0
            )
        })

        let lessonHeaderEl = document.querySelector('h1.lesson-header-number')
        if (!lessonHeaderEl) {
            const h1s = Array.from(document.querySelectorAll('h1'))
            lessonHeaderEl = h1s.find((h) => h.textContent.includes('Lesson'))
        }
        const selectedTabEl = document.querySelector('li.tab.viewed.selected')

        if (!video) {
            console.error(
                '[D2L-DL] Active video element not found. Make sure the video is visible on screen.'
            )
            return
        }

        const fullTitle = getCurrentTitle()

        let countSuffix = ''
        if (downloadCounts[fullTitle]) {
            downloadCounts[fullTitle] += 1
            countSuffix = ` ${downloadCounts[fullTitle]}`
        } else {
            downloadCounts[fullTitle] = 1
        }

        const fileName = `${fullTitle}${countSuffix}.png`.replace(
            /[<>:"/\\|?*]/g,
            ''
        )

        try {
            const scaleFactor = 2
            const canvas = document.createElement('canvas')
            canvas.width = (video.videoWidth || video.clientWidth) * scaleFactor
            canvas.height = (video.videoHeight || video.clientHeight) * scaleFactor

            const ctx = canvas.getContext('2d')

            if (video.readyState < 2) {
                console.warn('[D2L-DL] Video data not fully loaded yet. Capture might be blank.')
            }

            if (video.paused && !video.ended) {
                video.play()
                await new Promise((r) => setTimeout(r, 100))
                video.pause()
            }

            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Show CC picker if cues are available; otherwise download immediately
            const cues = getAllCCCues(video)
            if (cues.length > 0) {
                const time = video.currentTime
                const currentCueIdx = cues.reduce((best, cue, i) => {
                    if (cue.startTime <= time) {
                        if (best === -1 || cue.startTime > cues[best].startTime) return i
                    }
                    return best
                }, -1)

                const chosenText = await showCCPicker(video, currentCueIdx, cues)
                // null = user dismissed (cancel) → abort
                if (chosenText === null) {
                    console.log('[D2L-DL] Download cancelled.')
                    return
                }
                renderCCAndDownload(canvas, chosenText, scaleFactor, fileName)
            } else {
                renderCCAndDownload(canvas, null, scaleFactor, fileName)
            }
        } catch (e) {
            console.error('[D2L-DL] Capture failed.', e)
        }
    }

    async function takeSnapshotInFrame() {
        if (window.location.hostname.includes('studyforge.net')) {
            await downloadStudyForgeFrame()
            return
        }
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
            // Forward to nested iframes
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
            #d2l-dl-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
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

            #d2l-counter {
                position: fixed; bottom: 76px; right: 20px; z-index: 2147483647;
                display: none; align-items: center; gap: 6px;
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 12px; padding: 4px 8px;
                font-family: -apple-system, sans-serif; font-size: 12px; color: #ccc;
                box-shadow: 0 2px 10px rgba(0,0,0,0.4); backdrop-filter: blur(8px);
                user-select: none;
            }
            #d2l-counter .counter-label { color: rgba(255,255,255,0.6); font-size: 11px; }
            #d2l-counter .counter-value {
                font-weight: 700; font-size: 14px; color: #fff;
                min-width: 18px; text-align: center;
            }
            #d2l-counter .counter-btn {
                width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
                border-radius: 6px; background: rgba(255,255,255,0.15);
                color: #fff; cursor: pointer; font-size: 16px; line-height: 1;
                transition: background 0.15s, color 0.15s; border: none;
                font-family: -apple-system, sans-serif;
            }
            #d2l-counter .counter-btn:hover { background: rgba(255,255,255,0.3); color: #fff; }

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

            /* ── CC Picker Modal ─────────────────────────────────────── */
            #d2l-cc-backdrop {
                position: fixed; inset: 0; z-index: 2147483647;
                background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: center;
                opacity: 0; transition: opacity 0.2s ease;
                pointer-events: none;
            }
            #d2l-cc-backdrop.visible { opacity: 1; pointer-events: all; }

            #d2l-cc-modal {
                background: #1a1a1a; border: 1px solid #333; border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6);
                font-family: -apple-system, sans-serif; color: #efefef;
                width: min(520px, 92vw); max-height: 80vh;
                display: flex; flex-direction: column;
                transform: scale(0.95) translateY(8px);
                transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
            }
            #d2l-cc-backdrop.visible #d2l-cc-modal {
                transform: scale(1) translateY(0);
            }
            #d2l-cc-modal-header {
                padding: 18px 20px 12px;
                border-bottom: 1px solid #2a2a2a;
                display: flex; align-items: center; justify-content: space-between;
            }
            #d2l-cc-modal-header h3 { margin: 0; font-size: 15px; color: #fff; }
            #d2l-cc-modal-header p  { margin: 2px 0 0; font-size: 11px; color: #666; }
            #d2l-cc-close {
                width: 28px; height: 28px; border-radius: 50%;
                background: rgba(255,255,255,0.08); border: none;
                color: #888; font-size: 16px; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: background 0.15s, color 0.15s; flex-shrink: 0;
            }
            #d2l-cc-close:hover { background: rgba(255,255,255,0.18); color: #fff; }

            #d2l-cc-cue-list {
                overflow-y: auto; flex: 1;
                padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;
                min-height: 0;
            }
            .d2l-cc-cue-row {
                display: flex; align-items: flex-start; gap: 10px;
                padding: 8px 10px; border-radius: 10px;
                cursor: pointer; transition: background 0.15s;
                border: 1px solid transparent;
            }
            .d2l-cc-cue-row:hover { background: #252525; }
            .d2l-cc-cue-row.current { border-color: #2a5298; background: rgba(42,82,152,0.18); }
            .d2l-cc-cue-row.checked { background: #252525; }
            .d2l-cc-cue-row input[type=checkbox] {
                margin-top: 2px; accent-color: #2a5298; flex-shrink: 0;
                width: 15px; height: 15px; cursor: pointer;
            }
            .d2l-cc-cue-text {
                font-size: 13px; line-height: 1.45; color: #ddd; flex: 1;
            }
            .d2l-cc-cue-row.current .d2l-cc-cue-text { color: #fff; font-weight: 600; }
            .d2l-cc-time-badge {
                font-size: 10px; color: #555; white-space: nowrap;
                margin-top: 2px; flex-shrink: 0;
            }

            #d2l-cc-editor-wrap {
                padding: 12px 16px; border-top: 1px solid #2a2a2a;
            }
            #d2l-cc-editor-label {
                font-size: 11px; color: #666; margin-bottom: 6px; display: block;
            }
            #d2l-cc-editor {
                width: 100%; box-sizing: border-box;
                background: #111; border: 1px solid #333; border-radius: 10px;
                color: #fff; font-size: 13px; font-family: -apple-system, sans-serif;
                padding: 10px 12px; resize: vertical; min-height: 58px;
                outline: none; transition: border-color 0.15s;
                line-height: 1.5;
            }
            #d2l-cc-editor:focus { border-color: #2a5298; }

            #d2l-cc-footer {
                padding: 12px 16px 16px;
                display: flex; gap: 8px; justify-content: flex-end;
                border-top: 1px solid #2a2a2a;
            }
            .d2l-cc-btn {
                padding: 8px 18px; border-radius: 10px; border: none;
                font-size: 13px; font-weight: 600; cursor: pointer;
                transition: opacity 0.15s, transform 0.1s;
                font-family: -apple-system, sans-serif;
            }
            .d2l-cc-btn:active { transform: scale(0.97); }
            .d2l-cc-btn.secondary {
                background: rgba(255,255,255,0.08); color: #aaa;
            }
            .d2l-cc-btn.secondary:hover { background: rgba(255,255,255,0.14); color: #fff; }
            .d2l-cc-btn.primary {
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                color: #fff;
            }
            .d2l-cc-btn.primary:hover { opacity: 0.88; }
        `

        const styleEl = document.createElement('style')
        styleEl.innerHTML = styles
        document.head.appendChild(styleEl)

        function createUI() {
            const isStudyForge =
                window.location.hostname.includes('studyforge.net')
            const btn = document.createElement('button')
            btn.id = 'd2l-dl-btn'
            if (isStudyForge) {
                btn.innerHTML = `<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div><div class="text">Download Frame</div>`
            } else {
                btn.innerHTML = `<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div><div class="text">Content Tools</div>`
            }
            document.body.appendChild(btn)

            const scriptBtn = document.createElement('button')
            scriptBtn.id = 'd2l-script-btn'
            scriptBtn.innerHTML = `<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div><div class="text">Save Script</div>`
            document.body.appendChild(scriptBtn)

            const promptBtn = document.createElement('button')
            promptBtn.id = 'd2l-prompt-btn'
            promptBtn.innerHTML = `<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg></div><div class="text">Copy Prompt</div>`
            document.body.appendChild(promptBtn)

            promptBtn.onclick = () => {
                const promptText = `Provide algebraic solutions in individual code blocks using these formatting rules:
- Simplify all equations and use a "lazy student" style (skip obvious intermediate steps).
- Use a single space on otherwise empty lines to prevent them from being trimmed.
- Include spaces between operators (e.g., y = 5x + 6), but NOT inside fractions (use 1/-5, not 1 /-5).
- Use abbreviations where possible (e.g., // for parallel, perp for perpendicular, pt for point).
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

                // Listener for responses from all frames (including nested)
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

                // 1. Extract from top frame
                const topScript = await extractScriptInFrame()
                if (topScript) results.push(topScript)

                // 2. Request from all direct iframes (which will forward recursively)
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

                // 3. Wait for collection window (1s)
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
                                            { type: 'blob' }
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

            if (isStudyForge) {
                // --- Counter widget ---
                const counterEl = document.createElement('div')
                counterEl.id = 'd2l-counter'
                counterEl.innerHTML = `
                    <span class="counter-label">next #</span>
                    <button class="counter-btn" id="d2l-counter-dec" title="Decrement counter">−</button>
                    <span class="counter-value" id="d2l-counter-val">1</span>
                    <button class="counter-btn" id="d2l-counter-inc" title="Increment counter">+</button>
                `
                document.body.appendChild(counterEl)

                function refreshCounter() {
                    const title = getCurrentTitle()
                    const count = downloadCounts[title] || 0
                    const valEl = document.getElementById('d2l-counter-val')
                    if (valEl) valEl.textContent = count + 1
                    counterEl.style.display = 'flex'
                }

                document
                    .getElementById('d2l-counter-dec')
                    .addEventListener('click', () => {
                        const title = getCurrentTitle()
                        if ((downloadCounts[title] || 0) > 0) {
                            downloadCounts[title] = downloadCounts[title] - 1
                            refreshCounter()
                        }
                    })

                document
                    .getElementById('d2l-counter-inc')
                    .addEventListener('click', () => {
                        const title = getCurrentTitle()
                        downloadCounts[title] = (downloadCounts[title] || 0) + 1
                        refreshCounter()
                    })

                // Refresh counter after each download
                btn.addEventListener('click', async () => {
                    await downloadStudyForgeFrame()
                    refreshCounter()
                })

                // Debounced refresh on DOM changes (catches tab/lesson switches)
                let _counterDebounce = null
                new MutationObserver(() => {
                    clearTimeout(_counterDebounce)
                    _counterDebounce = setTimeout(refreshCounter, 300)
                }).observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: false,
                    characterData: false,
                })

                refreshCounter()
            } else {
                btn.addEventListener('click', showMenu)
            }
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
            const dlBtn = document.getElementById('d2l-dl-btn')
            const sbtn = document.getElementById('d2l-script-btn')
            const promptBtn = document.getElementById('d2l-prompt-btn')

            if (isQMode) {
                if (dlBtn) dlBtn.style.display = 'none'
                if (sbtn) sbtn.style.display = 'none'
                if (promptBtn) promptBtn.style.display = 'flex'
            } else {
                if (dlBtn) dlBtn.style.display = 'flex'
                if (promptBtn) promptBtn.style.display = 'none'
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
        // Iframe logic to report presence of video-script
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
    }

    // Listen for 'T' keypress to click the text tool button in Q-mode (handles both top frame and nested iframes)
    window.addEventListener('keydown', (e) => {
        if (e.key === 't' || e.key === 'T') {
            const active = document.activeElement
            if (
                active &&
                (active.tagName === 'INPUT' ||
                    active.tagName === 'TEXTAREA' ||
                    active.isContentEditable)
            ) {
                return
            }
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
        }
    })
})()
