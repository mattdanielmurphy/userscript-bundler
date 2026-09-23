# Canvas 37090 AIF Bulk Downloader

- Added `userscripts/canvas-37090-aif-bulk-downloader.user.js` for exactly `https://canvas.ualberta.ca/courses/37090/modules`.
- The script registers a Tampermonkey menu command, finds all `.aif` module links, reads each enclosing `Attachment_<fileId>` class, and invokes Canvas's direct file download route at a one-second cadence.
- The final report uses one `console.log(report)` call so DevTools receives an expandable object, including partial results after an error.
- Verified JavaScript syntax with `node --check`; `bun` was not available in the shell. The existing uncommitted `userscript_bundle.user.js` was not touched.
