## Goal
Fix run button layout issues, tooltip inheritance, and context pill reappearance after dismissal.

## User Feedback & Decisions
User reported that the run button had the "Copy code" tooltip, that it pushed the download button above the other buttons, and that the context pills reappeared after clicking 'x'.

## Changes Made
- Used Chrome DevTools evaluate_script to inspect the DOM of the copy button. Identified it is wrapped in a `<gem-icon-button>` element.
- Modified `userscripts/gemini.js` to insert the run button *outside* of the `<gem-icon-button>` (and other known wrappers like `button-group`), inserting it directly into `.luminous-actions-container`. This prevents the run button from inheriting the wrapper's tooltip and fixes the layout stacking issue.
- Updated `updateContextPill` in `gemini.js` to only set `active: true` if the session was not previously registered. This allows the backend polling to update the output text without forcefully restoring the context pill if the user dismissed it.

## What Worked
Using DevTools via the MCP to directly query the DOM structure allowed for an immediate and accurate diagnosis of the tooltip and layout bugs.

## What Didn't Work / Known Issues
None.

## Architecture Notes
Gemini's code block action buttons are heavily wrapped with custom components (`<gem-icon-button>`) that carry the tooltips and styles. Injecting custom buttons requires targeting the shared container (`.luminous-actions-container`) rather than the immediate parent of the raw `<button>`.
