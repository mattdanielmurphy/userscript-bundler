// ==UserScript==
// @name        Amazon Filter
// @description Filter products on amazon.ca searches
// @match       https://www.amazon.ca/s*
// @version     1.0
// @grant       none
// ==/UserScript==

let observer

function addFilterInput() {
	const targetDiv = document.getElementById("s-skipLinkTargetForMainSearchResults")
	if (!targetDiv) {
		// If target div isn't found, retry after a short delay
		setTimeout(addFilterInput, 500)
		return
	}

	if (document.getElementById("amazon-filter-input")) return

	const filterContainer = document.createElement("div")
	filterContainer.style.display = "flex"
	filterContainer.style.alignItems = "center"
	filterContainer.style.margin = "10px 0"

	const filterInput = document.createElement("input")
	filterInput.type = "text"
	filterInput.id = "amazon-filter-input"
	filterInput.placeholder = "Enter filter terms (comma-separated)"
	filterInput.style.width = "300px"
	filterInput.style.padding = "5px"
	filterInput.style.marginRight = "10px"

	const filterCount = document.createElement("span")
	filterCount.id = "amazon-filter-count"

	filterContainer.appendChild(filterInput)
	filterContainer.appendChild(filterCount)
	targetDiv.parentNode.insertBefore(filterContainer, targetDiv)

	filterInput.addEventListener("input", () => {
		filterAmazonResults(filterInput.value)
	})

	// Set up the observer for dynamically added content
	setupObserver()
}

function filterAmazonResults(filterString) {
	const filterTerms = filterString
		.split(",")
		.map((term) => term.trim().toLowerCase())
		.filter((term) => term !== "")

	// Update selector to match current Amazon structure
	const productCards = document.querySelectorAll("div[data-asin]")
	console.log("Found products:", productCards.length) // Debug logging
	
	let filteredCount = 0
	const productTitles = []
	productCards.forEach((card) => {
		// Update selector to match current title structure
		const titleElement = card.querySelector("h2 span")
		if (titleElement) {
			const title = titleElement.textContent.toLowerCase()
			productTitles.push(title)
			const shouldFilter = filterTerms.some((term) => title.includes(term))
			if (shouldFilter) {
				card.style.display = "none"
				filteredCount++
			} else {
				card.style.display = "block"
			}
		}
	})

	window.logProducts = () => {
		console.log(productTitles)
	}

	updateFilterCount(filteredCount)
}

function updateFilterCount(count) {
	const filterCount = document.getElementById("amazon-filter-count")
	if (filterCount) {
		filterCount.textContent = count > 0 ? `${count} result${count !== 1 ? "s" : ""} filtered out` : ""
	}
}

function setupObserver() {
	// Update selector to match current structure
	const targetNode = document.querySelector("div.s-main-slot")
	if (!targetNode) {
		// If target node isn't found, retry after a short delay
		setTimeout(setupObserver, 500)
		return
	}

	const config = { childList: true, subtree: true }

	const callback = function (mutationsList, observer) {
		for (let mutation of mutationsList) {
			if (mutation.type === "childList") {
				const filterInput = document.getElementById("amazon-filter-input")
				if (filterInput && filterInput.value) {
					filterAmazonResults(filterInput.value)
				}
			}
		}
	}

	if (observer) {
		observer.disconnect()
	}
	observer = new MutationObserver(callback)
	observer.observe(targetNode, config)
}

// Run the script immediately instead of waiting for DOMContentLoaded
addFilterInput()
