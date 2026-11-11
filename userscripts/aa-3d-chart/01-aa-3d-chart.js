// ==UserScript==
// @name         Artificial Analysis 3D Frontier Chart
// @namespace    local.aa.3d-chart
// @version      2.1.0
// @description  Adds Matt's own 3D model chart (intelligence × cost per task × time per task) under the homepage rankings. It shows AA's shared model selection, and quick picks (frontier, one or more makers) change that selection for every chart on the page.
// @match        https://artificialanalysis.ai/*
// @grant        GM_addElement
// @run-at       document-idle
// ==/UserScript==

// The chart is ~/projects/model-charts/chart/model-chart.js (00-model-chart.js is a link to it).
// Data comes from the page already open in this browser: the React context that feeds AA's own charts
// (allPageModels, selectedPageModels, setSelectedPageModels). Nothing is fetched or stored.
;(function () {
	"use strict"
	const TAG = "[AA 3D chart]"
	const CARD_ID = "aa3d-card"
	const EV = { ask: "aa3d:ask", data: "aa3d:data", set: "aa3d:set" }

	// ---- page world (Tampermonkey's world can't see React's fiber expandos) ----
	function pageReader(EV) {
		let statics = null // release → deprecated, and AA's own "no public API" flags; these don't change
		function ctx() {
			const start = document.querySelector(".recharts-wrapper")
			const key = start && Object.keys(start).find((k) => k.startsWith("__reactFiber"))
			if (!key) return null
			let root = start[key]
			while (root.return) root = root.return
			let value = null, releases = null
			const stack = [root]
			while (stack.length && !(value && (releases || statics))) {
				const f = stack.pop(), p = f.memoizedProps
				if (p && p.value && typeof p.value === "object" && Array.isArray(p.value.allPageModels) && typeof p.value.setSelectedPageModels === "function") value = p.value
				if (p && p.modelsAndReleases && Array.isArray(p.modelsAndReleases.releases)) releases = p.modelsAndReleases.releases
				if (f.sibling) stack.push(f.sibling)
				if (f.child) stack.push(f.child)
			}
			if (!statics && releases) {
				const flight = (self.__next_f || []).map((x) => (x && x[1]) || "").join("")
				const checkered = [...flight.matchAll(/\{"id":"([0-9a-f-]{36})","label":"[^"]*","color":"[^"]*","logo":"[^"]*","url":"[^"]*","value":[^,]*,"displayValue":"[^"]*","pattern":"checkered"\}/g)].map((m) => m[1])
				statics = { deprecated: releases.filter((r) => r.deprecated).map((r) => r.slug), noApi: [...new Set(checkered)] }
			}
			return value
		}
		document.addEventListener(EV.ask, () => {
			let out = null
			try {
				const v = ctx()
				if (v) {
					const dep = new Set((statics && statics.deprecated) || [])
					out = {
						models: v.allPageModels.map((m) => ({
							id: m.id, slug: m.slug, shortName: m.shortName || m.name, released: m.releaseDate || null,
							creator: m.creator ? m.creator.name : "Other",
							family: m.release && m.release.name, deprecated: !!(m.release && dep.has(m.release.slug)),
							isDefault: !!m.chartDefaultSelected,
							score: m.intelligenceIndex,
							cost: m.intelligenceIndexCostPerTask ? m.intelligenceIndexCostPerTask.total : null,
							seconds: m.intelligenceIndexTimePerTask,
						})),
						selected: v.selectedPageModels.map((m) => m.slug),
						noApi: (statics && statics.noApi) || [],
					}
				}
			} catch (e) { out = null }
			document.dispatchEvent(new CustomEvent(EV.data, { detail: JSON.stringify(out) }))
		})
		document.addEventListener(EV.set, (e) => {
			try {
				const v = ctx(), want = JSON.parse(e.detail)
				const by = new Map(v.allPageModels.map((m) => [m.slug, m]))
				v.setSelectedPageModels(want.map((s) => by.get(s)).filter(Boolean))
			} catch (err) { console.error("[AA 3D chart]", err) }
		})
	}

	function installReader() {
		const code = `(${pageReader})(${JSON.stringify(EV)})`
		if (typeof GM_addElement === "function") GM_addElement(document.documentElement, "script", { textContent: code })
		else { const s = document.createElement("script"); s.textContent = code; document.documentElement.appendChild(s) }
	}
	function ask() {
		let got
		const on = (e) => { got = e.detail }
		document.addEventListener(EV.data, on)
		document.dispatchEvent(new CustomEvent(EV.ask)) // the page answers synchronously
		document.removeEventListener(EV.data, on)
		try { return got ? JSON.parse(got) : null } catch { return null }
	}
	const setSelection = (slugs) => document.dispatchEvent(new CustomEvent(EV.set, { detail: JSON.stringify(slugs) }))

	// ---- data ----
	const num = (v) => typeof v === "number" && isFinite(v)
	// AA rows → model-chart rows. "GPT-6 Luna (xhigh)" → family "GPT-6 Luna", effort "xhigh".
	// No cost per task (0) means AA has no public API price for it: shown grey and kept out of the frontier.
	function toRow(m, noApi) {
		if (!num(m.score) || !num(m.cost) || !num(m.seconds) || m.seconds <= 0 || m.cost < 0) return null
		const em = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(m.shortName)
		const muted = m.cost === 0 || noApi.has(m.id)
		return {
			id: m.slug, name: m.shortName, creator: m.creator,
			family: em ? em[1] : m.family || m.shortName, effort: em ? em[2].toLowerCase() : null, released: m.released,
			score: m.score, cost: m.cost, minutes: m.seconds / 60, url: "/models/" + m.slug,
			muted, mutedNote: muted ? "No publicly available API: left out of the frontier" : undefined,
			deprecated: m.deprecated, isDefault: m.isDefault,
		}
	}
	// p is "near the frontier" unless some q clearly beats it on all three at once:
	// q.score ≥ p.score + pts, and q's cost and time are each at most (1 - pct) of p's.
	function nearFront(rows, pts, pct) {
		return rows.filter((p) => !rows.some((q) => q !== p && q.score >= p.score + pts && q.cost <= p.cost * (1 - pct) && q.minutes <= p.minutes * (1 - pct)))
	}
	const monthsBefore = (iso, n) => { const d = new Date(iso); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10) }
	// a maker's models worth caring about: not deprecated, released within 6 months of its newest,
	// and not clearly beaten by another of its own models (that drops superseded versions)
	// strict Pareto: p goes unless some q is at least as good on all three and better on one
	const paretoFront = (rows) => rows.filter((p) => !rows.some((q) => q !== p && q.score >= p.score && q.cost <= p.cost && q.minutes <= p.minutes && (q.score > p.score || q.cost < p.cost || q.minutes < p.minutes)))
	// a maker's models worth using day to day: publicly available, not deprecated, released within
	// 6 months of its newest, and on that maker's own 3D frontier (nothing of theirs is smarter,
	// cheaper and faster at once, so there's no reason to pick anything below it)
	function makerPool(all, maker) {
		const mine = all.filter((r) => r.creator === maker && !r.deprecated && !r.muted)
		const newest = mine.map((r) => r.released).filter(Boolean).sort().at(-1)
		return newest ? mine.filter((r) => !r.released || r.released >= monthsBefore(newest, 6)) : mine
	}
	const makerPick = (all, maker) => paretoFront(makerPool(all, maker))
	const EFFORT_ORDER = ["minimal", "low", "medium", "high", "xhigh", "max"]
	const effortRank = (e) => { const i = EFFORT_ORDER.indexOf(e); return i < 0 ? 99 : i }
	// "Everyday": your makers' frontiers, remembered in this browser (Anthropic until you change it)
	const EVERYDAY_KEY = "aa3d-everyday-makers"
	function everydayMakers() {
		try { const v = JSON.parse(localStorage.getItem(EVERYDAY_KEY)); if (Array.isArray(v) && v.length) return v } catch {}
		return ["Anthropic"]
	}
	function saveEveryday(makers) { try { localStorage.setItem(EVERYDAY_KEY, JSON.stringify(makers)) } catch {} }
	const makersSlugs = (rows, makers) => makers.flatMap((mk) => makerPick(rows, mk)).sort((a, b) => b.score - a.score).map((r) => r.id)
	// with model or effort chips on, show every matching level (you asked for them), not just the frontier.
	// Models with no effort levels always pass the effort filter.
	function currentPick(rows) {
		const makers = [...pickedMakers]
		if (!pickedFamilies.size && !pickedEfforts.size) return makersSlugs(rows, makers)
		return makers.flatMap((mk) => makerPool(rows, mk))
			.filter((r) => (!pickedFamilies.size || pickedFamilies.has(r.family)) && (!pickedEfforts.size || !r.effort || pickedEfforts.has(r.effort)))
			.sort((a, b) => b.score - a.score).map((r) => r.id)
	}
	const framePick = (all) => nearFront(all.filter((r) => !r.muted && !r.deprecated), 1.5, 0.15)

	// ---- UI ----
	const CSS = `
#${CARD_ID}{margin-top:1rem}
#${CARD_ID} .mc{--bg:#fff;--panel:#fff;--border:rgb(217,217,217)}
#${CARD_ID} .mc .card{border:0;padding:0;background:transparent}
#${CARD_ID} .mc .legend{padding:0 10px;font-size:13px}
#${CARD_ID} .mc h2{font-family:inherit}
#${CARD_ID} .aa3d-picks{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:0 10px 12px;font:14px/1.4 inherit}
#${CARD_ID} .aa3d-picks .lbl{font-size:13.5px;color:#55575c;margin-right:2px}
#${CARD_ID} .aa3d-picks button,#${CARD_ID} .aa3d-picks select{font:inherit;font-size:13.5px;padding:6px 12px;border:1px solid rgb(217,217,217);background:#fff;color:#17181a;border-radius:6px;cursor:pointer}
#${CARD_ID} .aa3d-picks button:hover,#${CARD_ID} .aa3d-picks select:hover{border-color:#8a8c91}
#${CARD_ID} .aa3d-picks button[aria-pressed=true]{background:#17181a;color:#fff;border-color:#17181a}
#${CARD_ID} .aa3d-picks button:active{transform:translateY(1px)}
#${CARD_ID} .aa3d-picks .sep{width:1px;height:22px;background:rgb(217,217,217);margin:0 4px}
#${CARD_ID} .aa3d-picks .brk{flex-basis:100%;height:0}
#${CARD_ID} .aa3d-picks .hint2{font-size:12.5px;color:#8a8c91;margin-left:4px}
#${CARD_ID} .aa3d-status{color:#55575c;font-size:13px;padding:0 10px 10px;margin:0}
#${CARD_ID} .aa3d-status b{font-weight:600;color:#17181a}
html.dark #${CARD_ID} .mc{--bg:#161716;--panel:#161716;--border:#30312e}`

	let card = null, picksEl = null, statusEl = null, host = null, chart = null
	let lastSig = "", lastData = null, pickedMakers = new Set(), pickedFamilies = new Set(), pickedEfforts = new Set(), busyTimer = 0, startedEveryday = false
	const isDark = () => document.documentElement.classList.contains("dark")
	const sigOf = (slugs) => [...slugs].sort().join(",")

	function buildCard() {
		card = document.createElement("div")
		card.id = CARD_ID
		card.className = "border rounded-lg p-4 relative"
		card.innerHTML = `<div class="aa3d-picks" role="group" aria-label="Quick model picks"></div><p class="aa3d-status">Reading models from this page…</p><div class="aa3d-host"></div>`
		picksEl = card.querySelector(".aa3d-picks"); statusEl = card.querySelector(".aa3d-status"); host = card.querySelector(".aa3d-host")
		picksEl.addEventListener("click", onPick)
		picksEl.addEventListener("change", (e) => { if (e.target.matches("select") && e.target.value) { togglemaker(e.target.value); e.target.value = "" } })
	}

	function apply(slugs, label) {
		statusEl.innerHTML = `Selecting ${slugs.length} models (${label})…`
		setSelection(slugs)
		clearTimeout(busyTimer)
		busyTimer = setTimeout(schedule, 120)
	}
	function togglemaker(maker) {
		pickedMakers.has(maker) ? pickedMakers.delete(maker) : pickedMakers.add(maker)
		pickedFamilies.clear()
		if (!pickedMakers.size) return apply(lastData.defaults, "AA default")
		saveEveryday([...pickedMakers])
		apply(currentPick(lastData.rows), [...pickedMakers].join(" + "))
	}
	function onPick(e) {
		const b = e.target.closest("button[data-pick]")
		if (!b || !lastData) return
		const k = b.dataset.pick
		if (k.startsWith("fam:") || k.startsWith("eff:")) {
			const set = k.startsWith("fam:") ? pickedFamilies : pickedEfforts, v = k.slice(4)
			set.has(v) ? set.delete(v) : set.add(v)
			return apply(currentPick(lastData.rows), v)
		}
		pickedFamilies.clear(); pickedEfforts.clear()
		if (k === "everyday") { pickedMakers = new Set(everydayMakers()); apply(makersSlugs(lastData.rows, [...pickedMakers]), "everyday") }
		else if (k === "frontier") { pickedMakers.clear(); apply(framePick(lastData.rows).sort((a, b) => b.score - a.score).map((r) => r.id), "frontier") }
		else if (k === "default") { pickedMakers.clear(); apply(lastData.defaults, "AA default") }
		else if (k.startsWith("maker:")) togglemaker(k.slice(6))
	}

	function renderPicks(d, selSig) {
		const frontSig = sigOf(framePick(d.rows).map((r) => r.id)), defSig = sigOf(d.defaults)
		const makersSig = pickedMakers.size ? sigOf(currentPick(d.rows)) : null
		if (makersSig !== selSig) { pickedMakers.clear(); pickedFamilies.clear(); pickedEfforts.clear() } // changed elsewhere (AA's own picker)
		const every = everydayMakers(), everySig = sigOf(makersSlugs(d.rows, every))
		if (!pickedMakers.size && selSig === everySig) pickedMakers = new Set(every) // Everyday is on: show its makers' chips
		const counts = new Map()
		d.rows.filter((r) => !r.deprecated).forEach((r) => counts.set(r.creator, (counts.get(r.creator) || 0) + 1))
		const makers = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0])
		const top = makers.slice(0, 7), more = makers.slice(7)
		const btn = (k, txt, on, title) => `<button type="button" data-pick="${k}" aria-pressed="${on}" title="${title}">${txt}</button>`
		const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
		picksEl.innerHTML = `<span class="lbl">Show</span>` +
			btn("everyday", "Everyday", selSig === everySig, `The models worth using: current ${esc(every.join(" + "))} models on the frontier, nothing below it. Shown when the page opens; pick makers below to change which makers it uses.`) +
			btn("frontier", "Frontier", selSig === frontSig, "Publicly available models on or close to the 3D frontier, across all makers") +
			btn("default", "AA default", selSig === defSig && !pickedMakers.size, "Artificial Analysis's default selection") +
			`<span class="sep"></span><span class="lbl">Makers</span>` +
			top.map((m) => btn("maker:" + esc(m), esc(m), pickedMakers.has(m), `${esc(m)}'s current public models on its own frontier (superseded, deprecated and beaten ones left out). Pick several to compare; your picks become Everyday.`)).join("") +
			(more.length ? `<select aria-label="More makers"><option value="">More makers…</option>${more.map((m) => `<option value="${esc(m)}">${pickedMakers.has(m) ? "✓ " : ""}${esc(m)}</option>`).join("")}</select>` : "") + subRow(d, btn, esc)
	}

	// models and effort levels of the picked makers' current lineup
	function subRow(d, btn, esc) {
		if (!pickedMakers.size) return ""
		const pool = [...pickedMakers].flatMap((mk) => makerPool(d.rows, mk))
		const fams = new Map()
		pool.forEach((r) => fams.set(r.family, Math.max(fams.get(r.family) || 0, r.score)))
		const famList = [...fams.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0])
		const effs = [...new Set(pool.filter((r) => !pickedFamilies.size || pickedFamilies.has(r.family)).map((r) => r.effort).filter(Boolean))].sort((a, b) => effortRank(a) - effortRank(b) || a.localeCompare(b))
		if (famList.length < 2 && effs.length < 2) return ""
		// "Claude Fable 5.2", "Claude Opus 5.5" → "Fable 5.2", "Opus 5.5" when they all share the first word
		const first = famList[0].split(" ")[0], shared = famList.length > 1 && famList.every((f) => f.startsWith(first + " "))
		const trim = (f) => (shared ? f.slice(first.length + 1) : f)
		return `<span class="brk"></span><span class="lbl">Models</span>` +
			famList.map((f) => btn("fam:" + esc(f), esc(trim(f)), pickedFamilies.has(f), `Only ${esc(f)} (all its effort levels). Pick several to compare.`)).join("") +
			(effs.length ? `<span class="sep"></span><span class="lbl">Effort</span>` + effs.map((e) => btn("eff:" + esc(e), esc(e), pickedEfforts.has(e), `Only the ${esc(e)} effort level. Pick several.`)).join("") : "") +
			(pickedFamilies.size || pickedEfforts.size ? "" : `<span class="hint2">Showing the frontier only. Pick a model or effort to see all its levels.</span>`)
	}

	function mountChart(d, rows) {
		const old = chart
		const camera = old && old.view && old.view.yaw != null ? { yaw: old.view.yaw, pitch: old.view.pitch, zoom: old.view.zoom, panX: old.view.panX, panY: old.view.panY, persp: old.view.persp } : null
		if (old && old.destroy) old.destroy()
		const oneMaker = new Set(rows.map((r) => r.creator)).size === 1
		chart = window.ModelChart.mount(host, {
			rows,
			spec: {
				title: "Intelligence, cost and time per task: the 3D frontier",
				note: "Ringed and named: models no other one beats on all three at once (smarter, cheaper and faster). Grey: no publicly available API, left out of the frontier. Drag to rotate, ⌘-scroll or pinch to zoom, Shift-drag to move, double-click to recentre, click a point to open it.",
				axes: { x: "cost", y: "score", z: "minutes" },
				groupBy: oneMaker ? "family" : "creator", labelBy: "name", lines: oneMaker,
				view: "iso", fronts: ["all"], labels: "front", fade: 0.28, height: 700,
				table: false, theme: isDark() ? "dark" : "light", camera,
			},
			meta: { updated: "live from this page" },
		})
	}

	function refresh(force) {
		const raw = ask()
		if (!raw) return false
		if (!startedEveryday) {
			startedEveryday = true
			// open on Everyday unless the URL already names models (a shared link or AA's picker)
			if (!new URLSearchParams(location.search).has("models")) {
				const rows0 = raw.models.map((m) => toRow(m, new Set(raw.noApi))).filter(Boolean)
				const slugs = makersSlugs(rows0, everydayMakers())
				if (slugs.length && sigOf(slugs) !== sigOf(raw.selected)) { pickedMakers = new Set(everydayMakers()); setSelection(slugs) }
			}
		}
		const sel = raw.selected, sig = sigOf(sel)
		if (!force && sig === lastSig) return true
		lastSig = sig
		const noApi = new Set(raw.noApi)
		const rows = raw.models.map((m) => toRow(m, noApi)).filter(Boolean)
		lastData = { rows, defaults: raw.models.filter((m) => m.isDefault).map((m) => m.slug) }
		const selSet = new Set(sel), shown = rows.filter((r) => selSet.has(r.id))
		renderPicks(lastData, sig)
		const missing = sel.length - shown.length, grey = shown.filter((r) => r.muted).length
		statusEl.innerHTML = `Showing <b>${shown.length}</b> of the <b>${sel.length}</b> models selected on this page${missing ? ` (${missing} have no cost or time per task)` : ""}${grey ? `, ${grey} grey` : ""}. Picks here change the selection for every chart on the page, and AA's own model picker changes this one.`
		mountChart(lastData, shown)
		console.log(TAG, `showing ${shown.length}/${sel.length} selected (${rows.length} with data)`)
		return true
	}

	// Put the card right after the three ranking cards, full width. Idempotent.
	function place() {
		if (location.pathname !== "/") { if (card && card.isConnected) card.remove(); return }
		const grid = document.querySelector("div.grid.gap-4.lg\\:grid-cols-3")
		if (!grid || !grid.querySelector(":scope > div.border.rounded-lg.p-4.relative")) return
		document.querySelectorAll("#" + CARD_ID).forEach((n) => { if (n !== card) n.remove() })
		if (!card) buildCard()
		const moved = grid.nextElementSibling !== card
		if (moved) grid.after(card)
		if (!refresh(!chart) && !chart) return
		// only redraw when the card moved: the chart's own DOM updates also trigger the observer
		if (moved && chart) chart.redraw()
	}

	let queued = false
	function schedule() {
		if (queued) return
		queued = true
		requestAnimationFrame(() => { queued = false; try { place() } catch (e) { console.error(TAG, e) } })
	}

	function start() {
		if (!window.ModelChart) return console.error(TAG, "ModelChart missing from bundle")
		const st = document.createElement("style")
		st.textContent = CSS
		document.head.appendChild(st)
		installReader()
		// AA re-renders its charts when the selection changes; that's the cue to re-read it
		new MutationObserver((ms) => { if (ms.some((m) => !card || !card.contains(m.target))) schedule() }).observe(document.body, { childList: true, subtree: true })
		new MutationObserver(() => chart && chart.setTheme(isDark() ? "dark" : "light")).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
		schedule()
	}
	start()
})()
