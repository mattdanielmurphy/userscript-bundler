// ==UserScript==
// @name         ai-os Gemini Context Sync
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Siphons web UI threads and custom code blocks directly into the local ai-os ecosystem
// @author       Matthew Murphy
// @match        https://gemini.google.com/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @run-at       document-end
// ==/UserScript==

;(function () {
    'use strict'
    console.log('[AI-OS SYNC RUNNING] 🚀 (port 3031)')

    const API_PORT = 3031 // Update with actual Rust bridge port
    const SYNC_URL = `http://127.0.0.1:${API_PORT}/api/context/sync`

    function getThreadId() {
        let title = document.title.replace(' - Gemini', '').trim()
        if (title === 'Gemini' || !title) {
            title = 'default_thread'
        } else {
            title = title.replace(/[^a-zA-Z0-9_-]/g, '_')
        }
        const urlParams = new URLSearchParams(window.location.search)
        const id = urlParams.get('thread_id') ||
            window.location.pathname.split('/').pop() ||
            'unknown'
        return `${title}_${id}`
    }

    function exportThreadWithTimestamps() {
        console.log('[AI-OS SYNC] exportThreadWithTimestamps called')
        // Select all user queries and model responses
        const messages = Array.from(
            document.querySelectorAll('user-query, model-response')
        )
        console.log(`[AI-OS SYNC] Found ${messages.length} messages:`, messages)

        if (messages.length === 0) {
            console.log('[AI-OS SYNC] No messages found, aborting export')
            return
        }

        const threadData = messages.map((msg) => {
            const isUser = msg.tagName.toLowerCase() === 'user-query'
            const role = isUser ? 'User' : 'Assistant'

            // Find the timestamp associated with this message
            const timestampEl = msg.parentElement.querySelector('.gm-timestamp')
            const timestamp = timestampEl
                ? `[${timestampEl.getAttribute('data-timestamp') || timestampEl.innerText.trim()}] `
                : ''

            // Extract text and convert basic html to markdown
            const clone = msg.cloneNode(true)
            clone.querySelectorAll('pre').forEach(pre => {
                pre.innerText = '\n```\n' + pre.innerText + '\n```\n'
            })
            clone.querySelectorAll('code').forEach(code => {
                if(!code.closest('pre')) code.innerText = '`' + code.innerText + '`'
            })
            clone.querySelectorAll('b, strong').forEach(b => {
                b.innerText = '**' + b.innerText + '**'
            })
            clone.querySelectorAll('i, em').forEach(i => {
                i.innerText = '*' + i.innerText + '*';
            })
            
            let text = clone.innerText.trim()
            text = text.replace(/^(You said|Gemini said)\s*/i, '')

            return { role, text, timestamp }
        })

        // Format the output with [Timestamp] [Role]: Content
        const formattedText = threadData
            .map((m) => `${m.timestamp}${m.role}:\n${m.text}\n`)
            .join('\n---\n\n')

        if (window._lastSentContextSync === formattedText) {
            console.log('[AI-OS SYNC] Payload unchanged, aborting export')
            return
        }
        window._lastSentContextSync = formattedText

        const payload = {
            thread_id: getThreadId(),
            content: formattedText,
        }
        console.log('[AI-OS SYNC] Sending payload to bridge:', payload)

        GM_xmlhttpRequest({
            method: 'POST',
            url: SYNC_URL,
            data: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
            onload: function (response) {
                console.log(`[AI-OS SYNC] Success:`, response.responseText)
            },
            onerror: function (error) {
                console.error(
                    `[ai-os sync] Error communicating with bridge:`,
                    error
                )
            },
        })
    }

    let timeout = null
    const observer = new MutationObserver((mutations) => {
        let shouldExport = false
        for (const mutation of mutations) {
            if (
                mutation.addedNodes.length > 0 ||
                mutation.type === 'characterData'
            ) {
                shouldExport = true
                break
            }
        }

        if (shouldExport) {
            console.log(
                '[AI-OS SYNC] Mutation detected, scheduling export in 2s'
            )
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => {
                exportThreadWithTimestamps()
            }, 2000) // Debounce by 2 seconds
        }
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    })

    // Initial export
    setTimeout(exportThreadWithTimestamps, 2000)
})()
