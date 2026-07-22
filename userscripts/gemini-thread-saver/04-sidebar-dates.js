// ═══════════════════════════════════════════════════════════
// SIDEBAR DATES & GM SETTINGS
// ═══════════════════════════════════════════════════════════

let currentLayout = gm.getValue("gwd_layout_style", "split")
let showAbsolute = gm.getValue("gwd_show_absolute", false)
let dateFormat = gm.getValue("gwd_date_format", "yyyy-mm-dd")
let autoThreadSync = gm.getValue("gwd_auto_thread_sync", true)
let isMenuExpanded = gm.getValue("gwd_menu_expanded", false)

let menuIds = []

function getMenuText(key) {
	const dict = {
		settingsToggle: `⚙️ Sidebar Date Settings (${isMenuExpanded ? "Click to collapse ⬆️" : "Click to expand ⬇️"})`,
		layout: ` ├─ 📐 Layout: ${currentLayout === "split" ? "Right (Click → Below title)" : "Below title (Click → Right)"}`,
		absolute: ` ├─ ⏰ Detailed Time: ${showAbsolute ? "Visible (Click → Hide)" : "Hidden (Click → Show)"}`,
		format: ` ├─ 📅 Date Format: ${dateFormat === "yyyy-mm-dd" ? "YYYY-MM-DD (Click → MM/DD/YYYY)" : "MM/DD/YYYY (Click → YYYY-MM-DD)"}`,
		sync: ` └─ 🔄 Auto Thread Sync: ${autoThreadSync ? "Enabled (Click → Disable)" : "Disabled (Click → Enable)"}`,
	}
	return dict[key] || ""
}

function refreshMenu() {
	menuIds.forEach((id) => gm.unregisterMenuCommand(id))
	menuIds = []
	const opts = { autoClose: false }

	const idToggle = gm.registerMenuCommand(
		getMenuText("settingsToggle"),
		() => {
			isMenuExpanded = !isMenuExpanded
			gm.setValue("gwd_menu_expanded", isMenuExpanded)
			refreshMenu()
		},
		opts,
	)
	if (idToggle) menuIds.push(idToggle)

	if (isMenuExpanded) {
		const idLayout = gm.registerMenuCommand(
			getMenuText("layout"),
			() => {
				currentLayout = currentLayout === "classic" ? "split" : "classic"
				gm.setValue("gwd_layout_style", currentLayout)
				clearAndReRenderSidebar()
				refreshMenu()
			},
			opts,
		)
		if (idLayout) menuIds.push(idLayout)

		const idAbsolute = gm.registerMenuCommand(
			getMenuText("absolute"),
			() => {
				showAbsolute = !showAbsolute
				gm.setValue("gwd_show_absolute", showAbsolute)
				clearAndReRenderSidebar()
				refreshMenu()
			},
			opts,
		)
		if (idAbsolute) menuIds.push(idAbsolute)

		const idFormat = gm.registerMenuCommand(
			getMenuText("format"),
			() => {
				dateFormat =
					dateFormat === "yyyy-mm-dd" ? "mm/dd/yyyy" : "yyyy-mm-dd"
				gm.setValue("gwd_date_format", dateFormat)
				clearAndReRenderSidebar()
				refreshMenu()
			},
			opts,
		)
		if (idFormat) menuIds.push(idFormat)

		const idSync = gm.registerMenuCommand(
			getMenuText("sync"),
			() => {
				autoThreadSync = !autoThreadSync
				gm.setValue("gwd_auto_thread_sync", autoThreadSync)
				refreshMenu()
			},
			opts,
		)
		if (idSync) menuIds.push(idSync)
	}
}

refreshMenu()

const conversationDates = new Map()

