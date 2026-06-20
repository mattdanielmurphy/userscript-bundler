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
- **Download All Videos**: A floating action button (indigo gradient) that cycles through lesson video tabs, waits for loading, and downloads all videos sequentially. Uses the standard video naming scheme: `<Nav Parts> - <Video Title> (<Video Num>).mp4`.

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
