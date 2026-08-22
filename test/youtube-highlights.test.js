import test from "node:test"
import assert from "node:assert/strict"

// Pure implementations matching the userscript for unit testing
function parseTimestamp(ts) {
	if (typeof ts === "number") return isNaN(ts) ? 0 : ts
	if (!ts || typeof ts !== "string") return 0
	ts = ts.trim()
	if (/^\d+(\.\d+)?$/.test(ts)) return parseFloat(ts)
	if (ts.includes(":")) {
		const parts = ts.split(":").map(Number)
		if (!parts.some(isNaN)) {
			if (parts.length === 2) return parts[0] * 60 + parts[1]
			if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
		}
	}
	// Handle 1h20m15s, 2m10s, 45s, etc.
	const hMatch = ts.match(/(\d+(?:\.\d+)?)\s*h/i)
	const mMatch = ts.match(/(\d+(?:\.\d+)?)\s*m/i)
	const sMatch = ts.match(/(\d+(?:\.\d+)?)\s*s/i)
	if (hMatch || mMatch || sMatch) {
		let total = 0
		if (hMatch) total += parseFloat(hMatch[1]) * 3600
		if (mMatch) total += parseFloat(mMatch[1]) * 60
		if (sMatch) total += parseFloat(sMatch[1])
		return total
	}
	return parseFloat(ts) || 0
}

function normalizeHighlightSegments(rawArr) {
	if (!Array.isArray(rawArr)) return []
	return rawArr.map((item, idx) => {
		if (Array.isArray(item)) {
			const start = parseTimestamp(item[0])
			const end = item[1] !== undefined ? parseTimestamp(item[1]) : start + 30
			const title = item[2] || `Segment ${idx + 1}`
			return { start, end: end > start ? end : start + 30, title }
		}
		const start = parseTimestamp(item.start ?? item.s ?? 0)
		let end = parseTimestamp(item.end ?? item.e ?? start + 30)
		if (end <= start) end = start + 30
		const title = item.title || item.name || item.label || `Segment ${idx + 1}`
		const seg = { start, end, title }
		if (item.tier !== undefined) seg.tier = item.tier
		return seg
	}).sort((a, b) => a.start - b.start)
}

function parseSingleHighlightItem(item, idx) {
	item = item.trim()
	let rangePart = item
	let title = `Segment ${idx + 1}`

	// 1. If explicit '=' separator is used for title
	if (item.includes("=")) {
		const eqIdx = item.indexOf("=")
		rangePart = item.slice(0, eqIdx).trim()
		title = item.slice(eqIdx + 1).trim().replace(/\+/g, " ")
	}

	// 2. Check for range separators: "..", " to ", "_", "-"
	let sep = null
	let sepIdx = -1

	if (rangePart.includes("..")) {
		sep = ".."
		sepIdx = rangePart.indexOf("..")
	} else if (/\s+to\s+/i.test(rangePart)) {
		const m = rangePart.match(/\s+to\s+/i)
		sep = m[0]
		sepIdx = m.index
	} else if (rangePart.includes("_")) {
		sep = "_"
		sepIdx = rangePart.indexOf("_")
	} else if (rangePart.includes("-")) {
		sep = "-"
		sepIdx = rangePart.indexOf("-")
	}

	if (sep) {
		const startPart = rangePart.slice(0, sepIdx).trim()
		const rest = rangePart.slice(sepIdx + sep.length).trim()
		// In 'rest', find end time vs optional colon title
		const match = rest.match(/^([0-9:hms.\s]+)(?::(.*))?$/i)
		if (match) {
			const endPart = match[1].trim()
			if (match[2] !== undefined && !item.includes("=")) {
				title = match[2].trim().replace(/\+/g, " ")
			}
			const start = parseTimestamp(startPart)
			let end = parseTimestamp(endPart)
			if (end <= start) end = start + 30
			return {
				start,
				end,
				title: title || `Segment ${idx + 1}`
			}
		}
	} else {
		// No range separator: single timestamp with optional title
		const match = rangePart.match(/^([0-9:hms.\s]+)(?::(.*))?$/i)
		if (match) {
			const startPart = match[1].trim()
			if (match[2] !== undefined && !item.includes("=")) {
				title = match[2].trim().replace(/\+/g, " ")
			}
			const start = parseTimestamp(startPart)
			return {
				start,
				end: start + 30,
				title: title || `Segment ${idx + 1}`
			}
		}
	}

	const start = parseTimestamp(rangePart)
	return {
		start,
		end: start + 30,
		title: title || `Segment ${idx + 1}`
	}
}

