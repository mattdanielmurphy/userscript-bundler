// ==UserScript==
// @name        D2L Image Downloader
// @namespace   Violentmonkey Scripts
// @match       https://sd44.onlinelearningbc.com/d2l/*
// @grant       none
// @version     1.0
// @author      Antigravity
// @description Adds a button to download all images in the content area of D2L courses.
// ==/UserScript==

;(function () {
	"use strict"

	// Provided script logic
	const runDownloadScript = async () => {
		// 1. Helper function to find the element across Shadow boundaries
		function findInShadow(selector, root = document) {
			const el = root.querySelector(selector)
			if (el) return el

			const children = root.querySelectorAll("*")
			for (const child of children) {
				if (child.shadowRoot) {
					const found = findInShadow(selector, child.shadowRoot)
					if (found) return found
				}
			}
			return null
		}

		const container = findInShadow(".d2l-html-block-rendered")
		if (!container) {
			console.error("Could not find the container .d2l-html-block-rendered")
			alert("Could not find the content container (.d2l-html-block-rendered).")
			return
		}

		// 2. Find all images inside the container
		const images = Array.from(container.querySelectorAll("img"))
		console.log(`Found ${images.length} images. Starting download...`)

		if (images.length === 0) {
			alert("No images found in the content area.")
			return
		}

		// 3. Download each image
		for (let i = 0; i < images.length; i++) {
			const src = images[i].src
			try {
				const response = await fetch(src)
				const blob = await response.blob()
				const url = window.URL.createObjectURL(blob)

				const a = document.createElement("a")
				a.href = url
				// Extract filename or use a generic one
				const filename = src.split("/").pop().split("?")[0] || `image-${i}.png`
				a.download = filename

				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
				window.URL.revokeObjectURL(url)

				// Small delay to prevent browser throttling
				await new Promise((resolve) => setTimeout(resolve, 200))
			} catch (err) {
				console.error(`Failed to download ${src}:`, err)
			}
		}

		console.log("Download process complete.")
	}

	const SCRIPT_TEXT = `(async () => {
  // 1. Helper function to find the element across Shadow boundaries
  function findInShadow(selector, root = document) {
    const el = root.querySelector(selector);
    if (el) return el;
    
    const children = root.querySelectorAll('*');
    for (const child of children) {
      if (child.shadowRoot) {
        const found = findInShadow(selector, child.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  const container = findInShadow('.d2l-html-block-rendered');
  if (!container) {
    console.error("Could not find the container .d2l-html-block-rendered");
    return;
  }

  // 2. Find all images inside the container
  const images = Array.from(container.querySelectorAll('img'));
  console.log(\`Found \${images.length} images. Starting download...\`);

  // 3. Download each image
  for (let i = 0; i < images.length; i++) {
    const src = images[i].src;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      // Extract filename or use a generic one
      const filename = src.split('/').pop().split('?')[0] || \`image-\${i}.png\`;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Small delay to prevent browser throttling
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err) {
      console.error(\`Failed to download \${src}:\`, err);
    }
  }
  
  console.log("Download process complete.");
})();`

	// Premium Styles
	const styles = `
        #d2l-dl-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 10px 18px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-weight: 500;
            font-size: 13px;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            backdrop-filter: blur(10px);
            opacity: 0.8;
        }

        #d2l-dl-btn:hover {
            opacity: 1;
            transform: translateY(-2px);
            box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
            background: linear-gradient(135deg, #2a5298 0%, #1e3c72 100%);
        }

        #d2l-dl-btn:active {
            transform: translateY(0);
        }

        #d2l-dl-dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            z-index: 2147483647;
            background: #1a1a1a;
            color: #efefef;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 30px 100px rgba(0, 0, 0, 0.8);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            max-width: 360px;
            width: 90%;
            display: none;
            opacity: 0;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            text-align: center;
            border: 1px solid #333;
        }

        #d2l-dl-dialog.visible {
            display: block;
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }

        #d2l-dl-dialog h2 {
            margin-top: 0;
            color: #fff;
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.01em;
        }

        #d2l-dl-dialog p {
            color: #aaa;
            margin-bottom: 24px;
            font-size: 14px;
            line-height: 1.5;
        }

        .d2l-dl-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .d2l-dl-btn-secondary {
            background: #333;
            color: #eee;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: background 0.2s;
        }

        .d2l-dl-btn-secondary:hover {
            background: #444;
        }

        .d2l-dl-btn-primary {
            background: #007aff;
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: background 0.2s;
        }

        .d2l-dl-btn-primary:hover {
            background: #0063d1;
        }

        #d2l-dl-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 2147483646;
            display: none;
            opacity: 0;
            transition: opacity 0.3s;
            backdrop-filter: blur(4px);
        }

        #d2l-dl-overlay.visible {
            display: block;
            opacity: 1;
        }
    `

	const styleEl = document.createElement("style")
	styleEl.innerHTML = styles
	document.head.appendChild(styleEl)

	function createUI() {
		if (document.getElementById("d2l-dl-btn")) return

		const btn = document.createElement("button")
		btn.id = "d2l-dl-btn"
		btn.innerHTML =
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download All Images'
		document.body.appendChild(btn)

		const overlay = document.createElement("div")
		overlay.id = "d2l-dl-overlay"
		document.body.appendChild(overlay)

		const dialog = document.createElement("div")
		dialog.id = "d2l-dl-dialog"
		dialog.innerHTML = `
            <h2>Download Triggered</h2>
            <p>The image script has finished. If your browser asks for permission to download multiple files, click "Allow".</p>
            <div class="d2l-dl-actions">
                <button class="d2l-dl-btn-secondary" id="d2l-dl-copy">Copy Script</button>
                <button class="d2l-dl-btn-primary" id="d2l-dl-close">Done</button>
            </div>
        `
		document.body.appendChild(dialog)

		btn.addEventListener("click", async () => {
			btn.disabled = true
			const originalHTML = btn.innerHTML
			btn.innerHTML = "<span>⏳</span> Processing..."

			try {
				await runDownloadScript()

				overlay.classList.add("visible")
				dialog.classList.add("visible")
			} catch (err) {
				console.error("Download script error:", err)
			} finally {
				btn.disabled = false
				btn.innerHTML = originalHTML
			}
		})

		document.getElementById("d2l-dl-copy").addEventListener("click", () => {
			const copyBtn = document.getElementById("d2l-dl-copy")
			navigator.clipboard.writeText(SCRIPT_TEXT).then(() => {
				const originalText = copyBtn.textContent
				copyBtn.textContent = "Copied!"
				setTimeout(() => (copyBtn.textContent = originalText), 2000)
			})
		})

		document.getElementById("d2l-dl-close").addEventListener("click", () => {
			overlay.classList.remove("visible")
			dialog.classList.remove("visible")
		})

		overlay.addEventListener("click", () => {
			overlay.classList.remove("visible")
			dialog.classList.remove("visible")
		})
	}

	// Initialize
	if (document.body) {
		createUI()
	} else {
		window.addEventListener("DOMContentLoaded", createUI)
	}
})()
