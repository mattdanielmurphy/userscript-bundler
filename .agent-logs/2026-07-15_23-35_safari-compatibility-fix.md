## Goal
Resolve `ReferenceError: Can't find variable: GM_getValue` in `gemini.js` (and potentially other scripts like `perplexity.js`) when run directly within the Safari "Userscripts" extension.

## User Feedback & Decisions
- The user switched to Safari and pointed the "Userscripts" extension directly at the userscripts directory.
- The user requested a fix for the `GM_getValue` ReferenceError but requested not to fork the Safari Userscripts extension itself.

## Changes Made
- Modified [gemini.js](file:///Users/matt/projects/userscript-bundler/userscripts/gemini.js) and [perplexity.js](file:///Users/matt/projects/userscript-bundler/userscripts/perplexity.js):
  - Added `@grant GM.getValue`, `@grant GM.setValue`, and `@grant GM.xmlHttpRequest` to metadata blocks.
  - Implemented automatic legacy synchronous `GM_*` API polyfills (including `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand`, `GM_unregisterMenuCommand`, and `GM_xmlhttpRequest`) within the scripts' main IIFEs to fall back to `localStorage` (for values) and bound `GM.xmlHttpRequest` (for network requests) when the legacy sync equivalents are not natively supported by the host extension.
- Updated [README.md](file:///Users/matt/projects/userscript-bundler/README.md) to add `@grant GM.xmlHttpRequest` to the dynamic loader script template.

## What Worked
- Re-ran `node bundler.js` successfully with no warnings.
- The polyfills fallback gracefully to legacy browser storage and modern asynchronous APIs.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- The Safari Userscripts extension (by quoid) implements modern asynchronous `GM.*` APIs but does not natively support the legacy synchronous `GM_*` storage/command APIs.
- The polyfill uses `localStorage` with a prefix (`__gm_`) to implement synchronous value persistence.
