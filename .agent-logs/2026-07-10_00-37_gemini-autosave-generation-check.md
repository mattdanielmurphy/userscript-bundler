## Goal
Prevent the Gemini userscript (`gemini.js`) from triggering thread auto-saves (which backup the conversation to the local server) while the model is actively streaming/generating a response. It should wait to sync/save the thread until the response has fully completed.

## User Feedback & Decisions
The user complained that the thread was saved every 10 seconds or so while Gemini had new loading text updates. The synchronization should check if output generation is ongoing, and only trigger a debounced save when it finishes.

## Changes Made
- Modified `userscripts/gemini.js`:
  - Added an `isCurrentlyGenerating()` check in the MutationObserver's export handler.
  - Detected active generation by checking if a stop-generating button is present (using an regex-based aria-label matching `/stop/i` along with `/generat|respons|stream/i`).
  - Added a secondary check that prevents saving if the very last item in `user-query, model-response` is a `user-query` (indicating a response is pending start).
  - Cleaned up trailing/duplicate whitespace.
- Updated `FEATURES.md` to document the GMT Archive improvements.
- Created and transitioned feature tracking file `.devtool/features/gemini-save-fix.md` to the `review` state.

## What Worked
- Verification that `node bundler.js` successfully wraps and bundles all scripts, producing `userscript_bundle.js`.
- The stop button check + trailing element checks reliably intercept intermediate mutation-triggered saves.

## What Didn't Work / Known Issues
None.

## Architecture Notes
- Gemini dynamically mounts and updates `<model-response>` elements. A `MutationObserver` on the body catches these updates.
- During active generation, the `button[aria-label="Stop generating"]` (or similar) is inserted into the DOM. Its absence is a reliable indicator that the model has concluded writing its output.
