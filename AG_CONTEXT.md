# Project: Userscript Bundler

## Overview
A tool for bundling userscripts, likely with a watcher and auto-bundling capabilities.

## Key Files
- `bundler.js`: Main bundling logic
- `watch-and-bundle.js`: Watcher for auto-bundling
- `userscripts/`: Source directory for userscripts
- `userscript_bundle.js`: The bundled output

## Conventions
- Uses `mv` instead of `rm` for safety (user rule)
- Updates `AG_CONTEXT.md` with durable knowledge
- Userscripts are in `userscripts/` directory
- Userscript bundle includes a **Dynamic Reload Hack** to detect local file changes and bypass manager caching by auto-reloading the page.
- YouTube Master Script features: Refresh on unavailable, toggle thumbnails, remove members-only, hide shorts, get transcript button, search exclusion, max quality, and **ignore number keys (seeking)**.
- Perplexity script features: Hides "Upgrade to Max" and "Upgrade now" banners, and removes "Try this answer with" advertisements.
- TorrentMac script: Removes fake "Download Now" buttons by text content.
- **Online Learning BC / StudyForge**: YouTube Fullscreen Fix. Uses a "Keymaster + UI" cross-frame messaging architecture to bypass D2L's nested iframe permission restrictions. Includes an 'F' key shortcut.
- **ContentConnections Enhancements**: Hides whiteboard/menu, adds "Yes (Show Sol.)" and "No (Skip Sol.)" buttons, and automates next steps based on correctness choice.
