## Goal
Modify the userscript bundler (`bundler.cjs`) so that for userscripts broken into multiple modules (grouped entries in `script_manifest.json`), it not only includes them in the main bundle (`userscript_bundle.js`), but also compiles them into standalone executable `.user.js` files inside a dedicated output folder (`compiled/`).

## User Feedback & Decisions
- The user has an app where they inject `gemini.js` (Gemini Thread Saver) directly.
- Since it was split into modules under `userscripts/gemini-thread-saver/`, they needed a standalone compiled script file rather than extracting it from `userscript_bundle.js`.

## Changes Made
1. **Bundler Compilation Step (`bundler.cjs`)**:
   - Added Step 7: Multi-module userscript compilation logic.
   - Filters entries in `script_manifest.json` that specify a `files` array (e.g. `gemini-thread-saver`).
   - Dynamically parses headers from all sub-module files to extract and aggregate `@grant`, `@connect`, `@match`, `@name`, `@description`, and `@run-at` metadata into a unified Userscript header block.
   - Concatenates module files in exact order with source boundary comments (`/* ===== file ===== */`).
   - Performs syntax validation via Node's `vm.Script` before writing to disk.
   - Outputs compiled standalone scripts into `./compiled/<id-or-group-name>.user.js` (e.g. `compiled/gemini-thread-saver.user.js`).
2. **Feature Tracking & Documentation**:
   - Created `.devtool/features/multi-module-standalone-compilation.md` (set status to `review`).
   - Updated `FEATURES.md` and appended session entry to `DEVELOPMENT_JOURNAL.md`.

## What Worked
- Running `node bundler.cjs` successfully builds `userscript_bundle.js` and creates `compiled/gemini-thread-saver.user.js` (99.72 KB).
- `node test-grouped-bundle.cjs` regression tests pass cleanly.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- Standalone multi-module output files preserve the shared lexical IIFE wrapper structure across sub-modules while providing a standard `// ==UserScript==` header block at the top, making them directly injectable in external applications or userscript managers without needing `userscript_bundle.js`.
