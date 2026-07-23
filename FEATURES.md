# Project Features

This document tracks all features, capabilities, and enhancements implemented in the Userscript Bundler project.

## StudyForge Frame + KaTeX Notes Downloader
- **Download Frame**: Captures the visible video frame along with KaTeX formatted notes/captions rendered nicely in a composite PNG.
- **Caption Picker**: Select and edit captions from the video's active subtitle tracks, featuring LaTeX rendering support.
- **No Caption Default**: Starts with blank note field for quick one-click capture.
- **Video Position Resume**: Automatically saves and restores video playback position per lesson in localStorage.
- **Keyboard Shortcuts**:
  - `Opt+S` (`Alt+S`): Instantly download the current frame with no caption.
  - `Opt+V` (`Alt+V`): Instantly download the current video file.
- **Download All Videos + Questions**: A floating action button (indigo gradient) that cycles through lesson video tabs, waits for loading, downloads all videos sequentially (including embedding any GeoGebra interactives as offline HTML files if no video is present), and exports all practice questions on the page as a CSV (`<Lesson Header> - Practice Questions.csv`). Fully supports lessons containing multiple distinct sections or `lo-group` tab widgets, automatically prefixing titles with section/part numbers to prevent collisions.
- **Enhanced Practice Questions Extraction**: Scrapes question titles from `aria-label` tags or `.q-title` headers for accurate classification in the exported CSV.
- **GeoGebra Interactive Applet Downloader**: Downloads standalone offline HTML files for GeoGebra interactives on the page/tabs when calling the downloader. Uses tracking in localStorage (`sf_downloaded_geogebra`) to prevent duplicate downloads. Scopes element selection to the active tab container.
- **Toast Notifications**: Provides beautiful, non-blocking toast notifications (using a premium blue gradient) to signal successful completion or errors on download operations.

## YouTube Master Script
- **Thumbnail Toggling**: Toggle visibility of thumbnails.
- **Transcript Extraction**: Fast transcript extraction with fallback parsing.
- **Shorts Hiding**: Automatically hides YouTube Shorts videos.
- **Low View Hiding**: Hides videos with under 1k views.
- **Quality & Control**: Forces maximum quality and bypasses number key seeking conflicts.

## Perplexity.ai Improvements
- **Rate Limit Indicator**: Displays remaining queries.
- **Banner Ad-blocker**: Removes promotional layouts and up-sells.
- **Auto Focus**: Automatically focuses the prompt input box on thread load.

## ContentConnections Enhancements
- **Clean Layout**: Hides whiteboards and side menus.
- **Solution Shortcuts**: Quick correct/incorrect buttons and automatic navigation.
- **Canvas Capture**: captures canvas views using `Opt+D`.
- **Recursive Capture**: Auto-advances lessons to capture entire units.
- **Dark Mode**: High-fidelity dark theme with canvas/image inversion.

## D2L Image Downloader
- **Image Extraction**: Finds and downloads rendered images from learning management pages.
- **Cross-frame Discovery**: Scrapes nested frames recursively using `TreeWalker`.
- **UI Highlights**: Highlights target frames on hover.

## TorrentMac Cleanup
- Removes deceptive fake download links/buttons.

## Forbes Paywall Bypass
- Restores scrolling and removes article overlay/paywall modals.
## GMT Archive (Gemini Improvements)
- **Local Markdown Archiving**: Automatically serializes and archives conversations locally in Markdown format with timestamps.
- **Smart Autosave Synchronization**: Debounces and triggers local backup synchronizations only after the Gemini model has completely finished generating the response, avoiding partial backups and redundant requests during active output generation.
- **Title Synchronization**: Syncs the document tab title with the conversation thread title using `MutationObserver`.
- **Run Bash Commands**: Adds a "Run 🚀" button next to Gemini's native copy button on bash code blocks. Uses the local backend to spawn a detached `tmux` session, executing commands seamlessly on your host system.

## Bundler & Grouped Userscripts
- **Script Grouping**: Concatenates multiple source files listed under `"group"` and `"files"` in `script_manifest.json` into a single shared IIFE lexical scope in explicit load order.
- **Standalone Multi-Module Compilation**: In addition to generating `userscript_bundle.js`, automatically compiles multi-module script groups (such as `gemini-enhancements`) into individual standalone `.user.js` files under the `compiled/` directory for direct use in standalone userscript injectors.
- **Single Dispatcher Wrapper**: Generates a single wrapper function per group in `userscript_bundle.js` so all group source files execute together inside one shared scope when matching page URLs.
- **Source Boundaries & Validation**: Inserts `/* ===== file ===== */` boundary comments, enforces path safety, checks file existence/duplication/readability, and validates syntax before wrapping.
- **Automatic Watching**: Watcher automatically rebuilds `userscript_bundle.js` when any grouped `.js` file or `script_manifest.json` is modified.

## Centralized Cross-Manager Compatibility Layer
- **Centralized API Wrapper**: Prepend a lightweight compatibility module (`compat.js`) that abstracts differences between Tampermonkey and Safari's "Userscripts" extension (e.g. sync/async storage, menu commands, and style injection).
- **Universal XHR request adapter**: Translates callbacks and promise-based network requests dynamically across legacy `GM_xmlhttpRequest` and modern/case-insensitive `GM.xmlHttpRequest` formats.
- **Graceful Failure Diagnostics**: Captures unavailable XHR APIs in limited extensions and informs the user via clear console logs and alerts instead of throwing a TypeError crash.
