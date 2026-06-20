## Goal
Extend the "Download All Videos" floating button function to also scrape and download all practice questions on the StudyForge page as a CSV file.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Appended a question scraping and downloading routine to `downloadAllVideos`.
  - The routine extracts `.q-preview` subtitles, texts, and answers (with common class heuristics), generates a standard CSV structure, and downloads it using a Blob URL named `<Lesson Header> - Practice Questions.csv`.
- Updated [FEATURES.md](file:///Users/matthewmurphy/projects/userscript-bundler/FEATURES.md) to reflect the new capability.

## What Worked
- Successful bundler build.
- Export of CSV is clean, handles escaping of nested quotes properly, and names files according to the active lesson context.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- Using Blob URLs (`new Blob([csv], { type: 'text/csv' })`) is preferred over simple `data:text/csv` string encoding because it bypasses browser URL length limit restrictions and character encoding glitches for large sets of questions.
