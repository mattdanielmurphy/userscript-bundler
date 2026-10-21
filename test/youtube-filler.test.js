import { test, expect } from "bun:test"
import fs from "fs"
import path from "path"

// Evaluate the real <filler-core> block from the userscript so tests can't drift from it.
const src = fs.readFileSync(path.join(import.meta.dir, "../userscripts/youtube-master.user.js"), "utf8")
const core = src.match(/\/\/ <filler-core>[^\n]*\n([\s\S]*?)\/\/ <\/filler-core>/)[1]
const { invertSkipsToKeeps, parseFillerResponse, fillerCacheGet, fillerCachePut, fillerHash, formatClock, transcriptPanelParams, transcriptFromPanelJson } = new Function(
	`${core}; return { invertSkipsToKeeps, parseFillerResponse, fillerCacheGet, fillerCachePut, fillerHash, formatClock, transcriptPanelParams, transcriptFromPanelJson }`,
)()

test("invertSkipsToKeeps: gaps between skips become keeps, last keep runs to the end", () => {
	const skips = [{ start: 0, end: 42 }, { start: 600, end: 690 }, { start: 2850, end: 2930 }]
	expect(invertSkipsToKeeps(skips, 2930)).toEqual([
		{ start: 42, end: 600, title: "Content" },
		{ start: 690, end: 2850, title: "Content" },
	])
	expect(invertSkipsToKeeps([{ start: 100, end: 200 }])).toEqual([
		{ start: 0, end: 100, title: "Content" },
		{ start: 200, end: Infinity, title: "Content" },
	])
	expect(invertSkipsToKeeps([], 50)).toEqual([{ start: 0, end: 50, title: "Content" }])
})

test("invertSkipsToKeeps: overlapping skips don't create bogus keeps", () => {
	expect(invertSkipsToKeeps([{ start: 10, end: 50 }, { start: 20, end: 30 }, { start: 50.2, end: 60 }], 100)).toEqual([
		{ start: 0, end: 10, title: "Content" },
		{ start: 60, end: 100, title: "Content" },
	])
})

test("parseFillerResponse: validates, sorts, merges and clamps", () => {
	const data = { skips: [{ start: 600, end: 690, label: "teaser", reason: "r" }, { start: "0", end: "42", label: "recap" }, { start: 650, end: 700 }, { start: 5, end: 5.5 }, { start: "x", end: 9 }, { start: 2900, end: 3000, label: "next time" }] }
	expect(parseFillerResponse(data, 2930)).toEqual([
		{ start: 0, end: 42, label: "recap", reason: "" },
		{ start: 600, end: 700, label: "teaser", reason: "r" },
		{ start: 2900, end: 2930, label: "next time", reason: "" },
	])
	expect(parseFillerResponse({ error: "nope" })).toBeNull()
	expect(parseFillerResponse(null)).toBeNull()
	expect(parseFillerResponse({ skips: [] })).toEqual([])
})

test("cache: hit only for same video and taste; evicts oldest past max", () => {
	const t = fillerHash("taste A")
	let c = fillerCachePut({}, "vid1", t, [{ start: 0, end: 10 }], 1)
	expect(fillerCacheGet(c, "vid1", t)).toEqual([{ start: 0, end: 10 }])
	expect(fillerCacheGet(c, "vid1", fillerHash("taste B"))).toBeNull()
	expect(fillerCacheGet(c, "vid2", t)).toBeNull()
	c = fillerCachePut(c, "vid2", t, [], 2, 2)
	c = fillerCachePut(c, "vid3", t, [], 3, 2)
	expect(Object.keys(c).sort()).toEqual(["vid2", "vid3"])
	expect(fillerCacheGet(c, "vid2", t)).toEqual([]) // "no filler" is cached too
})

test("formatClock", () => {
	expect(formatClock(42)).toBe("0:42")
	expect(formatClock(90)).toBe("1:30")
	expect(formatClock(3725)).toBe("1:02:05")
})

test("transcriptPanelParams matches what YouTube's own transcript panel sends", () => {
	expect(transcriptPanelParams("vLSrEiEiifs")).toBe("qgkPCgt2TFNyRWlFaWlmcxgB")
})

test("transcriptFromPanelJson extracts [Ns] lines from a get_panel response", () => {
	const json = { a: [{ timelineItemViewModel: { contentItems: [{ transcriptSegmentViewModel: { timestamp: "1:05", simpleText: "second" } }] } }, { transcriptSegmentViewModel: { timestamp: "0:01", simpleText: "On this episode" } }, { transcriptSegmentViewModel: { timestamp: "1:00:00", simpleText: "late" } }] }
	expect(transcriptFromPanelJson(json)).toBe("[1s] On this episode\n[65s] second\n[3600s] late")
	expect(transcriptFromPanelJson({})).toBeNull()
})
