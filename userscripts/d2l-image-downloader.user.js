// ==UserScript==
// @name        D2L Image Downloader
// @match       https://*.onlinelearningbc.com/d2l/*
// @match       https://*.onlinelearningbc.com/content/*
// @match       https://*.studyforge.net/*
// @match       https://d2l.sd44.bc.ca/*
// @match       *://*.contentconnections.ca/*
// @require     https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require     https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @require     https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @grant       none
// @version     1.5
// @author      Antigravity
// @description Adds a button to download all images as a ZIP or take a high-res snapshot of D2L/StudyForge content.
// ==/UserScript==

;(function () {
	"use strict"
	console.log(`[D2L-DL] Userscript initialized in ${window.location.href} (Top: ${window === window.top})`)

	const IS_TOP = window === window.top

	// 1. Optimized helper function to find the element across Shadow boundaries
	function findInShadow(selector, root = document) {
		const el = root.querySelector(selector)
		if (el) return el

		// Only iterate over elements that could potentially have a shadowRoot
		const walkers = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
			acceptNode: (node) =>
				node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
		})

		let node
		while ((node = walkers.nextNode())) {
			const found = findInShadow(selector, node.shadowRoot)
			if (found) return found
		}
		return null
	}

	// Helper to find all iframes even inside shadow roots
	function findIframes(root = document, list = []) {
		list.push(...Array.from(root.querySelectorAll("iframe")))

		const walkers = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
			acceptNode: (node) =>
				node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
		})

		let node
		while ((node = walkers.nextNode())) {
			findIframes(node.shadowRoot, list)
		}
		return list
	}

	// Helper to find all images even inside shadow roots
	function findImages(root = document, list = []) {
		list.push(...Array.from(root.querySelectorAll("img")))

		const walkers = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
			acceptNode: (node) =>
				node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
		})

		let node
		while ((node = walkers.nextNode())) {
			findImages(node.shadowRoot, list)
		}
		return list
	}

	async function getTargetImages() {
		const candidates = [
			".d2l-html-block-rendered",
			".d2l-fileviewer-render-container",
			".sf-lesson-content", // StudyForge
			".sf-page-content", // StudyForge
			".content-area", // Generic StudyForge/ContentConnections
			"main",
			'[role="main"]',
			".d2l-content-container",
			"#d2l_content",
			".content-panel",
			".content-block",
			".document-container",
			"#app",
		]

		let container = null
		for (const selector of candidates) {
			container = findInShadow(selector)
			if (container) break
		}

		if (!container) container = document.body

		let images = findImages(container)
		return images.filter((img) => {
			if (
				img.closest(
					"nav, header, footer, .d2l-navigation-s, .d2l-header, .navigation-menu, .header-button-tray, .sf-nav",
				)
			)
				return false
			const width = img.naturalWidth || img.width
			const height = img.naturalHeight || img.height
			// Allow small images if they are in a content block but not icons
			if (width > 0 && height > 0 && width < 30 && height < 30) {
				if (img.classList.contains("d2l-icon") || img.src.includes("icon"))
					return false
			}
			if (!img.src || img.src.startsWith("data:")) return false
			const srcLower = img.src.toLowerCase()
			if (srcLower.includes("icon") && !srcLower.includes("content")) {
				if (width < 64 && height < 64) return false
			}
			return true
		})
	}

	async function bundleImagesInFrame() {
		const images = await getTargetImages()
		if (images.length === 0) {
			console.log("[D2L-DL] No images found in this frame.")
			return []
		}

		console.log(`[D2L-DL] Bundling ${images.length} images...`)
		const results = []
		for (let i = 0; i < images.length; i++) {
			try {
				const src = images[i].src
				const response = await fetch(src)
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				const blob = await response.blob()

				// Smart filename extraction
				let filename = ""
				try {
					const url = new URL(src)
					const pathParts = url.pathname.split("/")
					filename = pathParts.pop() || "image"
					if (!filename.includes(".") && response.type) {
						// Try to get extension from mime type
						const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png"
						filename += `.${ext}`
					}
				} catch (e) {
					filename = `image-${i}.png`
				}

				results.push({ filename, blob })
			} catch (err) {
				console.error(`[D2L-DL] Failed to fetch image:`, images[i].src, err)
			}
		}
		return results
	}

	async function takeSnapshotInFrame() {
		const candidates = [
			".content-panel",
			".content-block",
			".d2l-html-block-rendered",
			"main",
		]
		let target = null
		for (const s of candidates) {
			target = findInShadow(s)
			if (target) break
		}
		if (!target) target = document.body

		console.log(`[D2L-DL] Taking high-res snapshot of:`, target)
		const canvas = await html2canvas(target, {
			scale: 2,
			useCORS: true,
			backgroundColor: "#ffffff",
		})
		canvas.toBlob((blob) => {
			saveAs(blob, `snapshot-${new Date().getTime()}.png`)
		})
	}

	async function extractScriptInFrame() {
		const elements = Array.from(document.querySelectorAll(".video-script"))
		console.log(`[D2L-SCRIPT] Found ${elements.length} .video-script elements in ${window.location.href}`)
		if (elements.length === 0) return null

		const scriptParts = elements
			.map((el) => el.textContent.trim())
			.filter((text) => text !== "")

		console.log(`[D2L-SCRIPT] Extracted ${scriptParts.length} parts from this frame.`)
		return scriptParts.join("\n\n")
	}

	window.addEventListener("message", async (event) => {
		if (event.data && event.data.type === "D2L_SNAPSHOT") {
			await takeSnapshotInFrame()
		} else if (
			event.data &&
			event.data.type === "D2L_TRIGGER_DOWNLOAD_SINGLE"
		) {
			const items = await bundleImagesInFrame()
			if (items.length > 0) {
				const zip = new JSZip()
				items.forEach((it) => zip.file(it.filename, it.blob))
				const content = await zip.generateAsync({ type: "blob" })
				saveAs(content, "images.zip")
			}
		} else if (event.data && event.data.type === "D2L_EXTRACT_SCRIPT_REQUEST") {
			console.log(`[D2L-SCRIPT] Received script extraction request in ${window.location.href}`)
			const script = await extractScriptInFrame()
			if (script) {
				console.log(`[D2L-SCRIPT] Sending extraction response from ${window.location.href}`)
				window.top.postMessage(
					{ type: "D2L_EXTRACT_SCRIPT_RESPONSE", script },
					"*",
				)
			} else {
				console.log(`[D2L-SCRIPT] No script content found to send in response.`)
			}
		}
	})

	if (IS_TOP) {
		const styles = `
            #d2l-dl-btn {
                position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                color: white; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px; width: 48px; height: 48px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(10px); opacity: 0.9; overflow: hidden;
                white-space: nowrap; font-family: -apple-system, sans-serif; font-weight: 600;
            }
            #d2l-dl-btn:hover { width: 180px; opacity: 1; border-radius: 12px; }
            #d2l-dl-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
            #d2l-dl-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
            #d2l-dl-btn:hover .text { opacity: 1; max-width: 120px; margin-right: 16px; }

            #d2l-script-btn {
                position: fixed; bottom: 20px; right: 80px; z-index: 2147483647;
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px; width: 48px; height: 48px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(10px); opacity: 0.9; overflow: hidden;
                white-space: nowrap; font-family: -apple-system, sans-serif; font-weight: 600;
                display: none;
            }
            #d2l-script-btn:hover { width: 160px; opacity: 1; border-radius: 12px; }
            #d2l-script-btn .icon { min-width: 48px; display: flex; align-items: center; justify-content: center; }
            #d2l-script-btn .text { opacity: 0; max-width: 0; transition: all 0.3s ease; font-size: 14px; }
            #d2l-script-btn:hover .text { opacity: 1; max-width: 100px; margin-right: 16px; }

            #d2l-dl-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.2); z-index: 2147483646;
                display: none; opacity: 0; transition: opacity 0.3s; backdrop-filter: blur(2px);
            }
            #d2l-dl-overlay.visible { display: block; opacity: 1; }

            #d2l-dl-dialog {
                position: fixed; bottom: 80px; right: 20px;
                z-index: 2147483647; background: #1a1a1a; color: #efefef;
                padding: 20px; border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                font-family: -apple-system, sans-serif;
                max-width: 360px; width: 90%; display: none;
                opacity: 0; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                border: 1px solid #333;
            }
            #d2l-dl-dialog.visible { display: block; opacity: 1; transform: translateY(0) scale(1); }
            #d2l-dl-dialog h2 { margin: 0 0 4px 0; color: #fff; font-size: 16px; }
            #d2l-dl-dialog p { color: #888; margin: 0 0 16px 0; font-size: 12px; }

            .d2l-dl-frame-list { display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto; margin-bottom: 12px; }
            .d2l-dl-frame-item {
                background: #252525; padding: 10px 14px; border-radius: 10px;
                cursor: pointer; transition: all 0.2s ease;
                display: flex; align-items: center; justify-content: space-between;
                border: 1px solid transparent;
            }
            .d2l-dl-frame-item:hover { background: #333; transform: translateX(2px); }
            .d2l-dl-frame-item.all { background: #007aff; color: white; border: none; }
            .d2l-dl-frame-item .title { font-weight: 600; font-size: 13px; }
            .d2l-dl-frame-item .desc { font-size: 10px; color: #777; }

            .d2l-dl-item-actions { display: flex; gap: 8px; }
            .d2l-dl-action-icon {
                width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
                border-radius: 6px; background: rgba(255,255,255,0.05); color: #aaa;
                transition: all 0.2s;
            }
            .d2l-dl-action-icon:hover { background: rgba(255,255,255,0.15); color: #fff; }

            #d2l-iframe-highlighter {
                position: fixed; pointer-events: none; border: 3px solid #007aff;
                background: rgba(0, 122, 255, 0.05); z-index: 2147483645;
                transition: all 0.2s ease; border-radius: 4px; display: none;
            }
        `

		const styleEl = document.createElement("style")
		styleEl.innerHTML = styles
		document.head.appendChild(styleEl)

		function createUI() {
			const btn = document.createElement("button")
			btn.id = "d2l-dl-btn"
			btn.innerHTML = `<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div><div class="text">Content Tools</div>`
			document.body.appendChild(btn)

			const scriptBtn = document.createElement("button")
			scriptBtn.id = "d2l-script-btn"
			scriptBtn.innerHTML = `<div class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div><div class="text">Save Script</div>`
			document.body.appendChild(scriptBtn)

			async function handleScriptDownload() {
				console.log(`[D2L-SCRIPT] Script download triggered.`)
				const results = []
				const topScript = await extractScriptInFrame()
				if (topScript) results.push(topScript)

				const iframes = findIframes()
				console.log(`[D2L-SCRIPT] Requesting scripts from ${iframes.length} iframes.`)
				const iframeScripts = await Promise.all(
					iframes.map((iframe) => {
						return new Promise((resolve) => {
							const listener = (event) => {
								if (
									event.data &&
									event.data.type === "D2L_EXTRACT_SCRIPT_RESPONSE" &&
									event.source === iframe.contentWindow
								) {
									console.log(`[D2L-SCRIPT] Received response from an iframe.`)
									window.removeEventListener("message", listener)
									resolve(event.data.script)
								}
							}
							window.addEventListener("message", listener)
							iframe.contentWindow.postMessage(
								{ type: "D2L_EXTRACT_SCRIPT_REQUEST" },
								"*",
							)
							setTimeout(() => {
								window.removeEventListener("message", listener)
								resolve(null)
							}, 2000)
						})
					}),
				)

				iframeScripts.forEach((s) => {
					if (s) results.push(s)
				})

				console.log(`[D2L-SCRIPT] Total scripts collected: ${results.length}`)
				if (results.length > 0) {
					console.log(`[D2L-SCRIPT] Saving script file...`)
					const blob = new Blob([results.join("\n\n---\n\n")], {
						type: "text/plain;charset=utf-8",
					})
					saveAs(blob, `script-${new Date().getTime()}.txt`)
				} else {
					console.warn(`[D2L-SCRIPT] No script content collected from any frame.`)
					alert("No script content found to save.")
				}
			}

			scriptBtn.onclick = handleScriptDownload

			const overlay = document.createElement("div")
			overlay.id = "d2l-dl-overlay"
			document.body.appendChild(overlay)

			const highlighter = document.createElement("div")
			highlighter.id = "d2l-iframe-highlighter"
			document.body.appendChild(highlighter)

			const dialog = document.createElement("div")
			dialog.id = "d2l-dl-dialog"
			document.body.appendChild(dialog)

			const hide = () => {
				overlay.classList.remove("visible")
				dialog.classList.remove("visible")
				highlighter.style.display = "none"
			}

			function showMenu() {
				const iframes = findIframes()
				const frames = [
					{ name: "Top Page", frame: window, desc: "Main document container" },
					...iframes.map((f, i) => ({
						name: f.title || f.name || f.id || `Iframe #${i + 1}`,
						frame: f,
						desc: f.src.split("/").pop() || "Embedded frame",
					})),
				]

				dialog.innerHTML = `
                    <h2>Content Tools</h2>
                    <p>Select a frame to download images (ZIP) or take a snapshot.</p>
                    <div class="d2l-dl-frame-list">
                        <div class="d2l-dl-frame-item all" id="d2l-dl-all">
                            <div>
                                <div class="title">All Frames (ZIP)</div>
                                <div class="desc">Triggers ZIP download in every frame</div>
                            </div>
                        </div>
                        ${frames
													.map(
														(f, i) => `
                            <div class="d2l-dl-frame-item" data-index="${i}">
                                <div class="info">
                                    <div class="title">${f.name}</div>
                                    <div class="desc">${f.desc}</div>
                                </div>
                                <div class="d2l-dl-item-actions">
                                    <div class="d2l-dl-action-icon snapshot-btn" title="Take Snapshot" data-index="${i}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                    </div>
                                    <div class="d2l-dl-action-icon zip-btn" title="ZIP Images" data-index="${i}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                    </div>
                                </div>
                            </div>
                        `,
													)
													.join("")}
                    </div>
                    <div style="display:flex; justify-content:space-between">
                        <button id="d2l-dl-close" style="background:none; border:none; color:#555; cursor:pointer; font-size:11px">Close</button>
                    </div>
                `

				overlay.classList.add("visible")
				dialog.classList.add("visible")

				dialog.querySelectorAll(".d2l-dl-frame-item").forEach((item) => {
					item.addEventListener("mouseenter", () => {
						const idx = item.getAttribute("data-index")
						if (!idx) return
						const f = frames[parseInt(idx)]
						if (f.frame !== window && f.frame.getBoundingClientRect) {
							const r = f.frame.getBoundingClientRect()
							highlighter.style.cssText = `top:${r.top}px; left:${r.left}px; width:${r.width}px; height:${r.height}px; display:block;`
						} else highlighter.style.display = "none"
					})
				})

				dialog.querySelectorAll(".zip-btn").forEach((btn) => {
					btn.addEventListener("click", (e) => {
						e.stopPropagation()
						const f = frames[parseInt(btn.dataset.index)]
						hide()
						if (f.frame === window) {
							bundleImagesInFrame().then(async (items) => {
								if (items.length > 0) {
									const zip = new JSZip()
									items.forEach((it) => zip.file(it.filename, it.blob))
									const content = await zip.generateAsync({ type: "blob" })
									saveAs(content, "images.zip")
								}
							})
						} else {
							f.frame.contentWindow.postMessage(
								{ type: "D2L_TRIGGER_DOWNLOAD_SINGLE" },
								"*",
							)
						}
					})
				})

				dialog.querySelectorAll(".snapshot-btn").forEach((btn) => {
					btn.addEventListener("click", (e) => {
						e.stopPropagation()
						const f = frames[parseInt(btn.dataset.index)]
						hide()
						if (f.frame === window) takeSnapshotInFrame()
						else
							f.frame.contentWindow.postMessage({ type: "D2L_SNAPSHOT" }, "*")
					})
				})

				document.getElementById("d2l-dl-all").addEventListener("click", () => {
					hide()
					frames.forEach((f) => {
						if (f.frame === window) {
							bundleImagesInFrame().then(async (items) => {
								if (items.length > 0) {
									const zip = new JSZip()
									items.forEach((it) => zip.file(it.filename, it.blob))
									const content = await zip.generateAsync({ type: "blob" })
									saveAs(content, "top-images.zip")
								}
							})
						} else {
							f.frame.contentWindow.postMessage(
								{ type: "D2L_TRIGGER_DOWNLOAD_SINGLE" },
								"*",
							)
						}
					})
				})

				document.getElementById("d2l-dl-close").onclick = hide
				overlay.onclick = hide
			}

			btn.addEventListener("click", showMenu)
		}

		if (document.body) createUI()
		else window.addEventListener("DOMContentLoaded", createUI)

		window.addEventListener("message", (event) => {
			if (event.data && event.data.type === "D2L_HAS_VIDEO_SCRIPT") {
				const sbtn = document.getElementById("d2l-script-btn")
				if (sbtn) sbtn.style.display = "flex"
			}
		})

		const updateVisibility = () => {
			const c = document.getElementById("chatFrame")
			if (c) c.remove()

			if (document.querySelector(".video-script")) {
				const sbtn = document.getElementById("d2l-script-btn")
				if (sbtn) sbtn.style.display = "flex"
			}
		}
		updateVisibility()
		new MutationObserver(updateVisibility).observe(document.documentElement, {
			childList: true,
			subtree: true,
		})
	} else {
		// Iframe logic to report presence of video-script
		const reportPresence = () => {
			if (document.querySelector(".video-script")) {
				console.log(`[D2L-SCRIPT] Found script in iframe: ${window.location.href}, reporting to top...`)
				window.top.postMessage({ type: "D2L_HAS_VIDEO_SCRIPT" }, "*")
			}
		}
		reportPresence()
		new MutationObserver(reportPresence).observe(document.documentElement, {
			childList: true,
			subtree: true,
		})
	}
})()
