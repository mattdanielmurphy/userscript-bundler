# Project: Userscript Bundler

## Overview
A tool for bundling userscripts, likely with a watcher and auto-bundling capabilities.

## Key Files
- `bundler.js`: Main bundling logic
- `watch-and-bundle.js`: Watcher for auto-bundling
- `userscripts/`: Source directory for userscripts
- `userscript_bundle.js`: The bundled output

## Conventions
- **Safety**: Uses `mv` instead of `rm` for recovery.
- **Sync**: `userscript_bundle.js` is strictly ignored and untracked to prevent build artifacts in Git.
- **Durable Knowledge**: Update `AG_CONTEXT.md` with repo changes.
- **Structure**: Userscripts live in `userscripts/`.
- **Dynamic Reload Hack**: The bundle includes a script to detect local file changes and bypass manager caching.
- YouTube Master Script features: Refresh on unavailable, toggle thumbnails, remove members-only (enhanced for sidebar), hide shorts, hide low view videos (<1k), get transcript button, search exclusion, max quality, and **ignore number keys (seeking)**.
- Perplexity script features: Hides "Upgrade to Max" and "Upgrade now" banners, removes "Try this answer with" advertisements, and **automatically focuses the input field when a new thread is created**.
- TorrentMac script: Removes fake "Download Now" buttons by text content.
- **Online Learning BC / StudyForge**: YouTube Fullscreen Fix. Uses a "Keymaster + UI" cross-frame messaging architecture to bypass D2L's nested iframe permission restrictions. Includes an 'F' key shortcut.
- **ContentConnections Enhancements**: Hides whiteboard/menu, adds "Yes (Show Sol.)" and "No (Skip Sol.)" buttons, and automates next steps based on correctness choice.
