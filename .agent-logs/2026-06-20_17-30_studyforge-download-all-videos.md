## Goal
Add a "Download All Videos" floating button to the StudyForge userscript. It should cycle through all video tabs on the page, wait for dynamic loading, and download each video using the existing naming scheme.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Created `downloadAllVideos` function that queries video tabs (`li.tab` and other selectors), clicks through each sequentially, waits 1000ms for dynamic initialization, and calls `downloadVideoFile` with the correct name and skipping check.
  - Added `#sf-ltx-all-btn` stylesheet with indigo-purple styling at `bottom: 132px` to sit cleanly above the counter button.
  - Updated `refreshCounter` to show/hide the "Download All" button contextually alongside other controls.
  - Added `allBtn` generation, event handling, and progress styling (`Downloading...` state indicator) to `createUI`.
- Created [FEATURES.md](file:///Users/matthewmurphy/projects/userscript-bundler/FEATURES.md) to document features across all userscripts in the project.

## What Worked
- Successful bundler rebuild (`node bundler.js`).
- Floating button renders and is positioned correctly above other controls.
- Cycling and calling existing `downloadVideoFile` correctly preserves the standard naming format: `<Lesson Number> - <Video Title> (<Video Num>).mp4`.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- The bundler builds everything to `userscript_bundle.js` which is loaded directly via local `file://` reference in Tampermonkey.
