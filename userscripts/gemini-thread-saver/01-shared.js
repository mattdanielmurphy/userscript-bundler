// ═══════════════════════════════════════════════════════════
// SHARED TOOLTIP SINGLETON & UTILITIES
// ═══════════════════════════════════════════════════════════

const FONT = "Google Sans, Google Sans Flex, Roboto, sans-serif"
let tooltipEl = null
let tooltipTimer = null

function ensureTooltip() {
	if (tooltipEl || !document.body) return
	tooltipEl = document.createElement("div")
	tooltipEl.style.cssText = `
      position: fixed;
      background: #1e1e2e;
      color: #e2e2f0;
      padding: 7px 13px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-family: ${FONT};
      pointer-events: none;
      z-index: 99999;
      display: none;
      box-shadow: 0 4px 18px rgba(0,0,0,0.4);
      white-space: nowrap;
      line-height: 1.6;
    `
	document.body.appendChild(tooltipEl)
}

function showTooltip(e, text) {
	ensureTooltip()
	if (!tooltipEl) return
	tooltipEl.innerText = text
	tooltipEl.style.display = "block"
	positionTooltip(e)
}

function hideTooltip() {
	if (tooltipEl) tooltipEl.style.display = "none"
}

function positionTooltip(e) {
	if (!tooltipEl) return
	tooltipEl.style.left = `${e.clientX + 14}px`
	tooltipEl.style.top = `${e.clientY - 42}px`
}

// Used by message timestamp spans
function attachTooltip(el, getFullText) {
	el.style.cursor = "default"
	el.addEventListener("mouseenter", (e) => showTooltip(e, getFullText()))
	el.addEventListener("mousemove", positionTooltip)
	el.addEventListener("mouseleave", hideTooltip)
}

// ═══════════════════════════════════════════════════════════
// SHARED TIME UTILITIES
// ═══════════════════════════════════════════════════════════

function getLocalTzAbbr() {
	return new Date()
		.toLocaleTimeString("en-US", { timeZoneName: "short" })
		.split(" ")
		.pop()
}

function getLocalTzOffsetHours() {
	return -new Date().getTimezoneOffset() / 60
}

function formatTime(date) {
	return date.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	})
}

function formatFullDateTime(date) {
	const d = date.toLocaleDateString([], {
		month: "long",
		day: "numeric",
		year: "numeric",
	})
	return `${d} at ${formatTime(date)} ${getLocalTzAbbr()}`
}

function getRelativeDateLabel(unix, forSidebar = false) {
	const date = new Date(unix * 1000)
	const now = new Date()
	const todayMs = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime()
	const targetMs = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	).getTime()
	const diffDays = Math.floor((todayMs - targetMs) / 86400000)

	if (diffDays <= 0) return forSidebar ? "Today" : null
	if (diffDays === 1) return "Yesterday"
	if (diffDays === 2) return "2 days ago"
	if (diffDays < 7) return `${diffDays} days ago`

	const weeks = Math.floor(diffDays / 7)
	if (diffDays < 30) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`

	const months = Math.floor(diffDays / 30.44)
	if (diffDays < 365)
		return months === 1 ? "1 month ago" : `${months} months ago`

	const years = Math.floor(diffDays / 365.25)
	return years === 1 ? "1 year ago" : `${years} years ago`
}
