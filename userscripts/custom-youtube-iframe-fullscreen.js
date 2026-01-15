// ==UserScript==
// @name         Universal YouTube Fullscreen Unblocker
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds a 'True Fullscreen' button to YouTube embeds on ANY website, bypassing iframe restrictions.
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @allFrames    true
// ==/UserScript==

;(function () {
	"use strict"

	const url = window.location.href
	const isYouTube = url.includes("youtube.com/embed/")
	console.log(`(5:16pm)
🛠️ [Unblocker] Loaded in frame: ${url}
(5:16pm)`)

	/**
	 * PART 1: THE COORDINATOR (Runs in all parent frames)
	 */
	if (!isYouTube) {
		const style = document.createElement("style")
		style.textContent = `
            .yt-unblocker-pseudo-fs {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 2147483647 !important;
                background: black !important;
                border: none !important;
            }
            body.yt-unblocker-parent-fs {
                overflow: hidden !important;
            }
        `
		document.head.appendChild(style)

		const unlockAndCoordinate = () => {
			document.querySelectorAll("iframe").forEach((f) => {
				f.setAttribute("allowfullscreen", "true")
				f.setAttribute("webkitallowfullscreen", "true")
				f.setAttribute("mozallowfullscreen", "true")
				f.setAttribute("msallowfullscreen", "true")
				let allow = f.getAttribute("allow") || ""
				if (!allow.includes("fullscreen")) f.setAttribute("allow", (allow ? allow + "; " : "") + "fullscreen")
			})
		}

		function findSenderFrame(root, sourceWindow) {
			const frames = root.querySelectorAll("iframe")
			for (const f of frames) if (f.contentWindow === sourceWindow) return f
			const all = root.querySelectorAll("*")
			for (const el of all) {
				if (el.shadowRoot) {
					const found = findSenderFrame(el.shadowRoot, sourceWindow)
					if (found) return found
				}
			}
			return null
		}

		window.addEventListener("message", async (event) => {
			if (!event.data || event.data.type !== "TOGGLE_FS") return

			console.log(`📥 [Coordinator] FS Request from ${event.origin}`)
			const senderFrame = findSenderFrame(document, event.source)
			const isNative = !!(document.fullscreenElement || document.webkitFullscreenElement)
			const isWinFS = window.innerHeight >= window.screen.height - 10

			console.log(`   - Sender Found: ${!!senderFrame}, NativeFS: ${isNative}, WinFS: ${isWinFS}`)

			if (senderFrame) {
				const isPseudo = senderFrame.classList.contains("yt-unblocker-pseudo-fs")
				const isCurrentlyFullscreen = document.fullscreenElement === senderFrame || document.webkitFullscreenElement === senderFrame

				// 1. If currently in Pseudo-FS, exit it.
				if (isPseudo) {
					console.log("🚀 [Coordinator] EXIT Pseudo-FS")
					senderFrame.classList.remove("yt-unblocker-pseudo-fs")
					document.body.classList.remove("yt-unblocker-parent-fs")
					return
				}

				// 2. If currently in Native FS (and it's the sender), exit it.
				if (isCurrentlyFullscreen) {
					console.log("🚀 [Coordinator] EXIT Native FS")
					const exit = document.exitFullscreen || document.webkitExitFullscreen
					if (exit) {
						try {
							await exit.call(document)
						} catch (e) {
							console.error("❌ [Coordinator] Failed to exit Native FS:", e)
						}
					}
					return
				}

				// 3. Try to Enter Native FS with a verification fallback + Timeout Race
				console.log("🚀 [Coordinator] Attempting Native FS...")
				const req = senderFrame.requestFullscreen || senderFrame.webkitRequestFullscreen
				let nativeFailed = false

				if (req) {
					try {
						console.log(">> [Coordinator] Entering Native FS try block...")

						// Create a timeout promise that rejects after 50ms
						const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("FS_TIMEOUT")), 50))

						// Race the actual request against the timeout
						await Promise.race([req.call(senderFrame), timeoutPromise])

						console.log(">> [Coordinator] Native FS Promise Resolved. Verifying...")

						// Verify success after a short delay
						setTimeout(() => {
							console.log(">> [Coordinator] Verification timeout running.")
							const currentFS = document.fullscreenElement || document.webkitFullscreenElement
							console.log(">> [Coordinator] Verification: CurrentFS is", currentFS, "Expected:", senderFrame)

							if (currentFS !== senderFrame) {
								console.warn("⚠️ [Coordinator] Verification FAILED. Falling back to Pseudo-FS.")
								enablePseudoFS()
							} else {
								console.info("✅ [Coordinator] Native FS Verified Active")
							}
						}, 250)
					} catch (err) {
						if (err.message === "FS_TIMEOUT") {
							console.warn("⚠️ [Coordinator] Native FS Request TIMED OUT (Browser didn't respond). Engaging Pseudo-FS.")
						} else {
							console.error("❌ [Coordinator] Native FS Promise Rejected:", err)
						}
						nativeFailed = true
					}
				} else {
					console.warn("❌ [Coordinator] requestFullscreen API missing on frame")
					nativeFailed = true
				}

				if (nativeFailed) {
					console.log("🚀 [Coordinator] Native FS unavailable/failed/timed-out. Engaging Pseudo-FS.")
					enablePseudoFS()
				}

				function enablePseudoFS() {
					senderFrame.classList.add("yt-unblocker-pseudo-fs")
					document.body.classList.add("yt-unblocker-parent-fs")
					console.log("   - [Coordinator] Pseudo-FS applied to frame.")
				}
			} else {
				console.log("🚀 [Coordinator] Sender not direct child (or not found), bubbling up...")
				if (window !== window.top) window.parent.postMessage({ type: "TOGGLE_FS" }, "*")
			}
		})

		// State tracking for window dimensions (Physical Fullscreen Detection)
		let wasWinFS = window.innerHeight >= window.screen.height - 10

		const checkFullscreenState = () => {
			const isWinFS = window.innerHeight >= window.screen.height - 10
			const isNativeFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)

			// LOGIC: If we WENT from Fullscreen (Physical or Native) to Windowed, force cleanup
			// This handles the case where Parent Iframe was Fullscreen, user pressed Esc, and browser exited.
			if ((wasWinFS && !isWinFS) || !isNativeFS) {
				const pseudo = document.querySelector(".yt-unblocker-pseudo-fs")
				if (pseudo) {
					// Only cleanup if we are definitely NOT in native anymore
					// AND (we just shrank from physical FS OR we know native is gone)
					// We verify isNativeFS is false to avoid killing valid native FS if resize happens oddly
					if (!isNativeFS && !isWinFS) {
						console.log("🔓 [Coordinator] Detected exit from Fullscreen state (WinFS: " + wasWinFS + "->" + isWinFS + "). Cleaning up.")
						pseudo.classList.remove("yt-unblocker-pseudo-fs")
						document.body.classList.remove("yt-unblocker-parent-fs")
					}
				}
			}
			wasWinFS = isWinFS
		}

		// Listeners
		window.addEventListener("resize", checkFullscreenState)
		const fsEvents = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"]
		fsEvents.forEach((evt) => document.addEventListener(evt, checkFullscreenState))

		// Also Keep Escape Key Trap for Windowed Mode (Scenario 1) where browser doesn't swallow it
		window.addEventListener(
			"keydown",
			(e) => {
				if (e.key === "Escape" || e.code === "Escape") {
					const pseudo = document.querySelector(".yt-unblocker-pseudo-fs")
					if (pseudo) {
						console.log("🔓 [Coordinator] Escape key trapped. Exiting Pseudo-FS.")
						// e.preventDefault() // Try to prevent, though browser takes precedence in native FS
						// We don't stop propagation here to allow parent to receive it if needed (e.g. to exit its own FS)
						pseudo.classList.remove("yt-unblocker-pseudo-fs")
						document.body.classList.remove("yt-unblocker-parent-fs")
					}
				}
			},
			true
		)

		// Initial check
		setTimeout(checkFullscreenState, 500)

		unlockAndCoordinate()
		new MutationObserver(unlockAndCoordinate).observe(document.body, { childList: true, subtree: true })
	}

	/**
	 * PART 2: THE HIJACKER (Runs only inside YouTube embeds)
	 */
	if (isYouTube) {
		function hijackNativeButton() {
			const nativeBtn = document.querySelector(".ytp-fullscreen-button")
			if (!nativeBtn) return

			const updateIconColor = (color) => {
				const paths = nativeBtn.querySelectorAll("path")
				paths.forEach((p) => p.style.setProperty("fill", color, "important"))
			}

			nativeBtn.style.setProperty("opacity", "1", "important")
			nativeBtn.style.setProperty("cursor", "pointer", "important")
			updateIconColor("#eeeeee")

			if (nativeBtn.dataset.hijacked) return

			console.log("🎯 Native YouTube FS button found. Hijacking...")
			nativeBtn.addEventListener("mouseenter", () => updateIconColor("#ffffff"))
			nativeBtn.addEventListener("mouseleave", () => updateIconColor("#eeeeee"))
			nativeBtn.addEventListener("focus", () => updateIconColor("#ffffff"))
			nativeBtn.addEventListener("blur", () => updateIconColor("#eeeeee"))

			nativeBtn.addEventListener(
				"click",
				(e) => {
					console.log("🚀 Intercepted native FS click. Toggling Fullscreen...")
					e.stopImmediatePropagation()
					e.preventDefault()
					console.log("📤 [Hijacker] Sending TOGGLE_FS to parent...")
					window.parent.postMessage({ type: "TOGGLE_FS" }, "*")
				},
				true
			)
			nativeBtn.dataset.hijacked = "true"
		}

		// --- CLICK DEBOUNCING ---
		let clickTimer = null
		const CLICK_DELAY = 250
		const reDispatchedEvents = new WeakSet()

		window.addEventListener(
			"click",
			(e) => {
				if (reDispatchedEvents.has(e)) return
				const isControl = e.target.closest(".ytp-chrome-controls") || e.target.closest(".ytp-settings-menu")
				const isInPlayer = e.target.closest(".html5-video-player") || e.target.closest("video")

				if (isInPlayer && !isControl) {
					e.stopImmediatePropagation()
					e.preventDefault()

					if (clickTimer) {
						console.log("🚀 [Hijacker] Double-click confirmed. Toggling Fullscreen...")
						clearTimeout(clickTimer)
						clickTimer = null
						console.log("📤 [Hijacker] Sending TOGGLE_FS to parent via dblclick...")
						window.parent.postMessage({ type: "TOGGLE_FS" }, "*")
					} else {
						clickTimer = setTimeout(() => {
							console.log("🎬 [Hijacker] Single-click confirmed. Re-dispatching...")
							clickTimer = null

							try {
								const newEvent = new MouseEvent("click", {
									bubbles: true,
									cancelable: true,
									view: e.view || window,
									clientX: e.clientX,
									clientY: e.clientY,
								})
								reDispatchedEvents.add(newEvent)
								e.target.dispatchEvent(newEvent)
							} catch (err) {
								console.error("❌ [Hijacker] MouseEvent dispatch failed:", err)
								// Fallback: If MouseEvent fails, at least try a generic Event
								const fallback = new Event("click", { bubbles: true, cancelable: true })
								reDispatchedEvents.add(fallback)
								e.target.dispatchEvent(fallback)
							}
						}, CLICK_DELAY)
					}
				}
			},
			true
		)

		window.addEventListener(
			"dblclick",
			(e) => {
				const isControl = e.target.closest(".ytp-chrome-controls") || e.target.closest(".ytp-settings-menu")
				const isInPlayer = e.target.closest(".html5-video-player") || e.target.closest("video")
				if (isInPlayer && !isControl) {
					e.stopImmediatePropagation()
					e.preventDefault()
				}
			},
			true
		)

		hijackNativeButton()
		new MutationObserver(hijackNativeButton).observe(document.body, { childList: true, subtree: true })

		document.addEventListener(
			"keydown",
			(e) => {
				if ((e.key === "f" || e.key === "F") && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
					e.stopImmediatePropagation()
					e.preventDefault()
					console.log("📤 [Hijacker] Sending TOGGLE_FS to parent via Hotkey...")
					window.parent.postMessage({ type: "TOGGLE_FS" }, "*")
				}
			},
			true
		)
	}
})()