function extractSidebarTimestamps(text) {
	if (!text) return
	const blocks = text.split('"c_')
	let found = false
	for (let i = 1; i < blocks.length; i++) {
		const idMatch = blocks[i].match(/^([a-zA-Z0-9_-]+)/)
		if (!idMatch) continue
		const id = idMatch[1]
		const tsMatch = blocks[i].match(/\[(\d{10}),/)
		if (tsMatch && !conversationDates.has(id)) {
			conversationDates.set(id, parseInt(tsMatch[1], 10))
			found = true
		}
	}
	if (found) {
		console.log(`[GMT] sidebar: ${conversationDates.size} conversation dates`)
		updateSidebarDOM()
	}
}

function formatAbsoluteTime(d) {
	const yyyy = d.getFullYear()
	const MM = String(d.getMonth() + 1).padStart(2, "0")
	const dd = String(d.getDate()).padStart(2, "0")
	const min = String(d.getMinutes()).padStart(2, "0")
	if (dateFormat === "mm/dd/yyyy") {
		const h12 = d.getHours() % 12 || 12
		const ampm = d.getHours() >= 12 ? "PM" : "AM"
		return `${MM}/${dd}/${yyyy} ${h12}:${min} ${ampm}`
	}
	return `${yyyy}-${MM}-${dd} ${String(d.getHours()).padStart(2, "0")}:${min}`
}

function clearAndReRenderSidebar() {
	document
		.querySelectorAll(".gwd-sidebar-date-wrapper")
		.forEach((el) => el.remove())
	document
		.querySelectorAll('a[data-test-id="conversation"]')
		.forEach((item) => {
			item.removeAttribute("data-date-injected")
			item.classList.remove("gwd-split-mode")
			const title = item.querySelector(".conversation-title")
			if (title) title.style.paddingRight = ""
		})
	updateSidebarDOM()
}

function updateSidebarDOM() {
	if (!document.body) return
	const currentPath = window.location.pathname

	document
		.querySelectorAll('a[data-test-id="conversation"]')
		.forEach((item) => {
			const href = item.getAttribute("href")
			item.classList.toggle("gwd-is-active", href === currentPath)

			// Suppress Gemini's native Angular tooltip on the item itself
			if (!item.hasAttribute("data-gwd-hover-bound")) {
				const blockNative = (e) => e.stopImmediatePropagation()
				item.addEventListener("mouseover", blockNative, true)
				item.addEventListener(
					"mouseenter",
					() => item.removeAttribute("mattooltip"),
					true,
				)
				item.setAttribute("data-gwd-hover-bound", "true")
			}

			if (item.hasAttribute("data-date-injected")) return
			if (!href) return

			const idMatch = href.match(/\/app\/([a-zA-Z0-9_-]+)/)
			if (!idMatch || !conversationDates.has(idMatch[1])) return

			const id = idMatch[1]
			const d = new Date(conversationDates.get(id) * 1000)
			const ts = conversationDates.get(id)
			const rel = getRelativeDateLabel(ts, true)
			const abs = formatAbsoluteTime(d)
			const titleContainer = item.querySelector(".conversation-title")

			item.style.position = "relative"
			const wrapper = document.createElement("div")
			wrapper.className = "gwd-sidebar-date-wrapper"

			// Tooltip is bound to the wrapper only — not the whole item
			wrapper.style.cursor = "default"
			wrapper.addEventListener("mouseenter", (e) => {
				clearTimeout(tooltipTimer)
				tooltipTimer = setTimeout(
					() => showTooltip(e, formatFullDateTime(d)),
					100,
				)
			})
			wrapper.addEventListener("mousemove", positionTooltip)
			wrapper.addEventListener("mouseleave", () => {
				clearTimeout(tooltipTimer)
				hideTooltip()
			})

			if (currentLayout === "classic") {
				wrapper.style.cssText = `
          font-size: 11px;
          font-family: ${FONT};
          color: var(--gmpx-color-on-surface-variant, #888);
          line-height: 1.2;
          font-weight: normal;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: default;
        `
				wrapper.textContent = showAbsolute ? `${rel} · ${abs}` : rel
				if (titleContainer) titleContainer.appendChild(wrapper)
			} else {
				item.classList.add("gwd-split-mode")
				wrapper.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          flex-shrink: 0;
          margin-left: auto;
          padding-left: 8px;
          cursor: default;
        `
				const relDiv = document.createElement("div")
				relDiv.textContent = rel
				relDiv.style.cssText = `
          font-size: 13px;
          font-weight: 500;
          font-family: ${FONT};
          color: var(--gmpx-color-on-surface-variant, #888);
          line-height: 1.2;
          pointer-events: none;
        `
				wrapper.appendChild(relDiv)

				if (showAbsolute) {
					const absDiv = document.createElement("div")
					absDiv.textContent = abs
					absDiv.style.cssText = `
            position: absolute;
            bottom: -6px;
            left: 14px;
            font-size: 11px;
            font-family: ${FONT};
            font-weight: var(--gem-sys-typography-type-scale--label-l-font-weight);
            letter-spacing: var(--gem-sys-typography-type-scale--label-l-font-tracking);
            line-height: var(--gem-sys-typography-type-scale--label-l-line-height);
            color: var(--gmpx-color-on-surface-variant, #888);
            white-space: nowrap;
            pointer-events: none;
          `
					wrapper.appendChild(absDiv)
				}

				const trailingIcon = item.querySelector(".trailing-icon-container")
				if (trailingIcon) item.insertBefore(wrapper, trailingIcon)
				else item.appendChild(wrapper)
			}

			item.setAttribute("data-date-injected", "true")
		})
}
