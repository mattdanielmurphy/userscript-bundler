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
- YouTube Master Script features: Refresh on unavailable, toggle thumbnails, remove members-only, hide shorts, get transcript button, search exclusion, max quality, and **ignore number keys (seeking)**.
- Perplexity script features: Hides "Upgrade to Max" and "Upgrade now" banners, and removes "Try this answer with" advertisements.
