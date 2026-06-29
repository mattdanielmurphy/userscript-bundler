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
        const pathParts = window.location.pathname.split('/');
        let id = pathParts[pathParts.length - 1];
        if (id === 'app' || !id || id === '') {
            const threadTitle = Array.from(document.querySelectorAll('h1'))
                .find(h1 => h1.innerText.trim() !== "Conversation with Gemini" && h1.innerText.trim() !== "")
                ?.innerText.trim();

            if (threadTitle) {
                window._aiOsThreadId = threadTitle;
                return threadTitle;
            }

            if (!window._aiOsThreadId) {
                window._aiOsThreadId = Math.random().toString(36).substring(2, 8);
            }
            id = window._aiOsThreadId;
        } else {
            window._aiOsThreadId = id; 
        }
        return id;
    }

    function showSyncedIcon() {
        let icon = document.getElementById('ai-os-synced-icon')
        if (!icon) {
            icon = document.createElement('div')
            icon.id = 'ai-os-synced-icon'
            icon.innerHTML = '✓ Synced'
            icon.style.position = 'fixed'
            icon.style.bottom = '16px'
            icon.style.right = '16px'
            icon.style.padding = '4px 8px'
            icon.style.background = 'rgba(100, 255, 100, 0.2)'
            icon.style.border = '1px solid rgba(100, 255, 100, 0.4)'
            icon.style.color = '#0f0'
            icon.style.borderRadius = '6px'
            icon.style.fontSize = '12px'
            icon.style.fontFamily = 'monospace'
            icon.style.zIndex = '9999'
            icon.style.opacity = '0'
            icon.style.transition = 'opacity 0.3s ease-in-out'
            icon.style.pointerEvents = 'none'
            document.body.appendChild(icon)
        }
        
        icon.style.opacity = '1'
        if (window._syncIconTimeout) clearTimeout(window._syncIconTimeout)
        window._syncIconTimeout = setTimeout(() => {
            icon.style.opacity = '0'
        }, 2000)
    }

    function exportThreadWithTimestamps() {
        // Select all user queries and model responses
        const messages = Array.from(
            document.querySelectorAll('user-query, model-response')
        )

        if (messages.length === 0) {
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

            // Attach clone to DOM to compute proper innerText newlines
            const hidden = document.createElement('div')
            hidden.style.display = 'block'
            hidden.style.position = 'absolute'
            hidden.style.left = '-9999px'
            hidden.appendChild(clone)
            document.body.appendChild(hidden)

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
            document.body.removeChild(hidden)

            text = text.replace(/^(You said|Gemini said)\s*/i, '')

            return { role, text, timestamp }
        })

        // Format the output with [Timestamp] [Role]: Content
        const formattedText = threadData
            .map((m) => `${m.timestamp}${m.role}:\n${m.text}\n`)
            .join('\n---\n\n')

        if (window._lastSentContextSync === formattedText) {
            return
        }
        window._lastSentContextSync = formattedText

        const payload = {
            thread_id: getThreadId(),
            content: formattedText,
        }

        GM_xmlhttpRequest({
            method: 'POST',
            url: SYNC_URL,
            data: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
            onload: function (response) {
                console.log(`[AI-OS SYNC] Success:`, response.responseText)
                showSyncedIcon()
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
            if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE && mutation.target.closest('model-response, user-query')) {
                shouldExport = true
                break
            }
            if (mutation.addedNodes) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const tag = node.tagName.toLowerCase()
                        if (tag === 'model-response' || tag === 'user-query' || node.querySelector?.('model-response, user-query')) {
                            shouldExport = true
                            break
                        }
                    }
                }
                if (shouldExport) break
            }
        }

        if (shouldExport) {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => {
                exportThreadWithTimestamps()
            }, 500) // Debounce by 500 milliseconds
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
