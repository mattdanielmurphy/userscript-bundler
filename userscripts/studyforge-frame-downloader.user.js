// ==UserScript==
// @name        StudyForge Frame + KaTeX Notes + Resume (Tuned)
// @match       https://*.studyforge.net/*
// @require     https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require     https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js
// @grant       none
// @version     2.0
// @author      Antigravity
// @description Download StudyForge video frame as PNG with KaTeX notes strip, remember last video/time, tuned text + resolution.
// ==/UserScript==

;(function () {
    'use strict'

    console.log('[SF-LTX] Userscript initialized in', window.location.href)

    // ── Global knobs ─────────────────────────────────────────────────────

    const FRAME_SCALE = 2.5 // overall PNG scale for frame + notes
    const NOTES_FONT_PX = 32 // notes text size (canvas-independent)
    const GAP_PX = 10 // gap between frame and separator line

    const downloadCounts = {}

    // ── KaTeX CSS injection (for in-page math if needed) ────────────────

    ;(function injectKatexCss() {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href =
            'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'
        document.head.appendChild(link)
    })()
    ;(function injectKatexCustomCss() {
        const styleEl = document.createElement('style')
        styleEl.textContent = `
          .katex .mfrac {
            font-size: 1.1em;
          }
          .katex .mfrac .frac-line {
            border-top-width: 1.2px;
          }
          .katex .mfrac .vlist > span:nth-child(1) {
            margin-bottom: 0.08em;
          }
          .katex .mfrac .vlist > span:nth-child(2) {
            margin-top: 0.08em;
          }
        `
        document.head.appendChild(styleEl)
    })()

    // ── Toast notifications helper ─────────────────────────────────────

    function showToast(message, duration = 3000) {
        const toast = document.createElement("div")
        toast.textContent = message
        Object.assign(toast.style, {
            position: "fixed",
            bottom: "30px",
            left: "50%",
            transform: "translateX(-50%) translateY(20px)",
            background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            zIndex: "2147483647",
            transition: "all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            opacity: "0",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "-apple-system, sans-serif"
        })
        document.body.appendChild(toast)
        
        // Force reflow
        toast.offsetHeight
        
        toast.style.opacity = "1"
        toast.style.transform = "translateX(-50%) translateY(0)"
        
        setTimeout(() => {
            toast.style.opacity = "0"
            toast.style.transform = "translateX(-50%) translateY(20px)"
            setTimeout(() => toast.remove(), 350)
        }, duration)
    }

    // ── Title helper (for filenames + counter) ──────────────────────────

    function getLessonTitle() {
        const nav = document.querySelector('nav.relative.mx-auto.my-0.flex')
        let lessonHeaderEl = document.querySelector('h1.lesson-header-number')
        if (!lessonHeaderEl) {
            const h1s = Array.from(document.querySelectorAll('h1'))
            lessonHeaderEl = h1s.find((h) => h.textContent.includes('Lesson'))
        }

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

        if (navParts.length > 0) {
            navParts[navParts.length - 1] =
                `${navParts[navParts.length - 1]} (${lessonNum})`
        } else {
            navParts.push(`(${lessonNum})`)
        }

        return navParts.join(' - ')
    }

    function getCurrentTitle(associatedTab = null) {
        const selectedTabEl = associatedTab || document.querySelector('li.tab.viewed.selected')

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

        let lessonTitle = getLessonTitle()

        // Handle multiple groups: secondary blocks are AP-only
        const groups = Array.from(document.querySelectorAll('.lo-group'))
        if (groups.length > 1 && selectedTabEl) {
            const groupEl = selectedTabEl.closest('.lo-group')
            if (groupEl) {
                const groupIdx = groups.indexOf(groupEl) + 1
                if (groupIdx > 1) {
                    if (lessonTitle.startsWith('Calculus')) {
                        lessonTitle = lessonTitle.replace(/^Calculus/, 'Calculus [AP]')
                    } else {
                        lessonTitle = `[AP] ${lessonTitle}`
                    }
                }
            }
        }

        return [lessonTitle, `${videoTitle} (${videoNum})`].join(' - ')
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

    function fmtTime(sec) {
        const m = Math.floor(sec / 60)
        const s = String(Math.floor(sec % 60)).padStart(2, '0')
        return `${m}:${s}`
    }

    // ── Basic utilities ─────────────────────────────────────────────────

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    function hasDownloadedVideo(src) {
        try {
            const list = JSON.parse(localStorage.getItem('sf_downloaded_videos') || '[]')
            return list.includes(src)
        } catch (e) {
            return false
        }
    }

    function markVideoDownloaded(src) {
        try {
            const list = JSON.parse(localStorage.getItem('sf_downloaded_videos') || '[]')
            if (!list.includes(src)) {
                list.push(src)
                localStorage.setItem('sf_downloaded_videos', JSON.stringify(list))
            }
        } catch (e) {
            console.warn('[SF-LTX] Failed to save downloaded video state:', e)
        }
    }

    async function downloadVideoFile(video, fullTitle, bypassCheck = false) {
        const src = video.currentSrc || video.src || video.querySelector('source')?.src
        if (!src) {
            console.warn('[SF-LTX] No video source found to download.')
            return
        }

        if (!bypassCheck && hasDownloadedVideo(src)) {
            console.log('[SF-LTX] Video already downloaded, skipping:', src)
            return
        }

        const videoFileName = `${fullTitle}.mp4`.replace(/[<>:"/\\|?*]/g, '')
        console.log('[SF-LTX] Downloading whole video:', src, 'as', videoFileName)

        try {
            const response = await fetch(src)
            const blob = await response.blob()
            const blobUrl = URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = blobUrl
            link.download = videoFileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(blobUrl)

            markVideoDownloaded(src)
        } catch (e) {
            console.warn('[SF-LTX] Fetch failed, falling back to direct link:', e)
            const link = document.createElement('a')
            link.href = src
            link.download = videoFileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            markVideoDownloaded(src)
        }
    }

    function hasDownloadedGeoGebra(filename) {
        try {
            const list = JSON.parse(localStorage.getItem('sf_downloaded_geogebra') || '[]')
            return list.includes(filename)
        } catch (e) {
            return false
        }
    }

    function markGeoGebraDownloaded(filename) {
        try {
            const list = JSON.parse(localStorage.getItem('sf_downloaded_geogebra') || '[]')
            if (!list.includes(filename)) {
                list.push(filename)
                localStorage.setItem('sf_downloaded_geogebra', JSON.stringify(list))
            }
        } catch (e) {
            console.warn('[SF-LTX] Failed to save downloaded geogebra state:', e)
        }
    }

    async function downloadGeoGebra(fullTitle, bypassCheck = false, container = document) {
        // 1. Expand the content if it's currently hidden
        const expandBtn = container.querySelector ? container.querySelector('.expand') : document.querySelector('.expand');
        const isHidden = container.querySelector ? container.querySelector('.reading-content[aria-hidden="true"]') : document.querySelector('.reading-content[aria-hidden="true"]');
        if (expandBtn && isHidden) {
            console.log("[SF-LTX] Expanding reading content...");
            expandBtn.click();
            // Wait briefly for content to render / iframe to appear
            await sleep(600); 
        }

        // 2. Find unique GeoGebra applets via their iframe sources
        const ggbIframes = Array.from(container.querySelectorAll('iframe[src*="geogebra.org/m/"]'));
        const materialIds = Array.from(new Set(ggbIframes.map(f => f.src.split('/').pop()).filter(Boolean)));

        if (materialIds.length === 0) {
            return false;
        }

        console.log(`[SF-LTX] Found ${materialIds.length} unique GeoGebra applet(s). Downloading...`);

        for (let i = 0; i < materialIds.length; i++) {
            const id = materialIds[i];
            
            // Name according to established scheme
            let fileName = '';
            if (materialIds.length === 1) {
                fileName = `${fullTitle}.html`.replace(/[<>:"/\\|?*]/g, '');
            } else {
                fileName = `${fullTitle} - Applet ${i + 1}.html`.replace(/[<>:"/\\|?*]/g, '');
            }

            if (!bypassCheck && hasDownloadedGeoGebra(fileName)) {
                console.log('[SF-LTX] GeoGebra applet already downloaded, skipping:', fileName);
                continue;
            }

            const params = {
                "material_id": id,
                "width": 800,
                "height": 600,
                "showMenuBar": true,
                "showAlgebraInput": true,
                "showToolBar": true,
                "showResetIcon": true,
                "enableShiftDragZoom": true,
                "enableRightClick": true,
                "showZoomButtons": true
            };

            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>GeoGebra Applet - ${id}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <!-- Load GeoGebra Web Script -->
    <script src="https://www.geogebra.org/apps/deployggb.js"></script>
</head>
<body style="margin:0; padding:0; display:flex; justify-content:center; align-items:center; height:100vh; background:#f0f0f0;">
    <div id="ggb-applet"></div>
    <script>
        var parameters = ${JSON.stringify(params, null, 4)};
        var applet = new GGBApplet(parameters, true);
        window.onload = function() {
            applet.inject("ggb-applet");
        };
    </script>
</body>
</html>`;

            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log(`[SF-LTX] Standalone HTML file generated for GeoGebra (ID: ${id}) and download started: ${fileName}`);
            markGeoGebraDownloaded(fileName);
        }

        return true;
    }

    function getVisibleVideo() {
        const videos = Array.from(document.querySelectorAll('video'))
        return videos.find((v) => {
            const s = getComputedStyle(v)
            const p = v.parentElement ? getComputedStyle(v.parentElement) : null
            return (
                s.display !== 'none' &&
                s.visibility !== 'hidden' &&
                v.offsetWidth > 0 &&
                (!p || p.visibility !== 'hidden')
            )
        })
    }

    async function ensureVideoFrame(video) {
        if (video.paused && !video.ended) {
            try {
                await video.play()
                await sleep(100)
                video.pause()
            } catch (_) {}
        }
    }

    // ── Notes strip renderer: DOM -> html2canvas in iframe (KaTeX) ──────

    async function buildNotesStrip(frameWidthPx, ccOrNotesText) {
        const text = ccOrNotesText || ''
        if (!text.replace(/\s/g, '')) return null // still bail if it's all whitespace

        const notesWidth = Math.round(frameWidthPx)

        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.left = '-10000px'
        iframe.style.top = '0'
        iframe.style.width = notesWidth + 'px'
        iframe.style.height = '2000px'
        iframe.style.border = '0'
        iframe.style.opacity = '1'
        iframe.style.pointerEvents = 'none'
        document.body.appendChild(iframe)

        const doc = iframe.contentDocument
        const katexCss =
            'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'

        doc.open()
        doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${katexCss}">
<style>
html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
}
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #171717;
}
.sheet {
    width: ${notesWidth}px;
    margin: 0;
    padding: 22px 32px 26px;
    box-sizing: border-box;
    background: #ffffff;
    font-size: ${NOTES_FONT_PX}px;
    line-height: 1.1;
}
.line {
    margin: 0 0 0.42em 0;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
}
.katex {
    font-size: 1em;
}
.katex-display {
    margin: 0.2em 0 0.3em 0;
}
</style>
</head>
<body>
<div class="sheet" id="sheet"></div>
</body>
</html>`)
        doc.close()

        const sheet = doc.getElementById('sheet')

        const paragraphs = text.split('\n')
        for (const raw of paragraphs) {
            // Preserve leading whitespace; only skip truly empty lines
            if (raw === '') continue
            const lineText = raw // no .trim()

            const line = doc.createElement('div')
            line.className = 'line'

            // Simple inline LaTeX detection: $...$
            let i = 0
            while (i < lineText.length) {
                const start = lineText.indexOf('$', i)
                if (start === -1) {
                    const span = doc.createElement('span')
                    span.textContent = lineText.slice(i)
                    line.appendChild(span)
                    break
                }
                if (start > i) {
                    const span = doc.createElement('span')
                    span.textContent = lineText.slice(i, start)
                    line.appendChild(span)
                }
                const end = lineText.indexOf('$', start + 1)
                if (end === -1) {
                    const span = doc.createElement('span')
                    span.textContent = lineText.slice(start)
                    line.appendChild(span)
                    break
                }
                const mathSrc = lineText.slice(start + 1, end)
                const span = doc.createElement('span')
                try {
                    span.innerHTML = katex.renderToString(mathSrc, {
                        throwOnError: false,
                        displayMode: false,
                        output: 'htmlAndMathml',
                    })
                } catch (e) {
                    span.textContent = mathSrc
                }
                line.appendChild(span)
                i = end + 1
            }

            sheet.appendChild(line)
        }

        await sleep(150)

        const rect = sheet.getBoundingClientRect()
        const stripCanvas = await html2canvas(sheet, {
            backgroundColor: '#ffffff',
            scale: FRAME_SCALE,
            useCORS: true,
            logging: false,
            foreignObjectRendering: false,
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
            windowWidth: Math.ceil(rect.width),
            windowHeight: Math.ceil(rect.height),
            removeContainer: true,
        })

        iframe.remove()
        return stripCanvas
    }

    async function composeFrameWithNotes(video, ccOrNotesText, fileName) {
        const frameW = video.videoWidth || video.clientWidth
        const frameH = video.videoHeight || video.clientHeight

        await ensureVideoFrame(video)

        const stripCanvas = await buildNotesStrip(frameW, ccOrNotesText)

        const outCanvas = document.createElement('canvas')
        outCanvas.width = frameW * FRAME_SCALE
        outCanvas.height =
            frameH * FRAME_SCALE +
            (stripCanvas
                ? GAP_PX * FRAME_SCALE + 1 * FRAME_SCALE + stripCanvas.height
                : 0)

        const ctx = outCanvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, outCanvas.width, outCanvas.height)

        ctx.drawImage(video, 0, 0, outCanvas.width, frameH * FRAME_SCALE)

        if (stripCanvas) {
            const sepY = frameH * FRAME_SCALE + GAP_PX * FRAME_SCALE
            ctx.fillStyle = '#d1d5db'
            ctx.fillRect(0, sepY, outCanvas.width, FRAME_SCALE)

            const stripY = sepY + FRAME_SCALE
            ctx.drawImage(stripCanvas, 0, stripY)
        }

        const a = document.createElement('a')
        a.href = outCanvas.toDataURL('image/png')
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        console.log('[SF-LTX] Saved:', fileName, {
            frameW,
            frameH,
            outW: outCanvas.width,
            outH: outCanvas.height,
            hasNotes: !!stripCanvas,
        })
    }

    // ── CC / Notes modals ───────────────────────────────────────────────

    function showCCPickerWithCues(video, currentCueIdx, cues) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div')
            backdrop.id = 'sf-ltx-backdrop'

            backdrop.innerHTML = `
                <div id="sf-ltx-modal">
                    <div id="sf-ltx-modal-header">
                        <div>
                            <h3>Caption / Notes</h3>
                            <p>Supports LaTeX with $...$, \\( ... \\), and \\[ ... \\].</p>
                        </div>
                        <button id="sf-ltx-close" title="Cancel">✕</button>
                    </div>
                    <div id="sf-ltx-cue-list"></div>
                    <div id="sf-ltx-editor-wrap">
                        <label id="sf-ltx-editor-label" for="sf-ltx-editor">Edit text</label>
                        <textarea id="sf-ltx-editor" rows="3" spellcheck="false"></textarea>
                    </div>
                    <div id="sf-ltx-footer">
                        <button class="sf-ltx-btn secondary" id="sf-ltx-skip">No caption</button>
                        <button class="sf-ltx-btn primary" id="sf-ltx-confirm">Download</button>
                    </div>
                </div>
            `

            document.body.appendChild(backdrop)
            requestAnimationFrame(() => backdrop.classList.add('visible'))

            const list = backdrop.querySelector('#sf-ltx-cue-list')
            const editor = backdrop.querySelector('#sf-ltx-editor')
            const checked = new Set()

            // "No caption" by default: do not pre-check the current cue index.

            function rebuildEditor() {
                const lines = [...checked]
                    .sort((a, b) => a - b)
                    .map((i) => cues[i].text.replace(/\n/g, ' '))
                editor.value = lines.join(' ')
            }

            cues.forEach((cue, i) => {
                const row = document.createElement('div')
                row.className =
                    'sf-ltx-cue-row' +
                    (i === currentCueIdx ? ' current' : '') +
                    (checked.has(i) ? ' checked' : '')

                const cb = document.createElement('input')
                cb.type = 'checkbox'
                cb.checked = checked.has(i)

                const textEl = document.createElement('div')
                textEl.className = 'sf-ltx-cue-text'
                textEl.textContent = cue.text.replace(/\n/g, ' ')

                const badge = document.createElement('div')
                badge.className = 'sf-ltx-time-badge'
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

            const currentRow = list.children[currentCueIdx]
            if (currentRow) {
                currentRow.scrollIntoView({
                    block: 'center',
                    behavior: 'instant',
                })
            }

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    dismiss(null)
                } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.target !== editor)) {
                    e.preventDefault()
                    dismiss(editor.value)
                }
            }
            window.addEventListener('keydown', onKeyDown)

            function dismiss(result) {
                window.removeEventListener('keydown', onKeyDown)
                backdrop.classList.remove('visible')
                setTimeout(() => backdrop.remove(), 250)
                resolve(result)
            }

            backdrop
                .querySelector('#sf-ltx-close')
                .addEventListener('click', () => dismiss(null))
            backdrop
                .querySelector('#sf-ltx-skip')
                .addEventListener('click', () => dismiss(''))
            backdrop
                .querySelector('#sf-ltx-confirm')
                .addEventListener('click', () => dismiss(editor.value))

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) dismiss(null)
            })

            const confirmBtn = backdrop.querySelector('#sf-ltx-confirm')
            if (confirmBtn) confirmBtn.focus()
        })
    }

    function showManualNotesPicker() {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div')
            backdrop.id = 'sf-ltx-backdrop'

            backdrop.innerHTML = `
                <div id="sf-ltx-modal">
                    <div id="sf-ltx-modal-header">
                        <div>
                            <h3>Notes to Insert</h3>
                            <p>No captions detected. Enter any notes (LaTeX: $...$, \\( ... \\), \\[ ... \\]).</p>
                        </div>
                        <button id="sf-ltx-close" title="Cancel">✕</button>
                    </div>
                    <div id="sf-ltx-editor-wrap">
                        <label id="sf-ltx-editor-label" for="sf-ltx-editor">Text / LaTeX</label>
                        <textarea id="sf-ltx-editor" rows="4" spellcheck="false"></textarea>
                    </div>
                    <div id="sf-ltx-footer">
                        <button class="sf-ltx-btn secondary" id="sf-ltx-skip">No caption</button>
                        <button class="sf-ltx-btn primary" id="sf-ltx-confirm">Download</button>
                    </div>
                </div>
            `

            document.body.appendChild(backdrop)
            requestAnimationFrame(() => backdrop.classList.add('visible'))

            const editor = backdrop.querySelector('#sf-ltx-editor')

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    dismiss(null)
                } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.target !== editor)) {
                    e.preventDefault()
                    dismiss(editor.value)
                }
            }
            window.addEventListener('keydown', onKeyDown)

            function dismiss(result) {
                window.removeEventListener('keydown', onKeyDown)
                backdrop.classList.remove('visible')
                setTimeout(() => backdrop.remove(), 250)
                resolve(result)
            }

            backdrop
                .querySelector('#sf-ltx-close')
                .addEventListener('click', () => dismiss(null))
            backdrop
                .querySelector('#sf-ltx-skip')
                .addEventListener('click', () => dismiss(''))
            backdrop
                .querySelector('#sf-ltx-confirm')
                .addEventListener('click', () => dismiss(editor.value))

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) dismiss(null)
            })

            const confirmBtn = backdrop.querySelector('#sf-ltx-confirm')
            if (confirmBtn) confirmBtn.focus()
        })
    }

    // ── Video resume (remember last video + time) ───────────────────────

    function getLessonIdForKey() {
        return window.location.pathname || 'default'
    }

    function buildStorageKey() {
        const lessonId = getLessonIdForKey()
        return `sf_last_video_${lessonId}`
    }

    function saveVideoPosition(video) {
        if (!video) return
        const key = buildStorageKey()
        const src = video.currentSrc || video.src || 'inline-video'
        const data = {
            src,
            currentTime: video.currentTime || 0,
        }
        try {
            localStorage.setItem(key, JSON.stringify(data))
        } catch (e) {
            console.warn('[SF-LTX] Failed to save video state:', e)
        }
    }

    function restoreVideoPosition() {
        const key = buildStorageKey()
        let data = null
        try {
            const raw = localStorage.getItem(key)
            if (!raw) return
            data = JSON.parse(raw)
        } catch (e) {
            console.warn('[SF-LTX] Failed to parse video state:', e)
            return
        }

        if (!data || typeof data.currentTime !== 'number') return

        const videos = Array.from(document.querySelectorAll('video'))
        if (!videos.length) return

        let target = videos.find(
            (v) => v.currentSrc === data.src || v.src === data.src
        )
        if (!target) target = videos[0]

        const applyTime = () => {
            try {
                target.currentTime = Math.max(0, data.currentTime)
                target.pause()
                console.log(
                    '[SF-LTX] Restored video to',
                    target.currentTime.toFixed(1),
                    'seconds'
                )
            } catch (e) {
                console.warn('[SF-LTX] Failed to restore time:', e)
            }
        }

        if (target.readyState >= 2) {
            applyTime()
        } else {
            target.addEventListener(
                'loadedmetadata',
                () => {
                    applyTime()
                },
                { once: true }
            )
        }
    }

    function attachVideoListeners() {
        const videos = Array.from(document.querySelectorAll('video'))
        if (!videos.length) return
        const video = videos[0]

        video.addEventListener('pause', () => saveVideoPosition(video))
        video.addEventListener('timeupdate', () => {
            if (
                !video._sf_lastSaved ||
                video.currentTime - video._sf_lastSaved > 5
            ) {
                saveVideoPosition(video)
                video._sf_lastSaved = video.currentTime
            }
        })
    }

    // ── Frame capture main flow ─────────────────────────────────────────

    async function downloadStudyForgeFrame(directNoCaption = false) {
        const container = document.querySelector('.video-wrapper')
        if (!container) {
            console.error('[SF-LTX] Video wrapper not found.')
            return
        }

        const video = getVisibleVideo()
        if (!video) {
            console.error(
                '[SF-LTX] Active video element not found. Make sure the video is visible.'
            )
            return
        }

        // Find matching tab for this video to get the correct title
        const videoWrapper = video.closest('.element, .video-container')
        let associatedTab = null
        if (videoWrapper) {
            const id = videoWrapper.getAttribute('data-id')
            const type = videoWrapper.getAttribute('data-type') || 'video'
            if (id) {
                associatedTab = document.querySelector(
                    `li.tab[data-id="${id}"][data-type="${type}"]`
                )
            }
        }

        const fullTitle = getCurrentTitle(associatedTab)

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
            if (directNoCaption) {
                await composeFrameWithNotes(video, '', fileName)
                downloadVideoFile(video, fullTitle)
                return
            }

            const cues = getAllCCCues(video)

            if (cues.length > 0) {
                const time = video.currentTime
                const currentCueIdx = cues.reduce((best, cue, i) => {
                    if (cue.startTime <= time) {
                        if (best === -1 || cue.startTime > cues[best].startTime)
                            return i
                    }
                    return best
                }, -1)

                const chosenText = await showCCPickerWithCues(
                    video,
                    currentCueIdx,
                    cues
                )
                if (chosenText === null) {
                    console.log('[SF-LTX] Download cancelled.')
                    return
                }
                await composeFrameWithNotes(video, chosenText, fileName)
                downloadVideoFile(video, fullTitle)
            } else {
                const manualText = await showManualNotesPicker()
                if (manualText === null) {
                    console.log(
                        '[SF-LTX] Download cancelled (no CC, no notes).'
                    )
                    return
                }
                await composeFrameWithNotes(
                    video,
                    manualText.trim().length > 0 ? manualText : null,
                    fileName
                )
                downloadVideoFile(video, fullTitle)
            }
        } catch (e) {
            console.error('[SF-LTX] Capture failed.', e)
        }
    }

    async function downloadAllVideos() {
        const tabSelectors = [
            'li.tab',
            'li[data-type="video"]', 
            '.video-tab', 
            '[role="tab"][aria-label*="video" i]',
            '.nav-link[href*="video"]'
        ];
        const tabs = Array.from(document.querySelectorAll(tabSelectors.join(',')));
        const originalTabs = Array.from(document.querySelectorAll('li.tab.selected, li.tab.active, .selected, .active'));
        
        const captureAndDownload = async (tab) => {
            const id = tab.getAttribute('data-id');
            const type = tab.getAttribute('data-type');
            if (!id || !type) return;

            const fullTitle = getCurrentTitle(tab);
            
            // Find the specific container element for this tab
            const container = document.querySelector(`.element[data-id="${id}"][data-type="${type}"], section[data-id="${id}"][data-type="${type}"]`);
            if (!container) {
                console.warn(`[SF-LTX] Content container not found for tab ID ${id}, type ${type}`);
                return;
            }

            if (type === 'video') {
                const video = container.querySelector('video');
                if (video) {
                    await downloadVideoFile(video, fullTitle, false);
                } else {
                    console.warn(`[SF-LTX] Video element not found inside container for tab ID ${id}`);
                }
            } else if (type === 'reading') {
                await downloadGeoGebra(fullTitle, false, container);
            }
        };

        if (tabs.length > 0) {
            console.log(`[SF-LTX] Cycling through ${tabs.length} tabs to download videos...`);
            for (const tab of tabs) {
                tab.click();
                await sleep(1000);
                await captureAndDownload(tab);
            }
            // Restore original tabs
            for (const tab of originalTabs) {
                tab.click();
            }
        } else {
            console.log('[SF-LTX] No tabs found. Downloading video from current view.');
            const video = getVisibleVideo();
            if (video) {
                await downloadVideoFile(video, getCurrentTitle(), false);
            }
        }

        // Download questions if any exist on the page
        const questionsData = Array.from(document.querySelectorAll('.q-preview')).map(q => {
            const questionEl = q.closest('.question');
            const ariaLabel = questionEl ? questionEl.getAttribute('aria-label') : '';
            let subtitle = '';
            if (ariaLabel) {
                const match = ariaLabel.match(/question \d+:\s*(.*)/i);
                if (match && match[1] && match[1] !== 'null') {
                    subtitle = match[1].trim();
                }
            }
            if (!subtitle) {
                const titleEl = q.closest('.q-info')?.querySelector('.q-title');
                subtitle = titleEl ? titleEl.innerText.trim() : (q.querySelector('.q-subtitle')?.innerText.trim() || 'No Subtitle');
            }
            const text = q.querySelector('.text')?.innerText.trim() || 'No Question Text';
            
            const nextEl = q.nextElementSibling;
            let answer = 'Answer not found on page';
            
            if (nextEl && (nextEl.classList.contains('answer') || nextEl.classList.contains('solution'))) {
                answer = nextEl.innerText.trim();
            } else {
                const potentialAnswer = q.querySelector('.answer, .solution, .q-answer');
                if (potentialAnswer) {
                    answer = potentialAnswer.innerText.trim();
                }
            }

            return { subtitle, text, answer };
        });

        if (questionsData.length > 0) {
            console.log(`[SF-LTX] Found ${questionsData.length} questions. Exporting to CSV...`);
            const csvRows = [
                "Subtitle,Question,Answer",
                ...questionsData.map(q => `"${q.subtitle.replace(/"/g, '""')}","${q.text.replace(/"/g, '""')}","${q.answer.replace(/"/g, '""')}"`)
            ];
            const csvContent = csvRows.join("\n");
            
            let cleanTitle = getLessonTitle().replace(/[<>:"/\\|?*]/g, '');
            if (document.querySelectorAll('.lo-group').length > 1 && cleanTitle.startsWith('Calculus')) {
                cleanTitle = cleanTitle.replace(/^Calculus/, 'Calculus [AP]');
            }
            const csvFileName = `${cleanTitle} - Practice Questions.csv`;

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", csvFileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            console.log('[SF-LTX] No practice questions found on page.');
        }
    }

    // ── Styles + UI (button + modal + counter) ─────────────────────────

    const styles = `
        #sf-ltx-btn {
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
        #sf-ltx-btn:hover { width: 180px; opacity: 1; border-radius: 12px; }
        #sf-ltx-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
        #sf-ltx-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
        #sf-ltx-btn:hover .text { opacity: 1; max-width: 120px; margin-right: 16px; }

        #sf-ltx-backdrop {
            position: fixed; inset: 0; z-index: 2147483647;
            background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.2s ease;
            pointer-events: none;
        }
        #sf-ltx-backdrop.visible { opacity: 1; pointer-events: all; }

        #sf-ltx-modal {
            background: #1a1a1a; border: 1px solid #333; border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            font-family: -apple-system, sans-serif; color: #efefef;
            width: min(520px, 92vw); max-height: 80vh;
            display: flex; flex-direction: column;
            transform: scale(0.95) translateY(8px);
            transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        #sf-ltx-backdrop.visible #sf-ltx-modal {
            transform: scale(1) translateY(0);
        }
        #sf-ltx-modal-header {
            padding: 18px 20px 12px;
            border-bottom: 1px solid #2a2a2a;
            display: flex; align-items: center; justify-content: space-between;
        }
        #sf-ltx-modal-header h3 { margin: 0; font-size: 15px; color: #fff; }
        #sf-ltx-modal-header p  { margin: 2px 0 0; font-size: 11px; color: #666; }
        #sf-ltx-close {
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(255,255,255,0.08); border: none;
            color: #888; font-size: 16px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s, color 0.15s; flex-shrink: 0;
        }
        #sf-ltx-close:hover { background: rgba(255,255,255,0.18); color: #fff; }

        #sf-ltx-cue-list {
            overflow-y: auto; flex: 1;
            padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;
            min-height: 0;
        }
        .sf-ltx-cue-row {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 8px 10px; border-radius: 10px;
            cursor: pointer; transition: background 0.15s;
            border: 1px solid transparent;
        }
        .sf-ltx-cue-row:hover { background: #252525; }
        .sf-ltx-cue-row.current { border-color: #2a5298; background: rgba(42,82,152,0.18); }
        .sf-ltx-cue-row.checked { background: #252525; }
        .sf-ltx-cue-row input[type=checkbox] {
            margin-top: 2px; accent-color: #2a5298; flex-shrink: 0;
            width: 15px; height: 15px; cursor: pointer;
        }
        .sf-ltx-cue-text {
            font-size: 13px; line-height: 1.45; color: #ddd; flex: 1;
        }
        .sf-ltx-cue-row.current .sf-ltx-cue-text { color: #fff; font-weight: 600; }
        .sf-ltx-time-badge {
            font-size: 10px; color: #555; white-space: nowrap;
            margin-top: 2px; flex-shrink: 0;
        }

        #sf-ltx-editor-wrap {
            padding: 12px 16px; border-top: 1px solid #2a2a2a;
        }
        #sf-ltx-editor-label {
            font-size: 11px; color: #666; margin-bottom: 6px; display: block;
        }
        #sf-ltx-editor {
            width: 100%; box-sizing: border-box;
            background: #111; border: 1px solid #333; border-radius: 10px;
            color: #fff; font-size: 13px; font-family: -apple-system, sans-serif;
            padding: 10px 12px; resize: vertical; min-height: 58px;
            outline: none; transition: border-color 0.15s;
            line-height: 1.5;
        }
        #sf-ltx-editor:focus { border-color: #2a5298; }

        #sf-ltx-footer {
            padding: 12px 16px 16px;
            display: flex; gap: 8px; justify-content: flex-end;
            border-top: 1px solid #2a2a2a;
        }
        .sf-ltx-btn {
            padding: 8px 18px; border-radius: 10px; border: none;
            font-size: 13px; font-weight: 600; cursor: pointer;
            transition: opacity 0.15s, transform 0.1s;
            font-family: -apple-system, sans-serif;
        }
        .sf-ltx-btn:active { transform: scale(0.97); }
        .sf-ltx-btn.secondary {
            background: rgba(255,255,255,0.08); color: #aaa;
        }
        .sf-ltx-btn.secondary:hover { background: rgba(255,255,255,0.14); color: #fff; }
        .sf-ltx-btn.primary {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: #fff;
        }
        .sf-ltx-btn.primary:hover { opacity: 0.88; }

        #sf-ltx-counter {
            position: fixed; bottom: 76px; right: 20px; z-index: 2147483647;
            display: none; align-items: center; gap: 6px;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 12px; padding: 4px 8px;
            font-family: -apple-system, sans-serif; font-size: 12px;
            color: #ccc; box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            backdrop-filter: blur(8px); user-select: none;
        }
        #sf-ltx-counter .label { color: rgba(255,255,255,0.7); font-size: 11px; }
        #sf-ltx-counter .val { font-weight: 700; font-size: 14px; color: #fff; min-width: 18px; text-align: center; }
        #sf-ltx-counter .btn {
            width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
            border-radius: 6px; background: rgba(255,255,255,0.15); color: #fff;
            cursor: pointer; font-size: 16px; line-height: 1;
            transition: background 0.15s, color 0.15s;
            border: none;
        }
        #sf-ltx-counter .btn:hover { background: rgba(255,255,255,0.3); }

        #sf-ltx-all-btn {
            position: fixed; bottom: 132px; right: 20px; z-index: 2147483647;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px; width: 48px; height: 48px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            backdrop-filter: blur(10px); opacity: 0.9; overflow: hidden;
            white-space: nowrap; font-family: -apple-system, sans-serif; font-weight: 600;
        }
        #sf-ltx-all-btn:hover { width: 180px; opacity: 1; border-radius: 12px; }
        #sf-ltx-all-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
        #sf-ltx-all-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
        #sf-ltx-all-btn:hover .text { opacity: 1; max-width: 120px; margin-right: 16px; }
    `

    const styleEl = document.createElement('style')
    styleEl.textContent = styles
    document.head.appendChild(styleEl)

    function refreshCounter() {
        const isQuestion = /#Q\d+&open$/.test(window.location.href)
        const btn = document.getElementById('sf-ltx-btn')
        const allBtn = document.getElementById('sf-ltx-all-btn')
        if (btn) btn.style.display = isQuestion ? 'none' : 'flex'
        if (allBtn) allBtn.style.display = isQuestion ? 'none' : 'flex'

        const title = getCurrentTitle()
        const count = downloadCounts[title] || 0
        const el = document.getElementById('sf-ltx-counter')
        const valEl = el ? el.querySelector('.val') : null
        if (valEl) valEl.textContent = count > 0 ? count : '0'
        if (el) el.style.display = isQuestion ? 'none' : 'flex'
    }

    function createUI() {
        const btn = document.createElement('button')
        btn.id = 'sf-ltx-btn'
        btn.innerHTML =
            '<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div><div class="text">Download Frame</div>'
        document.body.appendChild(btn)

        btn.addEventListener('click', async () => {
            await downloadStudyForgeFrame()
            refreshCounter()
        })

        const allBtn = document.createElement('button')
        allBtn.id = 'sf-ltx-all-btn'
        allBtn.innerHTML =
            '<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect><line x1="9" y1="10" x2="9" y2="14"></line><polyline points="7 12 9 14 11 12"></polyline></svg></div><div class="text">Download All</div>'
        document.body.appendChild(allBtn)

        allBtn.addEventListener('click', async () => {
            allBtn.style.pointerEvents = 'none'
            allBtn.style.opacity = '0.5'
            const textEl = allBtn.querySelector('.text')
            const originalText = textEl.textContent
            textEl.textContent = 'Downloading...'
            try {
                await downloadAllVideos()
                showToast('All downloads completed successfully!')
            } catch (e) {
                console.error('[SF-LTX] Error downloading all videos:', e)
                showToast('An error occurred during downloads.')
            } finally {
                allBtn.style.pointerEvents = 'all'
                allBtn.style.opacity = '0.9'
                textEl.textContent = originalText
            }
        })

        const counter = document.createElement('div')
        counter.id = 'sf-ltx-counter'
        counter.innerHTML = `
            <span class="label">notes</span>
            <span class="val">0</span>
            <button class="btn" data-dir="-1">−</button>
            <button class="btn" data-dir="+1">+</button>
        `
        document.body.appendChild(counter)

        counter.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn')
            if (!btn) return
            const dir = parseInt(btn.getAttribute('data-dir'), 10)
            const title = getCurrentTitle()
            const cur = downloadCounts[title] || 0
            downloadCounts[title] = Math.max(0, cur + dir)
            refreshCounter()
        })

        let counterDebounce = null
        new MutationObserver(() => {
            clearTimeout(counterDebounce)
            counterDebounce = setTimeout(refreshCounter, 300)
        }).observe(document.documentElement, {
            childList: true,
            subtree: true,
        })
        refreshCounter()
    }

    function init() {
        restoreVideoPosition()
        attachVideoListeners()

        if (document.body) createUI()
        else window.addEventListener('DOMContentLoaded', createUI)

        window.addEventListener('hashchange', refreshCounter)
        window.addEventListener('popstate', refreshCounter)

        // Keybinding: Opt+S (Alt+S) saves frame directly with no caption
        window.addEventListener('keydown', (e) => {
            if (
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.isContentEditable ||
                document.getElementById('sf-ltx-backdrop')
            ) {
                return
            }

            if (e.altKey && e.code === 'KeyS') {
                e.preventDefault()
                e.stopPropagation()
                downloadStudyForgeFrame(true).then(() => {
                    refreshCounter()
                })
            } else if (e.altKey && e.code === 'KeyV') {
                e.preventDefault()
                e.stopPropagation()
                const video = getVisibleVideo()

                let associatedTab = null
                if (video) {
                    const videoWrapper = video.closest('.element, .video-container')
                    if (videoWrapper) {
                        const id = videoWrapper.getAttribute('data-id')
                        const type = videoWrapper.getAttribute('data-type') || 'video'
                        if (id) {
                            associatedTab = document.querySelector(
                                `li.tab[data-id="${id}"][data-type="${type}"]`
                            )
                        }
                    }
                } else {
                    associatedTab = document.querySelector('li.tab.viewed.selected')
                }

                const fullTitle = getCurrentTitle(associatedTab)
                if (video) {
                    downloadVideoFile(video, fullTitle, true)
                } else {
                    let container = document
                    if (associatedTab) {
                        const id = associatedTab.getAttribute('data-id')
                        const type = associatedTab.getAttribute('data-type')
                        if (id && type) {
                            const match = document.querySelector(`.element[data-id="${id}"][data-type="${type}"], section[data-id="${id}"][data-type="${type}"]`)
                            if (match) container = match
                        }
                    }
                    if (!downloadGeoGebra(fullTitle, true, container)) {
                        console.error('[SF-LTX] Active video element or GeoGebra applet not found.')
                    }
                }
            }
        })
    }

    init()
})()
