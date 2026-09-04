// ==UserScript==
// @name         Strip Territorial & Land Acknowledgements
// @namespace    https://mattmurphy.ca
// @version      1.0.0
// @description  Automatically detects and strips territorial and land acknowledgement banners, footers, sections, and callouts across all websites.
// @author       Matthew Daniel Murphy
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // ─────────────────────────────────────────────────────────────
    // 1. INSTANT PREEMPTIVE CSS (Zero Flash of Unstyled Content)
    // ─────────────────────────────────────────────────────────────
    const cssRules = [
        // Known classes, IDs, and attributes for territorial/land acknowledgements
        '[class*="territorial-ack" i]',
        '[class*="territorial-acknowledg" i]',
        '[class*="land-ack" i]',
        '[class*="land-acknowledg" i]',
        '[class*="indigenous-ack" i]',
        '[id*="territorial-ack" i]',
        '[id*="territorial-acknowledg" i]',
        '[id*="land-ack" i]',
        '[id*="land-acknowledg" i]',
        '[aria-label*="territorial acknowledgement" i]',
        '[aria-label*="territorial acknowledgment" i]',
        '[aria-label*="land acknowledgement" i]',
        '[aria-label*="land acknowledgment" i]',
        '[data-testid*="territorial-ack" i]',
        '[data-testid*="land-ack" i]',
        // Specific institution selectors
        '.uc-footer__land-acknowledgement',
        '.land-acknowledgement',
        '.territorial-acknowledgement'
    ];

    // University of Alberta specific: .ack container in footer
    if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.endsWith('ualberta.ca')) {
        cssRules.push('div.ack', '.ack');
    }

    const styleEl = document.createElement('style');
    styleEl.id = 'strip-territorial-acknowledgements-preemptive';
    styleEl.textContent = `${cssRules.join(',\n')} {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        max-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
    }`;

    // Inject immediately into documentElement so it applies before body parses
    const root = document.documentElement || document.head;
    if (root) {
        root.appendChild(styleEl);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            (document.head || document.documentElement).appendChild(styleEl);
        }, { once: true });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. DETECTION PATTERNS & REGEXES
    // ─────────────────────────────────────────────────────────────

    // Headings, titles, badges, and labels (standalone / title-style)
    const HEADING_PATTERNS = [
        /^(?:our\s+)?(?:indigenous\s+|traditional\s+)?(?:territorial|land|treaty(?:\s+[0-9]+)?)\s+acknowledg(?:e)?ment(?:s)?(?:\s*[:\-–—].*)?$/i,
        /^(?:traditional\s+)?(?:territory|lands)\s+acknowledg(?:e)?ment(?:s)?(?:\s*[:\-–—].*)?$/i,
        /^acknowledg(?:e)?ment\s+of\s+(?:the\s+)?(?:traditional\s+)?(?:territory|territories|lands|country)(?:\s*[:\-–—].*)?$/i,
        /^honou?r(?:ing)?\s+(?:the\s+)?land(?:\s*[:\-–—].*)?$/i
    ];

    // Exclude headlines of news, commentary, and analysis articles
    const ARTICLE_HEADLINE_EXCLUSIONS = /\b(?:discuss(?:es|ed)?|debat(?:es|ed)|critic(?:ism|ize|ques?)|history|opinion|editorial|why|how\s+to|what\s+is|guide|perspectives?|controversy)\b/i;

    // High-confidence body text patterns (a single match indicates acknowledgement content)
    const HIGH_CONFIDENCE_BODY_PATTERNS = [
        // University of Alberta & Treaty 6/7/8 wording
        /(?:primarily\s+)?located\s+on\s+the\s+territory\s+of\s+Néhiyaw/i,
        /(?:territory|homeland)\s+of\s+(?:the\s+)?(?:Néhiyaw|Niitsitapi|Nakoda|Haudenosaunee|Anishinaabe)/i,
        /lands\s+that\s+are\s+now\s+known\s+as\s+part\s+of\s+Treaties?\s+[0-9]/i,
        /respects\s+the\s+sovereignty,\s*lands,\s*histories,\s*languages,\s*knowledge\s+systems/i,
        
        // General Canadian / North American institutional acknowledgements
        /(?:we\s+)?(?:respectfully\s+)?acknowledges?\s+(?:that\s+)?.*?(?:traditional|ancestral|unceded|treaty\s+[0-9]|custodians)/i,
        /(?:is|are|campuses?|buildings?)\s+(?:primarily\s+)?(?:located|situated|takes?\s+place|stand|stands|reside|resides)\s+on\s+(?:the\s+)?.*?(?:traditional|ancestral|unceded|treaty)/i,
        /(?:traditional|ancestral|unceded)(?:[,\s]+(?:and\s+)?(?:traditional|ancestral|unceded))*\s+(?:territory|territories|lands)/i,
        /acknowledges\s+that\s+its\s+campuses\s+are\s+situated\s+on/i,
        /acknowledges\s+that\s+it\s+operates\s+on\s+the\s+traditional/i,
        /we\s+wish\s+to\s+acknowledge\s+this\s+land\s+on\s+which/i,
        
        // Australian & Commonwealth acknowledgements
        /acknowledges?\s+(?:the\s+)?traditional\s+custodians\s+of\s+country/i,
        /pay\s+(?:our\s+)?respects?\s+to\s+(?:their\s+)?elders\s+past[,\s]+present/i
    ];

    // Medium-confidence markers (requires >= 2 to trigger on a block)
    const MEDIUM_MARKERS = [
        /treaty\s+(?:[0-9]+|six|seven|eight)/i,
        /homeland\s+of\s+the\s+(?:métis|metis)/i,
        /unceded/i,
        /traditional\s+(?:territory|lands)/i,
        /ancestral\s+(?:territory|lands)/i,
        /first\s+nations,\s*(?:métis|metis),\s*and\s+inuit/i,
        /custodians\s+of\s+(?:this\s+)?land/i,
        /reconciliation\s+and\s+respect/i
    ];

    // Tags that must NEVER be stripped as containers
    const PROTECTED_TAGS = new Set(['HTML', 'BODY', 'MAIN', 'ARTICLE']);
    const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

    // Track processed nodes to avoid redundant work
    const processedNodes = new WeakSet();

    // ─────────────────────────────────────────────────────────────
    // 3. CORE STRIPPING & CONTAINER RESOLUTION
    // ─────────────────────────────────────────────────────────────

    function removeElement(el) {
        if (!el || processedNodes.has(el)) return;
        processedNodes.add(el);

        const parent = el.parentElement;

        try {
            // Apply immediate CSS collapse before DOM removal to eliminate reflow glitch
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('height', '0', 'important');
            el.style.setProperty('margin', '0', 'important');
            el.style.setProperty('padding', '0', 'important');
            el.remove();
        } catch (e) {
            // Fallback if remove fails
            el.style.display = 'none';
        }

        // Clean up empty parent container if it became completely empty
        if (parent && !PROTECTED_TAGS.has(parent.tagName) && parent.children.length === 0) {
            if ((parent.textContent || '').trim().length === 0) {
                removeElement(parent);
            }
        }
    }

    /**
     * Determines whether text in a block constitutes an acknowledgement.
     */
    function isAcknowledgementText(text) {
        if (!text || text.length < 20 || text.length > 3500) return false;

        // Check high-confidence patterns
        for (const pattern of HIGH_CONFIDENCE_BODY_PATTERNS) {
            if (pattern.test(text)) return true;
        }

        // Check medium-confidence patterns (need >= 2 matches)
        let matches = 0;
        for (const marker of MEDIUM_MARKERS) {
            if (marker.test(text)) {
                matches++;
                if (matches >= 2) return true;
            }
        }

        return false;
    }

    /**
     * Ascends from a matched element to find the most appropriate enclosing container.
     */
    function resolveContainer(el) {
        let curr = el;

        // 1. Explicit acknowledgement container ancestor
        const explicitContainer = curr.closest(
            'div.ack, [class*="ack" i], [class*="territorial" i], [class*="land-ack" i], [class*="land-acknowledg" i], [id*="territorial-ack" i], [id*="land-ack" i], [aria-label*="acknowledgement" i], [aria-label*="acknowledgment" i]'
        );
        if (explicitContainer && !PROTECTED_TAGS.has(explicitContainer.tagName)) {
            const textLen = (explicitContainer.textContent || '').trim().length;
            if (textLen < 4000) {
                return explicitContainer;
            }
        }

        // 2. Semantic UI container ancestor (section, aside, details, callout, banner, alert, card)
        const uiContainer = curr.closest('section, aside, details, [class*="callout" i], [class*="banner" i], [class*="alert" i], [class*="card" i], [class*="modal" i]');
        if (uiContainer && !PROTECTED_TAGS.has(uiContainer.tagName)) {
            const text = (uiContainer.textContent || '').trim();
            if (text.length < 4000 && isAcknowledgementText(text)) {
                return uiContainer;
            }
        }

        // 3. Ascend if parent text is substantially only this element (thin wrapper)
        while (curr && curr.parentElement && !PROTECTED_TAGS.has(curr.parentElement.tagName)) {
            const parent = curr.parentElement;
            const parentText = (parent.textContent || '').trim();
            const currText = (curr.textContent || '').trim();

            if (parentText.length < 2000 && parentText.length <= currText.length * 1.15) {
                curr = parent;
                continue;
            }
            break;
        }

        return curr;
    }

    /**
     * Strips a heading and its associated following sibling paragraphs/blocks.
     */
    function stripHeadingAndContent(headingEl) {
        // First check if the heading is inside a dedicated container
        const container = resolveContainer(headingEl);
        if (container !== headingEl && !PROTECTED_TAGS.has(container.tagName)) {
            removeElement(container);
            return;
        }

        // Otherwise, remove subsequent siblings until the next heading or section break
        let sibling = headingEl.nextElementSibling;
        while (sibling) {
            const next = sibling.nextElementSibling;
            const tag = sibling.tagName;
            // Stop at next heading or major division
            if (HEADING_TAGS.has(tag) || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'HR') {
                break;
            }
            if (tag === 'P' || tag === 'DIV' || tag === 'SPAN' || tag === 'UL' || tag === 'BLOCKQUOTE') {
                removeElement(sibling);
            }
            sibling = next;
        }

        removeElement(headingEl);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. SCANNER PASS
    // ─────────────────────────────────────────────────────────────

    function scanElement(rootEl) {
        if (!rootEl || !rootEl.querySelectorAll) return;

        // A. Scan headings and lead elements
        const candidateHeadings = rootEl.querySelectorAll(
            'h1, h2, h3, h4, h5, h6, summary, .lead, strong, b, [class*="title" i], [class*="header" i], [role="heading"]'
        );

        for (const heading of candidateHeadings) {
            if (processedNodes.has(heading)) continue;
            const headingText = (heading.textContent || '').trim();
            if (!headingText || headingText.length > 150) continue;
            if (ARTICLE_HEADLINE_EXCLUSIONS.test(headingText)) continue;

            for (const pattern of HEADING_PATTERNS) {
                if (pattern.test(headingText)) {
                    stripHeadingAndContent(heading);
                    break;
                }
            }
        }

        // B. Scan paragraphs, blockquotes, divs, and callouts
        const candidateBlocks = rootEl.querySelectorAll(
            'p, blockquote, div.ack, div[class*="ack" i], [class*="callout" i], [class*="banner" i], aside, section, footer > div, footer p, .footnote'
        );

        for (const block of candidateBlocks) {
            if (processedNodes.has(block)) continue;
            const text = (block.textContent || '').trim();

            if (isAcknowledgementText(text)) {
                const target = resolveContainer(block);
                removeElement(target);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. LIFECYCLE & MUTATION OBSERVER
    // ─────────────────────────────────────────────────────────────

    // Initial sweep as early as possible
    function runSweep() {
        scanElement(document.body || document.documentElement);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runSweep, { once: true });
    } else {
        runSweep();
    }

    // Debounced MutationObserver for dynamic SPAs and late loads
    let scanScheduled = false;
    const observer = new MutationObserver((mutations) => {
        if (scanScheduled) return;
        scanScheduled = true;

        requestAnimationFrame(() => {
            scanScheduled = false;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Element node
                        scanElement(node);
                    }
                }
            }
        });
    });

    // Start observing from documentElement immediately
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

})();