function parseHighlightsParam(raw) {
	if (!raw) return []
	let str = String(raw).trim()
	try {
		str = decodeURIComponent(str)
	} catch (e) {}

	// Check Base64 (starts with b64: or raw base64)
	if (str.startsWith("b64:") || /^[A-Za-z0-9+/=]{16,}$/.test(str)) {
		const b64 = str.startsWith("b64:") ? str.slice(4) : str
		try {
			const decoded = typeof Buffer !== "undefined"
				? Buffer.from(b64, "base64").toString("utf8")
				: atob(b64)
			const parsed = JSON.parse(decoded)
			if (Array.isArray(parsed)) return normalizeHighlightSegments(parsed)
		} catch (e) {}
	}

	// Check JSON directly
	if ((str.startsWith("[") && str.endsWith("]")) || (str.startsWith("{") && str.endsWith("}"))) {
		try {
			const parsed = JSON.parse(str)
			const arr = Array.isArray(parsed) ? parsed : [parsed]
			return normalizeHighlightSegments(arr)
		} catch (e) {}
	}

	// Delimited string: e.g. "42-85:Intro,120-150:Solution" or "0:42-1:25,2:00-3:00"
	const items = str.split(/[,;\n|]+/).map((s) => s.trim()).filter(Boolean)
	return items.map((item, idx) => parseSingleHighlightItem(item, idx)).sort((a, b) => a.start - b.start)
}

