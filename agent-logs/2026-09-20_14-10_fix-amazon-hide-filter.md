# Agent Work Log: Fix Amazon Hide Filter Userscript

**Date:** 2026-09-20 14:10
**Task:** Diagnose and fix the Amazon Hide Filter userscript (`userscripts/amazon filter.js`) using Chrome DevTools MCP.

## Root Cause Analysis
Using Chrome DevTools MCP on the user's active Amazon search tab (`Amazon.ca : dual step garbage can`), identified multiple root causes that caused the Hide and Require keyword filters to appear broken:
1. **Strict Hyphen vs. Space Matching:** The regex generator (`makeTermRegex`) performed strict literal regex matching. When the user entered `pull-out` into the "Hide:" box, it created `/\bpull\-out\b/`, which failed to match Amazon product listings written as `Pull Out` (with a space).
2. **Require / Must-Have Comma-Separation Failure:** In `titleMatchesMustHave`, expressions without explicit `and`/`or` keywords were passed to `matchTerm` as a single literal string. When the user typed `dual, step`, the engine searched for the exact phrase `"dual, step"` including the comma, resulting in 0 matches and inadvertently hiding all products on the page.
3. **Deceptive Count and Status Display:** When `allowlistEnabled` was `false` (Brand Filter turned off so only keyword filtering is desired), `updateTopFilterCount()` hardcoded `filterCount.textContent = "👁️ Brand Filter is OFF: All X products visible."`, even when 98 products were filtered out by the keyword filter. This led the user to believe the Hide filter wasn't operating at all.
4. **Sponsored Ad Containers (`.AdHolder`) Bypassing Filter:** Sponsored banner rows (`.AdHolder`) often have `data-asin=""` and were excluded by `RESULT_SELECTOR`, allowing sponsored cards with excluded keywords (like "motion") to remain visible in search results.
5. **Word Boundary Errors on Non-Word Characters:** `\b` word boundaries failed when terms contained punctuation, hyphens, or symbols because `\b` requires a transition between `\w` and `\W`.

## Changes Made
1. **Flexible Delimiter Matching (`makeTermRegex`):**
   - Split core terms by `[-\s]+`.
   - For terms containing hyphens (e.g. `pull-out`), joined segments with `[-\s]?` to match `pull-out`, `pull out`, and compound `pullout`.
   - For terms containing spaces (e.g. `pull out`), joined segments with `[-\s]+`.
   - Conditioned `\b` boundary application to ensure it only applies when adjacent characters are alphanumeric `\w`.
   - Enabled case-insensitivity (`"i"` flag) and stripped accidental wrapping quotes.
2. **Comma-Separated Multi-Term Support (`titleMatchesMustHave`):**
   - Split OR clauses first, then split each clause by `[,;]|\s+and\s+/i` so comma-separated terms (e.g. `dual, step` or `recycle, trash`) require all terms to be present.
   - Cleaned empty terms and trailing commas.
3. **Keyword vs. Brand Breakdown Stats & UI Fixes:**
   - Expanded `state.stats` to track `filteredByKeywords` and `filteredByBrand` independently.
   - Updated `updateTopFilterCount()` to display:
     - When Brand Filter is OFF: `👁️ [allowed] of [total] products shown ([filteredByKeywords] hidden by keyword filter). Brand Filter is OFF.`
     - When Brand Filter is ON: accurate breakdown of keyword vs. brand exclusions.
   - Updated the bottom-right floating pill text (`abf-pill-text`) to reflect keyword filter status when Brand Filter is off.
4. **Sponsored Banner Filtering (`.AdHolder`):**
   - Added sponsored banner exclusion in `applyAllFilters` to hide `.AdHolder` elements when any text matches the active `excludeTerms`.
5. **Fallback Title Extraction & Empty Skeleton Filtering:**
   - Added generic `card.querySelector("h2")` title fallback in `getCardTitle()`.
   - Skipped unrendered empty skeleton cards from inflating total/allowed counts.
6. **Tests & Bundle:**
   - Updated unit test suite in `test/amazon-filter.test.js` to verify flexible hyphen/space matching and comma-separated must-have terms. All 15 tests pass.
   - Rebuilt bundle (`bun run build`) and verified live in Chrome on Amazon.ca via Chrome DevTools MCP.

## Verification
- Inspected live DOM and verified:
  - `Hide: motion, pull-out,`
  - `Require: recycle, trash`
  - Correctly showed 9 matching products and hid 98 non-matching / excluded products.
  - Count text accurately displayed: `👁️ 9 of 107 products shown (98 hidden by keyword filter). Brand Filter is OFF.`
  - Captured full visual screenshot confirming clean UI display and hidden items.
