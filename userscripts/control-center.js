/**
 * Userscript Control Center
 * 
 * Embedded cross-site control center for runtime enablement, Git history,
 * and targeted rollback.
 */

(function () {
	"use strict";

	const SERVER_BASE = "http://127.0.0.1:3033";
	const STORAGE_KEY = "uscc_settings_v1";

	// Retrieve local secret key from GM storage or default
	function getSecretKey() {
		return (typeof GM !== "undefined" && GM.getValue)
			? (GM.getValue("uscc_secret_key", "default-secret"))
			: Promise.resolve("default-secret");
	}

	// GM.xmlHttpRequest wrapper
	async function apiFetch(endpoint, options = {}) {
		const secret = await getSecretKey();
		const headers = {
			"Content-Type": "application/json",
			"X-Local-Automation-Key": secret,
			...(options.headers || {}),
		};

		return new Promise((resolve, reject) => {
			if (typeof GM === "undefined" || !GM.xmlHttpRequest) {
				return reject(new Error("GM.xmlHttpRequest unavailable. Ensure loader grants @grant GM.xmlHttpRequest and @connect 127.0.0.1"));
			}

			GM.xmlHttpRequest({
				method: options.method || "GET",
				url: `${SERVER_BASE}${endpoint}`,
				headers: headers,
				data: options.body ? JSON.stringify(options.body) : undefined,
				onload: (res) => {
					try {
						const json = JSON.parse(res.responseText);
						if (res.status >= 200 && res.status < 300 && json.ok) {
							resolve(json.data);
						} else {
							const err = json.error || { code: "HTTP_ERROR", message: `HTTP ${res.status}: ${res.responseText}` };
							reject(err);
						}
					} catch (e) {
						reject({ code: "PARSE_ERROR", message: "Failed to parse response JSON", raw: res.responseText });
					}
				},
				onerror: (err) => reject({ code: "NETWORK_ERROR", message: "Failed to connect to local-automation-server (127.0.0.1:3033)" }),
				ontimeout: () => reject({ code: "TIMEOUT", message: "Local automation server request timed out" }),
			});
		});
	}

	// Runtime enablement settings manager
	async function loadSettings() {
		try {
			const raw = await GM.getValue(STORAGE_KEY, "{}");
			return JSON.parse(raw);
		} catch {
			return { version: 1, scripts: {} };
		}
	}

	async function saveSettings(settings) {
		await GM.setValue(STORAGE_KEY, JSON.stringify(settings));
	}

	// Control Center UI Construction
	let uiHost = null;
	let shadowRoot = null;

	function createUI() {
		if (document.getElementById("uscc-root")) return;

		uiHost = document.createElement("div");
		uiHost.id = "uscc-root";
		uiHost.style.position = "fixed";
		uiHost.style.zIndex = "2147483647";
		document.body.appendChild(uiHost);

		shadowRoot = uiHost.attachShadow({ mode: "open" });

		const style = document.createElement("style");
		style.textContent = `
			:host {
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
				color: #e0e0e0;
				font-size: 13px;
			}
			.overlay {
				position: fixed;
				top: 0; left: 0; right: 0; bottom: 0;
				background: rgba(0, 0, 0, 0.65);
				backdrop-filter: blur(4px);
				display: flex;
				align-items: center;
				justify-content: center;
				opacity: 0;
				pointer-events: none;
				transition: opacity 0.2s ease;
			}
			.overlay.open {
				opacity: 1;
				pointer-events: auto;
			}
			.modal {
				background: #1e1e24;
				border: 1px solid #33333f;
				border-radius: 10px;
				width: 850px;
				max-width: 92vw;
				max-height: 85vh;
				display: flex;
				flex-direction: column;
				box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
				overflow: hidden;
			}
			.header {
				padding: 16px 20px;
				background: #252530;
				border-bottom: 1px solid #33333f;
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.header h2 {
				margin: 0;
				font-size: 16px;
				font-weight: 600;
				color: #fff;
				display: flex;
				align-items: center;
				gap: 8px;
			}
			.close-btn {
				background: transparent;
				border: none;
				color: #888;
				font-size: 20px;
				cursor: pointer;
				padding: 4px 8px;
				border-radius: 4px;
			}
			.close-btn:hover { color: #fff; background: #333344; }
			.toolbar {
				padding: 12px 20px;
				background: #18181f;
				border-bottom: 1px solid #2a2a38;
				display: flex;
				gap: 12px;
				align-items: center;
			}
			.search-input {
				flex: 1;
				background: #252530;
				border: 1px solid #383848;
				border-radius: 6px;
				padding: 6px 12px;
				color: #fff;
				font-size: 13px;
			}
			.search-input:focus { outline: none; border-color: #6366f1; }
			.btn {
				background: #313145;
				color: #e0e0e0;
				border: 1px solid #42425c;
				padding: 6px 14px;
				border-radius: 6px;
				cursor: pointer;
				font-weight: 500;
				font-size: 12px;
				transition: background 0.15s ease;
			}
			.btn:hover { background: #3d3d57; color: #fff; }
			.btn-primary { background: #4f46e5; border-color: #6366f1; color: #fff; }
			.btn-primary:hover { background: #4338ca; }
			.btn-danger { background: #dc2626; border-color: #ef4444; color: #fff; }
			.btn-danger:hover { background: #b91c1c; }
			.body {
				flex: 1;
				overflow-y: auto;
				padding: 16px 20px;
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			.script-card {
				background: #252532;
				border: 1px solid #333346;
				border-radius: 8px;
				padding: 14px 16px;
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.script-top {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
			}
			.script-info { display: flex; flex-direction: column; gap: 4px; }
			.script-name { font-weight: 600; font-size: 14px; color: #fff; display: flex; align-items: center; gap: 8px; }
			.script-desc { color: #aaa; font-size: 12px; }
			.badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
			.badge {
				font-size: 10px;
				padding: 2px 6px;
				border-radius: 4px;
				background: #181822;
				border: 1px solid #333346;
				color: #999;
			}
			.badge-matched { background: #064e3b; color: #34d399; border-color: #059669; }
			.badge-disabled { background: #7f1d1d; color: #fca5a5; border-color: #dc2626; }
			.badge-dirty { background: #78350f; color: #fde68a; border-color: #d97706; }
			.toggle-switch {
				position: relative;
				display: inline-block;
				width: 38px;
				height: 20px;
			}
			.toggle-switch input { opacity: 0; width: 0; height: 0; }
			.slider {
				position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
				background-color: #383848; transition: .2s; border-radius: 20px;
			}
			.slider:before {
				position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px;
				background-color: white; transition: .2s; border-radius: 50%;
			}
			input:checked + .slider { background-color: #10b981; }
			input:checked + .slider:before { transform: translateX(18px); }
			.history-panel {
				background: #181822;
				border: 1px solid #2e2e40;
				border-radius: 6px;
				padding: 12px;
				margin-top: 8px;
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.commit-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 6px 8px;
				border-radius: 4px;
				background: #21212e;
			}
			.commit-item:hover { background: #2a2a3c; }
			.commit-meta { display: flex; flex-direction: column; gap: 2px; }
			.commit-subject { font-weight: 500; color: #eee; }
			.commit-subtext { font-size: 11px; color: #777; font-family: monospace; }
			.reload-banner {
				background: #312e81;
				border: 1px solid #4338ca;
				color: #e0e7ff;
				padding: 10px 16px;
				border-radius: 6px;
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.status-bar {
				padding: 10px 20px;
				background: #18181f;
				border-top: 1px solid #2a2a38;
				font-size: 11px;
				color: #888;
				display: flex;
				justify-content: space-between;
			}
		`;

		shadowRoot.appendChild(style);

		const overlay = document.createElement("div");
		overlay.className = "overlay";

		overlay.innerHTML = `
			<div class="modal">
				<div class="header">
					<h2>⚙️ Userscript Control Center</h2>
					<button class="close-btn" id="uscc-close">&times;</button>
				</div>
				<div class="toolbar">
					<input type="text" class="search-input" id="uscc-search" placeholder="Search userscripts..." />
					<button class="btn" id="uscc-rebuild">🔨 Rebuild Bundle</button>
					<button class="btn" id="uscc-reload">🔄 Reload Page</button>
				</div>
				<div id="uscc-banner-container" style="padding: 12px 20px 0 20px; display: none;"></div>
				<div class="body" id="uscc-body">
					<div style="text-align: center; padding: 40px; color: #888;">Loading control server data...</div>
				</div>
				<div class="status-bar">
					<span id="uscc-status-left">Server: 127.0.0.1:3033</span>
					<span id="uscc-status-right">Alt+Shift+U</span>
				</div>
			</div>
		`;

		shadowRoot.appendChild(overlay);

		// Event handlers
		shadowRoot.getElementById("uscc-close").onclick = closeUI;
		overlay.onclick = (e) => { if (e.target === overlay) closeUI(); };

		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && overlay.classList.contains("open")) {
				closeUI();
			}
		});

		shadowRoot.getElementById("uscc-search").oninput = (e) => {
			filterScripts(e.target.value);
		};

		shadowRoot.getElementById("uscc-rebuild").onclick = async () => {
			try {
				updateStatus("Rebuilding bundle...");
				const res = await apiFetch("/api/userscripts/rebuild", { method: "POST" });
				showBanner("Bundle rebuilt successfully. Reload page to apply changes.");
				renderBody();
			} catch (err) {
				alert(`Build failed: ${err.message || err.details}`);
			}
		};

		shadowRoot.getElementById("uscc-reload").onclick = () => {
			window.location.reload();
		};
	}

	let needsReload = false;

	function showBanner(message) {
		needsReload = true;
		const container = shadowRoot.getElementById("uscc-banner-container");
		container.style.display = "block";
		container.innerHTML = `
			<div class="reload-banner">
				<span>⚠️ ${escapeHTML(message)}</span>
				<button class="btn btn-primary" id="uscc-banner-reload">Reload Now</button>
			</div>
		`;
		shadowRoot.getElementById("uscc-banner-reload").onclick = () => window.location.reload();
	}

	function updateStatus(text) {
		const el = shadowRoot.getElementById("uscc-status-left");
		if (el) el.textContent = text;
	}

	function escapeHTML(str) {
		return String(str || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	let cachedData = null;

	async function renderBody() {
		const bodyEl = shadowRoot.getElementById("uscc-body");
		try {
			const data = await apiFetch("/api/userscripts");
			const settings = await loadSettings();
			cachedData = data;

			bodyEl.innerHTML = "";

			if (!data.scripts || data.scripts.length === 0) {
				bodyEl.innerHTML = `<div style="text-align: center; padding: 40px;">No registered scripts found in server manifest.</div>`;
				return;
			}

			data.scripts.forEach((script) => {
				const isEnabled = settings.scripts?.[script.id]?.enabled !== false;
				const currentUrl = window.location.href;
				const matchesCurrent = script.matches.some((pattern) => {
					if (pattern === "*://*/*") return true;
					const domainMatch = pattern.match(/(?:https?|\*):\/\/(?:\*\.)?([^\/\*]+)/);
					return domainMatch && currentUrl.includes(domainMatch[1]);
				});

				const card = document.createElement("div");
				card.className = "script-card";
				card.dataset.scriptId = script.id;
				card.dataset.name = script.name.toLowerCase();

				const statusBadge = matchesCurrent
					? `<span class="badge badge-matched">Matches Current Site</span>`
					: `<span class="badge">Unmatched</span>`;

				const dirtyBadge = script.git?.workingTree?.dirty
					? `<span class="badge badge-dirty">Modified</span>`
					: "";

				const headSha = script.git?.head?.sha ? script.git.head.sha.slice(0, 7) : "unknown";

				card.innerHTML = `
					<div class="script-top">
						<div class="script-info">
							<div class="script-name">
								${escapeHTML(script.name)}
								<span style="font-size: 11px; font-weight: normal; color: #777;">(${escapeHTML(script.id)})</span>
							</div>
							<div class="script-desc">${escapeHTML(script.description || "")}</div>
							<div class="badges">
								${statusBadge}
								${dirtyBadge}
								<span class="badge">${escapeHTML(script.kind)}</span>
								<span class="badge">HEAD: ${escapeHTML(headSha)}</span>
							</div>
						</div>
						<label class="toggle-switch">
							<input type="checkbox" class="enable-toggle" ${isEnabled ? "checked" : ""} />
							<span class="slider"></span>
						</label>
					</div>
					<div style="display: flex; gap: 8px; margin-top: 4px;">
						<button class="btn history-btn">📜 History & Rollback</button>
					</div>
					<div class="history-container" style="display: none;"></div>
				`;

				// Toggle listener
				card.querySelector(".enable-toggle").onchange = async (e) => {
					const val = e.target.checked;
					const s = await loadSettings();
					if (!s.scripts) s.scripts = {};
					s.scripts[script.id] = { enabled: val };
					await saveSettings(s);
					showBanner(`Enablement updated for ${script.name}. Reload page to take effect.`);
				};

				// History listener
				card.querySelector(".history-btn").onclick = async () => {
					const container = card.querySelector(".history-container");
					if (container.style.display === "block") {
						container.style.display = "none";
						return;
					}
					container.style.display = "block";
					container.innerHTML = `<div style="padding: 8px; color: #888;">Loading commit history...</div>`;

					try {
						const histData = await apiFetch(`/api/userscripts/${script.id}/history?limit=15`);
						renderHistoryPanel(container, script, histData.commits);
					} catch (err) {
						container.innerHTML = `<div style="padding: 8px; color: #ef4444;">Failed to load history: ${escapeHTML(err.message)}</div>`;
					}
				};

				bodyEl.appendChild(card);
			});
		} catch (err) {
			bodyEl.innerHTML = `
				<div style="padding: 24px; background: #2d1818; border: 1px solid #7f1d1d; border-radius: 8px; color: #fca5a5;">
					<strong>Error connecting to Control API:</strong><br />
					${escapeHTML(err.message)}
					<br /><br />
					Ensure <code>local-automation-server</code> is running on <code>127.0.0.1:3033</code>.
				</div>
			`;
		}
	}

	function renderHistoryPanel(container, script, commits) {
		container.innerHTML = "";
		const panel = document.createElement("div");
		panel.className = "history-panel";

		if (!commits || commits.length === 0) {
			panel.innerHTML = `<div style="color: #777;">No history found for this script's allowed paths.</div>`;
			container.appendChild(panel);
			return;
		}

		commits.forEach((c) => {
			const item = document.createElement("div");
			item.className = "commit-item";

			const headMarker = c.isHead ? `<span class="badge badge-matched" style="font-size: 9px;">CURRENT HEAD</span>` : "";

			item.innerHTML = `
				<div class="commit-meta">
					<div class="commit-subject">${escapeHTML(c.subject)} ${headMarker}</div>
					<div class="commit-subtext">${escapeHTML(c.shortSha)} • ${escapeHTML(c.author)} • ${new Date(c.date).toLocaleString()}</div>
				</div>
				<div>
					${!c.isHead ? `<button class="btn btn-primary restore-btn">Restore</button>` : ""}
				</div>
			`;

			if (!c.isHead) {
				item.querySelector(".restore-btn").onclick = async () => {
					confirmAndRestore(script, c);
				};
			}

			panel.appendChild(item);
		});

		container.appendChild(panel);
	}

	async function confirmAndRestore(script, commit, confirmDirty = false) {
		const msg = `This restores only '${script.name}' source files to commit ${commit.shortSha} ("${commit.subject}"), rebuilds the local bundle, and creates a new Git rollback commit. It takes effect after reload.`;

		if (!confirm(msg)) return;

		try {
			updateStatus(`Restoring ${script.name}...`);
			const res = await apiFetch(`/api/userscripts/${script.id}/restore`, {
				method: "POST",
				body: { commitSha: commit.sha, confirmDirty }
			});

			showBanner(`Successfully restored ${script.name} to ${commit.shortSha}! Checkpoint ref: ${res.checkpointRef}.`);
			renderBody();
		} catch (err) {
			if (err.code === "WORKING_TREE_DIRTY" && !confirmDirty) {
				if (confirm(`Working tree files for ${script.name} are dirty (${err.details?.affectedFiles?.join(", ") || ""}). Overwrite dirty files?`)) {
					confirmAndRestore(script, commit, true);
				}
			} else {
				alert(`Restore failed: ${err.message || err.details}`);
			}
		}
	}

	function filterScripts(query) {
		const q = query.toLowerCase();
		const cards = shadowRoot.querySelectorAll(".script-card");
		cards.forEach((card) => {
			const name = card.dataset.name || "";
			const id = card.dataset.scriptId || "";
			if (name.includes(q) || id.includes(q)) {
				card.style.display = "flex";
			} else {
				card.style.display = "none";
			}
		});
	}

	function openUI() {
		createUI();
		const overlay = shadowRoot.querySelector(".overlay");
		overlay.classList.add("open");
		renderBody();
	}

	function closeUI() {
		if (shadowRoot) {
			const overlay = shadowRoot.querySelector(".overlay");
			if (overlay) overlay.classList.remove("open");
		}
	}

	// Register Tampermonkey menu command if available
	if (typeof GM_registerMenuCommand !== "undefined") {
		GM_registerMenuCommand("Open Userscript Control Center", openUI);
	}

	// Hotkey shortcut Alt+Shift+U
	window.addEventListener("keydown", (e) => {
		if (e.altKey && e.shiftKey && (e.key === "U" || e.key === "u")) {
			e.preventDefault();
			openUI();
		}
	});

	// Expose globally for dispatcher invocation if needed
	window.__USCC_OPEN__ = openUI;
})();
