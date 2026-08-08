# iCloud Userscripts One-Way Sync & Standalone Bundle Header

## Summary
- Added automatic userscript metadata header block generation (`generateUserscriptHeader`) to `bundler.cjs` containing standard baseline grants/connects plus all dynamically scanned directives.
- Updated `bundler.cjs` to generate `userscript_bundle.user.js` and automatically one-way sync it directly into the Safari Userscripts iCloud directory: `/Users/matt/Library/Mobile Documents/com~apple~CloudDocs/Userscripts/userscript_bundle.user.js`.
- Verified seamless compilation and synchronization when executed by the active LaunchAgent file watcher.
