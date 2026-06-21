## Goal
Provide a user notification system to signal when all files (videos, applets, and question CSVs) have finished downloading.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Created a `showToast(message, duration)` helper utility that injects a styled notification bubble (blue gradient, rounded corners, subtle drop shadow, slide-up animation) into the body.
  - Linked `showToast` to trigger inside the "Download All" button's click handler, notifying the user when the entire batch download finishes successfully or if an error is caught.
- Updated [FEATURES.md](file:///Users/matthewmurphy/projects/userscript-bundler/FEATURES.md) to note this capability.

## What Worked
- Rebuilt bundle successfully.
- Non-blocking toast appears exactly when batch downloads finish.
- The animation is smooth and fits the visual design.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- The toast uses CSS transitions (`all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)`) and triggers a DOM offset reflow right before changing styles to guarantee correct entrance animation regardless of layout timing.
