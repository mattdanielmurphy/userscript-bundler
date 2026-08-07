# Fix Multi-Line System Directive Stripping in Gemini Web UI

## Problem
In Gemini Web UI, injected system directives (`[SYSTEM CONTEXT & DIRECTIVES: ... ]`) were remaining visible in the rendered user prompt box.

## Root Cause
Gemini Web UI splits multi-line user queries into individual `<p class="query-text-line">` elements inside `<user-query>`. The previous regex matching was running on single `<p>` nodes independently. Since the opening `[SYSTEM CONTEXT & DIRECTIVES:` and closing `]` were on different `<p>` lines, single-line regex matching failed for every line in the block.

## Solution
1. Updated `03-timestamps.js` to iterate over query containers (`user-query`) and track `insideSysDirective` state across paragraph elements (`pNodes`).
2. Cleared clean content and set `display: none` for paragraph elements containing system directive lines so they are visually hidden without leaving empty DOM gaps.
3. Updated `toggleRawPayloadMode` to support toggling display between raw payload mode and clean mode.
4. Rebuilt userscript bundle (`userscript_bundle.js` and `compiled/gemini-enhancements.user.js`).
