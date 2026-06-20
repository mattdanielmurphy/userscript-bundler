## Goal
Enable automatic downloading of GeoGebra interactives as standalone offline HTML files during "Download All" operations and manually via keyboard shortcut.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Created `downloadGeoGebra(fullTitle, bypassCheck)` which extracts data parameters from the GeoGebra element, builds a self-contained HTML wrapper embedding GGBApplet, and triggers the download.
  - Implemented `hasDownloadedGeoGebra` and `markGeoGebraDownloaded` tracking logic storing keys in localStorage (`sf_downloaded_geogebra`) to skip duplicate downloads.
  - Configured `downloadAllVideos` to fallback to downloading a GeoGebra offline applet if no video element is found on the active tab.
  - Integrated a fallback in the `Opt+V` keydown handler to try downloading the GeoGebra interactive if no video exists on screen.
- Updated [FEATURES.md](file:///Users/matthewmurphy/projects/userscript-bundler/FEATURES.md) to log this feature.

## What Worked
- Successful bundle rebuild.
- GeoGebra elements are correctly parsed and standalone HTML packages are downloaded matching the standard filename scheme.
- Prevents duplication using local storage keys.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- Standalone HTML files are generated with a reference to GeoGebra's CDN script (`deployggb.js`) to bootstrap the applet offline or standalone.
