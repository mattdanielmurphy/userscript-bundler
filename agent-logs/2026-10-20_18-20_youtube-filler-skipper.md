# YouTube AI filler skipper (front end)

## Changes
- `userscripts/youtube-master.user.js`: section 8b (toggle, headless transcript fetch, API call with fetch→GM fallback, per-video cache, taste-notes editor modal, skip toast with Go back, error toast); reel engine gained `_reelMode` "filler" (skip jump, blue scrubber spans, no reel badge/button state).
- `test/youtube-filler.test.js`: inversion, response parsing, cache, panel params, panel JSON extraction.
- Loader header/README: `@connect yt.mattmurphy.ca`.

## Validation
- `bun test test/`: 22 pass.
- Headless muted Chrome on a real Mythbusters watch page with the script injected: toggle rendered, auto-ran, transcript fetched (423 lines), backend reached via CORS; the AI step returned the OpenRouter no-credit error, which surfaced in the tooltip.
