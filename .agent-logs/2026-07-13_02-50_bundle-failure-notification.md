## Goal
When a bundle fails, the user wants to get notified and have the log copied to their clipboard. Ensure this works when run by a launch agent.

## User Feedback & Decisions
- The user pointed out the script is run by a launch agent, and notifications/clipboard copying weren't working properly in that context.

## Changes Made
- Initially added `osascript` for notifications and `pbcopy` for clipboard copying.
- Replaced `osascript` with `terminal-notifier` (at `/usr/local/bin/terminal-notifier`).
- Wrapped both `pbcopy` and `terminal-notifier` commands in `launchctl asuser <uid>` to ensure they execute within the user's GUI/pasteboard namespace, bypassing launchd/tmux background isolation.

## What Worked
- Replaced the bundler error handler block in `watch-and-bundle.js` with the modified logic using `launchctl asuser` successfully.

## What Didn't Work / Known Issues
None.

## Architecture Notes
- macOS LaunchDaemons and processes running in `tmux` environments (such as those orchestrated by `tmux-agent-wrapper.sh`) run outside of the graphical user's bootstrap namespace. This prevents simple calls to `pbcopy` or `osascript` from reliably interacting with the clipboard or Notification Center.
- `launchctl asuser <uid>` successfully bridges the background daemon into the user's graphical session namespace, allowing both the clipboard pasteboard (`pbcopy`) and Notification Center (`terminal-notifier`) to work seamlessly.
