// ==UserScript==
// @name         Artificial Analysis 3D Frontier Chart
// @namespace    local.aa.3d-chart
// @version      1.0.0
// @description  Adds Matt's own 3D model chart (intelligence × cost per task × time per task) under the homepage rankings, with the 3D best trade-off models ringed and named.
// @match        https://artificialanalysis.ai/*
// @grant        GM_addElement
// @run-at       document-idle
// ==/UserScript==

// The chart is ~/projects/model-charts/chart/model-chart.js (00-model-chart.js is a link to it).
// Data comes from the page already open in this browser: the React context that feeds AA's own
// charts holds every model (allPageModels). Nothing is fetched or stored.
;(function () {
	"use strict"
	const TAG = "[AA 3D chart]"
	const CARD_ID = "aa3d-card"
	const EVT_ASK = "aa3d:ask", EVT_DATA = "aa3d:data"

	// Runs in the page's own JS world (Tampermonkey's world can't see React's fiber expandos).
	function pageReader(ASK, DATA) {
		function find() {
			const start = document.querySelector(".recharts-wrapper") || document.querySelector("#__next") || document.body.firstElementChild
			if (!start) return null
			const key = Object.keys(start).find((k) => k.startsWith("__reactFiber"))
			if (!key) return null
			let root = start[key]
			while (root.return) root = root.return
			let best = null
			const stack = [root]
			while (stack.length) {
				const f = stack.pop()
				const p = f.memoizedProps
				const v = p && p.value
				const cands = []
				if (v && typeof v === "object" && !Array.isArray(v)) for (const k in v) if (Array.isArray(v[k])) cands.push(v[k])
				if (p && typeof p === "object") for (const k in p) if (Array.isArray(p[k])) cands.push(p[k])
				for (const a of cands) {
					const o = a[0]
					if (o && typeof o === "object" && "slug" in o && "intelligenceIndex" in o && (!best || a.length > best.length)) best = a
				}
				if (f.sibling) stack.push(f.sibling)
				if (f.child) stack.push(f.child)
			}
			return best
		}
		document.addEventListener(ASK, () => {
			let rows = null
			try {
				const all = find()
				if (all) rows = all.map((m) => ({
					slug: m.slug, shortName: m.shortName || m.name, released: m.releaseDate || null,
					creator: m.creator ? m.creator.name : "Other",
					score: m.intelligenceIndex,
					cost: m.intelligenceIndexCostPerTask ? m.intelligenceIndexCostPerTask.total : null,
					seconds: m.intelligenceIndexTimePerTask,
				}))
			} catch (e) { rows = null }
			document.dispatchEvent(new CustomEvent(DATA, { detail: JSON.stringify(rows) }))
		})
	}

	function installReader() {
		const code = `(${pageReader})(${JSON.stringify(EVT_ASK)}, ${JSON.stringify(EVT_DATA)})`
		if (typeof GM_addElement === "function") GM_addElement(document.documentElement, "script", { textContent: code })
		else { const s = document.createElement("script"); s.textContent = code; document.documentElement.appendChild(s) }
	}

	function readModels() {
		let got
		const on = (e) => { got = e.detail }
		document.addEventListener(EVT_DATA, on)
		document.dispatchEvent(new CustomEvent(EVT_ASK)) // the page answers synchronously
		document.removeEventListener(EVT_DATA, on)
		try { return got ? JSON.parse(got) : null } catch { return null }
	}

	const num = (v) => typeof v === "number" && isFinite(v)
	// AA rows → model-chart rows. "GPT-6 Luna (xhigh)" → family "GPT-6 Luna", effort "xhigh".
	function toRows(models) {
		const rows = [], noCost = []
		for (const m of models) {
			if (!num(m.score) || !num(m.cost) || !num(m.seconds)) continue
			if (!(m.cost > 0) || !(m.seconds > 0)) { noCost.push(m.shortName); continue } // can't sit on a log axis
			const em = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(m.shortName)
			rows.push({
				id: m.slug, name: m.shortName, creator: m.creator,
				family: em ? em[1] : m.shortName, effort: em ? em[2].toLowerCase() : null, released: m.released,
				score: m.score, cost: m.cost, minutes: m.seconds / 60,
				url: "/models/" + m.slug,
			})
		}
		return { rows, noCost }
	}

	const CSS = `
#${CARD_ID}{margin-top:1rem}
#${CARD_ID} .mc{--bg:#fff;--panel:#fff;--border:rgb(217,217,217)}
#${CARD_ID} .mc .card{border:0;padding:0;background:transparent}
#${CARD_ID} .mc .legend{padding:0 10px;font-size:13px}
#${CARD_ID} .mc h2{font-family:inherit}
#${CARD_ID} .aa3d-left{color:#8a8c91;font-size:12.5px;margin:4px 0 0}
html.dark #${CARD_ID} .mc{--bg:#161716;--panel:#161716;--border:#30312e}`

	let card = null, chart = null, mountedFor = 0

	function isDark() { return document.documentElement.classList.contains("dark") }

	function build(models) {
		const { rows, noCost } = toRows(models)
		if (!rows.length) return false
		card = document.createElement("div")
		card.id = CARD_ID
		card.className = "border rounded-lg p-4 relative"
		const host = document.createElement("div")
		card.appendChild(host)
		chart = window.ModelChart.mount(host, {
			rows,
			spec: {
				title: "Intelligence, cost and time per task: the 3D frontier",
				note: "Ringed and named: models no other model beats on all three at once (smarter, cheaper and faster). Drag to rotate, scroll to zoom, click a point to open the model. Near a flat view it snaps into place.",
				axes: { x: "cost", y: "score", z: "minutes" },
				groupBy: "creator", labelBy: "name", lines: false,
				view: "iso", fronts: ["all"], labels: "front", fade: 0.28,
				table: false, theme: isDark() ? "dark" : "light",
			},
			meta: { updated: "live from this page" },
		})
		if (noCost.length) {
			const p = document.createElement("p")
			p.className = "aa3d-left"
			p.textContent = `Left out (no cost per task recorded): ${noCost.join(", ")}.`
			host.querySelector(".mc").appendChild(p)
		}
		mountedFor = rows.length
		console.log(TAG, `plotted ${rows.length} models, ${chart.data.length} drawn, ${noCost.length} without cost`)
		return true
	}

	// Put the card right after the three ranking cards, full width. Idempotent.
	function place() {
		if (location.pathname !== "/") { if (card && card.isConnected) card.remove(); return }
		const grid = document.querySelector("div.grid.gap-4.lg\\:grid-cols-3")
		if (!grid || !grid.querySelector(":scope > div.border.rounded-lg.p-4.relative")) return
		document.querySelectorAll("#" + CARD_ID).forEach((n) => { if (n !== card) n.remove() })
		if (!card) {
			const models = readModels()
			if (!models || !build(models)) return
		}
		// only redraw when the card moved: the chart's own DOM updates also trigger the observer
		if (grid.nextElementSibling !== card) { grid.after(card); chart.redraw() }
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
		new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
		new MutationObserver(() => chart && chart.setTheme(isDark() ? "dark" : "light")).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
		schedule()
	}
	start()
})()
