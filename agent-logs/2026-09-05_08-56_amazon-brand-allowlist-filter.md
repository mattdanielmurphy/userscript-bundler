# 2026-09-05 08:56 - Amazon Brand Allowlist & Product Filter Userscript

## Summary
Upgraded `userscripts/amazon filter.js` from a basic keyword filter into an aggressive, production-ready 4-tier ALLOWLIST brand filter and product search filter for Amazon across global domains (`.com`, `.ca`, `.co.uk`, `.de`, `.fr`, `.es`, `.it`, `.co.jp`, etc.). Eradicates temporary dropshipping spam and auto-generated accounts (e.g., "XIYIJIA", "GVOODE") while protecting legitimate obscure or newly launched brands through multi-layered verification.

## Architecture & Legitimacy Verification Tiers

1. **Tier 1: External Open Allowlist Sync & Cached Database**:
   - Integrates dynamic fetching from community-maintained allowlists (primary: `https://raw.githubusercontent.com/chris-mosley/AmazonBrandFilterList/main/brands.txt` with 3,900+ verified brands).
   - 24-hour cache TTL in GM storage (`abf_brands_cache`, `abf_cache_timestamp`) to ensure non-blocking instant page renders.
   - Built-in curated seed list of 350+ reputable global brands for immediate cold-start filtering on fresh installs.
   - $O(1)$ Set lookup data structure for fast real-time card evaluation.

2. **Tier 2: Structural On-Page Amazon Signals (Auto-Whitelisting)**:
   - Official Brand Store link detection: recognizes links to `/stores/`, `/stores/page/`, `/stores/node/`, or merchant `me=` URLs.
   - Fulfillment signals: regex matching `Ships from Amazon`, `Sold by Amazon`, and Prime badges.
   - Brand Registry badges: recognizes `Amazon's Choice`, `Overall Pick`, `Best Seller`, `#1 Best Seller`, and `Climate Pledge Friendly`.

3. **Tier 3: Algorithmic & Linguistic Heuristic Fallback**:
   - Dropshipping spam signature detection: flags and filters ALL-CAPS single-block strings between 5 and 9 letters (e.g. `XIYIJIA`, `GVOODE`, `ZXKVO`).
   - Standard English Title Case validation with phonetic analysis.
   - Vowel ratio enforcement: requires vowel frequency between 25% and 60% with zero 4+ consecutive consonant clusters.
   - Multi-word brand names or recognized corporate suffixes (`Inc`, `LLC`, `Co`, `Ltd`, `Corp`, `Labs`, `Studios`, `Works`, `Supply`, `Tech`, `Audio`, etc.).

4. **Tier 4: Local User Allowlist & UI Override**:
   - Local custom whitelist stored in `GM_setValue('user_custom_whitelist')`.
   - **Inline Card UI**:
     - *Hard Hide Mode*: sets `display: none` and renders a 22px bar `🛡️ Hidden: [Brand] — [+ Whitelist] [👁️ Reveal]`.
     - *Soft Dim Mode*: sets `opacity: 0.18`, `filter: grayscale(100%)`, and reveals full opacity on hover with an overlay `[+ Whitelist]`.
   - **Floating Control Panel**:
     - Collapsible widget in bottom-right corner with live statistics (allowed, hidden, database total).
     - Filter mode toggle (Hard Hide vs. Soft Dim).
     - Dynamic list of distinct filtered brands on current page with 1-click whitelist buttons.
     - Custom user whitelist manager (add brand, delete brand, clear).
     - Manual "Sync Allowlist Now" button.

5. **Preserved Existing Features**:
   - Kept and enhanced the in-page top filter inputs at `#s-skipLinkTargetForMainSearchResults`:
     - Exclude: comma-separated title keywords or `/regex/flags`
     - Require: `AND` / `OR` title expressions
     - Live result count badge and allowlist status indicator.

## Verification
- Added test suite in `test/amazon-filter.test.js` validating Userscript headers, linguistic/phonetic heuristics against spam vs legitimate names, and title matching logic.
- Automated tests pass: `bun run test` (15 pass, 0 fail).
- Bundle built cleanly via `bun run build` and auto-synced to iCloud.
