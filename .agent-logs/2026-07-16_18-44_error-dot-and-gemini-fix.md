## Goal
- Replace invasive userscript error notifications (`GM_notification` popups) with a contained, on-screen red dot indicator.
- Fix a syntax error in `userscripts/gemini.js` that causes a `TypeError`.

## User Feedback & Decisions
- The user confirmed the proposed changes and requested fixing the syntax error in `gemini.js` alongside the error dot implementation.

## Changes Made
- **`userscripts/gemini.js`**: Added missing semicolon `;` after the IIFE definition on line 3187 to prevent incorrect chaining of the subsequent IIFE.
- **`bundler.js`**:
  - Removed the `GM_notification` grant from auto-generated list of grants since it's no longer used.
  - Replaced trying to call `GM_notification` in runtime/try-catch error blocks with a custom `showErrorDot` implementation.
  - Implemented the error dot to pulse at the bottom-right corner of the page, aggregate multiple errors, copy all stack traces to clipboard on click with a green feedback indicator, and dismiss on double click.
- **`README.md`**: Updated loader instructions/grants to align with the generated set.
- **`AG_CONTEXT.md`**: Documented the new error dot reporting convention.

## What Worked
- `node -c userscripts/gemini.js` successfully validates syntax.
- `node bundler.js` successfully builds the entire userscript bundle without any sync warnings or error output.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- The error dot uses CSS styles injected into the DOM at runtime. If an error is caught at `document-start` before `document.body` is created, the dot is queued and rendered as soon as `document.body` becomes available.
