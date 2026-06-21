## Goal
Fix a regression where the "Download All Videos" and practice questions features did not download any videos or GeoGebra files.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Fixed the container selector `document.querySelector` queries in `downloadAllVideos` and `Alt+V` keyboard handler to explicitly match tag names `.element` or `section`.
  - This prevents the selector from incorrectly matching the `li.tab` element itself (which also had the same `data-id` and `data-type` attributes and appeared earlier in the DOM, but lacked any `<video>` or iframe children).

## What Worked
- Rebuilding the userscript bundle succeeded.
- Target elements are resolved correctly by specifying tags, bypassing `li.tab` elements.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- DOM element order determines which element is matched by `querySelector`. Always restrict query selectors to the expected container tag names (e.g. `section` or `.element`) when matching shared attributes (like `data-id` and `data-type`) between tab controls and their content widgets.
