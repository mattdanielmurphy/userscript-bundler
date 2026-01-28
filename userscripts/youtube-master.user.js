// ==UserScript==
// @name         YouTube Master Script (Consolidated)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Consolidated script for all YouTube userscript features with a single MutationObserver for efficiency.
// @author       Gemini CLI Agent
// @match        https://www.youtube.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        none
// @run-at       document-start
// ==/UserScript==

;(function () {
	"use strict"

	// --- UTILITIES ---
	const isWatchPage = () => window.location.pathname === "/watch"
	const isSearchPage = () => window.location.pathname === "/results"
	const isChannelPage = () => window.location.pathname.startsWith("/@") || window.location.pathname.startsWith("/channel/")

	// --- 1. YOUTUBE REFRESH ON UNAVAILABLE VIDEO (Watch Page Only) ---
	const REFRESH_KEY = "yt_refresh_on_error_count"
	const MAX_REFRESHES = 1
	const ERROR_SELECTOR = "yt-player-error-message-renderer #reason"

	function checkAndRefresh() {
		if (!isWatchPage()) return

		const errorElement = document.querySelector(ERROR_SELECTOR)
		const isErrorPresent = errorElement && errorElement.textContent.trim() === "Video unavailable"
		let refreshCount = parseInt(localStorage.getItem(REFRESH_KEY) || "0", 10)

		if (isErrorPresent) {
			if (refreshCount < MAX_REFRESHES) {
				console.log('MasterScript: Detected "Video unavailable". Refreshing page.')
				localStorage.setItem(REFRESH_KEY, refreshCount + 1)
				window.location.reload()
			} else {
				console.log('MasterScript: Detected "Video unavailable", but max refreshes reached.')
			}
		} else {
			if (refreshCount > 0) {
				localStorage.removeItem(REFRESH_KEY)
				console.log("MasterScript: Error cleared. Resetting refresh counter.")
			}
		}
	}

	// --- 2. YOUTUBE TOGGLE THUMBNAILS ---
	let thumbnailsHidden = sessionStorage.getItem("thumbnailsHidden") === "true"
	let buttonSetup = false

	function applyThumbnailStyle(el, hide) {
		el.style.visibility = hide ? "hidden" : ""
	}

	function toggleAllThumbnails(hide) {
		document.querySelectorAll("#video-preview").forEach((videoPreview) => {
			applyThumbnailStyle(videoPreview, hide)
		})
		document.querySelectorAll("ytd-thumbnail").forEach((thumbnail) => {
			applyThumbnailStyle(thumbnail, hide)
		})
		document.querySelectorAll("yt-thumbnail-view-model").forEach((thumbnail) => {
			applyThumbnailStyle(thumbnail, hide)
		})
	}

	function isDarkMode() {
		return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
	}

	function setupButton(createBtn) {
		if (document.getElementById("thumbnail-toggle-btn")) return
		buttonSetup = true

		const toggleBtn = document.createElement("button")
		toggleBtn.id = "thumbnail-toggle-btn"
		toggleBtn.title = "Toggle Thumbnails"
		Object.assign(toggleBtn.style, {
			height: `${createBtn.offsetHeight}px`,
			width: `${createBtn.offsetWidth}px`,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			background: "transparent",
			border: "none",
			cursor: "pointer",
			padding: "0",
			position: "relative",
		})

		const svgNS = "http://www.w3.org/2000/svg"
		const svg = document.createElementNS(svgNS, "svg")
		svg.setAttribute("viewBox", "0 0 24 24")
		svg.setAttribute("width", "26.4")
		svg.setAttribute("height", "26.4")
		svg.style.display = "block"

		const rect = document.createElementNS(svgNS, "rect")
		rect.setAttribute("x", "2")
		rect.setAttribute("y", "4")
		rect.setAttribute("width", "20")
		rect.setAttribute("height", "16")
		rect.setAttribute("rx", "2")
		rect.setAttribute("fill", "none")
		rect.setAttribute("stroke-width", "2")

		const sun = document.createElementNS(svgNS, "circle")
		sun.setAttribute("cx", "7")
		sun.setAttribute("cy", "9")
		sun.setAttribute("r", "2")

		const mountain = document.createElementNS(svgNS, "path")
		mountain.setAttribute("d", "M2 20 L9 13 L13 17 L17 12 L22 20 Z")

		const line = document.createElementNS(svgNS, "line")
		line.setAttribute("x1", "4")
		line.setAttribute("y1", "18")
		line.setAttribute("x2", "20")
		line.setAttribute("y2", "6")
		line.setAttribute("stroke-width", "2")
		line.setAttribute("stroke-linecap", "round")
		line.style.display = "none"

		const setIconColor = () => {
			const isDark = isDarkMode()
			const mainColor = isDark ? "#fff" : "#0f0f0f"
			const strikeColor = isDark ? "#D8D8D8" : "#252525"
			rect.setAttribute("stroke", mainColor)
			sun.setAttribute("fill", mainColor)
			mountain.setAttribute("fill", mainColor)
			mountain.setAttribute("opacity", "0.4")
			line.setAttribute("stroke", strikeColor)
		}

		svg.append(rect, sun, mountain, line)
		toggleBtn.appendChild(svg)

		toggleBtn.addEventListener("mouseenter", () => {
			if (!thumbnailsHidden) line.style.display = "block"
		})
		toggleBtn.addEventListener("mouseleave", () => {
			if (!thumbnailsHidden) line.style.display = "none"
		})
		toggleBtn.addEventListener("click", () => {
			thumbnailsHidden = !thumbnailsHidden
			sessionStorage.setItem("thumbnailsHidden", thumbnailsHidden)
			toggleAllThumbnails(thumbnailsHidden)
			line.style.display = thumbnailsHidden ? "block" : "none"
		})

		createBtn.replaceWith(toggleBtn)

		setIconColor()
		window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", setIconColor)
	}

	function checkThumbnailButton() {
		if (buttonSetup) return
		const createBtn = document.querySelector('button[aria-label="Create"]')
		if (createBtn) {
			const parentButtonRenderer = createBtn.closest("ytd-button-renderer")
			if (parentButtonRenderer) {
				setupButton(parentButtonRenderer)
			}
		}
	}

	// --- 3. YOUTUBE REMOVE MEMBERS-ONLY VIDEOS ---
	function deleteMembersOnlyVideos() {
		// Only run on channel pages for efficiency, but keep it broad for now as the original was broad.
		// if (!isChannelPage()) return;

		// YouTube uses different structures for badges. We look for the common ones.
		const elements = Array.from(document.querySelectorAll(".yt-badge-shape__text, p, span, yt-formatted-string")).filter((el) => el.textContent.trim() === "Members only")

		elements.forEach((el) => {
			const videoItem = el.closest("ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-rich-grid-media")
			if (videoItem) {
				videoItem.remove()
			}
		})
	}

	// --- 4. YOUTUBE HIDE SHORTS ---
	function removeShortsRows() {
		const shortsRows = Array.from(document.querySelectorAll("ytd-rich-section-renderer, ytd-rich-shelf-renderer")).filter((el) => el.textContent && /Shorts/i.test(el.textContent))

		if (shortsRows.length > 0) {
			shortsRows.forEach((row) => row.remove())
			return true
		}
		return false
	}

	function removeShortsSearchGrid() {
		const shortsSpans = Array.from(document.querySelectorAll("span")).filter((span) => span.innerText === "Shorts")
		let removed = false
		shortsSpans.forEach((span) => {
			const shelf = span.closest("grid-shelf-view-model")
			if (shelf) {
				shelf.remove()
				removed = true
			}
		})
		return removed
	}

	function runShortsRemovers() {
		removeShortsRows()
		removeShortsSearchGrid()
	}

	// --- 5. YOUTUBE HIDE LOW VIEW VIDEOS ---
	function parseViews(viewText) {
		if (!viewText) return Infinity // Don't hide if we can't find text
		const cleanText = viewText.toLowerCase().replace(/,/g, "").trim()
		if (cleanText.includes("no views")) return 0

		const match = cleanText.match(/([\d.]+)\s*([kmbt]?)\s*view/)
		if (!match) return Infinity

		let count = parseFloat(match[1])
		const multiplier = match[2]

		if (multiplier === "k") count *= 1000
		else if (multiplier === "m") count *= 1000000
		else if (multiplier === "b") count *= 1000000000

		return count
	}

	function hideLowViewVideos() {
		const VIEW_THRESHOLD = 1000

		// Find elements that look like view counts
		const viewElements = Array.from(document.querySelectorAll(".yt-badge-shape__text, p, span, yt-formatted-string")).filter((el) => {
			const text = el.textContent.toLowerCase()
			return (text.includes("view") || text.includes("no views")) && /[\d.]/.test(text)
		})

		viewElements.forEach((el) => {
			const text = el.textContent.trim()
			const views = parseViews(text)

			if (views < VIEW_THRESHOLD) {
				const videoItem = el.closest("ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-rich-grid-media")
				if (videoItem) {
					videoItem.remove()
				}
			}
		})
	}

	// --- 6. YOUTUBE GET TRANSCRIPT BUTTON (Watch Page Only) ---
	let _transcriptInterval = null

	async function setupTranscriptButton() {
		if (!isWatchPage()) return

		const shareBtnContainer = document.querySelector("#above-the-fold #top-level-buttons-computed")
		if (!shareBtnContainer || shareBtnContainer.children.length < 2) {
			return
		}
		const shareBtn = shareBtnContainer.children[1].querySelector('button[aria-label="Share"]')

		if (!shareBtn || shareBtn.hasAttribute("data-transcript-button-processed")) {
			return
		}

		shareBtn.setAttribute("data-transcript-button-processed", "true")

		// Change button text
		const textDiv = shareBtn.querySelector(".yt-spec-button-shape-next__button-text-content")
		if (textDiv) {
			textDiv.innerText = "Get transcript"
		} else {
			shareBtn.innerText = "Get transcript"
		}

		// Set click handler (keeping the async logic)
		shareBtn.onclick = async function () {
			const showTranscriptBtn = document.querySelector('button[aria-label="Show transcript"]')
			if (showTranscriptBtn) {
				showTranscriptBtn.click()
			} else {
				alert('No "Show transcript" button found!')
				return
			}

			let maxTries = 200,
				tries = 0
			let transcriptContainer = null
			while (!transcriptContainer && tries < maxTries) {
				await new Promise((res) => setTimeout(res, 20))
				transcriptContainer = document.querySelector("#segments-container")
				tries++
			}
			if (!transcriptContainer) {
				alert("Transcript container not found!")
				return
			}

			let lines = transcriptContainer.innerText.split("\n")
			let processed = []
			let lastTime = null
			const timecodeRegex = /^(?:\d{1,2}:)?\d{2}$/
			const audioDescRegex = /^\[.*\]$/

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim()
				if (line === "") continue

				if (!isNaN(Number(line.replace(":", ""))) && timecodeRegex.test(line)) {
					lastTime = line
					if (lines[i + 1] && audioDescRegex.test(lines[i + 1].trim())) {
						i++
						lastTime = null
					}
				} else if (audioDescRegex.test(line)) {
					lastTime = null
					continue
				} else if (lastTime) {
					processed.push(`[${lastTime}] ${line}`)
					lastTime = null
				} else {
					processed.push(line)
				}
			}

			const finalTranscript = processed.join("\n").replace(/\n{3,}/g, "\n\n")
			const transcriptPanel = transcriptContainer.closest("ytd-engagement-panel-section-list-renderer")

			try {
				transcriptPanel.querySelector("#visibility-button button").click()
			} catch (err) {
				console.log("Failed to close panel:", err)
			}

			try {
				await navigator.clipboard.writeText(finalTranscript)
				alert("Transcript copied to clipboard!")
			} catch (err) {
				alert("Failed to copy transcript: " + err)
			}
		}
	}

	// --- 7. YOUTUBE SEARCH EXCLUDE TERMS (Search Page Only) ---
	let resultsObserver = null
	let _ytExclResizeHandler = null
	let _ytExclScrollHandler = null

	function ensureStyle() {
		let style = document.getElementById("yt-search-exclusion-style")
		if (style) return style
		style = document.createElement("style")
		style.id = "yt-search-exclusion-style"
		style.appendChild(document.createTextNode('ytd-video-renderer[data-excluded="true"] { display: none !important; }\n            #yt-search-exclusion-tip { will-change: transform, opacity; }'))
		document.head.appendChild(style)
		return style
	}

	function ensureTooltip() {
		let tip = document.getElementById("yt-search-exclusion-tip")
		if (tip) return tip

		tip = document.createElement("div")
		tip.id = "yt-search-exclusion-tip"
		tip.setAttribute("role", "tooltip")

		Object.assign(tip.style, {
			position: "absolute",
			zIndex: "9999",
			maxWidth: "320px",
			background: "rgba(28,28,28,0.96)",
			color: "#fff",
			padding: "6px 8px",
			borderRadius: "8px",
			boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
			fontSize: "12px",
			lineHeight: "14px",
			height: "14px",
			pointerEvents: "none",
			transition: "opacity 120ms ease",
			opacity: "0",
			backdropFilter: "blur(6px)",
			border: "1px solid rgba(255,255,255,0.1)",
			whiteSpace: "nowrap",
		})

		const span = document.createElement("span")
		span.textContent = "Omit terms using dashes. Example: pizza -shorts -trailer"
		tip.appendChild(span)

		document.body.appendChild(tip)
		return tip
	}

	function getSearchInput() {
		let input = document.querySelector('input[name="search_query"]') || document.querySelector('input[role="combobox"][placeholder="Search"]')
		if (!input) {
			const candidates = Array.from(document.querySelectorAll('input[type="text"], input'))
			input =
				candidates.find((el) => {
					const ph = (el.getAttribute("placeholder") || "").toLowerCase()
					const role = (el.getAttribute("role") || "").toLowerCase()
					const name = (el.getAttribute("name") || "").toLowerCase()
					return role === "combobox" || name === "search_query" || ph.includes("search")
				}) || null
		}
		return input
	}

	function getSuggestionsListbox() {
		return document.querySelector('[role="listbox"]')
	}

	function showTooltipNear(input) {
		const tip = ensureTooltip()
		const rect = input.getBoundingClientRect()
		const scrollX = window.scrollX || document.documentElement.scrollLeft || 0
		const scrollY = window.scrollY || document.documentElement.scrollTop || 0
		const margin = 8
		const extraLeft = 50
		const extraTop = 5

		tip.style.left = "-9999px"
		tip.style.top = "-9999px"
		tip.style.opacity = "0"
		const tipRectInitial = tip.getBoundingClientRect()

		let left = rect.left + scrollX - tipRectInitial.width - margin - extraLeft
		let top = rect.top + scrollY + extraTop

		if (left < scrollX + 8) {
			left = rect.left + scrollX - extraLeft
			top = rect.top + scrollY - tipRectInitial.height - margin + extraTop
			if (top < scrollY + 8) {
				top = rect.bottom + scrollY + margin + extraTop
			}
		}

		tip.style.left = `${left}px`
		tip.style.top = `${top}px`
		tip.style.opacity = "1"

		const listbox = getSuggestionsListbox()
		if (listbox) {
			listbox.style.transform = `translateY(30px)`
			listbox.style.willChange = "transform"
		}
	}

	function hideTooltip() {
		const tip = document.getElementById("yt-search-exclusion-tip")
		if (tip) tip.style.opacity = "0"
		const listbox = getSuggestionsListbox()
		if (listbox) {
			listbox.style.transform = ""
			listbox.style.willChange = ""
		}
	}

	function parseExclusions(query) {
		if (!query) return []
		const tokens = String(query).split(/\s+/).filter(Boolean)
		const excl = tokens
			.filter((t) => t.startsWith("-"))
			.map((t) => {
				const stripped = t.replace(/^-/, "")
				if (!stripped || stripped.startsWith("-")) return ""
				return stripped.trim().toLowerCase()
			})
			.filter(Boolean)
		return Array.from(new Set(excl))
	}

	function getTitleText(videoRenderer) {
		if (!videoRenderer) return ""
		let a = videoRenderer.querySelector("a#video-title")
		if (!a) {
			a =
				videoRenderer.querySelector("h3 a[aria-label], h3 a[title]") ||
				videoRenderer.querySelector('a[aria-label][href*="/watch"], a[title][href*="/watch"]') ||
				videoRenderer.querySelector('a[href*="/watch"]')
		}
		if (!a) return ""
		const ytf = a.querySelector("yt-formatted-string")
		const text = (ytf ? ytf.textContent : a.textContent) || ""
		return text.trim()
	}

	function applyExclusionToRenderer(renderer, exclusions) {
		const title = getTitleText(renderer).toLowerCase()
		if (!title) {
			renderer.removeAttribute("data-excluded")
			return false
		}
		const matched = exclusions.some((kw) => title.includes(kw))
		if (matched) {
			renderer.setAttribute("data-excluded", "true")
			return true
		} else {
			renderer.removeAttribute("data-excluded")
			return false
		}
	}

	function getExclusionsFromURL() {
		const urlParams = new URLSearchParams(window.location.search)
		const searchQuery = urlParams.get("search_query") || ""
		return parseExclusions(searchQuery)
	}

	function applySearchFilter(exclusions) {
		const renderers = Array.from(document.querySelectorAll("ytd-video-renderer"))
		for (const r of renderers) {
			applyExclusionToRenderer(r, exclusions)
		}
	}

	function initSearchExclusion() {
		if (!isSearchPage()) return

		ensureStyle()
		const input = getSearchInput()
		if (!input) return

		let currentExclusions = getExclusionsFromURL()
		let userHasModifiedInput = false

		applySearchFilter(currentExclusions)

		let typingTimer = null
		const reapply = () => {
			if (userHasModifiedInput) {
				currentExclusions = parseExclusions(input.value)
			} else {
				const urlExclusions = getExclusionsFromURL()
				const inputExclusions = parseExclusions(input.value)
				currentExclusions = urlExclusions.length > 0 ? urlExclusions : inputExclusions
			}
			applySearchFilter(currentExclusions)
		}
		const debouncedReapply = () => {
			if (typingTimer) clearTimeout(typingTimer)
			typingTimer = setTimeout(reapply, 500)
		}

		// Remove previous handlers if pasted multiple times (important for SPA navigation)
		input.removeEventListener("focus", input._ytExclFocusHandler || (() => {}))
		input.removeEventListener("click", input._ytExclClickHandler || (() => {}))
		input.removeEventListener("blur", input._ytExclBlurHandler || (() => {}))
		input.removeEventListener("input", input._ytExclInputHandler || (() => {}))
		input.removeEventListener("change", input._ytExclChangeHandler || (() => {}))
		input.removeEventListener("keyup", input._ytExclKeyupHandler || (() => {}))
		const form = input.closest("form")
		if (form) {
			form.removeEventListener("submit", input._ytExclSubmitHandler || (() => {}))
		}

		// Handlers
		input._ytExclFocusHandler = () => showTooltipNear(input)
		input._ytExclClickHandler = () => showTooltipNear(input)
		input._ytExclBlurHandler = () => hideTooltip()
		input._ytExclInputHandler = () => {
			userHasModifiedInput = true
			debouncedReapply()
		}
		input._ytExclChangeHandler = () => {
			userHasModifiedInput = true
			debouncedReapply()
		}
		input._ytExclKeyupHandler = () => {
			userHasModifiedInput = true
			debouncedReapply()
		}

		input.addEventListener("focus", input._ytExclFocusHandler)
		input.addEventListener("click", input._ytExclClickHandler)
		input.addEventListener("blur", input._ytExclBlurHandler)
		input.addEventListener("input", input._ytExclInputHandler)
		input.addEventListener("change", input._ytExclChangeHandler)
		input.addEventListener("keyup", input._ytExclKeyupHandler)

		if (form) {
			input._ytExclSubmitHandler = () => setTimeout(reapply, 600)
			form.addEventListener("submit", input._ytExclSubmitHandler)
		}

		const tip = ensureTooltip()
		const reposition = () => {
			if (tip.style.opacity === "1") showTooltipNear(input)
		}
		window.removeEventListener("resize", _ytExclResizeHandler || (() => {}))
		window.removeEventListener("scroll", _ytExclScrollHandler || (() => {}))
		_ytExclResizeHandler = reposition
		_ytExclScrollHandler = reposition
		window.addEventListener("resize", _ytExclResizeHandler, { passive: true })
		window.addEventListener("scroll", _ytExclScrollHandler, { passive: true })
	}

	// --- 8. YOUTUBE MAX QUALITY (Event-based) ---
	// Full content of youtube-max-quality.js, adapted to fit the master script's IIFE.

	const DEBUG = false
	const resolutions = ["highres", "hd2880", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"]
	const heights = [4320, 2880, 2160, 1440, 1080, 720, 480, 360, 240, 144]
	let doc = document,
		win = window
	let recentVideo = ""
	let foundHFR = false
	let setHeight = 0
	let maxQualitySettings = {}

	function debugLog(message) {
		if (DEBUG) {
			console.log("YTHD | " + message)
		}
	}

	function unwrapElement(el) {
		if (el && el.wrappedJSObject) {
			return el.wrappedJSObject
		}
		return el
	}

	function getPlayer() {
		let ytPlayer = doc.getElementById("movie_player") || doc.getElementsByClassName("html5-video-player")[0]
		return unwrapElement(ytPlayer)
	}

	function getVideoIDFromURL(ytPlayer) {
		const idMatch = /(?:v=)([\\w\\-]+)/
		let id = "ERROR: idMatch failed; youtube changed something"
		let matches = idMatch.exec(ytPlayer.getVideoUrl())
		if (matches) {
			id = matches[1]
		}
		return id
	}

	function setResolution(ytPlayer, resolutionList) {
		debugLog("Setting Resolution...")

		const currentQuality = ytPlayer.getPlaybackQuality()
		let res = maxQualitySettings.targetRes

		if (maxQualitySettings.highFramerateTargetRes && foundHFR) {
			res = maxQualitySettings.highFramerateTargetRes
		}

		let shouldPremium = maxQualitySettings.preferPremium && [...ytPlayer.getAvailableQualityData()].some((q) => q.quality == res && q.qualityLabel.includes("Premium") && q.isPlayable)
		let useButtons = !maxQualitySettings.useAPI || shouldPremium

		if (resolutionList.indexOf(res) < resolutionList.indexOf(currentQuality)) {
			const end = resolutionList.length - 1
			let nextBestIndex = Math.max(resolutionList.indexOf(res), 0)
			let ytResolutions = ytPlayer.getAvailableQualityLevels()
			debugLog("Available Resolutions: " + ytResolutions.join(", "))

			while (ytResolutions.indexOf(resolutionList[nextBestIndex]) === -1 && nextBestIndex < end) {
				++nextBestIndex
			}

			if (!useButtons && maxQualitySettings.flushBuffer && currentQuality !== resolutionList[nextBestIndex]) {
				let id = getVideoIDFromURL(ytPlayer)
				if (id.indexOf("ERROR") === -1) {
					let pos = ytPlayer.getCurrentTime()
					ytPlayer.loadVideoById(id, pos, resolutionList[nextBestIndex])
				}
				debugLog("ID: " + id)
			}
			res = resolutionList[nextBestIndex]
		}

		if (maxQualitySettings.useAPI) {
			if (ytPlayer.setPlaybackQualityRange !== undefined) {
				ytPlayer.setPlaybackQualityRange(res)
			}
			ytPlayer.setPlaybackQuality(res)
			debugLog("(API) Resolution Set To: " + res)
		}
		if (useButtons) {
			let resLabel = heights[resolutionList.indexOf(res)]
			if (shouldPremium) {
				resLabel = [...ytPlayer.getAvailableQualityData()].find((q) => q.quality == res && q.qualityLabel.includes("Premium")).qualityLabel
			}

			let settingsButton = doc.querySelector(".ytp-settings-button:not(#ScaleBtn)")
			if (settingsButton) unwrapElement(settingsButton).click()

			let qualityMenuButton = document.evaluate(
				'.//*[contains(text(),"Quality")]/ancestor-or-self::*[@class="ytp-menuitem-label"]',
				ytPlayer,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue
			if (qualityMenuButton) unwrapElement(qualityMenuButton).click()

			let qualityButton = document.evaluate(
				'.//*[contains(text(),"' + heights[resolutionList.indexOf(res)] + '") and not(@class)]/ancestor::*[@class="ytp-menuitem"]',
				ytPlayer,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue
			if (qualityButton) unwrapElement(qualityButton).click()
			debugLog("(Buttons) Resolution Set To: " + res)
		}
	}

	function setResOnReady(ytPlayer, resolutionList) {
		if (maxQualitySettings.useAPI && (ytPlayer.getPlaybackQuality === undefined || ytPlayer.getPlaybackQuality() == "unknown")) {
			win.setTimeout(setResOnReady, 100, ytPlayer, resolutionList)
		} else {
			let framerateUpdate = false
			if (maxQualitySettings.highFramerateTargetRes) {
				let features = ytPlayer.getVideoData().video_quality_features
				if (features) {
					let isHFR = features.includes("hfr")
					framerateUpdate = isHFR && !foundHFR
					foundHFR = isHFR
				}
			}

			let curVid = getVideoIDFromURL(ytPlayer)
			if (curVid !== recentVideo || framerateUpdate) {
				recentVideo = curVid
				setResolution(ytPlayer, resolutionList)

				let storedQuality = localStorage.getItem("yt-player-quality")
				if (!storedQuality || storedQuality.indexOf(maxQualitySettings.targetRes) === -1) {
					let tc = Date.now(),
						te = tc + 2592000000
					localStorage.setItem("yt-player-quality", '{"data":"' + maxQualitySettings.targetRes + '","expiration":' + te + ',"creation":' + tc + "}")
				}
			}
		}
	}

	function setTheaterMode(ytPlayer) {
		debugLog("Setting Theater Mode")

		if (win.location.href.indexOf("/watch") !== -1) {
			let pageManager = unwrapElement(doc.getElementsByTagName("ytd-watch-flexy")[0])

			if (pageManager && !pageManager.hasAttribute("theater")) {
				if (maxQualitySettings.enableErrorScreenWorkaround) {
					const styleContent = "#error-screen { z-index: 42 !important } .ytp-error { display: none !important }"

					let errorStyle = doc.getElementById("ythdErrorWorkaroundStyleSheet")
					if (!errorStyle) {
						errorStyle = doc.createElement("style")
						errorStyle.type = "text/css"
						errorStyle.id = "ythdStyleSheet"
						errorStyle.textContent = styleContent
						doc.head.appendChild(errorStyle)
					} else {
						errorStyle.textContent = styleContent
					}
				}

				try {
					pageManager.setTheaterModeRequested(true)
					pageManager.updateTheaterModeState_(true)
					pageManager.onTheaterReduxValueUpdate(true)
					pageManager.setPlayerTheaterMode_()
					pageManager.dispatchEvent(new CustomEvent("yt-set-theater-mode-enabled", { detail: { enabled: true }, bubbles: true, cancelable: false }))
				} catch {}

				let theaterButton
				for (let i = 0; i < 3 && !pageManager.theaterValue; ++i) {
					debugLog("Clicking theater button to attempt to notify redux state")
					theaterButton = theaterButton || unwrapElement(doc.getElementsByClassName("ytp-size-button")[0])
					if (theaterButton) theaterButton.click()
				}
			}
		}
	}

	function computeAndSetPlayerSize() {
		let height = maxQualitySettings.customHeight
		if (!maxQualitySettings.useCustomSize) {
			let heightOffsetEl = doc.getElementById("masthead")
			let mastheadContainerEl = doc.getElementById("masthead-container")
			let mastheadHeight = 50,
				mastheadPadding = 16
			if (heightOffsetEl && mastheadContainerEl) {
				mastheadHeight = parseInt(win.getComputedStyle(heightOffsetEl).height, 10)
				mastheadPadding = parseInt(win.getComputedStyle(mastheadContainerEl).paddingBottom, 10) * 2
			}

			let i = Math.max(resolutions.indexOf(maxQualitySettings.targetRes), 0)
			height = Math.min(heights[i], win.innerHeight - (mastheadHeight + mastheadPadding))
			height = Math.max(height, 270)

			if (maxQualitySettings.removeBlackBars) {
				let ytPlayer = getPlayer()
				if (ytPlayer !== undefined && ytPlayer.getVideoAspectRatio !== undefined) {
					height = Math.min(height, win.innerWidth / ytPlayer.getVideoAspectRatio())
				}
			}
		}
		resizePlayer(height)
	}

	function resizePlayer(height) {
		debugLog("Setting video player size to " + height)

		if (setHeight === height) {
			debugLog("Player size already set")
			return
		}

		let styleContent =
			"\
ytd-watch-flexy[theater]:not([fullscreen]) #player-theater-container.style-scope, \
ytd-watch-flexy[theater]:not([fullscreen]) #player-wide-container.style-scope, \
ytd-watch-flexy[theater]:not([fullscreen]) #full-bleed-container.style-scope { \
min-height: " +
			height +
			"px !important; max-height: none !important; height: " +
			height +
			"px !important }"

		let ythdStyle = doc.getElementById("ythdStyleSheet")
		if (!ythdStyle) {
			ythdStyle = doc.createElement("style")
			ythdStyle.type = "text/css"
			ythdStyle.id = "ythdStyleSheet"
			ythdStyle.textContent = styleContent
			doc.head.appendChild(ythdStyle)
		} else {
			ythdStyle.textContent = styleContent
		}

		setHeight = height
		win.dispatchEvent(new Event("resize"))
	}

	function initMaxQuality() {
		if (!isWatchPage()) return

		let ytPlayer = getPlayer()

		if (maxQualitySettings.autoTheater && ytPlayer) {
			if (maxQualitySettings.allowCookies && doc.cookie.indexOf("wide=1") === -1) {
				doc.cookie = "wide=1; domain=.youtube.com"
			}
			setTheaterMode(ytPlayer)
		}

		if (maxQualitySettings.changePlayerSize && win.location.host.indexOf("youtube.com") !== -1 && win.location.host.indexOf("gaming.") === -1) {
			computeAndSetPlayerSize()
			window.addEventListener("resize", computeAndSetPlayerSize, true)
		}

		if (maxQualitySettings.changeResolution && maxQualitySettings.setResolutionEarly && ytPlayer) {
			setResOnReady(ytPlayer, resolutions)
		}

		if (maxQualitySettings.changeResolution || maxQualitySettings.autoTheater) {
			win.addEventListener(
				"loadstart",
				function (e) {
					if (!(e.target instanceof win.HTMLMediaElement)) {
						return
					}
					ytPlayer = getPlayer()
					if (ytPlayer) {
						debugLog("Loaded new video")
						if (maxQualitySettings.changeResolution) {
							setResOnReady(ytPlayer, resolutions)
						}
						if (maxQualitySettings.autoTheater) {
							setTheaterMode(ytPlayer)
						}
					}
				},
				true
			)
		}
	}

	async function applyMaxQualitySettings() {
		// Default settings from the original script
		maxQualitySettings = {
			changeResolution: true,
			preferPremium: true,
			targetRes: "hd2160",
			highFramerateTargetRes: null,
			changePlayerSize: false,
			removeBlackBars: false,
			useCustomSize: false,
			customHeight: 600,
			autoTheater: false,
			flushBuffer: true,
			allowCookies: false,
			setResolutionEarly: true,
			enableErrorScreenWorkaround: true,
			useAPI: true,
			overwriteStoredSettings: false,
		}

		if (typeof GM != "undefined" && GM.getValue && GM.setValue) {
			let settingsSaved = await GM.getValue("SettingsSaved")

			if (maxQualitySettings.overwriteStoredSettings || !settingsSaved) {
				Object.entries(maxQualitySettings).forEach(([k, v]) => GM.setValue(k, v))
				await GM.setValue("SettingsSaved", true)
			} else {
				await Promise.all(
					Object.keys(maxQualitySettings).map((k) => {
						let newval = GM.getValue(k)
						return newval.then((v) => [k, v])
					})
				).then((c) =>
					c.forEach(([nk, nv]) => {
						if (maxQualitySettings[nk] !== null && nk !== "overwriteStoredSettings") {
							maxQualitySettings[nk] = nv
						}
					})
				)
			}
			debugLog(
				Object.entries(maxQualitySettings)
					.map(([k, v]) => k + " | " + v)
					.join(", ")
			)
		}
	}

	// --- 9. IGNORE NUMBER KEYS (Prevent accidental seeking) ---
	function setupIgnoreNumberKeys() {
		window.addEventListener(
			"keydown",
			(e) => {
				if (isWatchPage() && /^\d$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
					const activeElement = document.activeElement
					const isInput =
						activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.isContentEditable || activeElement.getAttribute("role") === "textbox")

					if (!isInput) {
						e.stopPropagation()
						e.stopImmediatePropagation()
						e.preventDefault()
					}
				}
			},
			true
		)
	}

	// --- MASTER MUTATION HANDLER ---

	/**
	 * The single callback function for the MutationObserver.
	 * It runs all necessary DOM-based checks.
	 */
	function masterMutationHandler() {
		// 1. Thumbnail Toggle (Check for button and hide new thumbnails)
		checkThumbnailButton()
		if (thumbnailsHidden) {
			toggleAllThumbnails(true)
		}

		// 2. Remove Members-Only Videos
		deleteMembersOnlyVideos()

		// 3. Hide Shorts
		runShortsRemovers()

		// 3b. Hide Low View Videos
		hideLowViewVideos()

		// 4. Refresh on Error (Watch Page)
		checkAndRefresh()

		// 5. Search Exclusion (Search Page)
		if (isSearchPage()) {
			// Re-apply filter to newly loaded results
			const input = getSearchInput()
			if (input) {
				const currentExclusions = parseExclusions(input.value)
				applySearchFilter(currentExclusions)
			}
		}
	}

	// --- INITIALIZATION ---

	function initPageFeatures() {
		// Stop any previous intervals/listeners that are page-specific
		if (_transcriptInterval) {
			clearInterval(_transcriptInterval)
			_transcriptInterval = null
		}
		if (resultsObserver) {
			resultsObserver.disconnect()
			resultsObserver = null
		}
		hideTooltip() // Hide any lingering tooltip

		// Run initial checks for all features
		masterMutationHandler()

		// Setup URL-specific features
		if (isSearchPage()) {
			initSearchExclusion()
		}

		if (isWatchPage()) {
			// Start Max Quality script (event-based logic)
			initMaxQuality()

			// Start Transcript Button polling (needs polling to wait for button to appear)
			if (!_transcriptInterval) {
				_transcriptInterval = setInterval(setupTranscriptButton, 500)
			}
		}
	}

	// 1. Initial setup for features that need to run immediately
	toggleAllThumbnails(thumbnailsHidden) // Initial thumbnail state

	// 2. Start the single MutationObserver
	const masterObserver = new MutationObserver(masterMutationHandler)
	masterObserver.observe(document.documentElement, { childList: true, subtree: true })

	// 3. Handle SPA navigation (yt-navigate-finish is the best event for this)
	window.addEventListener("yt-navigate-finish", initPageFeatures, true)

	// 4. Setup keyboard overrides
	setupIgnoreNumberKeys()

	// 5. Apply Max Quality settings and run initial page features
	applyMaxQualitySettings().then(() => {
		initPageFeatures()
	})
})()
