// ==UserScript==
// @name         fix-aistudio-lag
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Removes GPU lag from Google AI Studio
// @author       xgloom
// @match        https://aistudio.google.com/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

;(function () {
    'use strict'

    gm.addStyle(`
        * {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }

        * {
            scroll-behavior: auto !important;
        }
    `)

    //* --- MATT MURPHY ADDITION ---
    //* Text box fix: add delay before token counter gets the update
    //? Injects a fake text box over the real one
    //? and fires input events every 2 seconds
    //? to trick the auto-counter from triggering a GPU re-render
    //? every time you type a character

    // 1. The Trusted Types compliant CSS injection
    const style = document.createElement('style')
    const cssText = document.createTextNode(`
        * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        * { scroll-behavior: auto !important; }
    `)
    style.appendChild(cssText)
    document.head.appendChild(style)

    // 2. The Pseudotextarea implementation
    function injectPseudoInput() {
        const realInput = document.querySelector(
            'textarea[placeholder*="Type something"]'
        )

        if (!realInput || realInput.dataset.debounced) return
        realInput.dataset.debounced = 'true'

        const pseudoInput = document.createElement('textarea')

        const styles = window.getComputedStyle(realInput)
        for (let key of styles) {
            pseudoInput.style[key] = styles[key]
        }

        pseudoInput.style.position = 'absolute'
        pseudoInput.style.zIndex = '9999'
        pseudoInput.style.backgroundColor = 'var(--background-color, #1e1e1e)'
        pseudoInput.placeholder = 'Typing (Debounced)...'

        realInput.parentElement.style.position = 'relative'
        realInput.parentElement.appendChild(pseudoInput)

        realInput.style.opacity = '0'
        realInput.style.pointerEvents = 'none'

        let debounceTimer

        const syncToRealInput = () => {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value'
            ).set
            nativeInputValueSetter.call(realInput, pseudoInput.value)
            realInput.dispatchEvent(new Event('input', { bubbles: true }))
        }

        pseudoInput.addEventListener('input', () => {
            clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                syncToRealInput()
            }, 2000)
        })

        pseudoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                clearTimeout(debounceTimer)
                syncToRealInput()

                setTimeout(() => {
                    pseudoInput.value = ''
                }, 50)
            }
        })
    }

    setInterval(injectPseudoInput, 1000)
})()
