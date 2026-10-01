// ==UserScript==
// @name         forall x: Calgary — readable text width
// @namespace    Matt's userscripts
// @version      1.0.0
// @description  Keeps chapter text at a comfortable maximum width on forall x: Calgary.
// @match        https://forallx.openlogicproject.org/html/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

;(() => {
	"use strict"

	const styleId = "forallx-readable-width-style"
	if (document.getElementById(styleId)) return

	const style = document.createElement("style")
	style.id = styleId
	style.textContent = `
		/* Keep the chapter aligned to a reading column, with generous room around wide tables. */
		#bml-main-content {
			box-sizing: border-box;
			width: 100%;
			padding-inline: clamp(2rem, 5vw, 4rem);
			margin-inline: auto;
			--reading-width: 72rem;
			--table-width: min(90rem, calc(100vw - 12rem));
		}

		#bml-main-content :is(
			.ltx_para > p.ltx_p,
			ol.ltx_enumerate,
			ul.ltx_itemize,
			dl.ltx_description,
			.ltx_logical-block,
			.ltx_equation,
			.ltx_figure,
			.ltx_listing
		) {
			box-sizing: border-box;
			width: 100%;
			max-width: var(--reading-width);
			margin-inline: auto;
		}

		/* Some generated h2 headings are styled as inline run-in titles by the book theme. */
		#bml-main-content :is(h1.ltx_title, h2.ltx_title, h3.ltx_title, h4.ltx_title, h5.ltx_title, h6.ltx_title) {
			box-sizing: border-box;
			display: block;
			width: 100%;
			max-width: var(--reading-width);
			margin-inline: auto;
		}

		#bml-main-content :is(ol.ltx_enumerate, ul.ltx_itemize) {
			box-sizing: border-box;
			width: min(100%, var(--reading-width));
			max-width: var(--reading-width);
			margin-inline: auto;
		}

		/* LaTeXML makes the first paragraph in each list item inline by default. */
		#bml-main-content .ltx_item .ltx_para > p.ltx_p {
			display: block;
			width: 100%;
			max-width: none;
			margin-inline: 0;
		}

		#bml-main-content .bml-overflow-wrapper {
			max-width: 100%;
			margin-inline: auto;
		}

		/* Tables size to their contents, growing past the text measure when useful. */
		#bml-main-content .bml-overflow-wrapper:has(> table.ltx_tabular) {
			box-sizing: border-box;
			width: max-content;
			max-width: var(--table-width);
			margin-inline: auto;
			overflow: auto;
		}

		@media (max-width: 1200px) {
			#bml-main-content {
				padding-inline: 3rem;
				--table-width: min(90rem, calc(100vw - 10rem));
			}
		}

		@media (max-width: 700px) {
			#bml-main-content {
				padding-inline: 1rem;
				--table-width: calc(100vw - 4rem);
			}
		}
	`
	document.head.appendChild(style)
})()
