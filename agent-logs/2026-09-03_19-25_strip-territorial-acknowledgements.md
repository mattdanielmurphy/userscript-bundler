# Work Log: Strip Territorial & Land Acknowledgements

**Date:** 2026-09-03 19:25  
**Author:** Antigravity / Gemini  
**Scope:** `userscript-bundler`  

## Problem Statement
User requested automatic removal of territorial and land acknowledgements across all web pages (such as the University of Alberta footer statement and equivalent institutional banners, course syllabus callouts, and footers), functioning like an adblocker.

## Solution Implemented
1. **Created Global Userscript:**
   - Authored [`userscripts/strip-territorial-acknowledgements.user.js`](file:///Users/matt/projects/userscript-bundler/userscripts/strip-territorial-acknowledgements.user.js).
   - Configured with `@match *://*/*` and `@run-at document-start`.
2. **Instant Preemptive CSS Injection:**
   - Injects zero-FOUC hiding rules at `document-start` targeting known acknowledgement classes, IDs, ARIA labels, and data attributes (including U of A `.ack` and standard institutional classes).
3. **Smart Heading & Text Content Scanner:**
   - Detects standalone acknowledgement headings (`HEADING_PATTERNS`) while explicitly excluding news/discussion headlines (`ARTICLE_HEADLINE_EXCLUSIONS`).
   - Detects high-confidence acknowledgement phrases (e.g. "primarily located on the territory of Néhiyaw", Treaties 6/7/8, "respects the sovereignty, lands, histories", "traditional, ancestral, and unceded territory", traditional custodians) and multi-match medium markers.
   - Climbs to dedicated semantic UI containers (`div.ack`, sections, aside, callouts, cards) or prunes heading + sibling paragraphs without breaking surrounding page layout or protected elements (`body`, `main`, `article`).
   - Uses debounced `MutationObserver` with `WeakSet` caching for dynamic SPAs and late-rendered content.
4. **Registration & Bundling:**
   - Registered entry in [`script_manifest.json`](file:///Users/matt/projects/userscript-bundler/script_manifest.json).
   - Migrated `package.json` build/test scripts to `bun` and bundled into `userscript_bundle.js` and iCloud synced standalone bundle.
5. **Headless Verification:**
   - Tested in headless Chrome across 4 test cases (U of A footer, generic banner, standalone syllabus paragraph, and false positive news article protection). All 4 passed.
