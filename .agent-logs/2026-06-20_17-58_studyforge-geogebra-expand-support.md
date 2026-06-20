## Goal
Support expanding reading content to load GeoGebra iframes, and extract material IDs from `geogebra.org/m/` src URLs to dynamically generate offline HTML applet packages.

## Changes Made
- Modified [studyforge-frame-downloader.user.js](file:///Users/matthewmurphy/projects/userscript-bundler/userscripts/studyforge-frame-downloader.user.js):
  - Updated `downloadGeoGebra` function to check for a `.expand` button and `.reading-content[aria-hidden="true"]`, clicking the expand button to reveal hidden widgets.
  - Pauses for `600ms` for DOM updates.
  - Queries `iframe[src*="geogebra.org/m/"]` to locate embedded applets.
  - Extracts the material ID from each iframe's URL path.
  - Configures applet settings parameters (Algebra Input, Zoom Buttons, Reset Icon, etc.) and packages them inside standalone offline HTML structures.
  - Standardizes the filenames as `${fullTitle} - Applet X.html` if multiple exist, or `${fullTitle}.html` if there is a single instance.
- Updated [FEATURES.md](file:///Users/matthewmurphy/projects/userscript-bundler/FEATURES.md) to log this feature enhancement.

## What Worked
- Rebuild is clean.
- Auto-expansion clicks correctly when needed.
- Iframes are successfully identified, parsed, and downloaded matching the naming scheme.

## What Didn't Work / Known Issues
- None.

## Architecture Notes
- Handles multiple applets per page by appending `- Applet {Index}` to the base title.
