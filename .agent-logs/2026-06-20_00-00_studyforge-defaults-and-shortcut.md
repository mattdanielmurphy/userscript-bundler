## Goal
Make "no caption" the default option when capturing frames using the StudyForge downloader userscript, allowing one-click downloads, and map `Opt+S` to save a frame directly with no caption.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Removed pre-checking of the current cue in `showCCPickerWithCues` to default to an empty text area.
  - Auto-focused the "Download" button in both caption/notes picker modals on mount.
  - Added Escape (cancel) and Enter (confirm) key event handlers to both modals for faster keyboard interactions.
  - Updated `downloadStudyForgeFrame` to accept a `directNoCaption` flag.
  - Added a global `keydown` event listener to capture `Opt+S` (physical `KeyS` with `altKey` modifier) to download the frame immediately with no caption.

## What Worked
- Re-ran the bundler successfully.
- Code matches physical keyboard inputs (`e.code === 'KeyS'`) ensuring cross-layout compatibility for Option+S on macOS.
- Modal confirm buttons are auto-focused.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- The project automatically bundles all files inside the `userscripts/` directory into a single bundle file `userscript_bundle.js` which is loaded locally by browser extensions.
