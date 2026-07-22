# Userscript Bundler & Control Center

A Node.js-based automation system that creates a single, CSP-safe JavaScript bundle for Tampermonkey userscripts, coupled with an embedded cross-site **Userscript Control Center** and local control API.

## Features

- **Embedded Control Center:** Open on any webpage with `Alt+Shift+U` or via Tampermonkey menu `Open Userscript Control Center`.
- **Runtime Enablement:** Enable or disable individual userscripts at runtime via GM storage (applies after page reload).
- **Targeted Git Rollback:** View script-local Git commit history and perform a targeted restore of only that specific userscript's declared source files from a chosen commit.
- **Auto Rebuilding:** Rebuilds the local bundle automatically during restores or via the UI / CLI (`pnpm build`).

## Master Userscript Configuration

Install one master userscript in Tampermonkey:

```javascript
// ==UserScript==
// @name         Local Userscript Dynamic Loader
// @version      0.2
// @description  Loads local userscripts from bundle in ~/projects/userscript-bundler
// @match        *://*/*
// @run-at       document-start
// @require      file:///Users/matt/projects/userscript-bundler/userscript_bundle.js
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        GM_addElement
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      127.0.0.1
// ==/UserScript==
```

## Control Center UI

Press **`Alt+Shift+U`** or click **Open Userscript Control Center** in the Tampermonkey menu on any page.

- **Enable / Disable:** Toggle scripts on/off without modifying source code.
- **Script History:** View recent commits for standalone or grouped source paths.
- **Restore Version:** Click **Restore** on any commit to rollback source files for that script, rebuild the bundle, and commit the rollback to Git.

## Bundling Commands

- **Build bundle:** `pnpm build`
- **Run tests:** `pnpm test`

For full API specifications, see [docs/userscript-control-api.md](docs/userscript-control-api.md).
