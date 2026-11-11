// ==UserScript==
// @name         Rate Your Music
// @namespace    http://tampermonkey.net/
// @version      2026-11-11
// @description  Feeds Music Connect's RYM score database: saves ratings from the RYM pages you open, and fetches (slowly, with your session) the pages Music Connect asks for while an RYM tab is open. Also embeds the Apple Music player on release pages.
// @author       Matt
// @match        https://rateyourmusic.com/*
// @icon         https://www.google.com/s2/favicons?sz=256&domain=rateyourmusic.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      127.0.0.1
// ==/UserScript==

// How it works
// - Every RYM page you open (album, chart, artist, genre) is parsed and posted to Music Connect
//   (http://127.0.0.1:47821/rym/ingest), which stores it in music.db. A small corner note says so.
// - While a RYM tab is open, this asks Music Connect every ~20 s for wanted pages (GET /rym/wanted), and
//   fetches them in the background with your own session: at most one page every 12 s, 40 an hour,
//   250 a day, so your account looks like a person reading. If RYM answers with its Cloudflare check,
//   it stops for 10 minutes and tells Music Connect; it never tries to get past the check itself.
// - Only one RYM tab fetches at a time (a lock in GM storage).
// - Old behaviour kept: the Apple Music embed next to the tracklist on release pages.
// Pure parsers sit between the <rym-core> markers so tests can run them on saved pages.

