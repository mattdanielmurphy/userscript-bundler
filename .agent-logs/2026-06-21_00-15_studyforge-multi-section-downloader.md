## Goal
Improve the StudyForge Video Downloader and Practice Questions function to support lessons that contain multiple tabbed sections (`.lo-group`) per lesson.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Updated `getCurrentTitle` to accept an optional tab reference and detect if multiple `.lo-group` widgets are present. If so, it prepends `Part X - ` (based on the group's index) to the filename to avoid duplicate name collisions.
  - Modified `downloadStudyForgeFrame` to resolve the corresponding tab for the visible video frame by matching its `data-id` and `data-type`.
  - Scoped `downloadGeoGebra` to a specific container (defaulting to `document`) to query applets only within the active tab's context.
  - Re-implemented `downloadAllVideos` to loop through all video tabs, activate them, and download content using the specific tab container selector context rather than using global document lookups.
  - Enhanced practice question scraping in `downloadAllVideos` to extract titles from the parent `.question` element's `aria-label` or fallback to `.q-title`, improving CSV subtitle labels.
  - Fixed the tab restore routine in `downloadAllVideos` to restore all originally selected tabs across all sections on the page.
- Updated [FEATURES.md](file:///Users/matthewmurphy/projects/userscript-bundler/FEATURES.md) to document multi-section support, scoped element selection, and enhanced practice question title parsing.

## What Worked
- Rebuilding the master bundle with `node bundler.js` succeeded without errors.
- Both active video matching and tab cycling are properly scoped to container sub-queries, which correctly handles multiple `.lo-group` containers on a single page.
- Question subtitles in the exported CSV now capture custom titles (like "Proof: Properties of Integrals #1") when present in `aria-label`.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- When multiple `.lo-group` sections are active, `document.querySelector('li.tab.viewed.selected')` only returns the first selected tab in the DOM. Scoping queries to the specific tab's matching content container is essential for correct multi-section behavior.
