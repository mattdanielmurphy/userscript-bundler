# YouTube Transcript Retrieval Improvements

## Changes
- Updated `userscripts/youtube-master.user.js` to replace repeated 50 ms full-DOM polling with mutation-observer waits for the transcript container.
- The main button handler now identifies transcript panels directly and no longer waits for YouTube's continuation spinner to disappear before extraction; internal-data parsing, DOM parsing, and virtualized scroll-sweep fallbacks remain.
- Replaced the highlight-reel transcript helper's fixed one-second sleep with an immediate lookup and a mutation-observer wait, and made it return `null` when no usable segments are rendered.
- Added AI-OS skill `_fetch-youtube-transcript`, using the active browser tab's native `exportYouTubeTranscript()` as the preferred method, and a global Codex transcript-first rule.

## Evidence
- Native export on the active YouTube page returned a complete timestamped auto-caption transcript in about 1.1 seconds: 35,515 characters and 787 lines.
- The userscript bundle had unrelated pre-existing Canvas downloader edits, so it was left untouched.

## Validation
- No automated test suite was run.