(() => {
	"use strict";
	if (window.top !== window.self) return;

	const MC = "http://127.0.0.1:47821";
	const LIMITS = { gapMs: 12000, perHour: 40, perDay: 250, blockedPauseMs: 10 * 60 * 1000 };
	const store = typeof gm !== "undefined" ? gm : null;

	// <rym-core>
	const RYMCore = (() => {
		const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
		const num = (s) => {
			const m = String(s || "").replace(/,/g, "").match(/\d+(\.\d+)?/);
			return m ? Number(m[0]) : null;
		};
		// Rating counts: charts abbreviate them ("2k", "1.2k"); album pages write them out ("1,234").
		const ratingCount = (s) => {
			const m = String(s || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([km])?/i);
			if (!m) return null;
			const mult = !m[2] ? 1 : m[2].toLowerCase() === "k" ? 1000 : 1000000;
			return Math.round(Number(m[1]) * mult);
		};
		const idFrom = (s) => {
			const m = String(s || "").match(/\[(?:Album|Artist|Genre)(\d+)\]/);
			return m ? Number(m[1]) : null;
		};
		const abs = (href, base) => {
			try { return new URL(href, base || "https://rateyourmusic.com/").href; } catch { return null; }
		};
		const yearOf = (s) => {
			const m = String(s || "").match(/\b(1[89]\d\d|20\d\d)\b/);
			return m ? Number(m[1]) : null;
		};
		const genreList = (root, sel) =>
			Array.from(root.querySelectorAll(sel)).map((a) => ({ name: text(a), id: idFrom(a.getAttribute("title")) })).filter((g) => g.name);
		/** Apple Music album id from RYM's media links JSON ({"applemusic":{"<id>":{...}}}). */
		const appleFrom = (el) => {
			if (!el) return null;
			try {
				const links = JSON.parse(el.getAttribute("data-links") || "{}");
				const am = links.applemusic;
				if (!am) return null;
				const first = Object.entries(am).find(([, v]) => v && v.default) || Object.entries(am)[0];
				if (!first) return null;
				const [key, v] = first;
				const fromUrl = String((v && (v.album || v.url)) || "").match(/(\d{6,})(?:\D*$)/);
				return /^\d+$/.test(key) ? key : fromUrl ? fromUrl[1] : null;
			} catch { return null; }
		};

		/** "/release/album/akusmi/terra-incognita/" → "Terra Incognita" (a fallback; the next page view saves the real title). */
		const slugTitle = (href) => {
			const last = decodeURIComponent(String(href || "").replace(/\/+$/, "").split("/").pop() || "");
			return last.replace(/[-_]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase()).trim();
		};

		function pageKind(url) {
			const p = new URL(url).pathname;
			if (/^\/release\//.test(p)) return "release";
			if (/^\/charts\//.test(p)) return "chart";
			if (/^\/artist\/[^/]+\/?$/.test(p)) return "artist";
			if (/^\/genre\/[^/]+\/?$/.test(p)) return "genre";
			if (/^\/search/.test(p)) return "search";
			return null;
		}

		function release(doc, url) {
			const title = doc.querySelector(".album_title");
			if (!title) return null;
			// The title node also holds the shortcut input and a small-screen "By …" block; take only its own text.
			const own = Array.from(title.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();
			const info = {};
			doc.querySelectorAll(".album_info tr").forEach((tr) => {
				const h = text(tr.querySelector("th"));
				if (h) info[h.toLowerCase()] = tr.querySelector("td");
			});
			const artists = Array.from((info.artist || doc).querySelectorAll("a.artist")).map(text).filter(Boolean);
			const artist = artists.length ? [...new Set(artists)].join(" & ") : text(doc.querySelector(".album_artist_small a.artist"));
			const count = ratingCount(text(doc.querySelector(".album_info .num_ratings b")) || text(doc.querySelector(".num_ratings")));
			const rating = num(text(doc.querySelector(".album_info .avg_rating")) || text(doc.querySelector(".avg_rating")));
			const typeText = text(info.type);
			const tracks = Array.from(doc.querySelectorAll("#tracks .track")).map((li) => ({
				title: text(li.querySelector(".tracklist_title .rendered_text")) || text(li.querySelector(".tracklist_title")),
				rating: num(text(li.querySelector(".track_rating_avg"))),
			})).filter((t) => t.title);
			return {
				rymId: idFrom(doc.querySelector(".album_shortcut")?.value),
				title: own || text(title),
				artist,
				year: yearOf(text(info.released) || text(info["recorded"])),
				type: typeText ? typeText.split(",")[0].trim().toLowerCase() : null,
				rating,
				count,
				rankText: text(info.ranked) || null,
				genres: genreList(doc, ".release_pri_genres a.genre"),
				secondary: genreList(doc, ".release_sec_genres a.genre"),
				descriptors: text(doc.querySelector(".release_pri_descriptors")).split(",").map((s) => s.trim()).filter(Boolean),
				language: text(info.language) || null,
				appleMusicId: appleFrom(doc.querySelector("#media_link_button_container_top")),
				url: url.split("#")[0],
				tracks,
			};
		}

		function chart(doc, url) {
			const items = [];
			const nodes = doc.querySelectorAll(".page_charts_section_charts_item, .page_section_charts_item_wrapper .object_release");
			const seen = new Set();
			nodes.forEach((n) => {
				const item = n.classList.contains("page_charts_section_charts_item") ? n : n.closest(".page_section_charts_item_wrapper") || n;
				if (seen.has(item)) return;
				seen.add(item);
				// The first release link is often the cover image (no text): take the first one with text, else the URL's slug.
				const rels = Array.from(item.querySelectorAll(".page_charts_section_charts_item_title a, a.release, a[href*='/release/']"));
				const rel = rels.find((a) => text(a)) || rels[0];
				const art = item.querySelector(".page_charts_section_charts_item_credited_links_primary a.artist, a.artist, a[href*='/artist/']");
				if (!rel || !art) return;
				const idAttr = (item.id || "") + " " + (item.querySelector("[id*='release']")?.id || "");
				const idm = idAttr.match(/(\d{3,})/);
				const pos = num(text(item.querySelector(".page_charts_section_charts_item_number, .topcharts_position")));
				items.push({
					rank: pos || undefined,
					rymId: idm ? Number(idm[1]) : null,
					title: text(rel) || slugTitle(rel.getAttribute("href")),
					artist: Array.from(item.querySelectorAll(".page_charts_section_charts_item_credited_links_primary a.artist")).map(text).join(" & ") || text(art),
					url: abs(rel.getAttribute("href"), url),
					year: yearOf(text(item.querySelector(".page_charts_section_charts_item_date, .topcharts_date"))),
					rating: num(text(item.querySelector(".page_charts_section_charts_item_details_average_num, .topcharts_avg"))),
					count: ratingCount(text(item.querySelector(".page_charts_section_charts_item_details_ratings .full, .page_charts_section_charts_item_details_ratings"))),
					genres: genreList(item, ".page_charts_section_charts_item_genres_primary a.genre"),
					secondary: genreList(item, ".page_charts_section_charts_item_genres_secondary a.genre"),
					descriptors: Array.from(item.querySelectorAll(".page_charts_section_charts_item_genre_descriptors span")).map(text).filter(Boolean),
					appleMusicId: appleFrom(item.querySelector("[data-links]")),
				});
			});
			const pm = new URL(url).pathname.match(/\/(\d+)\/?$/);
			// Plain /charts/ is RYM's default chart; name it by the chart it really is (from the page's own link).
			let canonical = url;
			if (/^\/charts\/?$/.test(new URL(url).pathname)) {
				const v = Array.from(doc.querySelectorAll("input[value*='/charts/']")).map((i) => i.value)[0];
				canonical = v || `https://rateyourmusic.com/charts/top/album/${new Date().getFullYear()}/`;
			}
			return { items, page: pm ? Number(pm[1]) : 1, url: canonical };
		}

		function artist(doc, url) {
			const name = text(doc.querySelector("h1.artist_name_hdr"));
			if (!name) return null;
			const items = Array.from(doc.querySelectorAll(".disco_release")).map((r) => {
				const a = r.querySelector(".disco_mainline a, a.album");
				if (!a) return null;
				const sec = r.closest("[id^='disco_type_']");
				return {
					rymId: num((r.id || "").replace(/\D+/g, " ")),
					title: text(a),
					artist: name,
					url: abs(a.getAttribute("href"), url),
					year: yearOf(text(r.querySelector(".disco_subline, .disco_year_ymd, .disco_year_y"))),
					rating: num(text(r.querySelector(".disco_avg_rating"))),
					count: ratingCount(text(r.querySelector(".disco_ratings"))),
					type: sec ? { s: "album", e: "ep", i: "single", c: "compilation", l: "live" }[sec.id.slice(-1)] || null : null,
				};
			}).filter((x) => x && x.rating);
			return { artist: name, items };
		}

		function genre(doc, url) {
			const name = text(doc.querySelector("#page_genre_section_name h1, .page_genre_section h1"));
			if (!name) return null;
			const full = doc.querySelector(".page_genre_description_full .rendered_text") || doc.querySelector(".page_genre_description_short .rendered_text");
			const shortcut = Array.from(doc.querySelectorAll("input")).map((i) => i.value).find((v) => /^\[Genre\d+\]$/.test(v || ""));
			return {
				name,
				id: idFrom(shortcut),
				description: text(full),
				related: [...new Set(Array.from((full || doc.createElement("div")).querySelectorAll("a.genre")).map(text))],
				akas: Array.from(doc.querySelectorAll(".page_genre_akas bdi")).map(text),
			};
		}

		function search(doc, url) {
			return Array.from(doc.querySelectorAll("a.searchpage[href*='/release/']")).map((a) => {
				const row = a.closest("tr") || a.parentElement;
				const art = row && row.querySelector("a.artist, a[href*='/artist/']");
				return { title: text(a), artist: text(art), url: abs(a.getAttribute("href"), url), year: yearOf(text(row)) };
			}).filter((r) => r.url);
		}

		/** Word overlap 0-1 between a query and "artist title". */
		function score(q, r) {
			const w = (s) => new Set(String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter(Boolean));
			const qw = w(q), rw = w(`${r.artist} ${r.title}`);
			if (!qw.size) return 0;
			let hit = 0;
			qw.forEach((x) => { if (rw.has(x)) hit++; });
			return hit / qw.size;
		}

		/** The page as an ingest payload, or null when there's nothing to save. */
		function parse(doc, url) {
			const kind = pageKind(url);
			if (kind === "release") { const r = release(doc, url); return r && r.rating ? { kind, url, release: r } : null; }
			if (kind === "chart") { const c = chart(doc, url); return c.items.length ? { kind, url: c.url, items: c.items, page: c.page } : null; }
			if (kind === "artist") { const a = artist(doc, url); return a && a.items.length ? { kind, url, items: a.items } : null; }
			if (kind === "genre") { const g = genre(doc, url); return g ? { kind, url, genre: g } : null; }
			return null;
		}

		const isChallenge = (html) => /<title>\s*Just a moment|cf-chl-|challenge-platform|Performing security verification/i.test(html);

		return { parse, search, score, pageKind, isChallenge, release, chart, artist, genre };
	})();
	// </rym-core>

	if (typeof module !== "undefined") { module.exports = RYMCore; return; }

	// * Talking to Music Connect

	function mc(method, path, body) {
		return new Promise((resolve, reject) => {
			const xhr = store?.xmlHttpRequest || (typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null);
			if (!xhr) return reject(new Error("GM.xmlHttpRequest unavailable"));
			xhr({
				method, url: MC + path, timeout: 15000,
				headers: { "X-MC-Client": "rym-userscript", "Content-Type": "application/json" },
				data: body ? JSON.stringify(body) : undefined,
				onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch { resolve({ ok: false }); } },
				onerror: () => reject(new Error("Music Connect isn't running")),
				ontimeout: () => reject(new Error("Music Connect timed out")),
			});
		});
	}

	// * Corner note (small, see-through, fades; never covers anything)

	function note(msg, bad = false) {
		let el = document.getElementById("mc-rym-note");
		if (!el) {
			el = document.createElement("div");
			el.id = "mc-rym-note";
			el.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:2147483646;font:12px/1.3 -apple-system,system-ui,sans-serif;padding:4px 8px;border-radius:6px;pointer-events:none;transition:opacity .6s;opacity:0;background:transparent;";
			document.documentElement.appendChild(el);
		}
		el.style.color = bad ? "rgba(180,40,60,.85)" : "rgba(120,120,130,.85)";
		el.textContent = msg;
		el.style.opacity = "1";
		clearTimeout(el._t);
		el._t = setTimeout(() => (el.style.opacity = "0"), bad ? 6000 : 2500);
	}

	// * Save what you're looking at

	async function saveThisPage() {
		const payload = RYMCore.parse(document, location.href);
		if (!payload) return;
		try {
			const r = await mc("POST", "/rym/ingest", payload);
			if (r.ok) note(`Music Connect: saved ${r.saved} ${payload.kind === "release" ? "album" : "albums"}`);
		} catch (e) {
			console.log("[RYM → Music Connect]", e.message);
		}
	}

	// * Fetch what Music Connect wants (slowly, one tab at a time)

	const now = () => Date.now();
	const tabId = Math.random().toString(36).slice(2);
	const get = (k, d) => (store ? store.getValue(k, d) : d);
	const set = (k, v) => store && store.setValue(k, v);

	function haveLock() {
		const l = get("mc_rym_lock", null);
		if (!l || l.tab === tabId || now() - l.at > 60000) { set("mc_rym_lock", { tab: tabId, at: now() }); return true; }
		return false;
	}

	function budgetOK() {
		const log = (get("mc_rym_fetches", []) || []).filter((t) => now() - t < 86400000);
		set("mc_rym_fetches", log);
		const last = log[log.length - 1] || 0;
		if (now() - last < LIMITS.gapMs) return false;
		if (log.filter((t) => now() - t < 3600000).length >= LIMITS.perHour) return false;
		return log.length < LIMITS.perDay;
	}
	function spend() { set("mc_rym_fetches", [...(get("mc_rym_fetches", []) || []), now()]); }

	async function getPage(url) {
		while (!budgetOK()) await new Promise((r) => setTimeout(r, 3000));
		spend();
		const res = await fetch(url, { credentials: "include" });
		const html = await res.text();
		if (res.status === 403 || res.status === 503 || RYMCore.isChallenge(html)) {
			const e = new Error("RYM is showing its human check");
			e.blocked = true;
			throw e;
		}
		if (res.status === 429) { const e = new Error("RYM says too many requests"); e.blocked = true; throw e; }
		if (!res.ok) throw new Error(`RYM answered ${res.status}`);
		return new DOMParser().parseFromString(html, "text/html");
	}

	async function work(w) {
		if (w.kind === "search") {
			const sUrl = `https://rateyourmusic.com/search?searchterm=${encodeURIComponent(w.query)}&searchtype=l`;
			const results = RYMCore.search(await getPage(sUrl), sUrl);
			const best = results.map((r) => ({ r, s: RYMCore.score(w.query, r) })).sort((a, b) => b.s - a.s)[0];
			if (!best || best.s < 0.5) return mc("POST", "/rym/ingest", { kind: "search", url: sUrl, items: [], wantedId: w.id, note: "RYM search found no matching album" });
			const doc = await getPage(best.r.url);
			const p = RYMCore.parse(doc, best.r.url);
			if (!p) return mc("POST", "/rym/failed", { id: w.id, note: "Couldn't read the album page" });
			// An artist search: "radiohead" matches an album by them; save it and also their page for the rest.
			return mc("POST", "/rym/ingest", { ...p, wantedId: w.id });
		}
		const url = w.url || w.query;
		const doc = await getPage(url);
		const p = RYMCore.parse(doc, url);
		if (!p) {
			const why = RYMCore.pageKind(url) === "chart" ? "The chart page had no albums (wrong genre name, or RYM changed its layout)" : "Nothing to read on that page";
			return mc("POST", "/rym/ingest", { kind: RYMCore.pageKind(url) || "release", url, items: [], wantedId: w.id, note: why });
		}
		return mc("POST", "/rym/ingest", { ...p, wantedId: w.id });
	}

	let busy = false;
	async function poll() {
		if (busy || !haveLock()) return;
		if (now() < (get("mc_rym_paused_until", 0) || 0)) return;
		busy = true;
		try {
			const r = await mc("GET", "/rym/wanted");
			for (const w of r.wanted || []) {
				try {
					await work(w);
					note(`Music Connect: fetched ${w.kind === "search" ? `“${w.query}”` : "a chart"} from RYM`);
				} catch (e) {
					if (e.blocked) {
						set("mc_rym_paused_until", now() + LIMITS.blockedPauseMs);
						await mc("POST", "/rym/blocked", { note: e.message });
						note("RYM wants its human check: reload this tab and pass it; Music Connect waits 10 min", true);
						break;
					}
					await mc("POST", "/rym/failed", { id: w.id, note: e.message });
				}
				haveLock();
			}
		} catch (e) {
			// Music Connect not running: try again later, quietly.
		} finally {
			busy = false;
		}
	}

	// * Apple Music embed next to the tracklist (from the 2023 script)

	function embedAppleMusic() {
		let tries = 0;
		const int = setInterval(() => {
			const element = document.querySelector('a[aria-label="Open in Apple Music"]');
			if (++tries > 40) clearInterval(int);
			if (!element) return;
			clearInterval(int);
			const tracklisting = document.querySelector(".hide-for-small .section_tracklisting");
			if (!tracklisting) return;
			const iframe = document.createElement("iframe");
			iframe.src = element.href.replace("https://geo", "https://embed");
			iframe.width = 300;
			iframe.height = 1000;
			const box = tracklisting.parentNode;
			box.style.display = "flex";
			box.parentNode.style.overflowX = "scroll";
			box.style.width = "max-content";
			box.style.minWidth = "fit-content";
			box.append(iframe);
		}, 500);
	}

	// * Start

	if (RYMCore.isChallenge(document.documentElement.outerHTML.slice(0, 5000))) return;   // the check page itself
	set("mc_rym_paused_until", 0);   // you passed the check (or never hit it): fetching may resume
	saveThisPage();
	if (RYMCore.pageKind(location.href) === "chart") {
		// Charts can fill in after load; save again when they change.
		let t, last = RYMCore.parse(document, location.href)?.items.length || 0;
		new MutationObserver(() => {
			clearTimeout(t);
			t = setTimeout(() => { const n = RYMCore.parse(document, location.href)?.items.length || 0; if (n !== last) { last = n; saveThisPage(); } }, 1500);
		})
			.observe(document.body, { childList: true, subtree: true });
	}
	if (RYMCore.pageKind(location.href) === "release") embedAppleMusic();
	setTimeout(poll, 3000);
	setInterval(poll, 20000);
})();
