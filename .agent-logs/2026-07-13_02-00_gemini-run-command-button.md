## Goal
The user wanted a new feature to add a "Run" button to bash command code blocks in the Gemini UI via their userscript, which sends the command to their existing local backend to execute in a detached `tmux` session.

## User Feedback & Decisions
- The user requested we start with just executing the command in the background, preferably a tmux session they can tap into.
- Approved implementation plan automatically.

## Changes Made
1. **Backend (`/Users/matt/projects/gemini-thread-sync/gemini-thread-saver-v1.0.1.ts`)**:
   - Added `POST /run-command` endpoint.
   - Saves command payload to a temporary bash script and spawns a detached `tmux new-session` pointing to the script.
2. **Frontend (`/Users/matt/projects/userscript-bundler/userscripts/gemini.js`)**:
   - Implemented `injectRunButtons` observer logic to find code blocks labeled or containing `bash`, `sh`, or `shell`.
   - Injected a "Run 🚀" button beside the native copy button.
   - The button securely re-uses the existing `gmt_archive_secret` key saved in `GM_getValue`.
3. **Docs**:
   - Updated `FEATURES.md` in `userscript-bundler`.

## What Worked
- Reusing the existing secret and backend express-like loopback server made adding the endpoint easy.
- Tmux spawn works well for detached, monitorable executions.

## What Didn't Work / Known Issues
- Gemini's DOM structure for code blocks frequently changes. The current heuristic goes up 3 parents to find the `code-block` container and scans for language tags. If the DOM significantly changes, the Run button might stop appearing.

## Architecture Notes
- The userscript intercepts network requests on `batchexecute`, but the custom features are added via basic DOM mutation observers.
- The `gemini-thread-saver-v1.0.1.ts` backend is a raw `node:http` loopback server without express.
