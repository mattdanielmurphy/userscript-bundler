## Goal
Implement a Perplexity Thread Saver userscript that saves search threads to the local archive server, matching the Gemini Thread Saver logic.

## User Feedback & Decisions
- The user confirmed Chrome is running in debug mode on port 9222.
- The user approved the implementation plan.

## Changes Made
- Created `userscripts/perplexity.js` containing the Perplexity Thread Saver userscript.
- Updated `gemini-thread-saver-v1.0.1.ts` on the archive server to dynamically parse the thread source and write to dynamic subfolders (`perplexity/` or `gemini/`).
- Created a devtool feature ticket at `.devtool/features/perplexity-thread-saver.md`.

## What Worked
- Automatically dumping and archiving Perplexity threads locally upon reload/auto-sync.
- Badge UI injection showing accurate token count on the Perplexity search page.

## What Didn't Work / Known Issues
- Initial connection via DevTools MCP on default port 9223 failed because the Chrome debug profile was active on port 9222.

## Architecture Notes
- Perplexity threads are parsed in chronological order by querying both user messages `[class*="group/query"]` and assistant responses `.prose` in document order.
