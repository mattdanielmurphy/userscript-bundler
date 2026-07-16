## Goal
Perform a one-time cross-manager compatibility audit and repair of the userscript workspace to achieve full compatibility between Tampermonkey and the Safari "Userscripts" extension without duplicate modules or codebase forks.

## User Feedback & Decisions
- The user pointed the Safari "Userscripts" extension at the local userscripts folder.
- They wanted a single canonical codebase and a centralized compatibility module (`compat.js`) that is injected dynamically by `bundler.js`.
- The user requested specific focus on the Gemini "is not a function" error.

## Changes Made
- Created [compat.js](file:///Users/matt/projects/userscript-bundler/userscripts/compat.js) providing the global `gm` compatibility namespace:
  - Synchronous storage wrappers (using `GM_getValue` / `GM_setValue`, falling back to prefix-scoped `localStorage`).
  - Asynchronous storage wrappers (using modern `GM.*` promise APIs).
  - Menu command wrappers (graceful no-ops when unsupported).
  - A robust XHR request adapter that seamlessly handles legacy `GM_xmlhttpRequest` and case-insensitive modern formats (`GM.xmlHttpRequest` / `GM.xmlhttpRequest`), with graceful rejection and user alerts if unsupported.
  - Centralized style injector (`gm.addStyle`).
- Updated [bundler.js](file:///Users/matt/projects/userscript-bundler/bundler.js) to exclude `compat.js` from manifest scanning and prepend its content inside the bundle's execution context.
- Refactored [gemini.js](file:///Users/matt/projects/userscript-bundler/userscripts/gemini.js) and [perplexity.js](file:///Users/matt/projects/userscript-bundler/userscripts/perplexity.js) to remove duplicate inline polyfills and utilize `gm.*` API endpoints.
- Updated [fix-aistudio-lag-1.0.user.js](file:///Users/matt/projects/userscript-bundler/userscripts/fix-aistudio-lag-1.0.user.js) to call `gm.addStyle` instead of `GM_addStyle`.
- Removed unused `@grant` blocks from [apple-music-embedded-player.user.js](file:///Users/matt/projects/userscript-bundler/userscripts/apple-music-embedded-player.user.js).
- Updated [FEATURES.md](file:///Users/matt/projects/userscript-bundler/FEATURES.md) to record the cross-manager compatibility layer.
- Updated task status to `review` in [.devtool/features/cross-manager-compatibility.md](file:///Users/matt/projects/userscript-bundler/.devtool/features/cross-manager-compatibility.md).

## What Worked
- Re-running `node bundler.js` compiled the bundle `userscript_bundle.js` successfully (size: 1437.51 KB).
- The wrapper seamlessly resolved case-sensitivity issues and missing sync methods.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- Safari's Userscripts extension natively supports asynchronous promise-based `GM.getValue` / `GM.setValue` but lacks legacy synchronous `GM_` storage functions and menu registration commands.
- The runtime TypeError "is not a function" was caused by the lack of `GM_xmlhttpRequest` in the extension context and the script trying to directly call it, which has now been wrapped in a feature-detecting `gm.xmlHttpRequest` call.