function getHighlightsFromUrl(urlStr) {
	try {
		const u = new URL(urlStr, "https://www.youtube.com")
		const queryCandidates = ["highlights", "reel", "segments", "hl_reel", "supercut"]
		for (const key of queryCandidates) {
			const val = u.searchParams.get(key)
			if (val) return val
		}
		if (u.hash) {
			const hashStr = u.hash.replace(/^#/, "")
			const hashParams = new URLSearchParams(hashStr)
			for (const key of queryCandidates) {
				const val = hashParams.get(key)
				if (val) return val
			}
			if (hashStr.includes("=") || hashStr.includes("-")) {
				const parts = hashStr.split("=")
				if (parts.length === 2 && queryCandidates.includes(parts[0])) {
					return parts[1]
				}
			}
		}
	} catch (e) {}
	return null
}

function generateHighlightUrl(baseUrl, segments) {
	if (!segments || segments.length === 0) return baseUrl
	const u = new URL(baseUrl, "https://www.youtube.com")
	const queryCandidates = ["highlights", "reel", "segments", "hl_reel", "supercut"]
	queryCandidates.forEach((k) => u.searchParams.delete(k))

	const formatted = segments
		.map((s) => {
			const titlePart = s.title && !s.title.startsWith("Segment ") ? `:${encodeURIComponent(s.title.replace(/\s+/g, "+"))}` : ""
			return `${Math.round(s.start)}-${Math.round(s.end)}${titlePart}`
		})
		.join(",")

	u.searchParams.set("highlights", formatted)
	return u.toString()
}

// Tests
test("Timestamp Parsing - Seconds, Standard, and Human Durations", () => {
	assert.equal(parseTimestamp(42), 42)
	assert.equal(parseTimestamp("42"), 42)
	assert.equal(parseTimestamp("1:25"), 85)
	assert.equal(parseTimestamp("01:02:30"), 3750)
	assert.equal(parseTimestamp("2m15s"), 135)
	assert.equal(parseTimestamp("1h30s"), 3630)
	assert.equal(parseTimestamp("45s"), 45)
})

test("URL Highlights Parsing - Simple Integer Intervals", () => {
	const param = "42-85,120-150,300-360"
	const segments = parseHighlightsParam(param)
	assert.equal(segments.length, 3)
	assert.deepEqual(segments[0], { start: 42, end: 85, title: "Segment 1" })
	assert.deepEqual(segments[1], { start: 120, end: 150, title: "Segment 2" })
	assert.deepEqual(segments[2], { start: 300, end: 360, title: "Segment 3" })
})

test("URL Highlights Parsing - Colon Timestamps & Titles", () => {
	const param = "0:42-1:25:The+Core+Problem,2:00-2:30:Conclusion"
	const segments = parseHighlightsParam(param)
	assert.equal(segments.length, 2)
	assert.equal(segments[0].start, 42)
	assert.equal(segments[0].end, 85)
	assert.equal(segments[0].title, "The Core Problem")
	assert.equal(segments[1].start, 120)
	assert.equal(segments[1].end, 150)
	assert.equal(segments[1].title, "Conclusion")
})

test("URL Highlights Parsing - JSON Encoded Array", () => {
	const json = JSON.stringify([
		{ start: 10, end: 20, title: "Intro" },
		{ start: 50, end: 90, title: "Demo" }
	])
	const segments = parseHighlightsParam(encodeURIComponent(json))
	assert.equal(segments.length, 2)
	assert.equal(segments[0].start, 10)
	assert.equal(segments[0].title, "Intro")
	assert.equal(segments[1].start, 50)
	assert.equal(segments[1].title, "Demo")
})

test("URL Extraction - Query and Hash Parameters", () => {
	const url1 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&highlights=10-20,30-40"
	assert.equal(getHighlightsFromUrl(url1), "10-20,30-40")

	const url2 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&reel=50-60"
	assert.equal(getHighlightsFromUrl(url2), "50-60")

	const url3 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ#highlights=100-150"
	assert.equal(getHighlightsFromUrl(url3), "100-150")
})

test("URL Highlights Generation", () => {
	const base = "https://www.youtube.com/watch?v=abc123xyz"
	const segments = [
		{ start: 42, end: 85, title: "The Problem" },
		{ start: 120, end: 150, title: "The Solution" }
	]
	const generated = generateHighlightUrl(base, segments)
	assert.ok(generated.includes("highlights="))
	
	// Test round-trip
	const extractedParam = getHighlightsFromUrl(generated)
	const parsed = parseHighlightsParam(extractedParam)
	assert.equal(parsed.length, 2)
	assert.equal(parsed[0].start, 42)
	assert.equal(parsed[0].end, 85)
	assert.equal(parsed[0].title, "The Problem")
	assert.equal(parsed[1].start, 120)
	assert.equal(parsed[1].end, 150)
})

test("URL Highlights Parsing - Human Duration Strings & Alternative Separators", () => {
	const param = "1m20s..2m30s:Section+One,5m to 6m15s=Section+Two,300_360:Section+Three"
	const segments = parseHighlightsParam(param)
	assert.equal(segments.length, 3)
	assert.equal(segments[0].start, 80)
	assert.equal(segments[0].end, 150)
	assert.equal(segments[0].title, "Section One")
	assert.equal(segments[1].start, 300)
	assert.equal(segments[1].end, 375)
	assert.equal(segments[1].title, "Section Two")
	assert.equal(segments[2].start, 300)
	assert.equal(segments[2].end, 360)
	assert.equal(segments[2].title, "Section Three")
})

test("URL Highlights Parsing - Base64 Encoded JSON", () => {
	const data = [
		{ start: 30, end: 60, title: "Base64 Demo 1" },
		{ start: 90, end: 120, title: "Base64 Demo 2" }
	]
	const b64 = Buffer.from(JSON.stringify(data)).toString("base64")
	const segments1 = parseHighlightsParam(b64)
	assert.equal(segments1.length, 2)
	assert.equal(segments1[0].start, 30)
	assert.equal(segments1[0].title, "Base64 Demo 1")

	const segments2 = parseHighlightsParam(`b64:${b64}`)
	assert.equal(segments2.length, 2)
	assert.equal(segments2[1].start, 90)
	assert.equal(segments2[1].title, "Base64 Demo 2")
})

test("URL Highlights Parsing - Single Timestamp Points (Default Snippet Duration)", () => {
	const param = "42:Key+Insight,120:Demo+Start"
	const segments = parseHighlightsParam(param)
	assert.equal(segments.length, 2)
	assert.equal(segments[0].start, 42)
	assert.equal(segments[0].end, 72)
	assert.equal(segments[0].title, "Key Insight")
	assert.equal(segments[1].start, 120)
	assert.equal(segments[1].end, 150)
	assert.equal(segments[1].title, "Demo Start")
})
