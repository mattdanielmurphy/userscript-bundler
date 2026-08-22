# Fix Context Chip Dismissal Button & Accidental Click Injection

**Date**: 2026-08-21 21:30  
**Project**: userscript-bundler (`gemini-enhancements`)

## Root Cause
In `07-terminal.js` under `renderContextPills()`:
1. The close button (`×`) was a tiny 14px text span with zero extra padding or min-dimensions, making the click target very small.
2. The entire pill element had an `onclick` listener configured to call `this.injectToChat(ctx.output)`, which pasted the entire context markdown block into the editor when clicking anywhere on the pill.
3. Missing the tiny close target caused accidental clicks on the pill body, triggering injection into the textarea. Typing keyword-triggering words repeatedly multiplied chips in a cascading manner.

## Changes Made
1. **Enlarged Close Button Click Target**:
   - Increased font-size to 16px.
   - Added `display: inline-flex; align-items: center; justify-content: center; min-width: 20px; min-height: 20px; padding: 4px 6px; margin: -4px -6px -4px 2px; border-radius: 50%;`.
   - Added hover feedback (`backgroundColor: rgba(255, 255, 255, 0.15)` and full opacity).
2. **Removed Click-to-Paste on Chip Body**:
   - Removed `pill.onclick = () => { this.injectToChat(ctx.output) }`.
   - Changed pill cursor from `pointer` to `default`.
   - Context is now exclusively injected upon actual message submission (or previewed via hover tooltip), preventing accidental pasting into the editor.
3. **Rebuilt Bundle**:
   - Ran `bun run build` to update compiled standalone scripts and `userscript_bundle.js`.
