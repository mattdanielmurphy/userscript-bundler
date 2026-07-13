## Goal
Fix duplicate Run buttons, alignment issues, and nested output execution bugs in the gemini.js userscript.

## User Feedback & Decisions
N/A

## Changes Made
- Modified `userscripts/gemini.js` `injectRunButtons` to explicitly skip `pre` tags nested inside `.gmt-inline-output` containers (`if (pre.closest(".gmt-inline-output")) return`).
- Added a `run-btn-gmt` class to the injected run buttons, and added a check to `copyBtn.parentNode` to return early if a button with that class is already present. This ensures it doesn't accidentally duplicate even if the `dataset` state gets reset.
- Adjusted flexbox styles applied to `copyBtn.parentNode` to enforce `flex-direction: row` explicitly if it isn't already a flex layout, resolving alignment issues.

## What Worked
Identified that the Run button duplication was caused by `startInline` dynamically adding a new output `<pre>` which `injectRunButtons` subsequently found and attached a Run button for, nested recursively within the previous output.

## What Didn't Work / Known Issues
None.

## Architecture Notes
Gemini code blocks are periodically parsed by `injectRunButtons` querying all `<pre>` tags. By appending our own output `<pre>` next to the code block, we inadvertently created a positive feedback loop for toolbars unless explicitly filtered.
