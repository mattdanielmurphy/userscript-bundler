// ==UserScript==
// @name        StudyForge Video Frame + CC Downloader
// @match       https://*.studyforge.net/*
// @grant       none
// @version     1.0
// @author      Antigravity
// @description Download the current StudyForge video frame as PNG with editable captions strip.
// ==/UserScript==

;(function () {
    'use strict'

    const downloadCounts = {}

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

    function fmtTime(sec) {
        const m = Math.floor(sec / 60)
        const s = String(Math.floor(sec % 60)).padStart(2, '0')
        return `${m}:${s}`
    }

    function renderCCAndDownload(canvas, ccText, scaleFactor, fileName) {
        let outCanvas = canvas

        if (ccText && ccText.trim()) {
            const fontSize = Math.max(14, Math.round(canvas.height * 0.025))
            const padding = Math.round(fontSize * 0.5)
            const lineSpacing = Math.round(fontSize * 1.35)

            const measureCtx = canvas.getContext('2d')
            measureCtx.font = `bold ${fontSize}px Roboto, sans-serif`

            const text = ccText.trim()
            const lines = []
            const maxWidth = canvas.width * 0.9
            const paragraphs = text.split('\n')

            for (const p of paragraphs) {
                const words = p.split(' ')
                let currentLine = ''
                for (const word of words) {
                    const testLine = currentLine
                        ? currentLine + word + ' '
                        : word + ' '
                    const metrics = measureCtx.measureText(testLine)
                    if (metrics.width > maxWidth && currentLine) {
                        lines.push(currentLine.trim())
                        currentLine = word + ' '
                    } else {
                        currentLine = testLine
                    }
                }
                if (currentLine) {
                    lines.push(currentLine.trim())
                }
            }

            const topMargin = Math.round(fontSize * 0.6)
            const bottomPad = Math.round(fontSize * 1.2)
            const stripHeight =
                topMargin +
                (lines.length - 1) * lineSpacing +
                fontSize +
                bottomPad

            outCanvas = document.createElement('canvas')
            outCanvas.width = canvas.width
            outCanvas.height = canvas.height + stripHeight
            const gapHeight = Math.round(fontSize * 0.5)

            const ctx = outCanvas.getContext('2d')

            ctx.drawImage(canvas, 0, 0)

            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, canvas.height, canvas.width, gapHeight)

            ctx.fillStyle = '#f0f0f0'
            ctx.fillRect(
                0,
                canvas.height + gapHeight,
                canvas.width,
                stripHeight
            )

            ctx.font = `bold ${fontSize}px Roboto, sans-serif`
            ctx.textAlign = 'left'
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.fillStyle = '#006FFF'

            const textTop =
                canvas.height + gapHeight + topMargin + fontSize * 0.85
            const textLeft = canvas.width * 0.05
            lines.forEach((line, index) => {
                ctx.fillText(
                    line,
                    textLeft,
                    textTop + index * lineSpacing,
                    maxWidth
                )
            })
            ctx.shadowBlur = 0
        }

        const dataUrl = outCanvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.download = fileName
        link.href = dataUrl
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        console.log(`[D2L-DL] Saved: ${fileName}`)
    }

    function showCCPicker(video, currentCueIdx, cues) {
        return new Promise((resolve) => {
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

            if (currentCueIdx >= 0) checked.add(currentCueIdx)

            function rebuildEditor() {
                const lines = [...checked]
                    .sort((a, b) => a - b)
                    .map((i) => cues[i].text.replace(/\n/g, ' '))
                editor.value = lines.join(' ')
            }

            cues.forEach((cue, i) => {
                const row = document.createElement('div')
                row.className =
                    'd2l-cc-cue-row' +
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

            const currentRow = list.children[currentCueIdx]
            if (currentRow) {
                currentRow.scrollIntoView({
                    block: 'center',
                    behavior: 'instant',
                })
            }

            function dismiss(result) {
                backdrop.classList.remove('visible')
                setTimeout(() => backdrop.remove(), 250)
                resolve(result)
            }

            backdrop
                .querySelector('#d2l-cc-close')
                .addEventListener('click', () => dismiss(null))
            backdrop
                .querySelector('#d2l-cc-skip')
                .addEventListener('click', () => dismiss(''))
            backdrop
                .querySelector('#d2l-cc-confirm')
                .addEventListener('click', () => dismiss(editor.value))

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) dismiss(null)
            })
        })
    }

    async function downloadStudyForgeFrame() {
        const container = document.querySelector('.video-wrapper')

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
            canvas.height =
                (video.videoHeight || video.clientHeight) * scaleFactor

            const ctx = canvas.getContext('2d')

            if (video.readyState < 2) {
                console.warn(
                    '[D2L-DL] Video data not fully loaded yet. Capture might be blank.'
                )
            }

            if (video.paused && !video.ended) {
                video.play()
                await new Promise((r) => setTimeout(r, 100))
                video.pause()
            }

            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

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

                const chosenText = await showCCPicker(
                    video,
                    currentCueIdx,
                    cues
                )
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

    // ── Styles + UI ─────────────────────────────────────────────────────

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
        const btn = document.createElement('button')
        btn.id = 'd2l-dl-btn'
        btn.innerHTML =
            '<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div><div class="text">Download Frame</div>'
        document.body.appendChild(btn)

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

        btn.addEventListener('click', async () => {
            await downloadStudyForgeFrame()
            refreshCounter()
        })

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
    }

    if (document.body) createUI()
    else window.addEventListener('DOMContentLoaded', createUI)
})()
