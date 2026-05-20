// ── StudyForge: frame download, CC helpers, CC picker modal ──────────────────
// Extracted from d2l-image-downloader.user.js
// Depends on: downloadCounts, downloadBlob, getAllCCCues, getCurrentTitle

// ── CC helpers ───────────────────────────────────────────────────────────────

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

// ── CC text → wrapped lines ───────────────────────────────────────────────────
// Since CC text is placed BELOW the image, we can wrap more aggressively.
// Aim for ~80 chars per line so text stays readable without compression.

const CC_MAX_LINE_LENGTH = 80

function wrapCCText(text) {
    if (text.length <= CC_MAX_LINE_LENGTH) return [text]

    const lines = []
    let remaining = text.trim()

    while (remaining.length > CC_MAX_LINE_LENGTH) {
        let splitIdx = remaining.lastIndexOf(' ', CC_MAX_LINE_LENGTH)
        if (splitIdx < 1) splitIdx = remaining.indexOf(' ', CC_MAX_LINE_LENGTH)
        if (splitIdx < 1) splitIdx = CC_MAX_LINE_LENGTH
        lines.push(remaining.slice(0, splitIdx).trim())
        remaining = remaining.slice(splitIdx).trim()
    }

    if (remaining.length > 0) lines.push(remaining)
    return lines
}

// ── Render CC strip + download ────────────────────────────────────────────────
// Appends a text strip BELOW the frame canvas so no video content is obscured.
// Extra height is added automatically to fit however many lines are needed.

function renderCCAndDownload(canvas, ccText, scaleFactor, fileName) {
    let outCanvas = canvas

    if (ccText && ccText.trim()) {
        const fontSize = Math.max(14, Math.round(canvas.height * 0.025))
        const padding = Math.round(fontSize * 0.5)
        const lineSpacing = Math.round(fontSize * 1.35)

        const lines = wrapCCText(ccText.trim())

        const topMargin = Math.round(fontSize * 0.6)
        const bottomPad = Math.round(fontSize * 1.2)
        const gapHeight = Math.round(fontSize * 0.5)

        // Height grows with however many lines we need
        const textBlockHeight =
            lines.length === 1
                ? fontSize
                : fontSize + lineSpacing * (lines.length - 1)
        const stripHeight = topMargin + textBlockHeight + bottomPad

        // Build a taller canvas: original frame on top, CC strip below
        outCanvas = document.createElement('canvas')
        outCanvas.width = canvas.width
        outCanvas.height = canvas.height + gapHeight + stripHeight

        const ctx = outCanvas.getContext('2d')

        // Blit original frame into the top portion
        ctx.drawImage(canvas, 0, 0)

        // White gap between frame and CC strip
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, canvas.height, canvas.width, gapHeight)

        // Fill CC strip background (very light grey)
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, canvas.height + gapHeight, canvas.width, stripHeight)

        // Draw text lines
        ctx.font = `bold ${fontSize}px Roboto, sans-serif`
        ctx.textAlign = 'center'
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.fillStyle = '#006FFF'

        const firstLineY =
            canvas.height + gapHeight + topMargin + fontSize * 0.85

        lines.forEach((line, i) => {
            ctx.fillText(
                line,
                outCanvas.width / 2,
                firstLineY + lineSpacing * i,
                outCanvas.width - padding * 2
            )
        })
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

// ── CC picker modal ───────────────────────────────────────────────────────────
// Shows a modal for selecting / editing CC cues; resolves with the final text
// string (possibly empty) or null if the user dismissed.

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

        // Click outside modal to cancel
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) dismiss(null)
        })
    })
}

// ── downloadStudyForgeFrame ───────────────────────────────────────────────────

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

        // Show CC picker if cues are available; otherwise download immediately
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
