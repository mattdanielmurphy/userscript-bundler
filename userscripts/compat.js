// Centralized compatibility layer for userscript manager APIs (Tampermonkey vs. Safari Userscripts extension)
// Exposed globally as `gm` to all bundled modules.

const gm = (function () {
	"use strict";

	const storagePrefix = "__gm_";

	// Helper to safely get localStorage without throwing SecurityError in sandboxed frames
	function safeGetLocalStorage() {
		try {
			if (typeof window !== "undefined" && window.localStorage) {
				return window.localStorage;
			}
		} catch (e) {}
		return null;
	}

	// 1. Sync Storage Helpers (fallback to localStorage)
	function getValue(key, defaultValue) {
		if (typeof GM_getValue === "function") {
			try {
				return GM_getValue(key, defaultValue);
			} catch (e) {
				console.error("[Compat] Native GM_getValue failed:", e);
			}
		}
		try {
			const storage = safeGetLocalStorage();
			if (!storage) return defaultValue;
			const val = storage.getItem(storagePrefix + key);
			if (val === null) return defaultValue;
			try {
				return JSON.parse(val);
			} catch (e) {
				return val;
			}
		} catch (e) {
			return defaultValue;
		}
	}

	function setValue(key, value) {
		if (typeof GM_setValue === "function") {
			try {
				GM_setValue(key, value);
				return;
			} catch (e) {
				console.error("[Compat] Native GM_setValue failed:", e);
			}
		}
		try {
			const storage = safeGetLocalStorage();
			if (storage) {
				storage.setItem(storagePrefix + key, JSON.stringify(value));
			}
		} catch (e) {
			console.error("[Compat] LocalStorage setValue failed:", e);
		}
	}

	// 2. Async Storage Helpers (prefer GM.* promise-based APIs)
	async function getValueAsync(key, defaultValue) {
		if (typeof GM !== "undefined" && typeof GM.getValue === "function") {
			try {
				return await GM.getValue(key, defaultValue);
			} catch (e) {
				console.error("[Compat] GM.getValue failed, falling back to sync:", e);
			}
		}
		return getValue(key, defaultValue);
	}

	async function setValueAsync(key, value) {
		if (typeof GM !== "undefined" && typeof GM.setValue === "function") {
			try {
				await GM.setValue(key, value);
				return;
			} catch (e) {
				console.error("[Compat] GM.setValue failed, falling back to sync:", e);
			}
		}
		setValue(key, value);
	}

	// 3. Menu Command Helpers
	function registerMenuCommand(name, fn, options) {
		if (typeof GM_registerMenuCommand === "function") {
			try {
				return GM_registerMenuCommand(name, fn, options);
			} catch (e) {
				console.error("[Compat] GM_registerMenuCommand failed:", e);
			}
		}
		// Graceful no-op for managers without menu commands (like Safari Userscripts)
		return null;
	}

	function unregisterMenuCommand(id) {
		if (id !== null && typeof GM_unregisterMenuCommand === "function") {
			try {
				GM_unregisterMenuCommand(id);
			} catch (e) {
				console.error("[Compat] GM_unregisterMenuCommand failed:", e);
			}
		}
	}

	// 4. Network/XHR Wrapper
	const isXmlHttpRequestSupported =
		typeof GM_xmlhttpRequest === "function" ||
		(typeof GM !== "undefined" && (typeof GM.xmlHttpRequest === "function" || typeof GM.xmlhttpRequest === "function"));

	function xmlHttpRequest(details) {
		if (typeof GM_xmlhttpRequest === "function") {
			try {
				return GM_xmlhttpRequest(details);
			} catch (e) {
				console.error("[Compat] GM_xmlhttpRequest execution failed:", e);
				if (details.onerror) details.onerror(e);
				return { abort: () => {} };
			}
		} else if (typeof GM !== "undefined" && (typeof GM.xmlHttpRequest === "function" || typeof GM.xmlhttpRequest === "function")) {
			try {
				const fn = GM.xmlHttpRequest || GM.xmlhttpRequest;
				// Modern GM.xmlHttpRequest returns a Promise, but also accepts callbacks.
				// We call it and also return the Promise for compatibility with both patterns.
				const promise = fn.call(GM, details);
				if (promise && typeof promise.catch === "function") {
					promise.catch((err) => {
						console.error("[Compat] GM.xmlHttpRequest Promise rejected:", err);
						if (details.onerror) details.onerror(err);
					});
				}
				return promise || { abort: () => {} };
			} catch (e) {
				console.error("[Compat] GM.xmlHttpRequest execution failed:", e);
				if (details.onerror) details.onerror(e);
				return { abort: () => {} };
			}
		} else {
			const errorMsg =
				"Cross-origin network API (GM_xmlhttpRequest or GM.xmlHttpRequest) is not supported in this userscript manager. " +
				"Archiving and command features are disabled.";
			console.warn("[Compat] " + errorMsg);
			
			// Call onerror callback if provided
			if (details.onerror) {
				setTimeout(() => {
					details.onerror({
						status: 0,
						statusText: "Extension Limitations",
						responseText: errorMsg,
					});
				}, 0);
			}
			
			// Return a rejected promise and a dummy abort function
			const dummyPromise = Promise.reject(new Error(errorMsg));
			dummyPromise.abort = () => {};
			return dummyPromise;
		}
	}

	// 5. Styles Injection Helper
	function addStyle(css) {
		if (typeof GM_addStyle === "function") {
			try {
				GM_addStyle(css);
				return;
			} catch (e) {
				console.error("[Compat] GM_addStyle failed, falling back to manual style injection:", e);
			}
		}
		try {
			const style = document.createElement("style");
			style.textContent = css;
			(document.head || document.documentElement).appendChild(style);
		} catch (e) {
			console.error("[Compat] Manual style injection failed:", e);
		}
	}

	// 6. Safe HTML Injection Helper (TrustedHTML compliant)
	function setSafeHTML(element, html) {
		if (!element) return;
		if (!html) {
			element.replaceChildren();
			return;
		}
		if (typeof window !== "undefined" && window.trustedTypes) {
			try {
				const policy = window.trustedTypes.defaultPolicy ||
					(window.trustedTypes.createPolicy ? window.trustedTypes.createPolicy("gm-safe-policy", { createHTML: (s) => s }) : null);
				if (policy) {
					element.innerHTML = policy.createHTML(html);
					return;
				}
			} catch (e) {}
		}
		try {
			const parser = new DOMParser();
			const parsed = parser.parseFromString(html, "text/html");
			element.replaceChildren(...parsed.body.childNodes);
		} catch (e) {
			element.innerHTML = html;
		}
	}

	return {
		getValue,
		setValue,
		getValueAsync,
		setValueAsync,
		registerMenuCommand,
		unregisterMenuCommand,
		xmlHttpRequest,
		isXmlHttpRequestSupported,
		addStyle,
		setSafeHTML,
	};
})();

// Expose on window object as well
if (typeof window !== "undefined") {
	window.gm = gm;
}
if (typeof globalThis !== "undefined") {
	globalThis.gm = gm;
}
