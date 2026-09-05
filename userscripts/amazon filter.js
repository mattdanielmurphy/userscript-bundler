// ==UserScript==
// @name         Amazon Brand Allowlist & Product Filter
// @namespace    https://github.com/mattdanielmurphy
// @version      2.2.0
// @description  Strict allowlist brand filter and keyword filter for Amazon (.com, .ca, .co.uk, etc.) with quick Show All toggle and auto-advance pagination on zero results.
// @author       Matt Murphy
// @match        https://www.amazon.com/*
// @match        https://www.amazon.ca/*
// @match        https://www.amazon.co.uk/*
// @match        https://www.amazon.de/*
// @match        https://www.amazon.fr/*
// @match        https://www.amazon.es/*
// @match        https://www.amazon.it/*
// @match        https://www.amazon.co.jp/*
// @match        https://www.amazon.com.au/*
// @match        https://www.amazon.com.mx/*
// @match        https://www.amazon.com.br/*
// @match        https://www.amazon.in/*
// @match        https://www.amazon.*/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @connect      githubusercontent.com
// ==/UserScript==

(function () {
	"use strict";

	// =========================================================================
	// CONSTANTS & SELECTORS
	// =========================================================================
	const RESULT_SELECTOR =
		'div[role="listitem"][data-component-type="s-search-result"][data-asin]:not([data-asin=""]), div[data-component-type="s-search-result"][data-asin]:not([data-asin=""])';

	const REMOTE_ALLOWLIST_URLS = [
		"https://raw.githubusercontent.com/chris-mosley/AmazonBrandFilterList/main/brands.txt",
	];

	const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

	// Storage Keys
	const STORAGE_KEY_CUSTOM_WHITELIST = "user_custom_whitelist";
	const STORAGE_KEY_REMOTE_CACHE = "abf_brands_cache";
	const STORAGE_KEY_CACHE_TIME = "abf_cache_timestamp";
	const STORAGE_KEY_FILTER_MODE = "abf_filter_mode"; // 'hard' | 'soft'
	const STORAGE_KEY_ALLOWLIST_ENABLED = "abf_allowlist_enabled";
	const STORAGE_KEY_AUTO_ADVANCE = "abf_auto_advance";
	const STORAGE_KEY_EXCLUDE_TERMS = "abf_exclude_terms";
	const STORAGE_KEY_MUST_TERMS = "abf_must_have_terms";

	const AUTO_ADVANCE_MAX_HOPS = 10;
	const AUTO_ADVANCE_DELAY_MS = 1200;

	// =========================================================================
	// STORAGE ADAPTER (GM_* with localStorage fallback)
	// =========================================================================
	const storage = {
		get(key, defaultValue) {
			try {
				if (typeof GM_getValue === "function") {
					return GM_getValue(key, defaultValue);
				}
				const item = localStorage.getItem(`abf_${key}`);
				return item !== null ? JSON.parse(item) : defaultValue;
			} catch (e) {
				return defaultValue;
			}
		},
		set(key, value) {
			try {
				if (typeof GM_setValue === "function") {
					GM_setValue(key, value);
					return;
				}
				localStorage.setItem(`abf_${key}`, JSON.stringify(value));
			} catch (e) {
				console.warn("[Amazon Filter] Failed to persist state for key:", key, e);
			}
		},
	};

	// =========================================================================
	// CURATED SEED ALLOWLIST (TIER 1 INSTANT COLD START)
	// =========================================================================
	// Established global brand names across major product categories.
	// Only authentic trademarked brands (no generic nouns or adjectives).
	const SEED_BRANDS = [
		"3m", "8bitdo", "acer", "adidas", "akg", "alienware", "altra", "amazon", "amazon basics",
		"amazon essentials", "amd", "anker", "ankerwork", "apc", "apple", "arcteryx", "asics", "asrock", "asus",
		"audio-technica", "aukey", "avery", "bandai", "bang & olufsen", "barbie", "baseus", "be quiet!", "beats",
		"belkin", "benq", "beyerdynamic", "big agnes", "birkenstock", "black diamond", "black+decker", "blink",
		"blue microphones", "bluetti", "bose", "bosch", "braun", "breville", "brother", "buffalo", "cable matters",
		"calvin klein", "canon", "carhartt", "casio", "cerave", "champion", "channellock", "citizen", "clarks",
		"coleman", "columbia", "cooler master", "corsair", "craftsman", "crayola", "crest", "crucial", "cuisinart",
		"cyberpower", "darn tough", "dell", "deuter", "dewalt", "dickies", "dji", "dove", "dremel", "drop",
		"duck", "ducky", "dyson", "ecoflow", "elgato", "epomaker", "epson", "estwing", "eufy", "evga",
		"exofficio", "faber-castell", "fellow", "fenix", "fifine", "fiio", "filson", "fischer", "fisher-price", "fitbit",
		"fjallraven", "focusrite", "fossil", "fractal design", "fruit of the loom", "garmin", "gearwrench", "gillette",
		"glorious", "godox", "gopro", "govee", "gregory", "hanes", "hasbro", "hifiman", "hoka", "homedics",
		"honeywell", "hot wheels", "hp", "hydro flask", "hyperx", "ifi", "ikea", "insta360", "instant pot", "intel",
		"irobot", "irwin", "jabra", "jackery", "jbl", "jds labs", "jlab", "kamik", "keen", "kef",
		"kelty", "keychron", "keurig", "kingston", "kitchenaid", "klein tools", "klipsch", "knipex", "kobo", "korg",
		"lacoste", "lamy", "le creuset", "lego", "lenovo", "leupold", "levi's", "lg", "linksys", "lodge",
		"logitech", "lowepro", "lowa", "makita", "manfrotto", "marmot", "marshall", "mattel", "merrell", "microsoft",
		"milwaukee", "moleskine", "monoprice", "moondrop", "motorola", "mountain hardwear", "msi", "msr", "muck boot",
		"naked & famous", "nemo", "nerf", "nespresso", "netgear", "neutrogena", "new balance", "nikon", "nike",
		"ninja", "nintendo", "nivea", "noctua", "nordictrack", "nudie jeans", "nzxt", "oakley", "olight", "oneplus",
		"oral-b", "osprey", "otterbox", "outdoor research", "oxo", "panasonic", "park tool", "patagonia", "peak design",
		"pendleton", "petzl", "philips", "philips sonicare", "pilot", "pioneer", "play-doh", "polar", "polk audio",
		"post-it", "presonus", "prana", "puma", "pyrex", "qnap", "razer", "ravpower", "ray-ban", "red wing",
		"reebok", "ridgid", "ring", "roccat", "rode", "rokid", "roku", "roland", "ryobi", "sabrent",
		"salomon", "samsung", "sandisk", "saucony", "scarpa", "schiit", "schwalbe", "scotty", "sea to summit", "seagate",
		"seasonic", "seiko", "sennheiser", "shark", "sharpie", "shimano", "shure", "sigma", "simple modern", "skullcandy",
		"smartwool", "solidremote", "sonos", "sony", "soundcore", "spigen", "sram", "staedtler", "stanley", "startech",
		"steelseries", "streamlight", "sunrei", "suunto", "synology", "tamron", "tascam", "tefal", "tekton", "teva",
		"the north face", "thermalright", "thermaltake", "therm-a-rest", "thule", "timberland", "timex", "tommy hilfiger",
		"topping", "toshiba", "tp-link", "traxxas", "trestles", "tripp lite", "ugreen", "ugg", "under armour", "uni-ball",
		"uniden", "vans", "vasque", "v-moda", "wacom", "wahoo", "waterman", "weber", "wera", "western digital",
		"whirlpool", "wiha", "wilson", "woot", "wolverine", "wrangler", "xfinity", "xiaomi", "yakima", "yamaha",
		"yeti", "yonex", "zebra", "zhiyun", "zojirushi", "zotac", "zwilling"
	];

	// =========================================================================
	// APPLICATION STATE
	// =========================================================================
	const state = {
		remoteAllowlist: new Set(),
		customWhitelist: new Set(),
		filterMode: storage.get(STORAGE_KEY_FILTER_MODE, "hard"), // 'hard' (display: none) | 'soft' (opacity: 0.15)
		allowlistEnabled: storage.get(STORAGE_KEY_ALLOWLIST_ENABLED, true),
		autoAdvanceEnabled: storage.get(STORAGE_KEY_AUTO_ADVANCE, true),
		excludeTerms: storage.get(STORAGE_KEY_EXCLUDE_TERMS, ""),
		mustHaveTerms: storage.get(STORAGE_KEY_MUST_TERMS, ""),
		stats: {
			total: 0,
			allowed: 0,
			filtered: 0,
		},
		autoAdvanceTimer: null,
		observer: null,
		isDebouncing: false,
		panelOpen: false,
	};

	// =========================================================================
	// STRING NORMALIZATION UTILITIES
	// =========================================================================
	function normalizeBrand(str) {
		if (!str || typeof str !== "string") return "";
		return str
			.toLowerCase()
			.replace(/['"’`]/g, "")
			.replace(/[^a-z0-9\s&-]/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}

	function normalizeTitle(text) {
		return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
	}

	function parseExcludeTerms(filterString) {
		return (filterString || "")
			.split(",")
			.map((term) => term.trim())
			.filter(Boolean);
	}

	function makeTermRegex(term) {
		term = (term || "").trim();
		if (!term) return null;

		if (term.startsWith("/") && term.lastIndexOf("/") > 0) {
			const lastSlash = term.lastIndexOf("/");
			const pattern = term.substring(1, lastSlash);
			const flags = term.substring(lastSlash + 1);
			try {
				return new RegExp(pattern, flags);
			} catch (e) {
				// Fallback to literal
			}
		}

		const lowerTerm = term.toLowerCase();
		const startsWithWildcard = lowerTerm.startsWith("*");
		const endsWithWildcard = lowerTerm.endsWith("*");

		let coreTerm = lowerTerm;
		if (startsWithWildcard) coreTerm = coreTerm.slice(1);
		if (endsWithWildcard) coreTerm = coreTerm.slice(0, -1);

		const escaped = coreTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
		const startBoundary = startsWithWildcard ? "" : "\\b";
		const endBoundary = endsWithWildcard ? "" : "\\b";

		return new RegExp(startBoundary + escaped + endBoundary);
	}

	function matchTerm(title, term) {
		const regex = makeTermRegex(term);
		if (!regex) return false;
		return regex.test(title);
	}

	function titleMatchesMustHave(title, expression) {
		const expr = (expression || "").trim();
		if (!expr) return true;

		if (!/\s+(?:and|or)\s+/i.test(expr)) {
			return matchTerm(title, expr);
		}

		const orClauses = expr
			.split(/\s+or\s+/i)
			.map((s) => s.trim())
			.filter(Boolean);

		return orClauses.some((clause) => {
			const andTerms = clause
				.split(/\s+and\s+/i)
				.map((s) => s.trim())
				.filter(Boolean);
			return andTerms.length > 0 && andTerms.every((term) => matchTerm(title, term));
		});
	}

	// =========================================================================
	// ALLOWLIST LOADING & REMOTE SYNC
	// =========================================================================
	function initAllowlists() {
		// 1. Seed brands into remote set
		for (const brand of SEED_BRANDS) {
			state.remoteAllowlist.add(normalizeBrand(brand));
		}

		// 2. Load custom user whitelist
		const customList = storage.get(STORAGE_KEY_CUSTOM_WHITELIST, []);
		if (Array.isArray(customList)) {
			for (const brand of customList) {
				state.customWhitelist.add(normalizeBrand(brand));
			}
		}

		// 3. Load cached remote brands
		const cachedData = storage.get(STORAGE_KEY_REMOTE_CACHE, null);
		const cacheTime = storage.get(STORAGE_KEY_CACHE_TIME, 0);
		const isCacheValid = Date.now() - cacheTime < CACHE_TTL_MS;

		if (cachedData && Array.isArray(cachedData)) {
			for (const brand of cachedData) {
				state.remoteAllowlist.add(normalizeBrand(brand));
			}
			console.log(`[Amazon Filter] Loaded ${cachedData.length} brands from local cache.`);
		}

		// 4. Fetch in background if cache is missing or stale
		if (!isCacheValid || !cachedData || cachedData.length === 0) {
			fetchRemoteAllowlist();
		}
	}

	function fetchRemoteAllowlist() {
		const targetUrl = REMOTE_ALLOWLIST_URLS[0];
		console.log(`[Amazon Filter] Fetching community allowlist from: ${targetUrl}`);

		const handleResponse = (text) => {
			if (!text || typeof text !== "string") return;
			const lines = text.split("\n");
			const brandArray = [];
			for (let line of lines) {
				line = line.trim();
				if (!line || line.startsWith("#")) continue;
				const norm = normalizeBrand(line);
				if (norm) {
					state.remoteAllowlist.add(norm);
					brandArray.push(norm);
				}
			}

			storage.set(STORAGE_KEY_REMOTE_CACHE, brandArray);
			storage.set(STORAGE_KEY_CACHE_TIME, Date.now());
			console.log(`[Amazon Filter] Successfully synced ${brandArray.length} remote brands.`);

			updateControlPanelStats();
			applyAllFilters();
		};

		if (typeof GM_xmlhttpRequest === "function") {
			GM_xmlhttpRequest({
				method: "GET",
				url: targetUrl,
				timeout: 15000,
				onload(response) {
					if (response.status >= 200 && response.status < 300) {
						handleResponse(response.responseText);
					}
				},
				onerror() {
					fallbackFetch(targetUrl, handleResponse);
				},
			});
		} else {
			fallbackFetch(targetUrl, handleResponse);
		}
	}

	function fallbackFetch(url, callback) {
		fetch(url)
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.text();
			})
			.then(callback)
			.catch((e) => {
				console.warn("[Amazon Filter] Remote fetch failed:", e);
			});
	}

	// =========================================================================
	// DOM EXTRACTION UTILITIES
	// =========================================================================
	function getSearchResultCards() {
		return [...document.querySelectorAll(RESULT_SELECTOR)];
	}

	function getCardTitle(card) {
		const titleRecipe = card.querySelector('[data-cy="title-recipe"]');
		const root = titleRecipe || card;

		const linkTitleSpan = root.querySelector(
			"a.s-line-clamp-2 h2 span, a.s-link-style h2 span, h2.a-size-mini a span"
		);
		if (linkTitleSpan?.textContent?.trim()) {
			return normalizeTitle(linkTitleSpan.textContent);
		}

		const productH2 = root.querySelector(
			"h2.a-text-normal span, h2.a-size-base-plus.a-spacing-none span, h2.a-color-base.a-text-normal span"
		);
		if (productH2?.textContent?.trim()) {
			return normalizeTitle(productH2.textContent);
		}

		for (const h2 of root.querySelectorAll("h2[aria-label]")) {
			if (h2.classList.contains("a-size-mini")) continue;
			const span = h2.querySelector("span");
			const raw = span?.textContent?.trim() || h2.getAttribute("aria-label")?.trim() || "";
			if (raw) return normalizeTitle(raw);
		}

		return "";
	}

	function extractStoreBrand(anchor) {
		if (!anchor) return "";
		const text = anchor.textContent.trim();
		const visitMatch = text.match(/(?:visit the|brand:)\s+([^.]+?)\s*(?:store|$)/i);
		if (visitMatch) return visitMatch[1].trim();

		const href = anchor.getAttribute("href") || "";
		const match = href.match(/\/stores\/(?:page\/)?([A-Za-z0-9%_-]+)/);
		if (match && !match[1].startsWith("node")) {
			return decodeURIComponent(match[1]).replace(/[-_]/g, " ").trim();
		}
		return "";
	}

	// =========================================================================
	// STRICT ALLOWLIST EVALUATOR
	// =========================================================================
	// Whatever is in the brand whitelist, we see those results.
	// Otherwise, we do not see them. Simple as that.
	function isBrandWhitelisted(card) {
		// 1. Check explicit brand header line on the card (e.g. h2.a-size-mini span)
		const brandHeading = card.querySelector(
			"h2.a-size-mini span, h5.s-line-clamp-1 span, span.s-brand-name, a.s-line-clamp-1 span"
		);
		if (brandHeading && brandHeading.textContent.trim()) {
			const explicit = normalizeBrand(brandHeading.textContent);
			if (explicit && (state.customWhitelist.has(explicit) || state.remoteAllowlist.has(explicit))) {
				return true;
			}
		}

		// 2. Check official Amazon Store link (/stores/)
		const storeAnchor = card.querySelector('a[href*="/stores/"], a[href*="/stores/page/"]');
		if (storeAnchor) {
			const storeBrand = extractStoreBrand(storeAnchor);
			if (storeBrand) {
				const normStore = normalizeBrand(storeBrand);
				if (state.customWhitelist.has(normStore) || state.remoteAllowlist.has(normStore)) {
					return true;
				}
			}
		}

		// 3. Check if product title matches a known whitelist brand (exact first words)
		const title = getCardTitle(card);
		if (title) {
			const words = title.split(/\s+/).filter(Boolean);
			if (words.length > 0) {
				const w1 = normalizeBrand(words[0]);
				if (state.customWhitelist.has(w1) || state.remoteAllowlist.has(w1)) {
					return true;
				}
			}
			if (words.length > 1) {
				const w2 = normalizeBrand(words.slice(0, 2).join(" "));
				if (state.customWhitelist.has(w2) || state.remoteAllowlist.has(w2)) {
					return true;
				}
			}
			if (words.length > 2) {
				const w3 = normalizeBrand(words.slice(0, 3).join(" "));
				if (state.customWhitelist.has(w3) || state.remoteAllowlist.has(w3)) {
					return true;
				}
			}
		}

		// Not in whitelist
		return false;
	}

	// =========================================================================
	// CARD VISIBILITY APPLIER (CLEAN DISPLAY NONE - NO IN-PAGE PLACEHOLDER JUNK)
	// =========================================================================
	function applyCardVisibility(card, isAllowed) {
		// Clean up any old placeholder bars or overlays
		const prev = card.previousElementSibling;
		if (prev && prev.classList && prev.classList.contains("abf-placeholder-bar")) {
			prev.remove();
		}
		const overlay = card.querySelector(".abf-card-overlay");
		if (overlay) overlay.remove();

		if (isAllowed) {
			card.style.removeProperty("display");
			card.style.removeProperty("opacity");
			card.style.removeProperty("filter");
			card.style.removeProperty("transition");
			card.removeAttribute("data-abf-hidden");
		} else {
			card.setAttribute("data-abf-hidden", "true");
			if (state.filterMode === "soft") {
				card.style.removeProperty("display");
				card.style.opacity = "0.15";
				card.style.filter = "grayscale(100%)";
				card.style.transition = "opacity 0.2s ease, filter 0.2s ease";
			} else {
				// HARD HIDE: completely clean display: none without any in-page DOM pollution
				card.style.display = "none";
			}
		}
	}

	// =========================================================================
	// MASTER FILTER PIPELINE
	// =========================================================================
	function applyAllFilters() {
		const excludeTerms = parseExcludeTerms(state.excludeTerms);
		const mustString = (state.mustHaveTerms || "").trim();
		const excludeActive = excludeTerms.length > 0;
		const mustActive = mustString !== "";

		const cards = getSearchResultCards();

		state.stats.total = cards.length;
		state.stats.allowed = 0;
		state.stats.filtered = 0;

		cards.forEach((card) => {
			const title = getCardTitle(card);

			// 1. Check title keyword exclusions (Exclude terms)
			if (excludeActive && title && excludeTerms.some((term) => matchTerm(title, term))) {
				state.stats.filtered++;
				applyCardVisibility(card, false);
				return;
			}

			// 2. Check title keyword requirements (Must have terms)
			if (mustActive && title && !titleMatchesMustHave(title, mustString)) {
				state.stats.filtered++;
				applyCardVisibility(card, false);
				return;
			}

			// 3. Strict Brand Whitelist Check
			if (state.allowlistEnabled) {
				const whitelisted = isBrandWhitelisted(card);
				if (!whitelisted) {
					state.stats.filtered++;
					applyCardVisibility(card, false);
					return;
				}
			}

			// Product passed
			state.stats.allowed++;
			applyCardVisibility(card, true);
		});

		updateTopFilterCount();
		updateControlPanelStats();
		checkZeroResultsAndAutoAdvance();
	}

	// =========================================================================
	// ALLOWLIST & AUTO-ADVANCE STATE CONTROLLERS
	// =========================================================================
	function setAllowlistEnabled(enabled) {
		state.allowlistEnabled = enabled;
		storage.set(STORAGE_KEY_ALLOWLIST_ENABLED, enabled);
		if (state.autoAdvanceTimer) {
			clearTimeout(state.autoAdvanceTimer);
			state.autoAdvanceTimer = null;
		}
		if (!enabled) {
			removeZeroResultsBanner();
			try {
				sessionStorage.removeItem("abf_auto_advance_hops");
			} catch (e) {}
		}
		applyAllFilters();
		updateControlPanelStats();
	}

	function setAutoAdvanceEnabled(enabled) {
		state.autoAdvanceEnabled = enabled;
		storage.set(STORAGE_KEY_AUTO_ADVANCE, enabled);
		if (!enabled && state.autoAdvanceTimer) {
			clearTimeout(state.autoAdvanceTimer);
			state.autoAdvanceTimer = null;
			removeZeroResultsBanner();
		}
		applyAllFilters();
		updateControlPanelStats();
	}

	function getNextPageElement() {
		return document.querySelector(
			'a.s-pagination-next:not(.s-pagination-disabled):not([aria-disabled="true"]), li.a-last:not(.a-disabled) a, a#pagnNextLink'
		);
	}

	function removeZeroResultsBanner() {
		const banner = document.getElementById("abf-zero-results-banner");
		if (banner) banner.remove();
	}

	function renderZeroResultsBanner() {
		const mainSlot =
			document.querySelector("div.s-main-slot") ||
			document.getElementById("search") ||
			document.querySelector(".s-result-list");
		if (!mainSlot) return;

		let banner = document.getElementById("abf-zero-results-banner");
		if (!banner) {
			banner = document.createElement("div");
			banner.id = "abf-zero-results-banner";
			banner.style.cssText =
				"margin: 14px 0 20px 0; padding: 14px 18px; background: #fff8e7; border: 1px solid #ffd599; border-left: 5px solid #ff9900; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,0.06);";
			mainSlot.insertBefore(banner, mainSlot.firstChild);
		}

		const nextLink = getNextPageElement();
		let hops = 0;
		try {
			hops = parseInt(sessionStorage.getItem("abf_auto_advance_hops") || "0", 10);
		} catch (e) {}

		const willAutoAdvance = state.autoAdvanceEnabled && nextLink && hops < AUTO_ADVANCE_MAX_HOPS;

		banner.innerHTML = `
			<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
				<div style="flex: 1; min-width: 260px;">
					<div style="display: flex; align-items: center; gap: 8px;">
						<span style="font-size: 18px;">⚠️</span>
						<strong style="color: #0f1111; font-size: 14px;">No products on this page match your brand allowlist</strong>
						<span style="font-size: 12px; color: #565959;">(${state.stats.total} hidden)</span>
					</div>
					<div id="abf-zero-banner-subtext" style="font-size: 12px; color: #565959; margin-top: 5px; line-height: 1.4;">
						${
							!nextLink
								? "🏁 Reached the last page of search results. No matching brands found."
								: hops >= AUTO_ADVANCE_MAX_HOPS
								? `🛑 Auto-advanced through ${AUTO_ADVANCE_MAX_HOPS} consecutive pages without matching brands. Auto-advance paused.`
								: willAutoAdvance
								? '⏩ Auto-advancing to next page in <strong>1.2s</strong>...'
								: "Turn off brand filter to view all products or advance to next page manually."
						}
					</div>
				</div>
				<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
					<button id="abf-zero-show-all-btn" style="background: #ffffff; color: #0f1111; border: 1px solid #888c8c; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: background 0.15s;">
						👁️ Show All Items (Turn Off Filter)
					</button>
					${
						willAutoAdvance
							? '<button id="abf-zero-cancel-advance-btn" style="background: #f0f2f2; color: #0f1111; border: 1px solid #d5d9d9; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;">⏹️ Cancel Auto-Advance</button>'
							: nextLink
							? '<button id="abf-zero-manual-next-btn" style="background: #ffd814; color: #0f1111; border: 1px solid #fcd200; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;">⏭️ Go to Next Page</button>'
							: ""
					}
				</div>
			</div>
		`;

		const showAllBtn = banner.querySelector("#abf-zero-show-all-btn");
		if (showAllBtn) {
			showAllBtn.addEventListener("click", () => {
				setAllowlistEnabled(false);
				showNotificationToast("👁️ Brand allowlist turned off. Showing all items.");
			});
		}

		const cancelBtn = banner.querySelector("#abf-zero-cancel-advance-btn");
		if (cancelBtn) {
			cancelBtn.addEventListener("click", () => {
				if (state.autoAdvanceTimer) {
					clearTimeout(state.autoAdvanceTimer);
					state.autoAdvanceTimer = null;
				}
				try {
					sessionStorage.removeItem("abf_auto_advance_hops");
				} catch (e) {}
				const sub = banner.querySelector("#abf-zero-banner-subtext");
				if (sub) sub.textContent = "⏹️ Auto-advance cancelled. Products remain hidden.";
				cancelBtn.remove();
				showNotificationToast("⏹️ Auto-advance cancelled.");
			});
		}

		const manualNextBtn = banner.querySelector("#abf-zero-manual-next-btn");
		if (manualNextBtn) {
			manualNextBtn.addEventListener("click", () => {
				if (nextLink) {
					if (typeof nextLink.click === "function") nextLink.click();
					else if (nextLink.href) window.location.href = nextLink.href;
				}
			});
		}

		if (willAutoAdvance) {
			showNotificationToast("⏩ 0 matching brands. Auto-advancing to next page...");
			state.autoAdvanceTimer = setTimeout(() => {
				try {
					sessionStorage.setItem("abf_auto_advance_hops", (hops + 1).toString());
				} catch (e) {}
				if (nextLink) {
					if (typeof nextLink.click === "function") nextLink.click();
					else if (nextLink.href) window.location.href = nextLink.href;
				}
			}, AUTO_ADVANCE_DELAY_MS);
		}
	}

	function checkZeroResultsAndAutoAdvance() {
		if (state.autoAdvanceTimer) {
			clearTimeout(state.autoAdvanceTimer);
			state.autoAdvanceTimer = null;
		}

		if (!state.allowlistEnabled || state.stats.total === 0 || state.stats.allowed > 0) {
			removeZeroResultsBanner();
			if (state.stats.allowed > 0) {
				try {
					sessionStorage.removeItem("abf_auto_advance_hops");
				} catch (e) {}
			}
			return;
		}

		renderZeroResultsBanner();
	}

	// =========================================================================
	// USER CUSTOM WHITELIST MANAGEMENT
	// =========================================================================
	function addCustomWhitelistBrand(brandName) {
		const norm = normalizeBrand(brandName);
		if (!norm) return;

		state.customWhitelist.add(norm);
		const arr = storage.get(STORAGE_KEY_CUSTOM_WHITELIST, []);
		if (!arr.includes(norm)) {
			arr.push(norm);
			storage.set(STORAGE_KEY_CUSTOM_WHITELIST, arr);
		}

		showNotificationToast(`✅ Added "${brandName}" to whitelist`);
		applyAllFilters();
		renderCustomWhitelistList();
	}

	function removeCustomWhitelistBrand(brandName) {
		const norm = normalizeBrand(brandName);
		state.customWhitelist.delete(norm);
		const arr = storage.get(STORAGE_KEY_CUSTOM_WHITELIST, []).filter((b) => b !== norm);
		storage.set(STORAGE_KEY_CUSTOM_WHITELIST, arr);

		showNotificationToast(`🗑️ Removed "${brandName}"`);
		applyAllFilters();
		renderCustomWhitelistList();
	}

	// =========================================================================
	// TOAST NOTIFICATIONS
	// =========================================================================
	function showNotificationToast(message) {
		let toast = document.getElementById("abf-toast");
		if (!toast) {
			toast = document.createElement("div");
			toast.id = "abf-toast";
			toast.style.cssText =
				"position: fixed; bottom: 80px; right: 24px; z-index: 1000000; background: #131921; color: #febd69; border: 1px solid #fcd200; padding: 10px 16px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.3s ease; opacity: 0; pointer-events: none;";
			document.body.appendChild(toast);
		}

		toast.textContent = message;
		toast.style.opacity = "1";
		clearTimeout(toast._timeout);
		toast._timeout = setTimeout(() => {
			toast.style.opacity = "0";
		}, 3000);
	}

	// =========================================================================
	// IN-PAGE TOP SEARCH FILTER INPUTS (PRESERVED FUNCTIONALITY)
	// =========================================================================
	function addTopFilterInput() {
		const targetDiv = document.getElementById("s-skipLinkTargetForMainSearchResults");
		if (!targetDiv) {
			setTimeout(addTopFilterInput, 500);
			return;
		}

		if (document.getElementById("amazon-filter-input")) return;

		const filterContainer = document.createElement("div");
		filterContainer.id = "abf-top-filter-container";
		filterContainer.style.cssText =
			"display: flex; flex-direction: column; gap: 8px; margin: 12px 0 16px 0; padding: 12px 16px; background: #ffffff; border: 1px solid #d5d9d9; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); font-family: inherit;";

		const rowStyle = "display: flex; align-items: center; flex-wrap: wrap; gap: 10px;";

		// Exclude Row
		const excludeRow = document.createElement("div");
		excludeRow.style.cssText = rowStyle;

		const excludeLabel = document.createElement("label");
		excludeLabel.htmlFor = "amazon-filter-input";
		excludeLabel.textContent = "Hide:";
		excludeLabel.style.cssText = "font-weight: 600; min-width: 65px; font-size: 13px; color: #0f1111;";

		const filterInput = document.createElement("input");
		filterInput.type = "text";
		filterInput.id = "amazon-filter-input";
		filterInput.placeholder = "Exclude if title contains (comma-separated)";
		filterInput.value = state.excludeTerms;
		filterInput.style.cssText =
			"width: 320px; padding: 6px 10px; border: 1px solid #888c8c; border-radius: 4px; font-size: 13px;";

		excludeRow.appendChild(excludeLabel);
		excludeRow.appendChild(filterInput);

		// Must Have Row
		const mustRow = document.createElement("div");
		mustRow.style.cssText = rowStyle;

		const mustLabel = document.createElement("label");
		mustLabel.htmlFor = "amazon-must-have-input";
		mustLabel.textContent = "Require:";
		mustLabel.style.cssText = "font-weight: 600; min-width: 65px; font-size: 13px; color: #0f1111;";

		const mustInput = document.createElement("input");
		mustInput.type = "text";
		mustInput.id = "amazon-must-have-input";
		mustInput.placeholder = "Must include (AND / OR), e.g. usb AND c OR hdmi";
		mustInput.value = state.mustHaveTerms;
		mustInput.style.cssText =
			"width: 420px; padding: 6px 10px; border: 1px solid #888c8c; border-radius: 4px; font-size: 13px;";

		mustRow.appendChild(mustLabel);
		mustRow.appendChild(mustInput);

		// Summary row
		const summaryRow = document.createElement("div");
		summaryRow.id = "abf-summary-row";
		summaryRow.style.cssText =
			"display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #565959; padding-top: 6px; border-top: 1px solid #f0f2f2;";

		const filterCount = document.createElement("span");
		filterCount.id = "amazon-filter-count";
		filterCount.style.cssText = "font-weight: 600; color: #007185;";

		const rightControls = document.createElement("div");
		rightControls.id = "abf-top-right-controls";
		rightControls.style.cssText = "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;";

		const autoAdvanceLabel = document.createElement("label");
		autoAdvanceLabel.style.cssText =
			"display: flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; font-size: 12px; color: #0f1111;";
		autoAdvanceLabel.innerHTML = `
			<input type="checkbox" id="abf-top-auto-advance" ${state.autoAdvanceEnabled ? "checked" : ""} style="cursor: pointer;">
			<span>⏩ Auto-advance on 0 results</span>
		`;

		const statusPill = document.createElement("span");
		statusPill.id = "abf-top-status-pill";

		const toggleBtn = document.createElement("button");
		toggleBtn.id = "abf-top-toggle-btn";
		toggleBtn.type = "button";
		toggleBtn.style.cssText =
			"padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;";

		rightControls.appendChild(autoAdvanceLabel);
		rightControls.appendChild(statusPill);
		rightControls.appendChild(toggleBtn);

		summaryRow.appendChild(filterCount);
		summaryRow.appendChild(rightControls);

		filterContainer.appendChild(excludeRow);
		filterContainer.appendChild(mustRow);
		filterContainer.appendChild(summaryRow);

		targetDiv.parentNode.insertBefore(filterContainer, targetDiv);

		const handleInput = () => {
			state.excludeTerms = filterInput.value;
			state.mustHaveTerms = mustInput.value;
			storage.set(STORAGE_KEY_EXCLUDE_TERMS, state.excludeTerms);
			storage.set(STORAGE_KEY_MUST_TERMS, state.mustHaveTerms);
			applyAllFilters();
		};

		filterInput.addEventListener("input", handleInput);
		mustInput.addEventListener("input", handleInput);

		toggleBtn.addEventListener("click", () => {
			setAllowlistEnabled(!state.allowlistEnabled);
			showNotificationToast(
				state.allowlistEnabled
					? "🛡️ Brand filter enabled."
					: "👁️ Brand filter turned off. Showing all items."
			);
		});

		const autoAdvanceInput = autoAdvanceLabel.querySelector("#abf-top-auto-advance");
		if (autoAdvanceInput) {
			autoAdvanceInput.addEventListener("change", (e) => {
				setAutoAdvanceEnabled(e.target.checked);
				showNotificationToast(
					e.target.checked
						? "⏩ Auto-advance enabled on 0 results."
						: "⏸️ Auto-advance disabled."
				);
			});
		}

		setupMutationObserver();
	}

	function updateTopFilterCount() {
		const filterCount = document.getElementById("amazon-filter-count");
		if (filterCount) {
			if (!state.allowlistEnabled) {
				filterCount.textContent = `👁️ Brand Filter is OFF: All ${state.stats.total} products visible.`;
			} else if (state.stats.filtered > 0) {
				filterCount.textContent = `🛡️ ${state.stats.filtered} of ${state.stats.total} products hidden (not in brand allowlist)`;
			} else {
				filterCount.textContent = `All ${state.stats.total} products allowed.`;
			}
		}

		const statusPill = document.getElementById("abf-top-status-pill");
		if (statusPill) {
			statusPill.innerHTML = `🛡️ <strong>Allowlist:</strong> ${
				state.allowlistEnabled
					? '<span style="color:#007600;">ACTIVE</span>'
					: '<span style="color:#c40000;">OFF</span>'
			} (${state.remoteAllowlist.size} brands)`;
		}

		const toggleBtn = document.getElementById("abf-top-toggle-btn");
		if (toggleBtn) {
			if (state.allowlistEnabled) {
				toggleBtn.textContent = "👁️ Show All Items (Turn Off Filter)";
				toggleBtn.style.background = "#f0f2f2";
				toggleBtn.style.color = "#0f1111";
				toggleBtn.style.border = "1px solid #888c8c";
			} else {
				toggleBtn.textContent = "🛡️ Turn On Brand Filter";
				toggleBtn.style.background = "#ffd814";
				toggleBtn.style.color = "#0f1111";
				toggleBtn.style.border = "1px solid #fcd200";
			}
		}

		const autoAdvanceCheckbox = document.getElementById("abf-top-auto-advance");
		if (autoAdvanceCheckbox) {
			autoAdvanceCheckbox.checked = state.autoAdvanceEnabled;
		}
	}

	// =========================================================================
	// COMPACT BOTTOM-RIGHT CONTROL PANEL
	// =========================================================================
	function createControlPanel() {
		if (document.getElementById("abf-control-panel-root")) return;

		const root = document.createElement("div");
		root.id = "abf-control-panel-root";
		root.style.cssText =
			"position: fixed; bottom: 20px; right: 20px; z-index: 999998; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px;";

		// Floating Pill Button
		const pill = document.createElement("button");
		pill.id = "abf-pill-toggle";
		pill.style.cssText =
			"display: flex; align-items: center; gap: 8px; background: #131921; color: #ffffff; border: 2px solid #febd69; border-radius: 24px; padding: 8px 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.3); transition: transform 0.2s;";
		pill.innerHTML = `<span>🛡️</span> <span id="abf-pill-text">Brand Filter · ${state.stats.filtered} Hidden</span>`;

		pill.addEventListener("mouseenter", () => (pill.style.transform = "scale(1.03)"));
		pill.addEventListener("mouseleave", () => (pill.style.transform = "scale(1)"));
		pill.addEventListener("click", () => toggleControlPanel());

		// Expanded Modal Window
		const panel = document.createElement("div");
		panel.id = "abf-panel-window";
		panel.style.cssText =
			"display: none; width: 340px; max-height: 480px; background: #131921; color: #ffffff; border: 1px solid #3a4553; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,0.4); flex-direction: column; overflow: hidden;";

		panel.innerHTML = `
			<div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #232f3e; border-bottom: 1px solid #3a4553;">
				<div style="display: flex; align-items: center; gap: 8px;">
					<span style="font-size: 16px;">🛡️</span>
					<span style="font-weight: 700; font-size: 14px; color: #febd69;">Brand Allowlist</span>
				</div>
				<button id="abf-panel-close" style="background: transparent; border: none; color: #ccc; font-size: 18px; cursor: pointer; line-height: 1;">✕</button>
			</div>

			<div style="padding: 14px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">
				<!-- Stats Bar -->
				<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #0f1111; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #3a4553;">
					<div>
						<div style="font-size: 10px; color: #888;">ALLOWED</div>
						<div id="abf-stat-allowed" style="font-size: 16px; font-weight: 700; color: #00c853;">${state.stats.allowed}</div>
					</div>
					<div>
						<div style="font-size: 10px; color: #888;">HIDDEN</div>
						<div id="abf-stat-filtered" style="font-size: 16px; font-weight: 700; color: #ff5252;">${state.stats.filtered}</div>
					</div>
					<div>
						<div style="font-size: 10px; color: #888;">DATABASE</div>
						<div id="abf-stat-db" style="font-size: 16px; font-weight: 700; color: #febd69;">${state.remoteAllowlist.size}</div>
					</div>
				</div>

				<!-- Toggle & Mode -->
				<div style="display: flex; flex-direction: column; gap: 8px; background: #1b222c; padding: 10px 12px; border-radius: 8px;">
					<div style="display: flex; align-items: center; justify-content: space-between;">
						<span style="font-weight: 600; font-size: 12px;">Allowlist Active:</span>
						<label style="position: relative; display: inline-block; width: 38px; height: 20px; cursor: pointer;">
							<input type="checkbox" id="abf-toggle-allowlist" ${state.allowlistEnabled ? "checked" : ""} style="opacity: 0; width: 0; height: 0;">
							<span id="abf-toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${state.allowlistEnabled ? "#febd69" : "#555"}; border-radius: 20px; transition: .3s;"></span>
						</label>
					</div>
					<div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
						<span>Auto-Advance on 0:</span>
						<label style="position: relative; display: inline-block; width: 38px; height: 20px; cursor: pointer;">
							<input type="checkbox" id="abf-toggle-autoadvance" ${state.autoAdvanceEnabled ? "checked" : ""} style="opacity: 0; width: 0; height: 0;">
							<span id="abf-toggle-autoadvance-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${state.autoAdvanceEnabled ? "#febd69" : "#555"}; border-radius: 20px; transition: .3s;"></span>
						</label>
					</div>
					<div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-top: 2px;">
						<span>Filter Mode:</span>
						<div style="display: flex; gap: 6px;">
							<button id="abf-mode-hard" style="background: ${state.filterMode === "hard" ? "#febd69" : "#2a3442"}; color: ${state.filterMode === "hard" ? "#111" : "#fff"}; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">Hard Hide</button>
							<button id="abf-mode-soft" style="background: ${state.filterMode === "soft" ? "#febd69" : "#2a3442"}; color: ${state.filterMode === "soft" ? "#111" : "#fff"}; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">Soft Dim</button>
						</div>
					</div>
				</div>

				<!-- Add Brand to Whitelist -->
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="font-weight: 600; font-size: 12px; color: #febd69;">Add Brand to Whitelist:</div>
					<div style="display: flex; gap: 6px;">
						<input type="text" id="abf-add-brand-input" placeholder="Brand name..." style="flex: 1; background: #0f1111; color: #fff; border: 1px solid #3a4553; border-radius: 4px; padding: 5px 8px; font-size: 12px;">
						<button id="abf-add-brand-btn" style="background: #ffd814; border: none; border-radius: 4px; padding: 5px 12px; font-weight: 600; font-size: 12px; cursor: pointer; color: #111;">Add</button>
					</div>
					<div id="abf-custom-tags-container" style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 90px; overflow-y: auto; background: #0f1111; border: 1px solid #3a4553; border-radius: 6px; padding: 6px;">
						<!-- Populated dynamically -->
					</div>
				</div>

				<!-- Sync Database -->
				<div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #3a4553; padding-top: 10px;">
					<button id="abf-sync-btn" style="background: #232f3e; color: #febd69; border: 1px solid #febd69; border-radius: 4px; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer;">
						🔄 Sync Allowlist Now
					</button>
					<span id="abf-sync-status" style="font-size: 10px; color: #888;">24h Cache Active</span>
				</div>
			</div>
		`;

		root.appendChild(pill);
		root.appendChild(panel);
		document.body.appendChild(root);

		// Listeners
		document.getElementById("abf-panel-close").addEventListener("click", () => toggleControlPanel(false));

		document.getElementById("abf-toggle-allowlist").addEventListener("change", (e) => {
			setAllowlistEnabled(e.target.checked);
		});

		document.getElementById("abf-toggle-autoadvance").addEventListener("change", (e) => {
			setAutoAdvanceEnabled(e.target.checked);
			showNotificationToast(
				e.target.checked
					? "⏩ Auto-advance enabled on 0 results."
					: "⏸️ Auto-advance disabled."
			);
		});

		document.getElementById("abf-mode-hard").addEventListener("click", () => {
			setFilterMode("hard");
		});

		document.getElementById("abf-mode-soft").addEventListener("click", () => {
			setFilterMode("soft");
		});

		document.getElementById("abf-add-brand-btn").addEventListener("click", () => {
			const input = document.getElementById("abf-add-brand-input");
			if (input && input.value.trim()) {
				addCustomWhitelistBrand(input.value.trim());
				input.value = "";
			}
		});

		document.getElementById("abf-add-brand-input").addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				document.getElementById("abf-add-brand-btn").click();
			}
		});

		document.getElementById("abf-sync-btn").addEventListener("click", () => {
			const status = document.getElementById("abf-sync-status");
			status.textContent = "Syncing...";
			fetchRemoteAllowlist();
			setTimeout(() => {
				status.textContent = "Updated!";
			}, 1500);
		});

		renderCustomWhitelistList();
	}

	function toggleControlPanel(force) {
		const panel = document.getElementById("abf-panel-window");
		const pill = document.getElementById("abf-pill-toggle");
		if (!panel || !pill) return;

		state.panelOpen = typeof force === "boolean" ? force : !state.panelOpen;
		if (state.panelOpen) {
			panel.style.display = "flex";
			pill.style.display = "none";
			updateControlPanelStats();
			renderCustomWhitelistList();
		} else {
			panel.style.display = "none";
			pill.style.display = "flex";
		}
	}

	function setFilterMode(mode) {
		state.filterMode = mode;
		storage.set(STORAGE_KEY_FILTER_MODE, mode);

		const hardBtn = document.getElementById("abf-mode-hard");
		const softBtn = document.getElementById("abf-mode-soft");
		if (hardBtn && softBtn) {
			hardBtn.style.background = mode === "hard" ? "#febd69" : "#2a3442";
			hardBtn.style.color = mode === "hard" ? "#111" : "#fff";
			softBtn.style.background = mode === "soft" ? "#febd69" : "#2a3442";
			softBtn.style.color = mode === "soft" ? "#111" : "#fff";
		}

		applyAllFilters();
	}

	function updateControlPanelStats() {
		const pillText = document.getElementById("abf-pill-text");
		if (pillText) {
			pillText.textContent = `Brand Filter · ${state.stats.filtered} Hidden`;
		}

		const statAllowed = document.getElementById("abf-stat-allowed");
		if (statAllowed) statAllowed.textContent = state.stats.allowed;

		const statFiltered = document.getElementById("abf-stat-filtered");
		if (statFiltered) statFiltered.textContent = state.stats.filtered;

		const statDb = document.getElementById("abf-stat-db");
		if (statDb) statDb.textContent = state.remoteAllowlist.size;

		const allowlistCheckbox = document.getElementById("abf-toggle-allowlist");
		if (allowlistCheckbox) allowlistCheckbox.checked = state.allowlistEnabled;
		const toggleSlider = document.getElementById("abf-toggle-slider");
		if (toggleSlider) toggleSlider.style.backgroundColor = state.allowlistEnabled ? "#febd69" : "#555";

		const autoAdvanceCheckbox = document.getElementById("abf-toggle-autoadvance");
		if (autoAdvanceCheckbox) autoAdvanceCheckbox.checked = state.autoAdvanceEnabled;
		const autoAdvanceSlider = document.getElementById("abf-toggle-autoadvance-slider");
		if (autoAdvanceSlider) autoAdvanceSlider.style.backgroundColor = state.autoAdvanceEnabled ? "#febd69" : "#555";
	}

	function renderCustomWhitelistList() {
		const container = document.getElementById("abf-custom-tags-container");
		if (!container) return;

		container.innerHTML = "";
		const customList = storage.get(STORAGE_KEY_CUSTOM_WHITELIST, []);
		if (customList.length === 0) {
			container.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center; width: 100%; padding: 4px;">No custom brands added yet.</div>';
			return;
		}

		customList.forEach((brand) => {
			const tag = document.createElement("span");
			tag.style.cssText =
				"display: inline-flex; align-items: center; gap: 4px; background: #232f3e; color: #ffffff; border: 1px solid #3a4553; border-radius: 12px; padding: 2px 8px; font-size: 11px;";
			tag.innerHTML = `
				<span>${escapeHtml(brand)}</span>
				<button class="abf-remove-tag-btn" style="background: transparent; border: none; color: #ff5252; cursor: pointer; font-size: 12px; line-height: 1; padding: 0;">✕</button>
			`;
			tag.querySelector(".abf-remove-tag-btn").addEventListener("click", () => {
				removeCustomWhitelistBrand(brand);
			});
			container.appendChild(tag);
		});
	}

	function escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text || "";
		return div.innerHTML;
	}

	// =========================================================================
	// MUTATION OBSERVER (SPA, INFINITE SCROLL, PAGINATION)
	// =========================================================================
	function setupMutationObserver() {
		if (state.observer) {
			state.observer.disconnect();
		}

		const targetNode =
			document.querySelector("div.s-main-slot") ||
			document.getElementById("search") ||
			document.body;

		if (!targetNode) {
			setTimeout(setupMutationObserver, 500);
			return;
		}

		const debouncedApply = () => {
			if (state.isDebouncing) return;
			state.isDebouncing = true;
			requestAnimationFrame(() => {
				applyAllFilters();
				state.isDebouncing = false;
			});
		};

		state.observer = new MutationObserver((mutations) => {
			let shouldRun = false;
			for (const mutation of mutations) {
				if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (
								node.matches?.(RESULT_SELECTOR) ||
								node.querySelector?.(RESULT_SELECTOR) ||
								node.classList?.contains("s-result-item")
							) {
								shouldRun = true;
								break;
							}
						}
					}
				}
				if (shouldRun) break;
			}

			if (shouldRun) {
				debouncedApply();
			}
		});

		state.observer.observe(targetNode, {
			childList: true,
			subtree: true,
		});
	}

	// =========================================================================
	// MENU COMMANDS
	// =========================================================================
	function registerTampermonkeyMenuCommands() {
		if (typeof GM_registerMenuCommand === "function") {
			GM_registerMenuCommand("👁️ Show All / Toggle Brand Filter", () => {
				setAllowlistEnabled(!state.allowlistEnabled);
				showNotificationToast(
					state.allowlistEnabled
						? "🛡️ Brand filter enabled."
						: "👁️ Brand filter turned off. Showing all items."
				);
			});
			GM_registerMenuCommand("⏩ Toggle Auto-Advance on Zero Results", () => {
				setAutoAdvanceEnabled(!state.autoAdvanceEnabled);
				showNotificationToast(
					state.autoAdvanceEnabled
						? "⏩ Auto-advance enabled on 0 results."
						: "⏸️ Auto-advance disabled."
				);
			});
			GM_registerMenuCommand("🛡️ Toggle Brand Filter Control Panel", () => {
				toggleControlPanel();
			});
			GM_registerMenuCommand("🔄 Sync Brand Allowlist Database Now", () => {
				fetchRemoteAllowlist();
			});
			GM_registerMenuCommand("⚙️ Set Filter Mode: Hard Hide", () => {
				setFilterMode("hard");
			});
			GM_registerMenuCommand("⚙️ Set Filter Mode: Soft Dim", () => {
				setFilterMode("soft");
			});
		}
	}

	// =========================================================================
	// INITIALIZATION ENTRYPOINT
	// =========================================================================
	function init() {
		initAllowlists();
		addTopFilterInput();
		createControlPanel();
		registerTampermonkeyMenuCommands();
		applyAllFilters();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
