// ==UserScript==
// @name         YouTube Master Script (Consolidated)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Consolidated script for all YouTube userscript features with a single MutationObserver for efficiency.
// @author       Gemini CLI Agent
// @match        https://www.youtube.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-start
// ==/UserScript==

;(function () {
	"use strict"

	console.log("new version loaded")

	// --- 0. CUSTOM APP STYLE (Background & Variables) ---
	// NOTE: We strictly use inline style application via JS. 
	// YouTube uses Trusted Types CSP which blocks setting style.textContent in userscripts.
	// Using pure el.style.setProperty bypasses CSP entirely and beats Polymer's DOM updates.
	function enforceDarkThemeBg() {
		try {
			const isDarkActive = isDarkMode();

			const vars =[
				'--yt-spec-base-background', 
				'--yt-spec-brand-background-solid', 
				'--yt-spec-brand-background-primary',
				'--yt-spec-general-background-a',
				'--yt-spec-general-background-b',
				'--yt-spec-general-background-c',
				'--yt-spec-raised-background',
				'--yt-spec-menu-background'
			];
			
			const applyVars = (el) => {
				if (!el) return;
				
				if (isDarkActive) {
					// Avoid DOM thrashing: Check if it's already #131313 before writing
					if (el.style.getPropertyValue('--yt-spec-base-background').trim() === '#131313') return;
					
					for (const v of vars) {
						el.style.setProperty(v, '#131313', 'important');
					}
					el.style.setProperty('background-color', '#131313', 'important');
					el.style.setProperty('background', '#131313', 'important');
				} else {
					// If NOT dark mode, ensure we remove our overrides if they exist
					if (el.style.getPropertyValue('--yt-spec-base-background').trim() !== '#131313') return;
					
					for (const v of vars) {
						el.style.removeProperty(v);
					}
					el.style.removeProperty('background-color');
					el.style.removeProperty('background');
				}
			};

			// Apply to the core structural elements
			applyVars(document.documentElement);
			if (document.body) applyVars(document.body);
			
			const app = document.querySelector('ytd-app');
			if (app) applyVars(app);
			
			const pageManager = document.querySelector('ytd-page-manager');
			if (pageManager) applyVars(pageManager);

			// Kill Ambient Mode (cinematics) which draws a glowing gradient over our background
			const ambients = document.querySelectorAll('#cinematics, ytd-watch-flexy[cinematic], #blur-container');
			ambients.forEach(el => {
				if (isDarkActive) {
					if (el.style.getPropertyValue('display') !== 'none') {
						el.style.setProperty('display', 'none', 'important');
					}
				} else {
					// Only remove if we're the ones who hid it
					if (el.style.getPropertyValue('display') === 'none') {
						el.style.removeProperty('display');
					}
				}
			});

			// Related Videos Hover & Spacing
			if (isWatchPage()) {
				const relatedContainer = document.querySelector('ytd-item-section-renderer.style-scope.ytd-watch-next-secondary-results-renderer');
				if (relatedContainer) {
					if (relatedContainer.style.opacity !== '0' && !relatedContainer.matches(':hover')) {
						relatedContainer.style.setProperty('opacity', '0', 'important');
						relatedContainer.style.setProperty('transition', 'opacity 0.3s ease', 'important');
					}
					relatedContainer.onmouseenter = () => relatedContainer.style.setProperty('opacity', '1', 'important');
					relatedContainer.onmouseleave = () => relatedContainer.style.setProperty('opacity', '0', 'important');
				}

				const relatedItems = document.querySelectorAll('yt-lockup-view-model.ytd-item-section-renderer.lockup');
				relatedItems.forEach(item => {
					if (item.style.getPropertyValue('margin-bottom') !== '20rem') {
						item.style.setProperty('margin-bottom', '20rem', 'important');
					}
				});
			}
		} catch (e) {
			// Catch silently so if YouTube changes a selector, the master script doesn't die
		}
	}

	// Run rapidly during initial page load to prevent a bright flash, independent of the observer
	let _bgTicks = 0;
	const _bgFastTimer = setInterval(() => {
		enforceDarkThemeBg();
		_bgTicks++;
		if (_bgTicks > 50) clearInterval(_bgFastTimer); // Stop rapid checks after ~5 seconds
	}, 100);

	// --- UTILITIES ---
	const isWatchPage = () => window.location.pathname === "/watch"
	const isSearchPage = () => window.location.pathname === "/results"
	const isChannelPage = () => window.location.pathname.startsWith("/@") || window.location.pathname.startsWith("/channel/")

	function showToast(message, duration = 3000) {
		const toast = document.createElement("div")
		toast.textContent = message
		Object.assign(toast.style, {
			position: "fixed",
			bottom: "100px",
			left: "50%",
			transform: "translateX(-50%)",
			backgroundColor: "rgba(28, 28, 28, 0.95)",
			color: "white",
			padding: "12px 24px",
			borderRadius: "8px",
			zIndex: "100000",
			fontFamily: "Roboto, Arial, sans-serif",
			fontSize: "14px",
			boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
			transition: "opacity 0.3s, transform 0.3s",
			opacity: "0",
			pointerEvents: "none",
		})
		document.body.appendChild(toast)
		setTimeout(() => {
			toast.style.opacity = "1"
			toast.style.transform = "translateX(-50%) translateY(-10px)"
		}, 10)
		setTimeout(() => {
			toast.style.opacity = "0"
			toast.style.transform = "translateX(-50%) translateY(0)"
			setTimeout(() => toast.remove(), 300)
		}, duration)
	}

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
		// Detect dark mode via YouTube's internal signaling (preferred) or OS preference (fallback)
		return document.documentElement.hasAttribute("dark") || 
		       (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches && !document.querySelector('ytd-app'));
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
		const shortsSpans = Array.from(document.querySelectorAll("span")).filter((span) => span.textContent.trim() === "Shorts")
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

	// --- 4b. REMOVE FULLSCREEN "MORE VIDEOS" GRID (inside ytd-player) ---
	function removeFullscreenGridOverlay() {
		const player = document.querySelector("ytd-player")
		if (!player) return
		player.querySelectorAll(".ytp-fullscreen-grid").forEach((el) => el.remove())
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

	async function getCompleteTranscript() {
		// Ensure transcript panel is active
		let showTranscriptBtn = document.querySelector('button[aria-label="Show transcript"]')
		if (showTranscriptBtn) showTranscriptBtn.click()
		
		await new Promise(r => setTimeout(r, 1000))
		
		const container = document.querySelector("#segments-container")
		if (!container) return null
		
		const nodes = container.querySelectorAll("ytd-transcript-segment-renderer, transcript-segment-view-model, ytw-transcript-segment-view-model")
		const segments = []
		
		nodes.forEach(n => {
			const timeEl = n.querySelector(".timestamp, .ytw-transcript-segment-view-model-timestamp")
			const textEl = n.querySelector(".segment-text, .ytw-transcript-segment-view-model-body")
			if (timeEl && textEl) {
				const time = timeEl.innerText.trim()
				const text = textEl.innerText.trim()
				const p = time.split(":").map(Number)
				const sec = p.length === 3 ? p[0]*3600 + p[1]*60 + p[2] : (p.length === 2 ? p[0]*60 + p[1] : p[0])
				segments.push({ sec, text })
			}
		})
		
		return segments.sort((a,b) => a.sec - b.sec).map(s => `[${s.sec}s] ${s.text}`).join("\n")
	}

	function startClipboardWatcher(originalPrompt) {
		const banner = document.createElement("div")
		banner.id = "yt-clipboard-waiting-banner"
		Object.assign(banner.style, {
			background: "rgba(28,28,28,0.95)",
			color: "#fff",
			border: "1px solid #ffd700",
			padding: "10px 20px",
			borderRadius: "20px",
			zIndex: "100000",
			position: "fixed",
			top: "20px",
			left: "50%",
			transform: "translateX(-50%)",
			boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
			fontSize: "14px",
			textAlign: "center"
		})
		banner.textContent = "📋 Prompt + transcript copied! Paste into your LLM. Waiting for JSON on clipboard..."
		document.body.appendChild(banner)

		const timer = setInterval(checkCb, 800)
		const focusHandler = () => checkCb()
		window.addEventListener('focus', focusHandler)

		async function checkCb() {
			try {
				const text = await navigator.clipboard.readText()
				if (text !== originalPrompt) {
					const parsed = JSON.parse(text)
					if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].start !== undefined) {
						clearInterval(timer)
						window.removeEventListener('focus', focusHandler)
						Object.assign(banner.style, {
							cursor: "pointer",
							background: "#ffd700",
							color: "#000",
							fontWeight: "700"
						})
						banner.textContent = `✨ JSON ready on clipboard! [▶ Activate Highlight Reel (${parsed.length} segments)]`
						banner.onclick = () => {
							if (typeof window.loadHighlightReel === 'function') window.loadHighlightReel(parsed)
							banner.remove()
						}
					}
				}
			} catch(e) {}
		}

		setTimeout(() => { clearInterval(timer); window.removeEventListener('focus', focusHandler); banner.remove() }, 120000)
	}

	async function setupTranscriptButton() {
		if (!isWatchPage()) return

		const shareBtnContainer = document.querySelector("#above-the-fold #top-level-buttons-computed, #top-level-buttons-computed, #actions-inner #top-level-buttons-computed")
		if (!shareBtnContainer) {
			console.log("[Transcript] Share button container not found yet.")
			return
		}

		const shareBtn = shareBtnContainer.querySelector('button[aria-label="Share"]')

		if (!shareBtn) {
			console.log("[Transcript] Share button not found yet.")
			return
		}

		if (shareBtn.hasAttribute("data-transcript-button-processed")) {
			return
		}

		console.log("[Transcript] Found Share button, applying 'Get transcript' override.")
		shareBtn.setAttribute("data-transcript-button-processed", "true")

		// Change button text
		const textDiv = shareBtn.querySelector(".yt-spec-button-shape-next__button-text-content")
		if (textDiv) {
			textDiv.innerText = "Get transcript"
		} else {
			shareBtn.innerText = "Get transcript"
		}

		let reelBtn = document.getElementById("yt-highlight-reel-btn")
		if (!reelBtn) {
			reelBtn = document.createElement("button")
			reelBtn.id = "yt-highlight-reel-btn"
			reelBtn.title = "Click to toggle or generate reel. Right-click to copy shareable Highlight URL."
			Object.assign(reelBtn.style, {
				height: "36px",
				padding: "0 16px",
				borderRadius: "18px",
				marginLeft: "8px",
				border: "none",
				background: _isReelActive ? "rgba(255, 215, 0, 0.2)" : "rgba(255, 255, 255, 0.1)",
				color: "#fff",
				cursor: "pointer",
				fontSize: "14px",
				fontWeight: "500",
				fontFamily: "Roboto, Arial, sans-serif",
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center"
			})

			reelBtn.oncontextmenu = async (e) => {
				e.preventDefault()
				e.stopPropagation()
				if (typeof window.copyHighlightReelUrl === "function") {
					await window.copyHighlightReelUrl()
				}
			}

			reelBtn.onclick = async () => {
				if (_highlightSegments.length === 0) {
					showToast("⏳ Extracting transcript & building prompt...")
					const transcriptText = await getCompleteTranscript()
					if (!transcriptText) {
						showToast("Could not extract transcript")
						return
					}
					const fullPrompt = `You are a Video Editor creating a tight, high-signal "Highlight Reel / Supercut" of a YouTube video using its transcript.

### Goal:
Select the most essential soundbites and insights that summarize the video's core arguments, demonstrations, and conclusions.

### Constraints:
1. Target Cumulative Duration: ~3 to 5 minutes (or ~10-15% of total runtime).
2. Continuous Soundbites: Each segment must start at the beginning of a complete sentence and end after the thought is fully expressed (do not cut mid-sentence).
3. Cut Fluff: Completely omit sponsor reads, channel intros/outros, repetitive filler, and low-information chit-chat.
4. Output Format: Return ONLY a raw JSON array of objects (no markdown code fences, no extra commentary).

### JSON Schema:
[
  {
    "start": 42,
    "end": 85,
    "title": "The Core Problem Explained",
    "tier": 1
  }
]

* Note: "start" and "end" MUST be integer seconds from the start of the video.

### Transcript to Analyze:
` + transcriptText
					await navigator.clipboard.writeText(fullPrompt)
					startClipboardWatcher(fullPrompt)
				} else {
					if (typeof window.toggleHighlightReel === 'function') {
						window.toggleHighlightReel()
					}
				}
			}
			shareBtn.parentNode.insertBefore(reelBtn, shareBtn.nextSibling)
		}
		reelBtn.textContent = _isReelActive && _highlightSegments.length > 0 ? `⚡ Reel: ON (${_currentSegmentIndex + 1}/${_highlightSegments.length})` : "⚡ Highlight reel"

		shareBtn.onclick = async function (e) {
			e.preventDefault()
			e.stopPropagation()

			console.log("[Transcript] 'Get transcript' clicked. Starting search...")

			// 1. Trigger functionality to show transcript
			let showTranscriptBtn = document.querySelector('button[aria-label="Show transcript"]')
			if (!showTranscriptBtn) {
				console.log("[Transcript] 'Show transcript' button not found in main view. Checking description...")
				const description = document.querySelector("#description")
				if (description) {
					showTranscriptBtn = description.querySelector('button[aria-label="Show transcript"]')
				}
			}

			if (showTranscriptBtn) {
				console.log("[Transcript] Clicking 'Show transcript' button...")
				showTranscriptBtn.click()
			} else {
				console.log("[Transcript] 'Show transcript' button not visible. Attempting to expand description...")
				const expandSelectors = ["#description #expand", "ytd-text-inline-expander #expand", "#description-inline-expander #expand", "tp-yt-paper-button#expand"]
				let expandBtn = null
				for (const sel of expandSelectors) {
					expandBtn = document.querySelector(sel)
					if (expandBtn) break
				}

				if (expandBtn) {
					expandBtn.click()
					await new Promise((res) => setTimeout(res, 300))
					showTranscriptBtn = document.querySelector('button[aria-label="Show transcript"]')
					if (showTranscriptBtn) {
						console.log("[Transcript] Found 'Show transcript' button after expand. Clicking...")
						showTranscriptBtn.click()
					} else {
						console.warn("[Transcript] Still could not find 'Show transcript' button after expand.")
					}
				} else {
					console.warn("[Transcript] Expand description button not found.")
				}
			}

			// 2. Wait for container with Shadow DOM piercing
			console.log("[Transcript] Waiting for transcript container to appear...")
			let maxTries = 100,
				tries = 0
			let transcriptContainer = null

			// Helper: Find element piercing shadow roots
			function querySelectorDeep(selector, root = document) {
				let element = root.querySelector(selector)
				if (element) return element
				const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false)
				while (walker.nextNode()) {
					const node = walker.currentNode
					if (node.shadowRoot) {
						element = querySelectorDeep(selector, node.shadowRoot)
						if (element) return element
					}
				}
				return null
			}

			while (!transcriptContainer && tries < maxTries) {
				await new Promise((res) => setTimeout(res, 50))

				// A. Check for any expanded panel first (Modern YouTube often uses a unified panel)
				const activePanel = document.querySelector('ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]')
				if (activePanel) {
					// Check if it's a tabbed panel and we need to switch to Transcript tab
					const transcriptTab = activePanel.querySelector('button[role="tab"][aria-label="Transcript"]')
					if (transcriptTab && transcriptTab.getAttribute("aria-selected") !== "true") {
						console.log("[Transcript] Found Transcript tab (not selected). Clicking...")
						transcriptTab.click()
						await new Promise((res) => setTimeout(res, 300))
					}

					transcriptContainer =
						activePanel.querySelector(".ytSectionListRendererContents") ||
						activePanel.querySelector("#contents") ||
						activePanel.querySelector("#segments-container") ||
						activePanel.querySelector("ytd-transcript-segment-list-renderer") ||
						activePanel.querySelector("ytd-macro-markers-list-renderer") ||
						activePanel.querySelector("ytd-transcript-renderer") ||
						activePanel.querySelector("#content") ||
						activePanel
				}

				// B. Try standard selectors globally
				if (!transcriptContainer) {
					transcriptContainer = document.querySelector("#segments-container") || document.querySelector("ytd-transcript-segment-list-renderer") || document.querySelector("ytd-transcript-renderer")
				}

				// C. Try looking specifically inside known panels by ID (even if hidden/old)
				if (!transcriptContainer) {
					const panels = document.querySelectorAll(
						'ytd-engagement-panel-section-list-renderer[target-id="PAmodern_transcript_view"], ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
					)
					for (const panel of panels) {
						transcriptContainer = panel.querySelector("#segments-container") || panel.querySelector("ytd-transcript-segment-list-renderer") || panel.querySelector("ytd-macro-markers-list-renderer")
						if (transcriptContainer) break
					}
				}

				// D. Try deep search if still not found
				if (!transcriptContainer) {
					transcriptContainer = querySelectorDeep("#segments-container") || querySelectorDeep("ytd-transcript-segment-list-renderer")
				}

				tries++
			}

			if (!transcriptContainer) {
				console.error("[Transcript] FAILED: Transcript container could not be found after 5 seconds.")
				const allPanels = document.querySelectorAll("ytd-engagement-panel-section-list-renderer")
				allPanels.forEach((p, i) => {
					console.log(`[Transcript Debug] Panel ${i} target-id:`, p.getAttribute("target-id"))
					console.log(`[Transcript Debug] Panel ${i} visibility:`, p.getAttribute("visibility"))
					console.log(`[Transcript Debug] Panel ${i} title:`, p.querySelector("#title-text")?.innerText)
				})

				showToast("Transcript container not found! Check console for details.")
				return
			}

			console.log("[Transcript] Container found. Waiting for content to populate...")

			// 2. Wait for content to load (Replacing hardcoded delays with MutationObserver)
			await new Promise((resolve) => {
				const checkReady = () => {
					const hasSegments = transcriptContainer.querySelector("ytd-transcript-segment-renderer, transcript-segment-view-model, ytw-transcript-segment-view-model, .ytw-transcript-segment-view-model, macro-markers-panel-item-view-model, .ytwMacroMarkersPanelItemViewModelHost")
					const isLoading = transcriptContainer.querySelector("tp-yt-paper-spinner, #spinner, ytd-continuation-item-renderer, #loading-message")
					return hasSegments && !isLoading
				}

				if (checkReady()) {
					resolve()
					return
				}

				const observer = new MutationObserver(() => {
					if (checkReady()) {
						observer.disconnect()
						resolve()
					}
				})
				observer.observe(transcriptContainer, { childList: true, subtree: true })
				setTimeout(() => {
					observer.disconnect()
					resolve()
				}, 7000) // 7s absolute max wait
			})

			// 3. Extract Text (Try Fast Data Extraction first, then fallback to innerText, then Ultra-Fast Sweep)
			console.time("[Transcript] Extraction Time")
			let finalTranscript = ""

			// Helper: Format MS to YT Time
			const formatMs = (ms) => {
				if (!ms && ms !== 0) return ""
				const totalSeconds = Math.floor(ms / 1000)
				const h = Math.floor(totalSeconds / 3600)
				const m = Math.floor((totalSeconds % 3600) / 60)
				const s = totalSeconds % 60
				if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
				return `${m}:${s.toString().padStart(2, "0")}`
			}

			// Helper: Parse YT Time to Seconds
			const tsToSec = (ts) => {
				if (!ts) return 0
				const p = ts.split(":").map(Number)
				if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
				if (p.length === 2) return p[0] * 60 + p[1]
				return p[0] || 0
			}

			// A. Attempt Instant Extraction from YT Internals
			const getInstantData = () => {
				try {
					// 1. Check for data attached to the DOM element
					const renderer = transcriptContainer.closest("ytd-transcript-renderer") || transcriptContainer.querySelector("ytd-transcript-renderer") || transcriptContainer
					const domData = renderer.data || renderer.__data || renderer.segmentsViewModel

					// 2. Check global app response (most authoritative)
					const app = document.querySelector("ytd-app")
					const panels = app?.data?.response?.engagementPanels || []
					let rawRenderer = null
					for (const p of panels) {
						const r = p.engagementPanelSectionListRenderer
						if (r?.targetId === "engagement-panel-searchable-transcript" || r?.targetId === "PAmodern_transcript_view") {
							rawRenderer = r.content?.transcriptRenderer
							break
						}
					}

					const data = domData || rawRenderer
					if (!data) return null

					let segments = null
					if (data.body?.transcriptBodyRenderer?.cueGroups) {
						segments = data.body.transcriptBodyRenderer.cueGroups.map((g) => {
							const cue = g.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer
							const time = cue.startOffsetMs !== undefined ? formatMs(cue.startOffsetMs) : cue.label?.simpleText
							const text = cue.cue.simpleText || cue.cue.runs?.map((r) => r.text).join("") || ""
							return { time, text: text.trim(), sec: tsToSec(time) }
						})
					} else if (data.segments && Array.isArray(data.segments)) {
						segments = data.segments
							.map((s) => {
								const vm = s.transcriptSegmentViewModel
								if (vm) {
									const time = vm.timestampText?.simpleText || vm.timestampText?.runs?.map((r) => r.text).join("")
									const text = vm.bodyText?.simpleText || vm.bodyText?.runs?.map((r) => r.text).join("")
									return { time, text: text?.trim(), sec: tsToSec(time) }
								}
								return null
							})
							.filter(Boolean)
					}

					if (segments && segments.length > 0) {
						return segments
							.sort((a, b) => a.sec - b.sec)
							.map((s) => `[${s.time}] ${s.text}`)
							.join("\n")
					}
				} catch (e) {}
				return null
			}

			finalTranscript = getInstantData()

			if (finalTranscript) {
				console.log("[Transcript] Success! Extracted instantly from internal data.")
			} else {
				// B. Fallback: Instant innerText parsing (User suggestion)
				console.log("[Transcript] Attempting instant DOM text extraction...")
				const segments = []
				const timecodeRegex = /^(\d{1,2}:)?\d{1,2}:\d{2}$/
				const metadataRegex = /^(\d+ (hour|minute|second)s?,? ?)+$/i
				const allTextLines = transcriptContainer.innerText
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)

				let lastTime = null
				let currentText = []
				let segmentCounter = 0

				for (const line of allTextLines) {
					if (timecodeRegex.test(line)) {
						if (lastTime && currentText.length > 0) {
							segments.push({ time: lastTime, text: currentText.join(" "), sec: tsToSec(lastTime), order: segmentCounter++ })
						}
						lastTime = line
						currentText = []
					} else if (line.startsWith("Chapter ")) {
						if (lastTime && currentText.length > 0) {
							segments.push({ time: lastTime, text: currentText.join(" "), sec: tsToSec(lastTime), order: segmentCounter++ })
						}
						// Add chapter marker - slightly before current time to keep sequence
						segments.push({ time: null, text: "\n" + line, sec: (lastTime ? tsToSec(lastTime) : 0) - 0.001, order: segmentCounter++ })
						lastTime = null
						currentText = []
					} else {
						// Filter out common non-dialogue metadata like "7 seconds"
						if (!metadataRegex.test(line)) {
							currentText.push(line)
						}
					}
				}
				// Push final
				if (lastTime && currentText.length > 0) {
					segments.push({ time: lastTime, text: currentText.join(" "), sec: tsToSec(lastTime), order: segmentCounter++ })
				}

				if (segments.length > 5) {
					finalTranscript = segments
						.sort((a, b) => (a.sec !== b.sec ? a.sec - b.sec : a.order - b.order))
						.map((s) => (s.time ? `[${s.time}] ${s.text}` : s.text))
						.join("\n")
					console.log("[Transcript] Success! Extracted via innerText. Segments:", segments.length)
				}
			}

			// C. Fallback: Ultra-Fast sweep (If others fail or seem incomplete)
			if (!finalTranscript) {
				console.log("[Transcript] Falling back to Rapid Sweep extraction...")
				const scrollable = transcriptContainer.querySelector("#segments-container") || transcriptContainer.closest("ytd-transcript-segment-list-renderer") || transcriptContainer

				scrollable.scrollTop = 0
				await new Promise((res) => setTimeout(res, 50))

				let allSegments = new Map()
				let lastSize = -1
				let sameSizeCount = 0
				const maxSteps = 200
				const sweepDelay = 25
				const jumpMultiplier = 4.0

				for (let i = 0; i < maxSteps; i++) {
					const nodes = transcriptContainer.querySelectorAll("ytd-transcript-segment-renderer, transcript-segment-view-model, ytw-transcript-segment-view-model, .ytw-transcript-segment-view-model")

					nodes.forEach((n) => {
						const d = n.data || n.segmentsViewModel
						let time = "",
							text = ""
						if (d && d.timestampText && d.bodyText) {
							time = d.timestampText.simpleText || d.timestampText.runs?.map((r) => r.text).join("")
							text = d.bodyText.simpleText || d.bodyText.runs?.map((r) => r.text).join("")
						} else {
							time = (n.querySelector("#segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp, .timestamp")?.innerText || "").trim()
							text = (n.querySelector(".segment-text, #segment-text, .segment-text-content, [role='text']")?.innerText || "").trim()
						}
						if (time && !allSegments.has(time)) {
							allSegments.set(time, { text, sec: tsToSec(time) })
						}
					})

					if (allSegments.size === lastSize) {
						sameSizeCount++
						if (sameSizeCount > 12 || scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 10) break
					} else {
						lastSize = allSegments.size
						sameSizeCount = 0
					}

					scrollable.scrollTop += scrollable.clientHeight * jumpMultiplier
					await new Promise((res) => setTimeout(res, sweepDelay))
				}

				if (allSegments.size > 0) {
					const sorted = Array.from(allSegments.entries()).sort((a, b) => a[1].sec - b[1].sec)
					finalTranscript = sorted.map(([time, data]) => `[${time}] ${data.text}`).join("\n")
				} else {
					console.warn("[Transcript] Sweep failed. Using whatever text is visible.")
					finalTranscript = transcriptContainer.innerText
				}
			}

			finalTranscript = finalTranscript.replace(/\n{3,}/g, "\n\n")
			console.timeEnd("[Transcript] Extraction Time")

			try {
				await navigator.clipboard.writeText(finalTranscript)
				console.log("[Transcript] Success! Transcript copied to clipboard.")
				showToast("Transcript copied to clipboard!")
			} catch (err) {
				console.error("[Transcript] Clipboard write failed:", err)
				showToast("Failed to copy transcript: " + err)
			}
		}
	}


	// --- 8. DYNAMIC HIGHLIGHT REEL ENGINE (Watch Page) ---
	let _highlightSegments = []
	let _isReelActive = false
	let _currentSegmentIndex = -1
	let _videoEl = null
	let _reelTimeUpdateHandler = null
	let _lastSkipFromTime = 0
	let _lastSkipLeadInTime = 0
	let _undoSkipPending = false
	let _skipCooldownUntil = 0
	let _toastTimeout = null
	let _lastVideoId = ""
	let _lastLoadedUrlParam = ""

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

		if (item.includes("=")) {
			const eqIdx = item.indexOf("=")
			rangePart = item.slice(0, eqIdx).trim()
			title = item.slice(eqIdx + 1).trim().replace(/\+/g, " ")
		}

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

		if (str.startsWith("b64:") || /^[A-Za-z0-9+/=]{16,}$/.test(str)) {
			const b64 = str.startsWith("b64:") ? str.slice(4) : str
			try {
				const decoded = atob(b64)
				const parsed = JSON.parse(decoded)
				if (Array.isArray(parsed)) return normalizeHighlightSegments(parsed)
			} catch (e) {}
		}

		if ((str.startsWith("[") && str.endsWith("]")) || (str.startsWith("{") && str.endsWith("}"))) {
			try {
				const parsed = JSON.parse(str)
				const arr = Array.isArray(parsed) ? parsed : [parsed]
				return normalizeHighlightSegments(arr)
			} catch (e) {}
		}

		const items = str.split(/[,;\n|]+/).map((s) => s.trim()).filter(Boolean)
		return items.map((item, idx) => parseSingleHighlightItem(item, idx)).sort((a, b) => a.start - b.start)
	}

	function getHighlightsFromUrl(urlStr = window.location.href) {
		try {
			const u = new URL(urlStr, window.location.origin)
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

	function getCurrentVideoId() {
		try {
			const u = new URL(window.location.href)
			return u.searchParams.get("v") || ""
		} catch (e) {
			return ""
		}
	}

	window.generateHighlightUrl = (segments = _highlightSegments) => {
		if (!segments || segments.length === 0) return window.location.href
		const u = new URL(window.location.href)
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

	window.copyHighlightReelUrl = async () => {
		if (_highlightSegments.length === 0) {
			showToast("⚠️ No active highlight reel to copy URL for.")
			return
		}
		const url = window.generateHighlightUrl()
		try {
			await navigator.clipboard.writeText(url)
			showToast("📋 Copied Highlight Reel URL with params!")
		} catch (e) {
			showToast("Failed to copy URL: " + e)
		}
	}

	function initHighlightReelVideoListener() {
		_videoEl = document.querySelector("video")
		if (!_videoEl) return

		if (_reelTimeUpdateHandler) _videoEl.removeEventListener("timeupdate", _reelTimeUpdateHandler)

		_reelTimeUpdateHandler = () => {
			if (!_isReelActive || _highlightSegments.length === 0) return
			const cur = _videoEl.currentTime
			if (cur < _skipCooldownUntil) return

			// 1. Check if current playback time is inside ANY highlight segment
			const currentSegIdx = _highlightSegments.findIndex((s) => cur >= s.start && cur < s.end)
			if (currentSegIdx !== -1) {
				if (_currentSegmentIndex !== currentSegIdx) {
					_currentSegmentIndex = currentSegIdx
				}
				updateScrubberBadge()
				return
			}

			// 2. If current playback time is before the first segment, or in a dead zone between segments:
			const nextIdx = _highlightSegments.findIndex((s) => s.start > cur)
			if (nextIdx !== -1) {
				const nextSegment = _highlightSegments[nextIdx]
				_lastSkipFromTime = cur
				_lastSkipLeadInTime = Math.max(0, cur - 4)
				_skipCooldownUntil = nextSegment.start + 0.6
				_videoEl.currentTime = nextSegment.start
				showSkipToast(nextSegment)
				_currentSegmentIndex = nextIdx
				updateScrubberBadge()
			} else {
				_isReelActive = false
				showToast("🎉 Highlight reel complete!")
				updateScrubberBadge()
				updateReelButton()
			}
		}
		_videoEl.addEventListener("timeupdate", _reelTimeUpdateHandler)

		// Re-render heatmap if metadata loads after listener initialization
		_videoEl.addEventListener("loadedmetadata", () => {
			if (_isReelActive && _highlightSegments.length > 0) renderHighlightHeatmap()
		}, { once: true })
		_videoEl.addEventListener("durationchange", () => {
			if (_isReelActive && _highlightSegments.length > 0) renderHighlightHeatmap()
		})
	}

	function showSkipToast(nextSegment) {
		const oldToast = document.getElementById("yt-highlight-skip-toast")
		if (oldToast) oldToast.remove()
		clearTimeout(_toastTimeout)

		const toast = document.createElement("div")
		toast.id = "yt-highlight-skip-toast"
		Object.assign(toast.style, {
			position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
			backgroundColor: "rgba(28,28,28,0.95)", color: "#fff", padding: "12px 20px",
			borderRadius: "8px", zIndex: "100000", cursor: "pointer", border: "1px solid #ffd700",
			boxShadow: "0 8px 24px rgba(0,0,0,0.6)", fontSize: "14px", textAlign: "center"
		})
		toast.textContent = `⏩ Skipped to "${nextSegment.title || 'Next Segment'}". Press [Enter] or click to undo & pause reel (5s)...`

		const bar = document.createElement("div")
		Object.assign(bar.style, { height: "2px", background: "#ffd700", width: "100%", transition: "width 5s linear", marginTop: "8px" })
		toast.appendChild(bar)
		document.body.appendChild(toast)

		setTimeout(() => { if (bar) bar.style.width = "0%" }, 10)

		let isCleanedUp = false
		const cleanup = () => {
			if (isCleanedUp) return
			isCleanedUp = true
			clearTimeout(_toastTimeout)
			window.removeEventListener("keydown", keyHandler)
			toast.remove()
		}

		_toastTimeout = setTimeout(cleanup, 5000)

		const undo = (e) => {
			if (e) {
				e.preventDefault()
				e.stopPropagation()
			}
			cleanup()
			_isReelActive = false
			if (_videoEl) {
				_videoEl.currentTime = _lastSkipLeadInTime
				_skipCooldownUntil = _lastSkipLeadInTime + 4
				_videoEl.play().catch(() => {})
			}
			updateReelButton()
			updateScrubberBadge()
			showToast("⏪ Rewound with context. Reel auto-skip paused (Press [H] to resume).")
		}

		toast.onclick = undo
		const keyHandler = (e) => {
			if (e.key === "Enter") {
				undo(e)
			}
		}
		window.addEventListener("keydown", keyHandler)
	}

	window.loadHighlightReel = (data, autoPlay = true) => {
		_highlightSegments = normalizeHighlightSegments(data)
		_isReelActive = true
		_currentSegmentIndex = 0
		renderHighlightHeatmap()
		updateReelButton()
		updateScrubberBadge()
		if (autoPlay && _highlightSegments.length > 0 && _videoEl) {
			_videoEl.currentTime = _highlightSegments[0].start
			_videoEl.play().catch(() => {})
		}
	}

	window.clearHighlightReel = () => {
		_highlightSegments = []
		_isReelActive = false
		_currentSegmentIndex = -1
		removeHighlightHeatmap()
		updateReelButton()
		updateScrubberBadge()
	}

	window.toggleHighlightReel = () => {
		_isReelActive = !_isReelActive
		updateReelButton()
		updateScrubberBadge()
		showToast(_isReelActive ? "Highlight Reel Active" : "Highlight Reel Paused")
	}

	window.jumpHighlightRelative = (dir) => {
		if (_highlightSegments.length === 0 || !_videoEl) return
		_isReelActive = true
		_currentSegmentIndex = Math.max(0, Math.min(_highlightSegments.length - 1, _currentSegmentIndex + dir))
		_videoEl.currentTime = _highlightSegments[_currentSegmentIndex].start
		updateReelButton()
		updateScrubberBadge()
	}

	function renderHighlightHeatmap() {
		removeHighlightHeatmap()
		const progressBar = document.querySelector(".ytp-progress-bar")
		if (!progressBar) return
		const container = document.createElement("div")
		container.id = "yt-highlight-heatmap-container"
		Object.assign(container.style, { position: "absolute", top: "0", left: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "10" })
		progressBar.appendChild(container)
		const duration = (_videoEl && _videoEl.duration) ? _videoEl.duration : 1
		_highlightSegments.forEach((s) => {
			const bar = document.createElement("div")
			const left = (s.start / duration) * 100
			const width = ((s.end - s.start) / duration) * 100
			Object.assign(bar.style, { position: "absolute", left: `${left}%`, width: `${width}%`, height: "100%", background: "rgba(255, 215, 0, 0.8)" })
			container.appendChild(bar)
		})
	}

	function removeHighlightHeatmap() {
		const c = document.getElementById("yt-highlight-heatmap-container")
		if (c) c.remove()
	}

	function updateReelButton() {
		const reelBtn = document.getElementById("yt-highlight-reel-btn")
		if (!reelBtn) return
		reelBtn.style.background = _isReelActive ? "rgba(255, 215, 0, 0.2)" : "rgba(255, 255, 255, 0.1)"
		reelBtn.textContent = _isReelActive && _highlightSegments.length > 0 ? `⚡ Reel: ON (${_currentSegmentIndex + 1}/${_highlightSegments.length})` : "⚡ Highlight reel"
	}

	function updateScrubberBadge() {
		let badge = document.getElementById("yt-highlight-scrubber-badge")
		const leftControls = document.querySelector(".ytp-left-controls")
		if (!_isReelActive || _highlightSegments.length === 0) {
			if (badge) badge.remove()
			return
		}
		if (!badge && leftControls) {
			badge = document.createElement("div")
			badge.id = "yt-highlight-scrubber-badge"
			Object.assign(badge.style, {
				background: "rgba(255, 215, 0, 0.18)", border: "1px solid rgba(255, 215, 0, 0.4)", color: "#ffd700",
				borderRadius: "4px", padding: "2px 8px", fontSize: "11px", fontWeight: "600",
				marginLeft: "8px", display: "inline-flex", alignItems: "center"
			})
			leftControls.appendChild(badge)
		}
		if (badge && _highlightSegments[_currentSegmentIndex]) {
			badge.textContent = `⚡ Seg ${_currentSegmentIndex + 1}/${_highlightSegments.length}: ${_highlightSegments[_currentSegmentIndex].title}`
		}
	}

	function initHighlightReel() {
		if (!isWatchPage()) return
		initHighlightReelVideoListener()

		const currentVideoId = getCurrentVideoId()
		const hlParam = getHighlightsFromUrl()

		if (hlParam) {
			const cacheKey = `${currentVideoId}:${hlParam}`
			if (_lastLoadedUrlParam !== cacheKey) {
				_lastLoadedUrlParam = cacheKey
				const parsed = parseHighlightsParam(hlParam)
				if (parsed.length > 0) {
					console.log("[Highlight Reel] Loaded from URL parameters:", parsed)
					const tryLoad = (retries = 10) => {
						_videoEl = document.querySelector("video")
						if (_videoEl) {
							window.loadHighlightReel(parsed, true)
							showToast(`⚡ Highlight reel loaded (${parsed.length} segments)`)
						} else if (retries > 0) {
							setTimeout(() => tryLoad(retries - 1), 300)
						}
					}
					tryLoad()
				}
			}
		} else {
			if (_lastVideoId && _lastVideoId !== currentVideoId && _highlightSegments.length > 0) {
				window.clearHighlightReel()
				_lastLoadedUrlParam = ""
			}
		}
		_lastVideoId = currentVideoId
	}

	// Keyboard hotkeys
	document.addEventListener("keydown", (e) => {
		if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return
		if (e.key.toLowerCase() === "h") window.toggleHighlightReel()
		if (e.key === "[") window.jumpHighlightRelative(-1)
		if (e.key === "]") window.jumpHighlightRelative(1)
	})

	window.addEventListener("popstate", () => { if (isWatchPage()) initHighlightReel() })
	window.addEventListener("hashchange", () => { if (isWatchPage()) initHighlightReel() })

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
				null,
			).singleNodeValue
			if (qualityMenuButton) unwrapElement(qualityMenuButton).click()

			let qualityButton = document.evaluate(
				'.//*[contains(text(),"' + heights[resolutionList.indexOf(res)] + '") and not(@class)]/ancestor::*[@class="ytp-menuitem"]',
				ytPlayer,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null,
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
				true,
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
					}),
				).then((c) =>
					c.forEach(([nk, nv]) => {
						if (maxQualitySettings[nk] !== null && nk !== "overwriteStoredSettings") {
							maxQualitySettings[nk] = nv
						}
					}),
				)
			}
			debugLog(
				Object.entries(maxQualitySettings)
					.map(([k, v]) => k + " | " + v)
					.join(", "),
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
			true,
		)
	}

	// --- MASTER MUTATION HANDLER ---

	/**
	 * The single callback function for the MutationObserver.
	 * It runs all necessary DOM-based checks.
	 */
	function masterMutationHandler() {
		// 0. Enforce Background Colors (Catches ytd-app dynamically via the observer)
		enforceDarkThemeBg();

		// 1. Thumbnail Toggle (Check for button and hide new thumbnails)
		checkThumbnailButton()
		if (thumbnailsHidden) {
			toggleAllThumbnails(true)
		}

		// 2. Remove Members-Only Videos
		deleteMembersOnlyVideos()

		// 3. Hide Shorts
		runShortsRemovers()

		// 3a. Remove fullscreen player "More videos" grid
		removeFullscreenGridOverlay()

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
            
            // Highlight Reel
            initHighlightReel()
		}

	}

	// 1. Initial setup for features that need to run immediately
	toggleAllThumbnails(thumbnailsHidden) // Initial thumbnail state

	// 2. Start the single MutationObserver
	let _masterMutationTimer = null
	const masterObserver = new MutationObserver(() => {
		if (_masterMutationTimer) return
		_masterMutationTimer = setTimeout(() => {
			masterMutationHandler()
			_masterMutationTimer = null
		}, 100)
	})
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
