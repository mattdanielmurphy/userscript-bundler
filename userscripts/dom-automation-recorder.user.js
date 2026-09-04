// ==UserScript==
// @name         DOM Action Recorder & Automation Generator
// @namespace    https://mattmurphy.ca
// @version      1.0.0
// @description  Cross-domain, multi-page DOM action recorder. Records clicks, inputs, dropdowns, navigation, and generates Playwright/Puppeteer automation scripts. Survives page loads and redirects.
// @author       Matthew Daniel Murphy
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    "use strict";

    // ─────────────────────────────────────────────────────────────
    // 1. STORAGE & CONSTANTS
    // ─────────────────────────────────────────────────────────────
    const STORAGE_KEY_ACTIVE = "__DOM_RECORDER_ACTIVE__";
    const STORAGE_KEY_PAUSED = "__DOM_RECORDER_PAUSED__";
    const STORAGE_KEY_ACTIONS = "__DOM_RECORDER_ACTIONS__";
    const STORAGE_KEY_SESSION_ID = "__DOM_RECORDER_SESSION_ID__";
    const STORAGE_KEY_START_TIME = "__DOM_RECORDER_START_TIME__";

    function getStore(key, defaultValue) {
        if (typeof GM_getValue === "function") {
            try { return GM_getValue(key, defaultValue); } catch (e) {}
        }
        if (typeof window !== "undefined" && window.gm && typeof window.gm.getValue === "function") {
            try { return window.gm.getValue(key, defaultValue); } catch (e) {}
        }
        try {
            const raw = localStorage.getItem(key);
            return raw !== null ? JSON.parse(raw) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }

    function setStore(key, value) {
        if (typeof GM_setValue === "function") {
            try { GM_setValue(key, value); return; } catch (e) {}
        }
        if (typeof window !== "undefined" && window.gm && typeof window.gm.setValue === "function") {
            try { window.gm.setValue(key, value); return; } catch (e) {}
        }
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
    }

    function copyToClipboard(text) {
        if (typeof GM_setClipboard === "function") {
            try { GM_setClipboard(text, "text"); return Promise.resolve(); } catch (e) {}
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return Promise.resolve();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. STATE MANAGEMENT
    // ─────────────────────────────────────────────────────────────
    let isRecording = getStore(STORAGE_KEY_ACTIVE, false);
    let isPaused = getStore(STORAGE_KEY_PAUSED, false);
    let pendingInputTimer = null;
    let pendingInputEvent = null;
    let hudElement = null;

    // ─────────────────────────────────────────────────────────────
    // 3. LOCATOR & SELECTOR ENGINE
    // ─────────────────────────────────────────────────────────────
    function getAssociatedLabel(el) {
        if (!el || !(el instanceof HTMLElement)) return null;
        // Check enclosing label
        const parentLabel = el.closest("label");
        if (parentLabel) {
            const clone = parentLabel.cloneNode(true);
            const nestedInput = clone.querySelector("input, select, textarea");
            if (nestedInput) nestedInput.remove();
            const txt = clone.textContent.trim();
            if (txt) return txt.substring(0, 60);
        }
        // Check label[for="id"]
        if (el.id) {
            const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (forLabel) {
                const txt = forLabel.textContent.trim();
                if (txt) return txt.substring(0, 60);
            }
        }
        // Check aria-labelledby
        const labelledBy = el.getAttribute("aria-labelledby");
        if (labelledBy) {
            const labelEl = document.getElementById(labelledBy);
            if (labelEl) {
                const txt = labelEl.textContent.trim();
                if (txt) return txt.substring(0, 60);
            }
        }
        return null;
    }

    function isStableId(id) {
        if (!id || typeof id !== "string") return false;
        // Exclude common auto-generated/dynamic ID patterns
        if (id.startsWith(":") || id.startsWith("rc-")) return false; // React internal IDs
        if (/^[a-f0-9]{8}-[a-f0-9]{4}/i.test(id)) return false; // UUIDs
        if (/\d{5,}/.test(id)) return false; // Long random numbers
        if (/^(ember|ember-view|gwt-|yui-|ext-gen|vue-)/i.test(id)) return false;
        return true;
    }

    function getCssPath(el) {
        if (!el || el === document.body) return "body";
        const path = [];
        let curr = el;
        while (curr && curr.parentElement && curr !== document.body) {
            let selector = curr.tagName.toLowerCase();
            if (curr.id && isStableId(curr.id)) {
                selector = `#${CSS.escape(curr.id)}`;
                path.unshift(selector);
                break;
            } else {
                let siblingIndex = 1;
                let sib = curr.previousElementSibling;
                while (sib) {
                    if (sib.tagName === curr.tagName) siblingIndex++;
                    sib = sib.previousElementSibling;
                }
                selector += `:nth-of-type(${siblingIndex})`;
            }
            path.unshift(selector);
            curr = curr.parentElement;
        }
        return path.join(" > ");
    }

    function getXPath(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";
        if (el.id && isStableId(el.id)) return `//*[@id="${el.id}"]`;
        const parts = [];
        for (; el && el.nodeType === Node.ELEMENT_NODE; el = el.parentNode) {
            let idx = 1;
            for (let sib = el.previousSibling; sib; sib = sib.previousSibling) {
                if (sib.nodeType === Node.ELEMENT_NODE && sib.tagName === el.tagName) idx++;
            }
            parts.unshift(`${el.tagName.toLowerCase()}[${idx}]`);
        }
        return "/" + parts.join("/");
    }

    function buildLocators(el) {
        if (!(el instanceof HTMLElement)) return null;

        const tagName = el.tagName.toLowerCase();
        const type = el.getAttribute("type") || null;
        const name = el.getAttribute("name") || null;
        const id = el.id && isStableId(el.id) ? el.id : null;
        const testId = el.getAttribute("data-testid") ||
                       el.getAttribute("data-test-id") ||
                       el.getAttribute("data-cy") ||
                       el.getAttribute("data-qa") ||
                       el.getAttribute("data-test") || null;
        const placeholder = el.getAttribute("placeholder") || null;
        const ariaLabel = el.getAttribute("aria-label") || null;
        const role = el.getAttribute("role") || null;
        const label = getAssociatedLabel(el);
        const text = (el.innerText || el.textContent || "").trim().substring(0, 60) || null;
        const cssPath = getCssPath(el);
        const xpath = getXPath(el);

        // Determine best selector
        let best = "";
        if (testId) {
            best = `[data-testid="${CSS.escape(testId)}"]`;
        } else if (id) {
            best = `#${CSS.escape(id)}`;
        } else if (name && (tagName === "input" || tagName === "select" || tagName === "textarea")) {
            best = `${tagName}[name="${CSS.escape(name)}"]`;
        } else if ((tagName === "button" || role === "button" || tagName === "a") && text && text.length < 35) {
            best = `${tagName}:has-text(${JSON.stringify(text)})`;
        } else if (placeholder) {
            best = `${tagName}[placeholder="${CSS.escape(placeholder)}"]`;
        } else if (ariaLabel) {
            best = `[aria-label="${CSS.escape(ariaLabel)}"]`;
        } else {
            best = cssPath;
        }

        return {
            best,
            tagName,
            type,
            name,
            id,
            testId,
            placeholder,
            ariaLabel,
            role,
            label,
            text,
            cssPath,
            xpath
        };
    }

    function getInteractiveTarget(target) {
        if (!(target instanceof HTMLElement)) return null;
        // Ignore clicks inside our own UI overlays
        if (target.closest("[data-dom-recorder-root]")) return null;

        return target.closest(
            'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], label, summary, [contenteditable="true"]'
        ) || target;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. ACTION PERSISTENCE & DEBOUNCING
    // ─────────────────────────────────────────────────────────────
    function saveAction(action) {
        if (isPaused) return;
        const actions = getStore(STORAGE_KEY_ACTIONS, []);
        action.index = actions.length + 1;
        actions.push(action);
        setStore(STORAGE_KEY_ACTIONS, actions);
        updateHUD();
        console.log(`%c[DOM Recorder #${action.index}] %c${action.type.toUpperCase()}`, "color:#6366f1;font-weight:bold;", "color:#10b981;font-weight:bold;", action);
    }

    function flushPendingInput() {
        if (pendingInputTimer) {
            clearTimeout(pendingInputTimer);
            pendingInputTimer = null;
        }
        if (pendingInputEvent) {
            saveAction(pendingInputEvent);
            pendingInputEvent = null;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────
    function handleClick(e) {
        if (!isRecording || isPaused) return;
        flushPendingInput();

        const target = getInteractiveTarget(e.target);
        if (!target) return;

        // Skip plain container clicks unless clickable
        if (["div", "span", "section", "article", "main", "body", "html"].includes(target.tagName.toLowerCase()) &&
            !target.getAttribute("role") && !target.onclick && !target.getAttribute("tabindex")) {
            return;
        }

        const locators = buildLocators(target);
        if (!locators) return;

        const action = {
            type: "click",
            timestamp: Date.now(),
            isoTime: new Date().toISOString(),
            url: window.location.href,
            locators: locators,
            value: target.value || null,
            href: target.getAttribute("href") || null
        };

        saveAction(action);
    }

    function handleInput(e) {
        if (!isRecording || isPaused) return;
        const target = e.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable)) return;
        if (target.closest("[data-dom-recorder-root]")) return;

        // Radio & checkboxes are handled by 'change' event
        if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) return;

        const locators = buildLocators(target);
        if (!locators) return;

        const currentValue = target.isContentEditable ? target.innerText : target.value;

        // Debounce typing so we record the consolidated value instead of 50 keystrokes
        if (pendingInputTimer) clearTimeout(pendingInputTimer);

        pendingInputEvent = {
            type: "input",
            timestamp: Date.now(),
            isoTime: new Date().toISOString(),
            url: window.location.href,
            locators: locators,
            value: currentValue
        };

        pendingInputTimer = setTimeout(() => {
            flushPendingInput();
        }, 500);
    }

    function handleChange(e) {
        if (!isRecording || isPaused) return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest("[data-dom-recorder-root]")) return;

        flushPendingInput();

        const locators = buildLocators(target);
        if (!locators) return;

        const action = {
            type: "change",
            timestamp: Date.now(),
            isoTime: new Date().toISOString(),
            url: window.location.href,
            locators: locators
        };

        if (target instanceof HTMLSelectElement) {
            action.value = target.value;
            action.selectedText = target.options[target.selectedIndex]?.text || "";
            action.selectedIndex = target.selectedIndex;
        } else if (target instanceof HTMLInputElement) {
            if (target.type === "checkbox") {
                action.checked = target.checked;
                action.value = target.value;
            } else if (target.type === "radio") {
                action.checked = target.checked;
                action.value = target.value;
            } else {
                action.value = target.value;
            }
        } else {
            action.value = target.value || null;
        }

        saveAction(action);
    }

    function handleKeydown(e) {
        if (!isRecording || isPaused) return;
        if (e.target && e.target.closest && e.target.closest("[data-dom-recorder-root]")) return;

        // Only record control keys like Enter (form submit) or Escape, not standard characters
        if (e.key === "Enter" || e.key === "Escape") {
            flushPendingInput();
            const target = e.target instanceof HTMLElement ? e.target : document.body;
            const locators = buildLocators(target);

            saveAction({
                type: "keydown",
                key: e.key,
                timestamp: Date.now(),
                isoTime: new Date().toISOString(),
                url: window.location.href,
                locators: locators
            });
        }
    }

    function handleSubmit(e) {
        if (!isRecording || isPaused) return;
        flushPendingInput();

        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.closest("[data-dom-recorder-root]")) return;

        const locators = buildLocators(form);
        saveAction({
            type: "submit",
            timestamp: Date.now(),
            isoTime: new Date().toISOString(),
            url: window.location.href,
            actionUrl: form.action || window.location.href,
            method: (form.method || "GET").toUpperCase(),
            locators: locators
        });
    }

    function handleNavigation() {
        if (!isRecording || isPaused) return;
        saveAction({
            type: "navigation",
            timestamp: Date.now(),
            isoTime: new Date().toISOString(),
            url: window.location.href,
            title: document.title || "",
            referrer: document.referrer || ""
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 6. SCRIPT GENERATOR (Playwright / Puppeteer / Vanilla JS)
    // ─────────────────────────────────────────────────────────────
    function generateCode(actions, format = "playwright") {
        if (!actions || actions.length === 0) return "// No actions recorded yet.";

        if (format === "playwright") {
            const lines = [
                `import { test, expect } from '@playwright/test';`,
                ``,
                `test('recorded automation flow', async ({ page }) => {`,
                `  test.setTimeout(60000);`,
                ``
            ];

            let lastUrl = "";
            actions.forEach((act) => {
                if (act.type === "navigation") {
                    if (act.url !== lastUrl) {
                        lines.push(`  // Navigate to ${act.title ? act.title + " (" + act.url + ")" : act.url}`);
                        lines.push(`  await page.goto(${JSON.stringify(act.url)}, { waitUntil: 'domcontentloaded' });`);
                        lines.push(``);
                        lastUrl = act.url;
                    }
                } else if (act.type === "click") {
                    const sel = act.locators?.best || "body";
                    const desc = act.locators?.text ? `"${act.locators.text}"` : (act.locators?.name || sel);
                    lines.push(`  // Click ${desc}`);
                    lines.push(`  await page.locator(${JSON.stringify(sel)}).click();`);
                } else if (act.type === "input") {
                    const sel = act.locators?.best || "input";
                    const desc = act.locators?.label || act.locators?.name || act.locators?.placeholder || sel;
                    lines.push(`  // Fill ${desc}`);
                    lines.push(`  await page.locator(${JSON.stringify(sel)}).fill(${JSON.stringify(act.value || "")});`);
                } else if (act.type === "change") {
                    const sel = act.locators?.best || "select";
                    if (act.selectedText) {
                        lines.push(`  // Select option "${act.selectedText}"`);
                        lines.push(`  await page.locator(${JSON.stringify(sel)}).selectOption({ label: ${JSON.stringify(act.selectedText)} });`);
                    } else if (act.checked !== undefined) {
                        lines.push(`  // Set checkbox/radio state`);
                        lines.push(`  await page.locator(${JSON.stringify(sel)}).setChecked(${act.checked});`);
                    } else {
                        lines.push(`  await page.locator(${JSON.stringify(sel)}).fill(${JSON.stringify(act.value || "")});`);
                    }
                } else if (act.type === "keydown" && act.key === "Enter") {
                    lines.push(`  // Press Enter`);
                    lines.push(`  await page.keyboard.press('Enter');`);
                } else if (act.type === "submit") {
                    lines.push(`  // Wait for submission`);
                    lines.push(`  await page.waitForLoadState('networkidle');`);
                }
            });

            lines.push(`});`);
            return lines.join("\n");
        }

        if (format === "puppeteer") {
            const lines = [
                `const puppeteer = require('puppeteer');`,
                ``,
                `(async () => {`,
                `  const browser = await puppeteer.launch({ headless: false });`,
                `  const page = await browser.newPage();`,
                `  await page.setViewport({ width: 1280, height: 800 });`,
                ``
            ];

            actions.forEach((act) => {
                if (act.type === "navigation") {
                    lines.push(`  await page.goto(${JSON.stringify(act.url)}, { waitUntil: 'networkidle2' });`);
                } else if (act.type === "click") {
                    const sel = act.locators?.best || "body";
                    lines.push(`  await page.waitForSelector(${JSON.stringify(sel)});`);
                    lines.push(`  await page.click(${JSON.stringify(sel)});`);
                } else if (act.type === "input") {
                    const sel = act.locators?.best || "input";
                    lines.push(`  await page.waitForSelector(${JSON.stringify(sel)});`);
                    lines.push(`  await page.$eval(${JSON.stringify(sel)}, el => el.value = '');`);
                    lines.push(`  await page.type(${JSON.stringify(sel)}, ${JSON.stringify(act.value || "")});`);
                } else if (act.type === "change" && act.selectedText) {
                    const sel = act.locators?.best || "select";
                    lines.push(`  await page.select(${JSON.stringify(sel)}, ${JSON.stringify(act.value)});`);
                } else if (act.type === "keydown" && act.key === "Enter") {
                    lines.push(`  await page.keyboard.press('Enter');`);
                }
            });

            lines.push(``);
            lines.push(`  console.log('Automation flow complete.');`);
            lines.push(`})();`);
            return lines.join("\n");
        }

        return JSON.stringify(actions, null, 2);
    }

    // ─────────────────────────────────────────────────────────────
    // 7. FLOATING HUD & EXPORT MODAL (USER INTERFACE)
    // ─────────────────────────────────────────────────────────────
    function mountHUD() {
        if (hudElement || !isRecording) return;
        if (!document.body) {
            window.addEventListener("DOMContentLoaded", mountHUD, { once: true });
            return;
        }

        const actions = getStore(STORAGE_KEY_ACTIONS, []);
        const host = window.location.hostname.replace(/^www\./, "");

        hudElement = document.createElement("div");
        hudElement.id = "dom-recorder-hud";
        hudElement.setAttribute("data-dom-recorder-root", "true");
        Object.assign(hudElement.style, {
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: "2147483647",
            backgroundColor: "#18181b",
            color: "#f4f4f5",
            borderRadius: "9999px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: "13px",
            lineHeight: "1",
            userSelect: "none",
            cursor: "grab",
            transition: "transform 0.15s ease"
        });

        // Recording indicator pill
        const dot = document.createElement("span");
        dot.id = "dom-recorder-dot";
        Object.assign(dot.style, {
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: isPaused ? "#f59e0b" : "#ef4444",
            boxShadow: isPaused ? "0 0 8px #f59e0b" : "0 0 10px #ef4444",
            display: "inline-block",
            animation: isPaused ? "none" : "dom-recorder-pulse 1.5s infinite"
        });

        const statusText = document.createElement("span");
        statusText.id = "dom-recorder-count";
        statusText.style.fontWeight = "600";
        statusText.textContent = `${isPaused ? "PAUSED" : "REC"} (${actions.length})`;

        const domainBadge = document.createElement("span");
        domainBadge.style.cssText = "background: #27272a; color: #a1a1aa; padding: 3px 7px; border-radius: 6px; font-size: 11px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
        domainBadge.textContent = host;

        // Pause/Resume button
        const pauseBtn = document.createElement("button");
        pauseBtn.textContent = isPaused ? "▶" : "⏸";
        pauseBtn.title = isPaused ? "Resume recording" : "Pause recording";
        Object.assign(pauseBtn.style, {
            background: "none",
            border: "none",
            color: "#d4d4d8",
            cursor: "pointer",
            fontSize: "12px",
            padding: "2px 5px",
            borderRadius: "4px"
        });
        pauseBtn.onclick = (e) => {
            e.stopPropagation();
            togglePause();
        };

        // Stop & Export button
        const stopBtn = document.createElement("button");
        stopBtn.textContent = "⏹ Stop & Export";
        Object.assign(stopBtn.style, {
            background: "#ef4444",
            color: "#ffffff",
            border: "none",
            borderRadius: "9999px",
            padding: "5px 12px",
            fontWeight: "600",
            fontSize: "12px",
            cursor: "pointer",
            transition: "background 0.15s ease"
        });
        stopBtn.onmouseover = () => { stopBtn.style.background = "#dc2626"; };
        stopBtn.onmouseout = () => { stopBtn.style.background = "#ef4444"; };
        stopBtn.onclick = (e) => {
            e.stopPropagation();
            stopRecording(true);
        };

        hudElement.appendChild(dot);
        hudElement.appendChild(statusText);
        hudElement.appendChild(domainBadge);
        hudElement.appendChild(pauseBtn);
        hudElement.appendChild(stopBtn);

        // Make draggable
        makeDraggable(hudElement);

        document.body.appendChild(hudElement);

        // Inject pulsing keyframe animation
        if (!document.getElementById("dom-recorder-keyframes")) {
            const style = document.createElement("style");
            style.id = "dom-recorder-keyframes";
            style.textContent = `
                @keyframes dom-recorder-pulse {
                    0% { transform: scale(0.95); opacity: 0.8; }
                    50% { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.8; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function updateHUD() {
        if (!hudElement) return;
        const countEl = hudElement.querySelector("#dom-recorder-count");
        const dotEl = hudElement.querySelector("#dom-recorder-dot");
        if (countEl) {
            const actions = getStore(STORAGE_KEY_ACTIONS, []);
            countEl.textContent = `${isPaused ? "PAUSED" : "REC"} (${actions.length})`;
        }
        if (dotEl) {
            dotEl.style.backgroundColor = isPaused ? "#f59e0b" : "#ef4444";
            dotEl.style.boxShadow = isPaused ? "0 0 8px #f59e0b" : "0 0 10px #ef4444";
            dotEl.style.animation = isPaused ? "none" : "dom-recorder-pulse 1.5s infinite";
        }
    }

    function unmountHUD() {
        if (hudElement) {
            hudElement.remove();
            hudElement = null;
        }
    }

    function makeDraggable(el) {
        let isDragging = false;
        let startX, startY, initX, initY;

        el.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "BUTTON") return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            initX = rect.left;
            initY = rect.top;
            el.style.cursor = "grabbing";
            e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = `${initX + dx}px`;
            el.style.top = `${initY + dy}px`;
            el.style.right = "auto";
            el.style.bottom = "auto";
        });

        window.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                el.style.cursor = "grab";
            }
        });
    }

    function showExportModal(actions) {
        const existing = document.getElementById("dom-recorder-export-modal");
        if (existing) existing.remove();

        const playwrightScript = generateCode(actions, "playwright");
        const puppeteerScript = generateCode(actions, "puppeteer");
        const rawJson = JSON.stringify(actions, null, 2);

        const modal = document.createElement("div");
        modal.id = "dom-recorder-export-modal";
        modal.setAttribute("data-dom-recorder-root", "true");
        Object.assign(modal.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: "2147483647",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        });

        const card = document.createElement("div");
        Object.assign(card.style, {
            backgroundColor: "#18181b",
            color: "#f4f4f5",
            width: "850px",
            maxWidth: "92vw",
            maxHeight: "88vh",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            border: "1px solid #27272a",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
        });

        // Header
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "20px 24px",
            borderBottom: "1px solid #27272a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
        });

        const titleBox = document.createElement("div");
        titleBox.innerHTML = `
            <div style="font-size: 18px; font-weight: 700; color: #ffffff;">⚡ Recorded Automation Session</div>
            <div style="font-size: 12px; color: #a1a1aa; margin-top: 4px;">Captured ${actions.length} action(s) across page navigations. Ready for Playwright / Puppeteer.</div>
        `;

        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "×";
        Object.assign(closeBtn.style, {
            background: "none",
            border: "none",
            color: "#a1a1aa",
            fontSize: "24px",
            lineHeight: "1",
            cursor: "pointer",
            padding: "0 6px"
        });
        closeBtn.onclick = () => modal.remove();

        header.appendChild(titleBox);
        header.appendChild(closeBtn);

        // Tab bar
        const tabContainer = document.createElement("div");
        Object.assign(tabContainer.style, {
            display: "flex",
            padding: "0 24px",
            borderBottom: "1px solid #27272a",
            background: "#121215",
            gap: "8px"
        });

        let activeTab = "playwright";
        const tabs = [
            { id: "playwright", label: "Playwright Code" },
            { id: "puppeteer", label: "Puppeteer Code" },
            { id: "json", label: "Raw JSON" },
            { id: "summary", label: "Action Log Table" }
        ];

        const tabButtons = {};
        const codePre = document.createElement("pre");
        Object.assign(codePre.style, {
            margin: "0",
            padding: "20px 24px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "12px",
            lineHeight: "1.5",
            color: "#e4e4e7",
            background: "#09090b",
            overflow: "auto",
            flex: "1",
            whiteSpace: "pre-wrap"
        });

        function renderTabContent() {
            if (activeTab === "playwright") {
                codePre.textContent = playwrightScript;
            } else if (activeTab === "puppeteer") {
                codePre.textContent = puppeteerScript;
            } else if (activeTab === "json") {
                codePre.textContent = rawJson;
            } else if (activeTab === "summary") {
                codePre.textContent = actions.map((a, i) => {
                    const sel = a.locators?.best || a.actionUrl || a.url || "";
                    const detail = a.value ? `value="${a.value}"` : (a.key ? `key="${a.key}"` : "");
                    return `[#${i+1}] [${a.type.toUpperCase().padEnd(10)}] ${sel} ${detail}`.trim();
                }).join("\n");
            }
        }

        tabs.forEach((tab) => {
            const btn = document.createElement("button");
            btn.textContent = tab.label;
            Object.assign(btn.style, {
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #6366f1" : "2px solid transparent",
                color: activeTab === tab.id ? "#ffffff" : "#a1a1aa",
                fontWeight: activeTab === tab.id ? "600" : "400",
                fontSize: "13px",
                padding: "12px 14px",
                cursor: "pointer"
            });
            btn.onclick = () => {
                activeTab = tab.id;
                Object.keys(tabButtons).forEach(k => {
                    const active = k === tab.id;
                    tabButtons[k].style.borderBottom = active ? "2px solid #6366f1" : "2px solid transparent";
                    tabButtons[k].style.color = active ? "#ffffff" : "#a1a1aa";
                    tabButtons[k].style.fontWeight = active ? "600" : "400";
                });
                renderTabContent();
            };
            tabButtons[tab.id] = btn;
            tabContainer.appendChild(btn);
        });

        renderTabContent();

        // Footer Actions
        const footer = document.createElement("div");
        Object.assign(footer.style, {
            padding: "16px 24px",
            borderTop: "1px solid #27272a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#121215"
        });

        const leftFooter = document.createElement("div");
        const clearBtn = document.createElement("button");
        clearBtn.textContent = "🗑 Clear Saved Log";
        Object.assign(clearBtn.style, {
            background: "none",
            border: "1px solid #3f3f46",
            color: "#f87171",
            borderRadius: "6px",
            padding: "8px 14px",
            fontSize: "12px",
            cursor: "pointer"
        });
        clearBtn.onclick = () => {
            if (confirm("Are you sure you want to clear the entire recorded action log?")) {
                clearLog();
                modal.remove();
            }
        };
        leftFooter.appendChild(clearBtn);

        const rightFooter = document.createElement("div");
        rightFooter.style.display = "flex";
        rightFooter.style.gap = "10px";

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "📋 Copy Current Tab";
        Object.assign(copyBtn.style, {
            background: "#27272a",
            border: "1px solid #3f3f46",
            color: "#ffffff",
            borderRadius: "6px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer"
        });
        copyBtn.onclick = () => {
            const content = codePre.textContent;
            copyToClipboard(content).then(() => {
                const orig = copyBtn.textContent;
                copyBtn.textContent = "✅ Copied!";
                setTimeout(() => { copyBtn.textContent = orig; }, 1800);
            });
        };

        const downloadBtn = document.createElement("button");
        downloadBtn.textContent = "💾 Download Script / JSON";
        Object.assign(downloadBtn.style, {
            background: "#6366f1",
            border: "none",
            color: "#ffffff",
            borderRadius: "6px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer"
        });
        downloadBtn.onclick = () => {
            let filename = "recorded_flow.spec.ts";
            let content = playwrightScript;
            let mime = "text/typescript";

            if (activeTab === "puppeteer") {
                filename = "recorded_flow.js";
                content = puppeteerScript;
                mime = "text/javascript";
            } else if (activeTab === "json" || activeTab === "summary") {
                filename = "recorded_actions.json";
                content = rawJson;
                mime = "application/json";
            }

            const blob = new Blob([content], { type: mime });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        rightFooter.appendChild(copyBtn);
        rightFooter.appendChild(downloadBtn);

        footer.appendChild(leftFooter);
        footer.appendChild(rightFooter);

        card.appendChild(header);
        card.appendChild(tabContainer);
        card.appendChild(codePre);
        card.appendChild(footer);
        modal.appendChild(card);
        document.body.appendChild(modal);
    }

    // ─────────────────────────────────────────────────────────────
    // 8. SESSION CONTROLS
    // ─────────────────────────────────────────────────────────────
    function startRecording() {
        flushPendingInput();
        isRecording = true;
        isPaused = false;
        setStore(STORAGE_KEY_ACTIVE, true);
        setStore(STORAGE_KEY_PAUSED, false);

        if (!getStore(STORAGE_KEY_SESSION_ID, null)) {
            setStore(STORAGE_KEY_SESSION_ID, `session_${Date.now()}`);
            setStore(STORAGE_KEY_START_TIME, Date.now());
            setStore(STORAGE_KEY_ACTIONS, []);
        }

        mountHUD();
        attachEventListeners();
        handleNavigation();
        console.log("%c[DOM Recorder] 🔴 Recording session started!", "color:#ef4444;font-weight:bold;font-size:14px;");
    }

    function stopRecording(showExport = true) {
        flushPendingInput();
        isRecording = false;
        isPaused = false;
        setStore(STORAGE_KEY_ACTIVE, false);
        setStore(STORAGE_KEY_PAUSED, false);

        unmountHUD();
        detachEventListeners();

        const actions = getStore(STORAGE_KEY_ACTIONS, []);
        console.log(`%c[DOM Recorder] ⏹ Recording stopped. ${actions.length} total actions captured.`, "color:#6366f1;font-weight:bold;font-size:14px;");
        if (actions.length > 0) {
            console.table(actions.map(a => ({
                index: a.index,
                type: a.type,
                target: a.locators?.best || a.url || "",
                value: a.value || a.key || "",
                url: a.url
            })));
        }

        if (showExport) {
            showExportModal(actions);
        }
    }

    function togglePause() {
        isPaused = !isPaused;
        setStore(STORAGE_KEY_PAUSED, isPaused);
        updateHUD();
        console.log(`%c[DOM Recorder] ${isPaused ? "⏸ PAUSED" : "▶ RESUMED"}`, "color:#f59e0b;font-weight:bold;");
    }

    function toggleRecording() {
        if (isRecording) {
            stopRecording(true);
        } else {
            startRecording();
        }
    }

    function clearLog() {
        flushPendingInput();
        setStore(STORAGE_KEY_ACTIONS, []);
        setStore(STORAGE_KEY_SESSION_ID, null);
        setStore(STORAGE_KEY_START_TIME, null);
        updateHUD();
        console.log("%c[DOM Recorder] 🗑 Action log cleared.", "color:#10b981;font-weight:bold;");
    }

    // ─────────────────────────────────────────────────────────────
    // 9. EVENT LISTENER ATTACHMENT
    // ─────────────────────────────────────────────────────────────
    let listenersAttached = false;

    function attachEventListeners() {
        if (listenersAttached) return;
        document.addEventListener("click", handleClick, { capture: true, passive: true });
        document.addEventListener("input", handleInput, { capture: true, passive: true });
        document.addEventListener("change", handleChange, { capture: true, passive: true });
        document.addEventListener("keydown", handleKeydown, { capture: true, passive: true });
        document.addEventListener("submit", handleSubmit, { capture: true, passive: true });

        // Flush input before page unloads / navigates
        window.addEventListener("beforeunload", flushPendingInput, { capture: true });
        window.addEventListener("pagehide", flushPendingInput, { capture: true });
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flushPendingInput();
        }, { capture: true });

        listenersAttached = true;
    }

    function detachEventListeners() {
        if (!listenersAttached) return;
        document.removeEventListener("click", handleClick, { capture: true });
        document.removeEventListener("input", handleInput, { capture: true });
        document.removeEventListener("change", handleChange, { capture: true });
        document.removeEventListener("keydown", handleKeydown, { capture: true });
        document.removeEventListener("submit", handleSubmit, { capture: true });
        listenersAttached = false;
    }

    // Global keyboard shortcut: Alt+Shift+R (or Option+Shift+R on Mac) to toggle recording anywhere
    window.addEventListener("keydown", (e) => {
        if (e.altKey && e.shiftKey && e.code === "KeyR") {
            e.preventDefault();
            toggleRecording();
        }
        if (e.altKey && e.shiftKey && e.code === "KeyP" && isRecording) {
            e.preventDefault();
            togglePause();
        }
    }, { capture: true });

    // ─────────────────────────────────────────────────────────────
    // 10. INITIALIZATION & MENU COMMANDS
    // ─────────────────────────────────────────────────────────────
    if (typeof GM_registerMenuCommand === "function") {
        try {
            GM_registerMenuCommand("🔴 Start Automation Recording", () => startRecording());
            GM_registerMenuCommand("⏹ Stop & Export Recording", () => stopRecording(true));
            GM_registerMenuCommand("⏸ Pause / Resume Recording", () => togglePause());
            GM_registerMenuCommand("📋 View / Export Last Session", () => {
                const actions = getStore(STORAGE_KEY_ACTIONS, []);
                showExportModal(actions);
            });
            GM_registerMenuCommand("🗑 Clear Recorded Actions", () => clearLog());
        } catch (e) {}
    }

    // If an active session was already running across a page load or redirect:
    if (isRecording) {
        attachEventListeners();
        handleNavigation();
        if (document.readyState === "loading") {
            window.addEventListener("DOMContentLoaded", mountHUD, { once: true });
        } else {
            mountHUD();
        }
    }

    // Expose global developer API on window
    const api = {
        start: startRecording,
        stop: stopRecording,
        pause: togglePause,
        toggle: toggleRecording,
        clear: clearLog,
        export: () => {
            const actions = getStore(STORAGE_KEY_ACTIONS, []);
            showExportModal(actions);
        },
        getActions: () => getStore(STORAGE_KEY_ACTIONS, []),
        generateScript: (fmt = "playwright") => generateCode(getStore(STORAGE_KEY_ACTIONS, []), fmt)
    };

    if (typeof window !== "undefined") {
        window.DOMRecorder = api;
    }
    if (typeof unsafeWindow !== "undefined") {
        unsafeWindow.DOMRecorder = api;
    }

    console.log(
        "%c[DOM Action Recorder] Loaded. Press Alt+Shift+R or run DOMRecorder.start() to begin recording.",
        "color:#8b5cf6;font-size:11px;"
    );

})();
