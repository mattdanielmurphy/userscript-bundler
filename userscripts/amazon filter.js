// ==UserScript==
// @name         Amazon Brand Allowlist & Product Filter
// @namespace    https://github.com/mattdanielmurphy
// @version      2.0.0
// @description  Aggressive allowlist (whitelist) brand filter and keyword filter for Amazon (.com, .ca, .co.uk, etc.) to eradicate dropshipping scams and auto-generated seller accounts.
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
	const STORAGE_KEY_EXCLUDE_TERMS = "abf_exclude_terms";
	const STORAGE_KEY_MUST_TERMS = "abf_must_have_terms";

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
	// Top ~350 reputable brands across tech, audio, household, appliances, fashion,
	// tools, and outdoor categories. Enables zero-latency filtering on fresh installs
	// even before remote community lists finish background fetching.
	const SEED_BRANDS = [
		"3m", "8bitdo", "acer", "adidas", "akg", "alexa", "alienware", "altra", "amazon", "amazon basics",
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
		filterMode: storage.get(STORAGE_KEY_FILTER_MODE, "hard"), // 'hard' | 'soft'
		allowlistEnabled: storage.get(STORAGE_KEY_ALLOWLIST_ENABLED, true),
		excludeTerms: storage.get(STORAGE_KEY_EXCLUDE_TERMS, ""),
		mustHaveTerms: storage.get(STORAGE_KEY_MUST_TERMS, ""),
		stats: {
			total: 0,
			allowed: 0,
			filtered: 0,
			byBrand: 0,
			byKeyword: 0,
		},
		filteredBrandsOnPage: new Map(), // brand -> { count, reason, sampleAsin }
		observer: null,
		isDebouncing: false,
		panelOpen: false,
	};

	// =========================================================================
	// STRING NORMALIZATION & PARSING UTILITIES
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
				// Fallback to literal if invalid regex
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
	// TIER 1: EXTERNAL ALLOWLIST FETCHING & LOCAL CACHE
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

		// 4. If cache is stale or missing, fetch in background
		if (!isCacheValid || !cachedData || cachedData.length === 0) {
			fetchRemoteAllowlist();
		}
	}

	function fetchRemoteAllowlist(force = false) {
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
					} else {
						console.warn("[Amazon Filter] Remote fetch failed with status:", response.status);
					}
				},
				onerror(err) {
					console.warn("[Amazon Filter] GM_xmlhttpRequest error, falling back to window.fetch:", err);
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
				console.warn("[Amazon Filter] Fallback fetch failed:", e);
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

	/**
	 * Extracts candidate brand strings, store links, and title prefixes from search card.
	 */
	function extractBrandContext(card) {
		// 1. Check for official store link: /stores/ or me= parameter
		const storeAnchor = card.querySelector(
			'a[href*="/stores/"], a[href*="/stores/page/"], a[href*="/stores/node/"], a[href*="me="]:not([href*="/s?"])'
		);
		let storeUrl = storeAnchor ? storeAnchor.getAttribute("href") : "";
		let storeBrandName = "";

		if (storeAnchor) {
			const anchorText = storeAnchor.textContent.trim();
			const visitMatch = anchorText.match(/(?:visit the|brand:)\s+([^.]+?)\s*(?:store|$)/i);
			if (visitMatch) {
				storeBrandName = visitMatch[1].trim();
			} else if (anchorText && anchorText.length < 35 && !anchorText.includes("http")) {
				storeBrandName = anchorText;
			} else if (storeUrl) {
				const match = storeUrl.match(/\/stores\/(?:page\/)?([A-Za-z0-9%_-]+)/);
				if (match && !match[1].startsWith("node")) {
					storeBrandName = decodeURIComponent(match[1]).replace(/[-_]/g, " ");
				}
			}
		}

		// 2. Check for explicit brand heading element
		let explicitBrandName = "";
		const brandHeading = card.querySelector(
			"h2.a-size-mini span, h5.s-line-clamp-1 span, span.s-brand-name, a.s-line-clamp-1 span"
		);
		if (brandHeading && brandHeading.textContent.trim()) {
			const text = brandHeading.textContent.trim();
			if (text.length < 40) explicitBrandName = text;
		}

		// 3. Title fallback: extract candidate tokens (first 1, 2, or 3 words)
		const title = getCardTitle(card);
		let token1 = "";
		let token2 = "";
		let token3 = "";
		if (title) {
			const words = title.split(/\s+/).filter(Boolean);
			if (words.length > 0) token1 = words[0];
			if (words.length > 1) token2 = words.slice(0, 2).join(" ");
			if (words.length > 2) token3 = words.slice(0, 3).join(" ");
		}

		// Select best candidate display brand name
		const primaryBrand = storeBrandName || explicitBrandName || token2 || token1 || "Unknown Brand";

		return {
			primaryBrand,
			storeBrandName,
			storeUrl,
			explicitBrandName,
			token1,
			token2,
			token3,
			title,
		};
	}

	// =========================================================================
	// TIER 2 & TIER 3 EVALUATORS
	// =========================================================================

	/**
	 * TIER 2: Checks structural on-page Amazon signals (Store URLs, Fulfilled/Sold by Amazon, Badges).
	 */
	function checkStructuralSignals(card, ctx) {
		// Signal A: Official Amazon Brand Store Link
		if (ctx.storeUrl && (ctx.storeUrl.includes("/stores/") || ctx.storeUrl.includes("/stores/page/"))) {
			return {
				legitimate: true,
				reason: "Official Amazon Brand Store",
				brand: ctx.storeBrandName || ctx.primaryBrand,
			};
		}

		// Signal B: Sold or Shipped by Amazon
		const cardText = card.textContent || "";
		if (
			/ships\s+from\s+(?:amazon|\bamazon\.[a-z.]+)/i.test(cardText) ||
			/sold\s+by\s+(?:amazon|\bamazon\.[a-z.]+)/i.test(cardText) ||
			/fulfilled\s+by\s+amazon/i.test(cardText)
		) {
			return {
				legitimate: true,
				reason: "Ships / Sold by Amazon",
				brand: ctx.primaryBrand,
			};
		}

		// Signal C: Amazon's Choice, Best Seller, or Established Brand Badges
		const badge = card.querySelector(
			'.a-badge-text, [aria-label*="Amazon\'s Choice"], [aria-label*="Best Seller"], [aria-label*="Overall Pick"], span[id*="amazons-choice"], span[id*="best-seller"]'
		);
		if (badge) {
			return {
				legitimate: true,
				reason: "Amazon Choice / Best Seller badge",
				brand: ctx.primaryBrand,
			};
		}

		if (/\b(?:amazon's\s+choice|best\s+seller|overall\s+pick|climate\s+pledge\s+friendly)\b/i.test(cardText)) {
			return {
				legitimate: true,
				reason: "Verified Amazon Badge",
				brand: ctx.primaryBrand,
			};
		}

		return { legitimate: false };
	}

	/**
	 * TIER 3: Algorithmic & Linguistic Heuristic Analyzer.
	 */
	function checkLinguisticHeuristics(brandName) {
		if (!brandName || typeof brandName !== "string") {
			return { legitimate: false, reason: "No brand name provided" };
		}

		const clean = brandName.trim();
		if (clean.length < 2) {
			return { legitimate: false, reason: "Brand name too short" };
		}

		// Flag spam seller signature: ALL-CAPS single-block string between 5 and 9 letters
		const isSingleWord = !/\s/.test(clean);
		if (isSingleWord && /^[A-Z]{5,9}$/.test(clean)) {
			return {
				legitimate: false,
				reason: `Suspicious ALL-CAPS single-block string ("${clean}")`,
			};
		}

		// Positive Test 1: Multi-word real name or recognized corporate suffix
		const corporateSuffixPattern =
			/\b(inc|llc|co|ltd|corp|corporation|laboratories|labs|studios|works|supply|outfitters|company|brands|workshop|designs|tech|electronics|audio|sound|living|home|gear|industries|sports|kitchen|craft)\b/i;
		const words = clean.split(/\s+/).filter(Boolean);
		if (words.length >= 2 || corporateSuffixPattern.test(clean)) {
			return {
				legitimate: true,
				reason: "Multi-word or recognized corporate brand structure",
			};
		}

		// Positive Test 2: Natural Phonetics & Vowel Ratio
		const lettersOnly = clean.replace(/[^a-zA-Z]/g, "");
		if (lettersOnly.length === 0) {
			return { legitimate: false, reason: "No alphabetic letters" };
		}

		const vowelMatches = lettersOnly.match(/[aeiouy]/gi);
		const vowelCount = vowelMatches ? vowelMatches.length : 0;
		const vowelRatio = vowelCount / lettersOnly.length;

		// Disqualify if containing 4 or more consecutive consonants (e.g., ZXKV, QWVB, KCHG)
		const hasConsonantCluster = /[bcdfghjklmnpqrstvwxz]{4,}/i.test(lettersOnly);
		if (hasConsonantCluster) {
			return {
				legitimate: false,
				reason: `Unnatural 4+ consonant cluster in "${clean}"`,
			};
		}

		// Check for standard Title Case (e.g. "KitchenAid", "Lodge", "Sony", "Soundcore")
		const isTitleCase = /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*$/.test(clean);

		// Natural vowel ratio must be between 25% and 60%
		if (vowelRatio >= 0.25 && vowelRatio <= 0.6) {
			if (isTitleCase) {
				return {
					legitimate: true,
					reason: `Title Case with natural phonetics (${Math.round(vowelRatio * 100)}% vowels)`,
				};
			}
		}

		return {
			legitimate: false,
			reason: `Linguistic heuristic failed (vowel ratio ${Math.round(vowelRatio * 100)}%)`,
		};
	}

	// =========================================================================
	// COMPREHENSIVE CARD EVALUATION ENGINE
	// =========================================================================
	function evaluateCard(card) {
		const ctx = extractBrandContext(card);
		const normPrimary = normalizeBrand(ctx.primaryBrand);
		const normExplicit = normalizeBrand(ctx.explicitBrandName);
		const normToken1 = normalizeBrand(ctx.token1);
		const normToken2 = normalizeBrand(ctx.token2);
		const normToken3 = normalizeBrand(ctx.token3);

		// ---------------------------------------------------------------------
		// 1. TIER 4: Local User Custom Whitelist
		// ---------------------------------------------------------------------
		if (
			state.customWhitelist.has(normPrimary) ||
			state.customWhitelist.has(normExplicit) ||
			state.customWhitelist.has(normToken1) ||
			state.customWhitelist.has(normToken2) ||
			state.customWhitelist.has(normToken3)
		) {
			return {
				allowed: true,
				tier: 4,
				reason: "User Custom Whitelist",
				brand: ctx.primaryBrand,
			};
		}

		// ---------------------------------------------------------------------
		// 2. TIER 1: External Open Allowlist Sync & Seed Database
		// ---------------------------------------------------------------------
		let matchedAllowlistBrand = null;
		if (state.remoteAllowlist.has(normPrimary)) matchedAllowlistBrand = ctx.primaryBrand;
		else if (state.remoteAllowlist.has(normExplicit)) matchedAllowlistBrand = ctx.explicitBrandName;
		else if (state.remoteAllowlist.has(normToken3)) matchedAllowlistBrand = ctx.token3;
		else if (state.remoteAllowlist.has(normToken2)) matchedAllowlistBrand = ctx.token2;
		else if (state.remoteAllowlist.has(normToken1)) matchedAllowlistBrand = ctx.token1;

		if (matchedAllowlistBrand) {
			return {
				allowed: true,
				tier: 1,
				reason: "Allowlist Database",
				brand: matchedAllowlistBrand,
			};
		}

		// ---------------------------------------------------------------------
		// 3. TIER 2: Structural On-Page Amazon Signals
		// ---------------------------------------------------------------------
		const tier2 = checkStructuralSignals(card, ctx);
		if (tier2.legitimate) {
			return {
				allowed: true,
				tier: 2,
				reason: tier2.reason,
				brand: tier2.brand || ctx.primaryBrand,
			};
		}

		// ---------------------------------------------------------------------
		// 4. TIER 3: Algorithmic & Linguistic Heuristic Fallback
		// ---------------------------------------------------------------------
		const candidateForHeuristic = ctx.explicitBrandName || ctx.token1 || ctx.primaryBrand;
		const tier3 = checkLinguisticHeuristics(candidateForHeuristic);
		if (tier3.legitimate) {
			return {
				allowed: true,
				tier: 3,
				reason: tier3.reason,
				brand: candidateForHeuristic,
			};
		}

		// ---------------------------------------------------------------------
		// UNVERIFIED / FAILED ALLOWLIST CHECK
		// ---------------------------------------------------------------------
		return {
			allowed: false,
			tier: 0,
			reason: tier3.reason || "Unverified Brand",
			brand: candidateForHeuristic || "Unknown Brand",
		};
	}

	// =========================================================================
	// FILTERING PIPELINE & CARD VISIBILITY APPLIER
	// =========================================================================
	function applyCardVisibility(card, isAllowed, filterReason, brandName) {
		const asin = card.getAttribute("data-asin") || "";

		// Remove any existing placeholder bar
		const existingBar = card.previousElementSibling;
		if (existingBar && existingBar.classList.contains("abf-placeholder-bar")) {
			existingBar.remove();
		}

		// Remove any existing soft-dim overlay inside card
		const existingOverlay = card.querySelector(".abf-card-overlay");
		if (existingOverlay) existingOverlay.remove();

		if (isAllowed) {
			card.style.removeProperty("display");
			card.style.removeProperty("opacity");
			card.style.removeProperty("filter");
			card.style.removeProperty("transition");
			card.removeAttribute("data-abf-hidden");
			return;
		}

		card.setAttribute("data-abf-hidden", "true");
		card.setAttribute("data-abf-brand", brandName);

		if (state.filterMode === "hard") {
			// HARD HIDE: set display none + inject subtle 1-line bar for recovery/whitelisting
			card.style.display = "none";

			const placeholder = document.createElement("div");
			placeholder.className = "abf-placeholder-bar";
			placeholder.style.cssText =
				"display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; margin: 4px 0; background: #f8f9fa; border: 1px dashed #d5d9d9; border-radius: 6px; font-size: 11px; color: #565959; box-sizing: border-box;";

			placeholder.innerHTML = `
				<div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
					<span style="font-size: 13px;">🛡️</span>
					<span>Hidden: <strong style="color: #0f1111;">${escapeHtml(brandName)}</strong> <span style="color: #888;">(${escapeHtml(filterReason)})</span></span>
				</div>
				<div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
					<button class="abf-quick-whitelist-btn" style="background: #ffd814; border: 1px solid #fcd200; border-radius: 12px; padding: 2px 8px; font-size: 10px; font-weight: 600; cursor: pointer; color: #0f1111;">+ Whitelist</button>
					<button class="abf-quick-reveal-btn" style="background: #ffffff; border: 1px solid #d5d9d9; border-radius: 12px; padding: 2px 8px; font-size: 10px; cursor: pointer; color: #565959;">👁️ Reveal</button>
				</div>
			`;

			const whitelistBtn = placeholder.querySelector(".abf-quick-whitelist-btn");
			whitelistBtn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				addCustomWhitelistBrand(brandName);
			});

			const revealBtn = placeholder.querySelector(".abf-quick-reveal-btn");
			revealBtn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				card.style.removeProperty("display");
				placeholder.style.opacity = "0.5";
				revealBtn.textContent = "✓ Shown";
			});

			card.parentNode.insertBefore(placeholder, card);
		} else {
			// SOFT DIM: Dim element to 0.18 opacity + grayscale + inline hover overlay
			card.style.removeProperty("display");
			card.style.opacity = "0.18";
			card.style.filter = "grayscale(100%)";
			card.style.transition = "opacity 0.2s ease, filter 0.2s ease";
			card.style.position = "relative";

			const overlay = document.createElement("div");
			overlay.className = "abf-card-overlay";
			overlay.style.cssText =
				"position: absolute; top: 6px; right: 6px; z-index: 20; display: flex; align-items: center; gap: 6px; background: rgba(19, 25, 33, 0.92); color: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 11px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);";

			overlay.innerHTML = `
				<span>🛡️ Dimmed: <strong>${escapeHtml(brandName)}</strong></span>
				<button class="abf-overlay-whitelist-btn" style="background: #febd69; border: none; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; cursor: pointer; color: #111;">+ Whitelist</button>
			`;

			const whitelistBtn = overlay.querySelector(".abf-overlay-whitelist-btn");
			whitelistBtn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				addCustomWhitelistBrand(brandName);
			});

			const handleEnter = () => {
				card.style.opacity = "0.95";
				card.style.filter = "none";
			};
			const handleLeave = () => {
				card.style.opacity = "0.18";
				card.style.filter = "grayscale(100%)";
			};

			card.addEventListener("mouseenter", handleEnter);
			card.addEventListener("mouseleave", handleLeave);

			card.appendChild(overlay);
		}
	}

	function applyAllFilters() {
		const excludeTerms = parseExcludeTerms(state.excludeTerms);
		const mustString = (state.mustHaveTerms || "").trim();
		const excludeActive = excludeTerms.length > 0;
		const mustActive = mustString !== "";

		const cards = getSearchResultCards();

		state.stats.total = cards.length;
		state.stats.allowed = 0;
		state.stats.filtered = 0;
		state.stats.byBrand = 0;
		state.stats.byKeyword = 0;
		state.filteredBrandsOnPage.clear();

		cards.forEach((card) => {
			const title = getCardTitle(card);

			// 1. Check title keyword exclusions (Exclude terms)
			if (excludeActive && title && excludeTerms.some((term) => matchTerm(title, term))) {
				state.stats.filtered++;
				state.stats.byKeyword++;
				applyCardVisibility(card, false, "Keyword Excluded", "Product");
				return;
			}

			// 2. Check title keyword requirements (Must have terms)
			if (mustActive && title && !titleMatchesMustHave(title, mustString)) {
				state.stats.filtered++;
				state.stats.byKeyword++;
				applyCardVisibility(card, false, "Missing Required Term", "Product");
				return;
			}

			// 3. Check Brand Allowlist (if enabled)
			if (state.allowlistEnabled) {
				const evaluation = evaluateCard(card);
				if (!evaluation.allowed) {
					state.stats.filtered++;
					state.stats.byBrand++;

					const currentBrandStat = state.filteredBrandsOnPage.get(evaluation.brand) || {
						count: 0,
						reason: evaluation.reason,
					};
					currentBrandStat.count++;
					state.filteredBrandsOnPage.set(evaluation.brand, currentBrandStat);

					applyCardVisibility(card, false, evaluation.reason, evaluation.brand);
					return;
				}
			}

			// Product passed all active filters
			state.stats.allowed++;
			applyCardVisibility(card, true);
		});

		updateTopFilterCount();
		updateControlPanelStats();
	}

	function escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text || "";
		return div.innerHTML;
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

		showNotificationToast(`✅ Whitelisted "${brandName}"`);
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
	// IN-PAGE TOP SEARCH FILTER INPUTS (PRESERVED FROM ORIGINAL USERSCRIPT)
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

		// Summary row with Allowlist badge and filter count
		const summaryRow = document.createElement("div");
		summaryRow.style.cssText =
			"display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #565959; padding-top: 4px; border-top: 1px solid #f0f2f2;";

		const filterCount = document.createElement("span");
		filterCount.id = "amazon-filter-count";
		filterCount.style.cssText = "font-weight: 600; color: #007185;";

		const statusPill = document.createElement("span");
		statusPill.innerHTML = `🛡️ <strong>Allowlist Filter:</strong> ${state.allowlistEnabled ? '<span style="color:#007600;">ACTIVE</span>' : '<span style="color:#c40000;">OFF</span>'} (${state.remoteAllowlist.size} verified brands)`;

		summaryRow.appendChild(filterCount);
		summaryRow.appendChild(statusPill);

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

		setupMutationObserver();
	}

	function updateTopFilterCount() {
		const filterCount = document.getElementById("amazon-filter-count");
		if (filterCount) {
			if (state.stats.filtered > 0) {
				filterCount.textContent = `🛡️ ${state.stats.filtered} of ${state.stats.total} products filtered (${state.stats.byBrand} unverified brands, ${state.stats.byKeyword} keyword exclusions)`;
			} else {
				filterCount.textContent = `All ${state.stats.total} products allowed.`;
			}
		}
	}

	// =========================================================================
	// FLOATING COLLAPSIBLE CONTROL PANEL (TIER 4 UI)
	// =========================================================================
	function createControlPanel() {
		if (document.getElementById("abf-control-panel-root")) return;

		const root = document.createElement("div");
		root.id = "abf-control-panel-root";
		root.style.cssText =
			"position: fixed; bottom: 20px; right: 20px; z-index: 999998; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px;";

		// Minimized Floating Pill Button
		const pill = document.createElement("button");
		pill.id = "abf-pill-toggle";
		pill.style.cssText =
			"display: flex; align-items: center; gap: 8px; background: #131921; color: #ffffff; border: 2px solid #febd69; border-radius: 24px; padding: 8px 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.3); transition: transform 0.2s, background 0.2s;";
		pill.innerHTML = `<span>🛡️</span> <span id="abf-pill-text">Brand Filter · ${state.stats.filtered} Hidden</span>`;

		pill.addEventListener("mouseenter", () => (pill.style.transform = "scale(1.03)"));
		pill.addEventListener("mouseleave", () => (pill.style.transform = "scale(1)"));
		pill.addEventListener("click", () => toggleControlPanel());

		// Expanded Modal Window
		const panel = document.createElement("div");
		panel.id = "abf-panel-window";
		panel.style.cssText =
			"display: none; width: 360px; max-height: 520px; background: #131921; color: #ffffff; border: 1px solid #3a4553; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,0.4); flex-direction: column; overflow: hidden;";

		panel.innerHTML = `
			<div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #232f3e; border-bottom: 1px solid #3a4553;">
				<div style="display: flex; align-items: center; gap: 8px;">
					<span style="font-size: 16px;">🛡️</span>
					<span style="font-weight: 700; font-size: 14px; color: #febd69;">Amazon Brand Allowlist</span>
				</div>
				<button id="abf-panel-close" style="background: transparent; border: none; color: #ccc; font-size: 18px; cursor: pointer; line-height: 1;">✕</button>
			</div>

			<div style="padding: 14px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-height: 450px;">
				<!-- Stats Bar -->
				<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #0f1111; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #3a4553;">
					<div>
						<div style="font-size: 10px; color: #888;">ALLOWED</div>
						<div id="abf-stat-allowed" style="font-size: 16px; font-weight: 700; color: #00c853;">${state.stats.allowed}</div>
					</div>
					<div>
						<div style="font-size: 10px; color: #888;">FILTERED</div>
						<div id="abf-stat-filtered" style="font-size: 16px; font-weight: 700; color: #ff5252;">${state.stats.filtered}</div>
					</div>
					<div>
						<div style="font-size: 10px; color: #888;">DATABASE</div>
						<div id="abf-stat-db" style="font-size: 16px; font-weight: 700; color: #febd69;">${state.remoteAllowlist.size}</div>
					</div>
				</div>

				<!-- Filter Mode & Master Switch -->
				<div style="display: flex; flex-direction: column; gap: 8px; background: #1b222c; padding: 10px 12px; border-radius: 8px;">
					<div style="display: flex; align-items: center; justify-content: space-between;">
						<span style="font-weight: 600; font-size: 12px;">Allowlist Filtering:</span>
						<label style="position: relative; display: inline-block; width: 38px; height: 20px; cursor: pointer;">
							<input type="checkbox" id="abf-toggle-allowlist" ${state.allowlistEnabled ? "checked" : ""} style="opacity: 0; width: 0; height: 0;">
							<span id="abf-toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${state.allowlistEnabled ? "#febd69" : "#555"}; border-radius: 20px; transition: .3s;"></span>
						</label>
					</div>
					<div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-top: 4px;">
						<span>Filter Mode:</span>
						<div style="display: flex; gap: 6px;">
							<button id="abf-mode-hard" style="background: ${state.filterMode === "hard" ? "#febd69" : "#2a3442"}; color: ${state.filterMode === "hard" ? "#111" : "#fff"}; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">Hard Hide</button>
							<button id="abf-mode-soft" style="background: ${state.filterMode === "soft" ? "#febd69" : "#2a3442"}; color: ${state.filterMode === "soft" ? "#111" : "#fff"}; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">Soft Dim</button>
						</div>
					</div>
				</div>

				<!-- Filtered on This Page Section -->
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="font-weight: 600; font-size: 12px; color: #febd69; display: flex; justify-content: space-between;">
						<span>Filtered On This Page:</span>
						<span id="abf-filtered-count-badge" style="color: #aaa; font-weight: normal;">(${state.filteredBrandsOnPage.size} brands)</span>
					</div>
					<div id="abf-filtered-page-list" style="max-height: 100px; overflow-y: auto; background: #0f1111; border: 1px solid #3a4553; border-radius: 6px; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
						<!-- Dynamically populated -->
					</div>
				</div>

				<!-- Custom Whitelist Manager -->
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="font-weight: 600; font-size: 12px; color: #febd69;">Custom User Whitelist:</div>
					<div style="display: flex; gap: 6px;">
						<input type="text" id="abf-add-brand-input" placeholder="Enter brand name..." style="flex: 1; background: #0f1111; color: #fff; border: 1px solid #3a4553; border-radius: 4px; padding: 5px 8px; font-size: 12px;">
						<button id="abf-add-brand-btn" style="background: #ffd814; border: none; border-radius: 4px; padding: 5px 12px; font-weight: 600; font-size: 12px; cursor: pointer; color: #111;">Add</button>
					</div>
					<div id="abf-custom-tags-container" style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 90px; overflow-y: auto; background: #0f1111; border: 1px solid #3a4553; border-radius: 6px; padding: 6px;">
						<!-- Dynamically populated -->
					</div>
				</div>

				<!-- Remote Database Sync Action -->
				<div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #3a4553; padding-top: 10px;">
					<button id="abf-sync-btn" style="background: #232f3e; color: #febd69; border: 1px solid #febd69; border-radius: 4px; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
						<span>🔄</span> Sync Allowlist Now
					</button>
					<span id="abf-sync-status" style="font-size: 10px; color: #888;">24h Cache Active</span>
				</div>
			</div>
		`;

		root.appendChild(pill);
		root.appendChild(panel);
		document.body.appendChild(root);

		// Event listeners for control panel
		document.getElementById("abf-panel-close").addEventListener("click", () => toggleControlPanel(false));

		document.getElementById("abf-toggle-allowlist").addEventListener("change", (e) => {
			state.allowlistEnabled = e.target.checked;
			storage.set(STORAGE_KEY_ALLOWLIST_ENABLED, state.allowlistEnabled);
			document.getElementById("abf-toggle-slider").style.backgroundColor = state.allowlistEnabled
				? "#febd69"
				: "#555";
			applyAllFilters();
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
			fetchRemoteAllowlist(true);
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

		const countBadge = document.getElementById("abf-filtered-count-badge");
		if (countBadge) countBadge.textContent = `(${state.filteredBrandsOnPage.size} brands)`;

		// Render list of filtered brands on page
		const filteredList = document.getElementById("abf-filtered-page-list");
		if (filteredList) {
			filteredList.innerHTML = "";
			if (state.filteredBrandsOnPage.size === 0) {
				filteredList.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center; padding: 4px;">No unverified brands on this page.</div>';
			} else {
				state.filteredBrandsOnPage.forEach((stat, brand) => {
					const row = document.createElement("div");
					row.style.cssText =
						"display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 2px 4px; border-radius: 4px; background: #161c24;";
					row.innerHTML = `
						<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px;" title="${escapeHtml(stat.reason)}">
							<strong>${escapeHtml(brand)}</strong> <span style="color: #888;">(${stat.count})</span>
						</span>
						<button class="abf-quick-allow-brand" style="background: #ffd814; border: none; border-radius: 3px; padding: 1px 6px; font-size: 10px; font-weight: 600; cursor: pointer; color: #111;">+ Whitelist</button>
					`;
					row.querySelector(".abf-quick-allow-brand").addEventListener("click", () => {
						addCustomWhitelistBrand(brand);
					});
					filteredList.appendChild(row);
				});
			}
		}
	}

	function renderCustomWhitelistList() {
		const container = document.getElementById("abf-custom-tags-container");
		if (!container) return;

		container.innerHTML = "";
		const customList = storage.get(STORAGE_KEY_CUSTOM_WHITELIST, []);
		if (customList.length === 0) {
			container.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center; width: 100%; padding: 4px;">No custom whitelisted brands yet.</div>';
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
			GM_registerMenuCommand("🛡️ Toggle Brand Filter Control Panel", () => {
				toggleControlPanel();
			});
			GM_registerMenuCommand("🔄 Sync Brand Allowlist Database Now", () => {
				fetchRemoteAllowlist(true);
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

	// Run initialization when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
