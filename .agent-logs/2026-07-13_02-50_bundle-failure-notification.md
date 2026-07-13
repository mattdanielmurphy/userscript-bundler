## Goal
When a bundle fails, the user wants to get notified and have the log copied to their clipboard.

## User Feedback & Decisions
None yet.

## Changes Made
- Modified `watch-and-bundle.js`'s bundler error handler.
- Used `child_process.spawn("pbcopy")` to write the full error output and exit code to the clipboard when the bundler script exits with a non-zero code.
- Used `child_process.spawn("osascript", ["-e", 'display notification ...'])` to show a macOS notification natively.

## What Worked
- Replaced the bundler error handler block in `watch-and-bundle.js` with the modified logic successfully.

## What Didn't Work / Known Issues
None.

## Architecture Notes
- The bundling is orchestrated by a parent process (`watch-and-bundle.js`) which shells out to `bundler.js` and handles file events. Intercepting the error at the parent level provides a clean way to deal with any potential crashes from the bundler without cluttering the bundler's own source code.
