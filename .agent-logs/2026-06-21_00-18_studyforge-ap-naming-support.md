## Goal
Update the StudyForge Video Downloader title scheme to mark downloads in secondary blocks with `[AP]` instead of a `Part X - ` prefix.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Updated `getCurrentTitle` to check if a tab is in a secondary block (group index > 1).
  - If so, it updates the unit/lesson title section from `Calculus` to `Calculus [AP]` (or prepends `[AP]` if the subject differs), and removes the standard `Part X - ` video title prefix.
  - Updated the CSV exporter filename in `downloadAllVideos` to apply the same `[AP]` tag logic if multiple groups are found on the page.

## What Worked
- Bundle successfully compiled.
- Files download as `Calculus [AP] - UNIT NAME ...` for secondary block tabs, cleanly segregating AP content without video name clutter.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- None.
