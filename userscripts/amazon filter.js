// ==UserScript==
// @name        Amazon Filter
// @description Filter products on amazon.ca searches
// @match       https://www.amazon.ca/s*
// @version     1.3
// @grant       none
// ==/UserScript==

let observer

const RESULT_SELECTOR =
	'div[role="listitem"][data-component-type="s-search-result"][data-asin]:not([data-asin=""])'

function addFilterInput() {
	const targetDiv = document.getElementById("s-skipLinkTargetForMainSearchResults")
	if (!targetDiv) {
		setTimeout(addFilterInput, 500)
		return
	}

	if (document.getElementById("amazon-filter-input")) return

	const filterContainer = document.createElement("div")
	filterContainer.style.display = "flex"
	filterContainer.style.flexDirection = "column"
	filterContainer.style.gap = "8px"
	filterContainer.style.margin = "10px 0"

	const rowStyle = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }

	const excludeRow = document.createElement("div")
	Object.assign(excludeRow.style, rowStyle)

	const filterInput = document.createElement("input")
	filterInput.type = "text"
	filterInput.id = "amazon-filter-input"
	filterInput.placeholder = "Exclude if title contains (comma-separated)"
	filterInput.style.width = "300px"
	filterInput.style.padding = "5px"

	const excludeLabel = document.createElement("label")
	excludeLabel.htmlFor = "amazon-filter-input"
	excludeLabel.textContent = "Hide:"
	excludeLabel.style.fontWeight = "600"

	excludeRow.appendChild(excludeLabel)
	excludeRow.appendChild(filterInput)

	const mustRow = document.createElement("div")
	Object.assign(mustRow.style, rowStyle)

	const mustInput = document.createElement("input")
	mustInput.type = "text"
	mustInput.id = "amazon-must-have-input"
	mustInput.placeholder = 'Must include (AND / OR), e.g. usb AND c OR hdmi'
	mustInput.style.width = "420px"
	mustInput.style.padding = "5px"

	const mustLabel = document.createElement("label")
	mustLabel.htmlFor = "amazon-must-have-input"
	mustLabel.textContent = "Require:"
	mustLabel.style.fontWeight = "600"

	mustRow.appendChild(mustLabel)
	mustRow.appendChild(mustInput)

	const filterCount = document.createElement("span")
	filterCount.id = "amazon-filter-count"

	filterContainer.appendChild(excludeRow)
	filterContainer.appendChild(mustRow)
	filterContainer.appendChild(filterCount)
	targetDiv.parentNode.insertBefore(filterContainer, targetDiv)

	const runFilters = () => applyAmazonFilters()

	filterInput.addEventListener("input", runFilters)
	mustInput.addEventListener("input", runFilters)

	setupObserver()
}

function getSearchResultCards() {
	return [...document.querySelectorAll(RESULT_SELECTOR)]
}

/** Product title h2>span in title-recipe (not brand line h2.a-size-mini). */
function getCardTitle(card) {
	const titleRecipe = card.querySelector('[data-cy="title-recipe"]')
	const root = titleRecipe || card

	const linkTitleSpan = root.querySelector(
		"a.s-line-clamp-2 h2 span, a.s-link-style h2 span",
	)
	if (linkTitleSpan?.textContent?.trim()) {
		return normalizeTitleText(linkTitleSpan.textContent)
	}

	const productH2 = root.querySelector(
		"h2.a-text-normal span, h2.a-size-base-plus.a-spacing-none span, h2.a-color-base.a-text-normal span",
	)
	if (productH2?.textContent?.trim()) {
		return normalizeTitleText(productH2.textContent)
	}

	for (const h2 of root.querySelectorAll("h2[aria-label]")) {
		if (h2.classList.contains("a-size-mini")) continue
		const span = h2.querySelector("span")
		const raw =
			span?.textContent?.trim() || h2.getAttribute("aria-label")?.trim() || ""
		if (raw) return normalizeTitleText(raw)
	}

	return ""
}

function normalizeTitleText(text) {
	return text.replace(/\s+/g, " ").trim().toLowerCase()
}

