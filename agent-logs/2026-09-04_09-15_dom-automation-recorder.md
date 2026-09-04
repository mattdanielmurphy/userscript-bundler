# 2026-09-04 09:15 - DOM Automation Recorder & Generator

## Summary
Created and bundled a cross-domain, multi-page DOM action recorder userscript (`userscripts/dom-automation-recorder.user.js`) that captures user interactions (clicks, debounced text inputs, dropdown selections, radio/checkbox changes, form submissions, navigation/redirects) and generates runnable Playwright and Puppeteer automation scripts.

## Key Changes
- **Cross-Domain Persistence via GM Storage**: Utilized `GM_getValue`/`GM_setValue` (with fallback to `localStorage`) to ensure session state, active recording flags, and action logs seamlessly survive full page navigations and cross-origin redirects (e.g. SSO auth, external checkouts, subdomains).
- **Session Lifecycle & Global Triggers**:
  - Hotkey trigger: `Alt+Shift+R` (or `Option+Shift+R` on macOS) toggles recording session on any website.
  - Menu commands: Registered Tampermonkey menu items for starting, stopping, pausing, exporting, and clearing.
  - Early restoration: Automatically checks `__DOM_RECORDER_ACTIVE__` at `document-start` to re-attach listeners and log navigation transitions without dropped events.
- **Robust Event & Locator Engine**:
  - Semantic target resolution via `closest()` to avoid capturing decorative inner SVG/span clicks.
  - Input debouncing (500ms) with synchronous flushing on `blur`, `click`, `submit`, `beforeunload`, and `pagehide` so no trailing keystrokes are lost during fast form submissions.
  - Multi-strategy locators: extracts `best`, `testId`, `name`, stable `id`, `text`, `label`, `cssPath`, and `xpath`.
- **In-Browser HUD & Code Generator**:
  - Draggable floating HUD showing live action counts, pulsing recording dot, and domain badge.
  - Interactive export modal with tabbed views for Playwright (`page.goto()`, `page.locator().fill()`, `page.locator().click()`), Puppeteer, and Raw JSON with 1-click clipboard copy and file downloads.
- **Bundler Integration**: Added entry to `script_manifest.json` and compiled into `userscript_bundle.js` and `userscript_bundle.user.js`.
