# Development Journal

## 2026-07-21
- **Refactor Gemini Thread Saver into Grouped Source Files:** Extended `bundler.js` and `watch-and-bundle.js` with script group capabilities and split `gemini.js` into 10 ordered source files sharing a single IIFE lexical scope under `userscripts/gemini-thread-saver/`. See [.agent-logs/2026-07-21_18-25_gemini-grouped-source-refactor.md](file:///Users/matt/projects/userscript-bundler/.agent-logs/2026-07-21_18-25_gemini-grouped-source-refactor.md).

## 2026-07-22
- **Multi-Module Standalone Compilation:** Updated `bundler.cjs` to compile multi-module (grouped) userscripts like Gemini Thread Saver into standalone `.user.js` files in `./compiled/`. Link to agent log: [.agent-logs/2026-07-22_02-45_multi-module-standalone-compilation.md](file:///Users/matt/projects/userscript-bundler/.agent-logs/2026-07-22_02-45_multi-module-standalone-compilation.md).

