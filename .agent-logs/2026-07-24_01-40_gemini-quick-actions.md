## Goal
Add Quick Actions dropdown and tool call execution capabilities to Gemini Enhancements in `userscript-bundler`, and align the prompt directives with auto-saving notes.

## User Feedback & Decisions
- Directives updated to instruct AI model to output `save_note` tool call JSON blocks.
- Added Quick Actions dropdown menu UI in `05-prompt-tools.js` to allow saving notes on demand directly from Gemini UI.

## Changes Made
1. **Gemini Enhancements Updates**:
   - `userscripts/gemini-enhancements/05-prompt-tools.js`: Injected `⚡ Quick Actions` dropdown for fast note-saving.
   - `userscripts/gemini-enhancements/09-page-observer.js`: Integrated `scanToolCalls` observer trigger.
   - `userscripts/gemini-enhancements/10-tool-calls.js`: Executed `save_note` requests to local archive server.
2. **Bundle Build & Standalone Output**:
   - Built `userscript_bundle.js` and compiled `compiled/gemini-enhancements.user.js`.
3. **Repository State & Pre-Flight**:
   - Ran `preflight.py` and `auto_commit.py` to auto-commit and push changes to remote repository.

## What Worked
- Pre-flight check, bundling, syntax validation, and remote git push completed without issues.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- `10-tool-calls.js` scans pre blocks in Gemini responses for `tool_call` or `json` blocks containing `{"tool": "save_note", "args": {...}}` and posts them to `http://127.0.0.1:3033/run-command`.
