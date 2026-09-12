# Remove YouTube Autoplay Guard & Relax Wake Mute Safeguards

**Date**: 2026-09-12 11:48  
**Context**: Video watching friction fix & sleep/wake mute threshold tuning.

## Changes Made
1. **Removed Section 0 Autoplay Guard (`youtube-master.user.js`)**:
   - Stripped monkey-patched `HTMLMediaElement.prototype.play` and trusted click requirements.
   - Restored native spacebar playback toggling and expected video autoplay on navigation.
   - Recompiled `userscript_bundle.js` and `userscript_bundle.user.js` via `bundler.cjs`.
2. **Tuned Hammerspoon Audio Muting (`~/.hammerspoon/modules/wake_mute.lua`)**:
   - Replaced unconditional mute-on-wake/unlock with a 10-minute inactivity threshold (`MUTE_THRESHOLD_SECONDS = 10 * 60`).
   - Only mutes when the Mac has been asleep or screen-locked for >10 minutes. Short breaks, moving desks, and routine use no longer mute the system.
   - Added automatic internal speaker mute safeguard in case headphones disconnect after sleep.
