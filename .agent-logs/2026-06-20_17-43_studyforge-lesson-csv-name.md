## Goal
Omit video-specific details from the practice questions CSV filename, using just the lesson's main path title.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Extracted the selector-querying path construction logic from `getCurrentTitle` into a helper function `getLessonTitle`.
  - Refactored `getCurrentTitle` to call `getLessonTitle` for clean title formatting.
  - Updated the CSV downloading step inside `downloadAllVideos` to use `getLessonTitle` instead of `getCurrentTitle`.

## What Worked
- Successful bundler build.
- CSV files are now cleanly named without the active video's sub-header or index (e.g. `Calculus - Functions - Compositions and Transformations of Functions (4) - Practice Questions.csv`).

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- Extracted helper `getLessonTitle()` keeps title computation logic DRY.
