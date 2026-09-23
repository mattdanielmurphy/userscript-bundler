# Canvas 37090 AIF Bulk Downloader

- Added `userscripts/canvas-37090-aif-bulk-downloader.user.js` for exactly `https://canvas.ualberta.ca/courses/37090/modules`.
- The script registers a Tampermonkey menu command, finds all `.aif` module links, reads each enclosing `Attachment_<fileId>` class, and invokes Canvas's direct file download route at a one-second cadence.
- The final report uses one `console.log(report)` call so DevTools receives an expandable object, including partial results after an error.
- Verified JavaScript syntax with `node --check`; `bun` was not available in the shell. The existing uncommitted `userscript_bundle.user.js` was not touched.
- Follow-up: replaced synthetic anchor clicks with `GM_download` and await its completion before starting the next file. Each completed file now receives a randomized 3.5–6.5 second pause before the next request.
- Follow-up: log one immediate, live `[aif-bulk-downloader]` report object. If the installed loader lacks `GM_download`, download one file via awaited `GM_xmlhttpRequest`, then save that completed blob before the next randomized pause and request.
- Follow-up: captured live evidence of Tampermonkey `not_whitelisted` errors. Added `@connect canvas.ualberta.ca` and fail-fast reporting that tells the user to add the same connect directive to the installed master userscript.