function makeTermRegex(term) {
	term = term.trim()
	if (!term) return null

	// Check if it is a regex literal (e.g. /pattern/flags)
	if (term.startsWith("/") && term.lastIndexOf("/") > 0) {
		const lastSlash = term.lastIndexOf("/")
		const pattern = term.substring(1, lastSlash)
		const flags = term.substring(lastSlash + 1)
		try {
			return new RegExp(pattern, flags)
		} catch (e) {
			// Fallback to literal
		}
	}

	const lowerTerm = term.toLowerCase()
	const startsWithWildcard = lowerTerm.startsWith("*")
	const endsWithWildcard = lowerTerm.endsWith("*")

	let coreTerm = lowerTerm
	if (startsWithWildcard) coreTerm = coreTerm.slice(1)
	if (endsWithWildcard) coreTerm = coreTerm.slice(0, -1)

	// Escape regex special characters in coreTerm
	const escaped = coreTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')

	const startBoundary = startsWithWildcard ? "" : "\\b"
	const endBoundary = endsWithWildcard ? "" : "\\b"

	return new RegExp(startBoundary + escaped + endBoundary)
}

function matchTerm(title, term) {
	const regex = makeTermRegex(term)
	if (!regex) return false
	return regex.test(title)
}

/** OR of AND-clauses; AND binds tighter. Plain text (no AND/OR) = single phrase match. */
function titleMatchesMustHave(title, expression) {
	const expr = expression.trim()
	if (!expr) return true

	if (!/\s+(?:and|or)\s+/i.test(expr)) {
		return matchTerm(title, expr)
	}

	const orClauses = expr
		.split(/\s+or\s+/i)
		.map((s) => s.trim())
		.filter(Boolean)

	return orClauses.some((clause) => {
		const andTerms = clause
			.split(/\s+and\s+/i)
			.map((s) => s.trim())
			.filter(Boolean)
		return andTerms.length > 0 && andTerms.every((term) => matchTerm(title, term))
	})
}

function parseExcludeTerms(filterString) {
	return filterString
		.split(",")
		.map((term) => term.trim())
		.filter((term) => term !== "")
}

function setCardVisible(card, visible) {
	if (visible) {
		card.style.removeProperty("display")
	} else {
		card.style.display = "none"
	}
}

function applyAmazonFilters() {
	const excludeInput = document.getElementById("amazon-filter-input")
	const mustInput = document.getElementById("amazon-must-have-input")
	const excludeString = excludeInput?.value ?? ""
	const mustString = mustInput?.value ?? ""

	const excludeTerms = parseExcludeTerms(excludeString)
	const mustActive = mustString.trim() !== ""
	const excludeActive = excludeTerms.length > 0
	const productCards = getSearchResultCards()

	let hiddenCount = 0
	productCards.forEach((card) => {
		const title = getCardTitle(card)

		if (!excludeActive && !mustActive) {
			setCardVisible(card, true)
			return
		}

		if (!title) {
			setCardVisible(card, true)
			return
		}

		const excluded = excludeTerms.some((term) => matchTerm(title, term))
		const missingRequired = mustActive && !titleMatchesMustHave(title, mustString)
		const hide = excluded || missingRequired

		setCardVisible(card, !hide)
		if (hide) hiddenCount++
	})

	updateFilterCount(hiddenCount)
}

function updateFilterCount(count) {
	const filterCount = document.getElementById("amazon-filter-count")
	if (filterCount) {
		filterCount.textContent =
			count > 0 ? `${count} result${count !== 1 ? "s" : ""} hidden` : ""
	}
}

function setupObserver() {
	const targetNode = document.querySelector("div.s-main-slot")
	if (!targetNode) {
		setTimeout(setupObserver, 500)
		return
	}

	const config = { childList: true, subtree: true }

	const callback = function () {
		const excludeInput = document.getElementById("amazon-filter-input")
		const mustInput = document.getElementById("amazon-must-have-input")
		if (
			(excludeInput && excludeInput.value) ||
			(mustInput && mustInput.value.trim())
		) {
			applyAmazonFilters()
		}
	}

	if (observer) {
		observer.disconnect()
	}
	observer = new MutationObserver(callback)
	observer.observe(targetNode, config)
}

addFilterInput()
