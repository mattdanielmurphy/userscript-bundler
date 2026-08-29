# Development Journal

## 2026-07-21
- **Refactor Gemini Thread Saver into Grouped Source Files:** Extended `bundler.js` and `watch-and-bundle.js` with script group capabilities and split `gemini.js` into 10 ordered source files sharing a single IIFE lexical scope under `userscripts/gemini-thread-saver/`. See [.agent-logs/2026-07-21_18-25_gemini-grouped-source-refactor.md](file:///Users/matt/projects/userscript-bundler/.agent-logs/2026-07-21_18-25_gemini-grouped-source-refactor.md).

## 2026-07-22
- **Multi-Module Standalone Compilation:** Updated `bundler.cjs` to compile multi-module (grouped) userscripts like Gemini Thread Saver into standalone `.user.js` files in `./compiled/`. Link to agent log: [.agent-logs/2026-07-22_02-45_multi-module-standalone-compilation.md](file:///Users/matt/projects/userscript-bundler/.agent-logs/2026-07-22_02-45_multi-module-standalone-compilation.md).

## 2026-07-24
- **Gemini Quick Actions & Tool Call Execution:** Added Quick Actions dropdown menu and `save_note` tool call executor to Gemini Enhancements. Link to agent log: [.agent-logs/2026-07-24_01-40_gemini-quick-actions.md](file:///Users/matt/projects/userscript-bundler/.agent-logs/2026-07-24_01-40_gemini-quick-actions.md).


- **Fix tool call execution logic:** Updated window.scanToolCalls to always display run button and enforce auto-execution condition. [See agent log](file:///Users/matt/.gemini/antigravity/brain/8130b9a3-f269-4c96-8be9-89a2e0c4d68c/agent-logs/2026-07-28_14-53_tool-calls-fix.md)
- **Tool Call Directive Update:** Updated `gemini-enhancements/05-prompt-tools.js` to refine the tool call schema and specify `run_automatically` behavior.
- **Refine tool execution logic:** Updated  to enable run button unconditionally and adjust auto-execute condition. [2026-07-28_15-00-refine-tool-execution.md](file:///Users/matt/.gemini/antigravity/brain/7ac774e3-9dea-4924-b8df-c7a48b731a2d/2026-07-28_15-00-refine-tool-execution.md)
- **Refine tool execution logic:** Updated 10-tool-calls.js to enable run button unconditionally and adjust auto-execute condition. [2026-07-28_15-00-refine-tool-execution.md](file:///Users/matt/.gemini/antigravity/brain/7ac774e3-9dea-4924-b8df-c7a48b731a2d/2026-07-28_15-00-refine-tool-execution.md)


## 2026-08-06
- **Fix Multi-Line System Directive Stripping:** Updated `03-timestamps.js` to track multi-line `[SYSTEM CONTEXT & DIRECTIVES:]` state across paragraph nodes in `user-query` containers and hide system directive lines from prompt display. See [agent-logs/2026-08-06_19-56_fix_system_directives_stripping.md](file:///Users/matt/projects/userscript-bundler/agent-logs/2026-08-06_19-56_fix_system_directives_stripping.md).

## 2026-08-16
- **YouTube Highlight Reel URL Parameters & Skill:** Added URL parameter parsing (`highlights`, `reel`, `segments`), automated segment seeking/skipping, heatmap progress bar rendering, and shareable link generation (`copyHighlightReelUrl`) to `youtube-master.user.js`. Created `_link-youtube-highlights` skill in `ai-os`. See [agent-logs/2026-08-16_18-10_youtube-highlight-url-params.md](file:///Users/matt/projects/userscript-bundler/agent-logs/2026-08-16_18-10_youtube-highlight-url-params.md).
## 2026-08-21
- **Context Chip Dismiss Target & Click Injection Fix:** Enlarged the close target (`×`) on context pills with circular hitboxes and hover highlights, and eliminated body click paste-to-chat injection to prevent accidental cascaded pastes when typing or dismissing chips. See [agent-logs/2026-08-21_21-30_context-chip-dismiss-fix.md](file:///Users/matt/projects/userscript-bundler/agent-logs/2026-08-21_21-30_context-chip-dismiss-fix.md).

## 2026-08-29
- **Table Visibility & Chat History Clipping Fix:** Overrode CSS containment and `content-visibility: auto` on historical `.conversation-container` nodes and dynamically expanded ancestor wrapper chains so tables overflow naturally into margins without clipping. See [agent-logs/2026-08-29_00-54_gemini-table-visibility-fix.md](file:///Users/matt/projects/userscript-bundler/agent-logs/2026-08-29_00-54_gemini-table-visibility-fix.md).
