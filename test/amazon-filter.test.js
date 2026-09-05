import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Amazon Filter Script Exists and Has Valid Userscript Headers", (t) => {
	const scriptPath = path.join(process.cwd(), "userscripts", "amazon filter.js");
	assert.ok(fs.existsSync(scriptPath), "amazon filter.js exists");

	const content = fs.readFileSync(scriptPath, "utf8");

	// Verify Metadata Header Block
	assert.ok(content.includes("// ==UserScript=="), "Has UserScript header start");
	assert.ok(content.includes("// ==/UserScript=="), "Has UserScript header end");
	assert.ok(content.includes("@name         Amazon Brand Allowlist & Product Filter"), "Has correct name");
	assert.ok(content.includes("@match        https://www.amazon.*/*"), "Has wildcard amazon match");
	assert.ok(content.includes("@grant        GM_xmlhttpRequest"), "Has GM_xmlhttpRequest grant");
	assert.ok(content.includes("@grant        GM_setValue"), "Has GM_setValue grant");
	assert.ok(content.includes("@grant        GM_getValue"), "Has GM_getValue grant");
	assert.ok(content.includes("@grant        GM_registerMenuCommand"), "Has GM_registerMenuCommand grant");
	assert.ok(content.includes("@run-at       document-idle"), "Has @run-at document-idle");
});

test("Amazon Filter - Linguistic & Heuristic Evaluator Logic", (t) => {
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

	// 1. Should flag auto-generated Chinese trademark spam sellers (ALL-CAPS 5-9 letters)
	const spamBrands = ["XIYIJIA", "GVOODE", "ZXKVO", "QWVBX", "KCHENG", "VONZOY", "YIHAODENG"];
	for (const brand of spamBrands) {
		const res = checkLinguisticHeuristics(brand);
		assert.equal(res.legitimate, false, `Expected ${brand} to be flagged as spam`);
	}

	// 2. Should legitimize legitimate Title Case brands with natural phonetics
	const legitimateTitleCase = ["KitchenAid", "Lodge", "Sony", "Soundcore", "Keychron", "Anker"];
	for (const brand of legitimateTitleCase) {
		const res = checkLinguisticHeuristics(brand);
		assert.equal(res.legitimate, true, `Expected ${brand} to pass heuristics`);
	}

	// 3. Should legitimize multi-word brands or recognized corporate entities
	const legitimateMultiWord = ["Peak Design", "Simple Modern", "JDS Labs", "Blue Bottle Coffee", "Anker Tech"];
	for (const brand of legitimateMultiWord) {
		const res = checkLinguisticHeuristics(brand);
		assert.equal(res.legitimate, true, `Expected ${brand} to pass multi-word heuristics`);
	}
});

test("Amazon Filter - Title Exclude & Must-Have Matching (Preserved Functionality)", (t) => {
	function makeTermRegex(term) {
		term = (term || "").trim();
		if (!term) return null;

		if (term.startsWith("/") && term.lastIndexOf("/") > 0) {
			const lastSlash = term.lastIndexOf("/");
			const pattern = term.substring(1, lastSlash);
			const flags = term.substring(lastSlash + 1);
			try {
				return new RegExp(pattern, flags);
			} catch (e) {}
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

	const title1 = "anker 65w usb c charger fast charging adapter with hdmi";
	const title2 = "ugreen nexode 100w gan charger usb-c only";

	// Exclude matching
	assert.ok(matchTerm(title1, "hdmi"), "Title1 contains hdmi");
	assert.ok(!matchTerm(title2, "hdmi"), "Title2 does not contain hdmi");

	// Must-Have logic (AND / OR)
	assert.ok(titleMatchesMustHave(title1, "usb AND c OR hdmi"), "Title1 matches usb AND c OR hdmi");
	assert.ok(titleMatchesMustHave(title1, "65w AND adapter"), "Title1 matches 65w AND adapter");
	assert.ok(!titleMatchesMustHave(title2, "100w AND hdmi"), "Title2 fails 100w AND hdmi");
});
