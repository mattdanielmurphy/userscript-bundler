// ═══════════════════════════════════════════════════════════
// PROMPT TIMESTAMP PREPEND & PROMPT TOOLS UI
// ═══════════════════════════════════════════════════════════

function getNowTimestamp() {
	const now = new Date()
	const date = now.toLocaleDateString("en-CA")
	const hh = String(now.getHours()).padStart(2, "0")
	const mm = String(now.getMinutes()).padStart(2, "0")
	const tz = getLocalTzAbbr()
	const off = getLocalTzOffsetHours()
	return `[${date} ${hh}:${mm} ${tz}${off >= 0 ? "+" + off : off}]`
}

function getSendButton(target) {
	if (!target) return null
	const btn = target.closest("button")
	if (!btn) return null
	const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase()
	const title = (btn.getAttribute("title") || "").toLowerCase()
	const dataTestId = (
		btn.getAttribute("data-test-id") ||
		btn.getAttribute("data-testid") ||
		""
	).toLowerCase()
	const hasSendClass = Array.from(btn.classList).some(
		(c) =>
			c.toLowerCase().includes("send") || c.toLowerCase().includes("submit"),
	)

	if (
		ariaLabel.includes("send") ||
		ariaLabel.includes("submit") ||
		title.includes("send") ||
		title.includes("submit") ||
		dataTestId.includes("send") ||
		dataTestId.includes("submit") ||
		hasSendClass ||
		btn.querySelector(
			'mat-icon[fonticon="send"], mat-icon[fonticon="arrow_upward"], mat-icon[data-mat-icon-name="send"], mat-icon[data-mat-icon-name="arrow_upward"]',
		)
	) {
		return btn
	}
	return null
}

// Predefined phase prompts
const PHASE_PROMPTS = [
	"Act as a technical sounding board. I have an idea for a new feature/project, and we need to brainstorm. \n\nDo not try to build it, write code, or structure a final plan yet. Your goal is to help me explore the edges of this idea. Ask me clarifying questions about the core problem, the ideal user experience, and potential pitfalls. Let's keep the conversation fluid and conceptual until I tell you we are ready to lock in a plan.\n\nHere is my initial thought: ",
	"Act as a Product Manager. We are closing the brainstorming phase. Synthesize our agreed-upon concept into a strict High-Level Plan outlining what this feature DOES and the exact user experience. \n\nStrictly avoid discussing how it is built under the hood. Structure your response using this exact framework:\n1. The Trigger: How the user or system initiates the action.\n2. The Staging Area: The intermediate UI, choices, or routing that happens before execution.\n3. Task Configuration: The rules, modes, or constraints applied to the task.\n4. Execution & Feedback: What happens during the process and how the user knows it finished.",
	"Act as a Systems Architect. Translate our approved High-Level Plan into a Lower-Level Technical Plan. \n\nFocus on the plumbing and architecture. You may include hyper-specific, uncommon code snippets if they are necessary to illustrate an architectural choice (e.g., a specific Rust/Tauri bridge implementation or complex API endpoint), but do not write the standard implementation logic.\n\nBreak down the architecture into:\n1. Tech Stack & CLI Tools: Required packages or background processes.\n2. Component Bridge: How the layers communicate (e.g., file watchers, HTTP, standard I/O).\n3. State & Context Management: Where temporary data or files live during execution.\n4. Technical Bottlenecks: Highlight 2-3 edge cases or potential fail states to watch out for.",
	"Act as a Prompt Engineer. We are ready to execute. Take the High-Level Plan and the Lower-Level Technical Plan and generate a strict, optimized instruction set for a local autonomous AI agent.\n\nOutput the final instructions inside a single code block formatted like this:\n```claude-instruction\n[Instructions here]\n```\n\nThe instructions must include:\n- The target context or directory behavior.\n- Strict constraints for the task (e.g., required logging formats, restricted commands).\n- A definitive, step-by-step implementation checklist.\n\nDo not include any conversational filler before or after the code block.",
]

let currentPhase = null
let localSkills = []

function fetchSkills() {
	// Local skills came from the retired backend. Keep the phase prompts only.
	localSkills = []
}
fetchSkills()

function replaceEditorContent(editor, newText) {
	editor.focus()
	document.execCommand("selectAll", false, null)
	document.execCommand("insertText", false, newText)
}

function processCommandReplacement(editor) {
	const currentText = editor.innerText || ""
	let newText = currentText.trim()
	let replaced = false

	const phaseSkills = [
		{ name: "phase0", prompt: PHASE_PROMPTS[0] },
		{ name: "phase1", prompt: PHASE_PROMPTS[1] },
		{ name: "phase2", prompt: PHASE_PROMPTS[2] },
		{ name: "phase3", prompt: PHASE_PROMPTS[3] },
	]
	const allOptions = [...phaseSkills, ...localSkills]

	allOptions.forEach((s) => {
		const pattern = new RegExp("\\/" + s.name + "\\b", "g")
		if (pattern.test(newText)) {
			newText = newText.replace(pattern, s.prompt)
			replaced = true
		}
	})

	if (replaced) {
		replaceEditorContent(editor, newText)
	}
}

let isPrependingPrompt = false

function hasAlreadyPrepended(text) {
	if (!text) return false
	return (
		text.includes("[SYSTEM CONTEXT & DIRECTIVES:") ||
		text.includes("[context to this point is") ||
		EMBED_RE.test(text)
	)
}

document.addEventListener(
	"click",
	function (e) {
		if (e.isTrusted === false) return
		if (isPrependingPrompt) return

		const btn = getSendButton(e.target)
		if (!btn) return
		const editor = document.querySelector(
			'.ql-editor[contenteditable="true"]',
		)
		if (!editor) return

		// Avoid the read-replace cycle that can double newlines in contenteditable
		let currentText = editor.innerText || ""
		if (!currentText.trim() || hasAlreadyPrepended(currentText)) return

		isPrependingPrompt = true
		setTimeout(() => {
			isPrependingPrompt = false
		}, 500)

		e.stopImmediatePropagation()
		e.preventDefault()

		// Run decoy/replacement substitution
		processCommandReplacement(editor)

		// Prepend timestamp by moving cursor to start and inserting text
		editor.focus()
		const sel = window.getSelection()
		const range = document.createRange()
		range.setStart(editor, 0)
		range.collapse(true)
		sel.removeAllRanges()
		sel.addRange(range)

		const tokenUsage = calculateThreadTokens()
		const tokenStr = tokenUsage.isPrecise ? tokenUsage.total : "*"
		const timestamp = `${getNowTimestamp()} [context to this point is ${tokenStr}] `

		// Dynamic New Thread Instruction Injection
		const userMessages = document.querySelectorAll("user-query, .user-query, [data-test-id='user-query']")
		const isNewThread = userMessages.length === 0

		let systemPrefix = ""
		if (isNewThread) {
			systemPrefix = `[SYSTEM CONTEXT & DIRECTIVES:
1. Primary User Vault: /Users/matt/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal/
2. Strict Media & Story Spoilers Directive: STRICT NO SPOILERS POLICY. You MUST NOT under any circumstances reveal plot twists, endings, key character fates, deaths, betrayals, secret identities, major narrative developments, or unreleased details for movies, TV shows, books, anime, games, or story-driven media. If asked about media, err heavily on the side of caution. Give zero hints or foreshadowing of major events unless the user explicitly requests spoilers with confirmation.
3. Tone, Sycophancy & Banned Buzzwords: No sycophantic praise or routine filler ("that's very insightful", "great question", "I understand..."). NEVER use banned buzzwords: "glitch in the matrix", "nuclear option", "final boss", "game changer", "level up", "cheat code", "you've hit on", "unlocking the potential".
4. Note-Taking Directive: When asked to "make a note about this" OR if we discuss anything interesting or ideas about future projects, you MUST proactively output a JSON tool call to save it as a note, or update an existing note. The JSON must be inside a \`\`\`tool_call codeblock. Schema: {"tool":"save_note","args":{"title":"Note Title","content":"Markdown content...","update":false}}. The userscript will execute this automatically and save it to Development/Project Notes/.
5. Fact-Checking Directive: When asked to verify/fact-check claims, perform Information Sufficiency Check, Source & Context Audit, and define Explicit Assumptions & Boundaries.
6. Local Environment & Tooling Rules: Default JS package manager is Bun (never npm/pnpm). Use ./tmp for local script files. Safe file removal via mv ~/.Trash/ (never rm).
7. No YouTube links in responses.]\n\n`
		}

		document.execCommand("insertText", false, systemPrefix + timestamp)
		console.log(`[GMT] prepended (isNewThread=${isNewThread}): "${systemPrefix + timestamp}"`)

		// Re-trigger click after a short delay
		setTimeout(() => {
			const freshBtn = getSendButton(e.target) || btn
			if (freshBtn) freshBtn.click()
		}, 80)
	},
	true,
)

document.addEventListener(
	"keydown",
	function (e) {
		if (e.isTrusted === false) return
		if (isPrependingPrompt) return

		if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)
			return

		const editor = e.target.closest('.ql-editor[contenteditable="true"]')
		if (!editor) return

		// If autocomplete menu is open, handle autocomplete keys instead
		if (autocompleteMenu && autocompleteMenu.style.display === "block") {
			return // Let autocomplete's keydown listener handle it
		}

		const currentText = editor.innerText || ""
		if (!currentText.trim() || hasAlreadyPrepended(currentText)) return

		isPrependingPrompt = true
		setTimeout(() => {
			isPrependingPrompt = false
		}, 500)

		e.stopImmediatePropagation()
		e.preventDefault()

		// Run decoy/replacement substitution
		processCommandReplacement(editor)

		// Prepend timestamp
		editor.focus()
		const sel = window.getSelection()
		const range = document.createRange()
		range.setStart(editor, 0)
		range.collapse(true)
		sel.removeAllRanges()
		sel.addRange(range)

		const tokenUsage = calculateThreadTokens()
		const tokenStr = tokenUsage.isPrecise ? tokenUsage.total : "*"
		const timestamp = `${getNowTimestamp()} [context to this point is ${tokenStr}] `

		// Dynamic New Thread Instruction Injection
		const userMessages = document.querySelectorAll("user-query, .user-query, [data-test-id='user-query']")
		const isNewThread = userMessages.length === 0

		let systemPrefix = ""
		if (isNewThread) {
			systemPrefix = `[SYSTEM CONTEXT & DIRECTIVES:
1. Primary User Vault: /Users/matt/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal/
2. Strict Media & Story Spoilers Directive: STRICT NO SPOILERS POLICY. You MUST NOT under any circumstances reveal plot twists, endings, key character fates, deaths, betrayals, secret identities, major narrative developments, or unreleased details for movies, TV shows, books, anime, games, or story-driven media. If asked about media, err heavily on the side of caution. Give zero hints or foreshadowing of major events unless the user explicitly requests spoilers with confirmation.
3. Tone, Sycophancy & Banned Buzzwords: No sycophantic praise or routine filler ("that's very insightful", "great question", "I understand..."). NEVER use banned buzzwords: "glitch in the matrix", "nuclear option", "final boss", "game changer", "level up", "cheat code", "you've hit on", "unlocking the potential".
4. Note-Taking Directive: When asked to "make a note about this" OR if we discuss anything interesting or ideas about future projects, you MUST proactively output a JSON tool call to save it as a note, or update an existing note. The JSON must be inside a \`\`\`tool_call codeblock. Schema: {"tool":"save_note","args":{"title":"Note Title","content":"Markdown content...","update":false}}. The userscript will execute this automatically and save it to Development/Project Notes/.
5. Fact-Checking Directive: When asked to verify/fact-check claims, perform Information Sufficiency Check, Source & Context Audit, and define Explicit Assumptions & Boundaries.
6. Local Environment & Tooling Rules: Default JS package manager is Bun (never npm/pnpm). Use ./tmp for local script files. Safe file removal via mv ~/.Trash/ (never rm).
7. No YouTube links in responses.]\n\n`
		}

		document.execCommand("insertText", false, systemPrefix + timestamp)
		console.log(`[GMT] keydown prepended (isNewThread=${isNewThread}): "${systemPrefix + timestamp}"`)

		// Dispatch enter key to trigger angular submission
		setTimeout(() => {
			const event = new KeyboardEvent("keydown", {
				key: "Enter",
				code: "Enter",
				keyCode: 13,
				which: 13,
				bubbles: true,
				cancelable: true,
			})
			editor.dispatchEvent(event)
		}, 80)
	},
	true,
)

function isDarkTheme() {
	return (
		document.body.classList.contains("dark-theme") ||
		document.documentElement.classList.contains("dark-theme") ||
		window.matchMedia("(prefers-color-scheme: dark)").matches
	)
}

// Inject Styles for AI-OS custom dropdowns, executor button, and phase dropdown trigger
const aiosStyle = document.createElement("style")
aiosStyle.textContent = `
    /* Unified Dropdown Style (Matches Gemini Dropdown) */
    .aios-dropdown {
        position: absolute;
        background: #ffffff !important;
        border-radius: 16px !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.04) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
        z-index: 999999 !important;
        padding: 8px 0 !important;
        min-width: 260px !important;
        box-sizing: border-box !important;
        font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
        display: none;
    }
    
    .aios-dark .aios-dropdown,
    .dark-theme .aios-dropdown,
    .dark-theme-active .aios-dropdown {
        background: #1e1f20 !important;
        border-color: rgba(255, 255, 255, 0.08) !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
    }
    
    @media (prefers-color-scheme: dark) {
        .aios-dropdown {
            background: #1e1f20 !important;
            border-color: rgba(255, 255, 255, 0.08) !important;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
        }
    }

    .aios-dropdown-item {
        display: flex !important;
        align-items: center !important;
        padding: 10px 16px !important;
        cursor: pointer !important;
        transition: background-color 0.15s ease !important;
        box-sizing: border-box !important;
        gap: 12px !important;
        text-align: left !important;
        user-select: none !important;
    }

    .aios-dropdown-item:hover {
        background-color: #f0f4f9 !important;
    }
    
    .aios-dark .aios-dropdown-item:hover,
    .dark-theme .aios-dropdown-item:hover,
    .dark-theme-active .aios-dropdown-item:hover {
        background-color: #2d2f31 !important;
    }
    
    @media (prefers-color-scheme: dark) {
        .aios-dropdown-item:hover {
            background-color: #2d2f31 !important;
        }
    }

    .aios-dropdown-checkmark {
        width: 16px !important;
        height: 16px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 14px !important;
        font-weight: bold !important;
        color: #1a73e8 !important;
        visibility: hidden !important;
    }
    
    .aios-dropdown-item.active .aios-dropdown-checkmark {
        visibility: visible !important;
    }

    .aios-dropdown-content {
        display: flex !important;
        flex-direction: column !important;
        flex-grow: 1 !important;
    }

    .aios-dropdown-name {
        font-size: 14px !important;
        font-weight: 500 !important;
        color: #1f1f1f !important;
        line-height: 1.4 !important;
        font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
    }
    
    .aios-dark .aios-dropdown-name,
    .dark-theme .aios-dropdown-name,
    .dark-theme-active .aios-dropdown-name {
        color: #e3e3e3 !important;
    }
    
    @media (prefers-color-scheme: dark) {
        .aios-dropdown-name {
            color: #e3e3e3 !important;
        }
    }

    .aios-dropdown-desc {
        font-size: 11px !important;
        color: #5f6368 !important;
        margin-top: 2px !important;
        line-height: 1.4 !important;
        font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
    }
    
    .aios-dark .aios-dropdown-desc,
    .dark-theme .aios-dropdown-desc,
    .dark-theme-active .aios-dropdown-desc {
        color: #c4c7c5 !important;
    }
    
    @media (prefers-color-scheme: dark) {
        .aios-dropdown-desc {
            color: #c4c7c5 !important;
        }
    }

    /* Container for Phase and Model selects */
    .pill-ui-logo-container.under-input {
        flex-direction: row !important;
        align-items: center !important;
    }

    /* Phase selector trigger pill */
    .aios-phase-select-btn {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 6px 14px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        color: #1f1f1f !important;
        background: #f0f4f9 !important;
        border: 1px solid transparent !important;
        border-radius: 16px !important;
        cursor: pointer !important;
        transition: background-color 0.2s, border-color 0.2s !important;
        font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
        margin-right: 8px !important;
        margin-bottom: 0 !important;
        height: 40px !important;
        box-sizing: border-box !important;
        outline: none !important;
    }
    .aios-phase-select-btn:hover {
        background: #e1e7ef !important;
    }
    
    .dark-theme .aios-phase-select-btn,
    .dark-theme-active .aios-phase-select-btn {
        color: #e3e3e3 !important;
        background: #2e2f33 !important;
    }
    .dark-theme .aios-phase-select-btn:hover,
    .dark-theme-active .aios-phase-select-btn:hover {
        background: #3e3f43 !important;
    }
    
    @media (prefers-color-scheme: dark) {
        .aios-phase-select-btn {
            color: #e3e3e3 !important;
            background: #2e2f33 !important;
        }
        .aios-phase-select-btn:hover {
            background: #3e3f43 !important;
        }
    }

    /* Execute Button next to block */
    .aios-btn-execute {
        background: linear-gradient(135deg, #10b981, #059669) !important;
        color: #0f172a !important;
        border: none !important;
        padding: 6px 14px !important;
        border-radius: 8px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        margin: 8px 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        font-family: "Google Sans", Roboto, system-ui, sans-serif !important;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15) !important;
    }
    .aios-btn-execute:hover {
        background: linear-gradient(135deg, #34d399, #059669) !important;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
        transform: translateY(-1px) !important;
    }
    .aios-btn-execute:active {
        transform: translateY(0) !important;
    }

    /* Autocomplete Menu specific sizing */
    .aios-autocomplete-menu {
        max-height: 280px !important;
        overflow-y: auto !important;
        width: 320px !important;
        padding: 6px !important;
    }
    .aios-autocomplete-menu::-webkit-scrollbar {
        width: 6px;
    }
    .aios-autocomplete-menu::-webkit-scrollbar-track {
        background: transparent;
    }
    .aios-autocomplete-menu::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.2);
        border-radius: 3px;
    }
    .aios-autocomplete-menu::-webkit-scrollbar-thumb:hover {
        background: rgba(128, 128, 128, 0.4);
    }

    /* Full-width and Compact Table Layout */
    .horizontal-scroll-wrapper {
        width: 100vw !important;
        max-width: 100vw !important;
        position: relative !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        box-sizing: border-box !important;
        padding: 0 48px !important;
        display: flex !important;
        justify-content: center !important;
        overflow-x: auto !important;
    }
    .table-block-component, .table-block, .table-content {
        width: auto !important;
        max-width: 100% !important;
    }
    table {
        width: auto !important;
        max-width: 100% !important;
        border-collapse: collapse !important;
        table-layout: auto !important;
    }
    table th, table td {
        padding: 8px 12px !important;
        white-space: normal !important;
        word-break: break-word !important;
        width: auto !important;
        min-width: 0 !important;
    }
    
    /* Responsive adjustments for narrower viewports */
    @media (max-width: 1400px) {
        table th, table td {
            padding: 6px 10px !important;
            font-size: 14px !important; /* reduce font size slightly from default 17px */
            max-width: 160px !important; /* help trigger wrapping when space is constrained */
        }
    }
`

function appendStyle(styleEl) {
	const doAppend = () => {
		const target = document.head || document.documentElement || document.body
		if (target) {
			target.appendChild(styleEl)
			return true
		}
		return false
	}

	if (!doAppend()) {
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", doAppend)
		} else {
			const observer = new MutationObserver(() => {
				if (doAppend()) observer.disconnect()
			})
			observer.observe(document, { childList: true, subtree: true })
		}
	}
}

appendStyle(aiosStyle)

// Autocomplete Menu logic
let autocompleteMenu = null
let selectedIndex = 0

function createAutocompleteMenu() {
	if (autocompleteMenu) return
	autocompleteMenu = document.createElement("div")
	autocompleteMenu.className = "aios-dropdown aios-autocomplete-menu"
	document.body.appendChild(autocompleteMenu)
}

function renderAutocomplete(inputEl, query) {
	createAutocompleteMenu()
	const rect = inputEl.getBoundingClientRect()

	const phaseSkills = [
		{
			name: "phase0",
			description: "Brainstorming - Explore edges conceptually",
			prompt: PHASE_PROMPTS[0],
		},
		{
			name: "phase1",
			description: "Product Map - Synthesize plan into product map",
			prompt: PHASE_PROMPTS[1],
		},
		{
			name: "phase2",
			description: "Tech Architecture - Technical plan & components",
			prompt: PHASE_PROMPTS[2],
		},
		{
			name: "phase3",
			description: "Execution Payload - Instruction set for local agent",
			prompt: PHASE_PROMPTS[3],
		},
	]

	const allOptions = [...phaseSkills, ...localSkills]
	const filtered = allOptions.filter(
		(s) =>
			s.name.toLowerCase().includes(query.toLowerCase()) ||
			s.description.toLowerCase().includes(query.toLowerCase()),
	)

	if (filtered.length === 0) {
		autocompleteMenu.style.display = "none"
		return
	}

	// Apply dark mode class
	if (isDarkTheme()) {
		autocompleteMenu.classList.add("aios-dark")
	} else {
		autocompleteMenu.classList.remove("aios-dark")
	}

	autocompleteMenu.style.top = `${window.scrollY + rect.top - autocompleteMenu.offsetHeight - 8}px`
	autocompleteMenu.style.left = `${rect.left}px`
	autocompleteMenu.style.display = "block"

	// Adjust positioning if it overflows top of screen
	const topVal = window.scrollY + rect.top - autocompleteMenu.offsetHeight - 8
	autocompleteMenu.style.top = `${topVal < 0 ? window.scrollY + rect.bottom + 8 : topVal}px`

	autocompleteMenu.textContent = ""
	filtered.forEach((skill, idx) => {
		const item = document.createElement("div")
		item.className = `aios-dropdown-item ${idx === selectedIndex ? "active" : ""}`

		const check = document.createElement("div")
		check.className = "aios-dropdown-checkmark"
		check.textContent = "✓"

		const content = document.createElement("div")
		content.className = "aios-dropdown-content"

		const nameEl = document.createElement("div")
		nameEl.className = "aios-dropdown-name"
		nameEl.textContent = "/" + skill.name

		const descEl = document.createElement("div")
		descEl.className = "aios-dropdown-desc"
		descEl.textContent = skill.description

		content.appendChild(nameEl)
		content.appendChild(descEl)

		item.appendChild(check)
		item.appendChild(content)

		item.addEventListener("click", () => {
			applySkill(inputEl, skill.name)
		})
		autocompleteMenu.appendChild(item)
	})
}

function applySkill(inputEl, skillName) {
	const text = inputEl.innerText || inputEl.value || ""
	const queryStart = text.lastIndexOf("/")
	if (queryStart !== -1) {
		const before = text.substring(0, queryStart)
		const after = text.substring(
			queryStart + text.substring(queryStart).split(/\s/)[0].length,
		)
		const newText = before + "/" + skillName + after
		replaceEditorContent(inputEl, newText)
	}
	if (autocompleteMenu) autocompleteMenu.style.display = "none"
	inputEl.focus()
}

// Phase Selection dropdown
let phaseDropdownMenu = null

function injectPhaseDropdown(promptContainer) {
	if (promptContainer.querySelector(".aios-phase-select-container")) return

	const container = document.createElement("div")
	container.className = "aios-phase-select-container"
	container.style.cssText = "position: relative; display: inline-block;"

	const btn = document.createElement("button")
	btn.className = "aios-phase-select-btn"

	const btnSpan = document.createElement("span")
	if (currentPhase === null) {
		const planSvg = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"svg",
		)
		planSvg.setAttribute("width", "14")
		planSvg.setAttribute("height", "14")
		planSvg.setAttribute("viewBox", "0 0 24 24")
		planSvg.setAttribute("fill", "none")
		planSvg.setAttribute("stroke", "currentColor")
		planSvg.setAttribute("stroke-width", "2")
		planSvg.setAttribute("stroke-linecap", "round")
		planSvg.setAttribute("stroke-linejoin", "round")
		planSvg.style.marginRight = "4px"
		planSvg.style.verticalAlign = "-2px"

		const planPath = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"path",
		)
		planPath.setAttribute(
			"d",
			"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
		)

		const planPoly1 = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"polyline",
		)
		planPoly1.setAttribute("points", "14 2 14 8 20 8")

		const planLine1 = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"line",
		)
		planLine1.setAttribute("x1", "16")
		planLine1.setAttribute("y1", "13")
		planLine1.setAttribute("x2", "8")
		planLine1.setAttribute("y2", "13")

		const planLine2 = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"line",
		)
		planLine2.setAttribute("x1", "16")
		planLine2.setAttribute("y1", "17")
		planLine2.setAttribute("x2", "8")
		planLine2.setAttribute("y2", "17")

		const planPoly2 = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"polyline",
		)
		planPoly2.setAttribute("points", "10 9 9 9 8 9")

		planSvg.appendChild(planPath)
		planSvg.appendChild(planPoly1)
		planSvg.appendChild(planLine1)
		planSvg.appendChild(planLine2)
		planSvg.appendChild(planPoly2)

		btnSpan.appendChild(planSvg)
		btnSpan.appendChild(document.createTextNode("Plan"))
	} else {
		btnSpan.textContent = `Phase ${currentPhase}`
	}
	btn.appendChild(btnSpan)

	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
	svg.setAttribute("width", "10")
	svg.setAttribute("height", "6")
	svg.setAttribute("viewBox", "0 0 10 6")
	svg.setAttribute("fill", "none")
	svg.style.marginLeft = "4px"
	svg.style.transition = "transform 0.2s"

	const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
	path.setAttribute("d", "M1 1L5 5L9 1")
	path.setAttribute("stroke", "currentColor")
	path.setAttribute("stroke-width", "1.5")
	path.setAttribute("stroke-linecap", "round")
	path.setAttribute("stroke-linejoin", "round")

	svg.appendChild(path)
	btn.appendChild(svg)

	btn.addEventListener("click", (e) => {
		e.preventDefault()
		e.stopPropagation()
		togglePhaseDropdown(container, btn)
	})

	container.appendChild(btn)

	const switchBtn = promptContainer.querySelector(
		'button.input-area-switch, button[aria-label*="Send"], button.send-button',
	)
	if (switchBtn) {
		switchBtn.parentNode.style.setProperty(
			"flex-direction",
			"row",
			"important",
		)
		switchBtn.parentNode.insertBefore(container, switchBtn)
	} else {
		promptContainer.appendChild(container)
	}
}

function togglePhaseDropdown(container, btn) {
	if (phaseDropdownMenu && phaseDropdownMenu.style.display === "block") {
		phaseDropdownMenu.style.display = "none"
		btn.querySelector("svg").style.transform = "rotate(0deg)"
		return
	}

	if (!phaseDropdownMenu) {
		phaseDropdownMenu = document.createElement("div")
		phaseDropdownMenu.className = "aios-dropdown"
		document.body.appendChild(phaseDropdownMenu)

		document.addEventListener("click", (e) => {
			if (
				!container.contains(e.target) &&
				!phaseDropdownMenu.contains(e.target)
			) {
				phaseDropdownMenu.style.display = "none"
				btn.querySelector("svg").style.transform = "rotate(0deg)"
			}
		})
	}

	phaseDropdownMenu.textContent = ""

	const phases = [
		{
			id: 0,
			name: "Phase 0: Brainstorming",
			desc: "Explore the edges of the idea conceptually",
		},
		{
			id: 1,
			name: "Phase 1: High-Level Plan",
			desc: "Synthesize concept into product map",
		},
		{
			id: 2,
			name: "Phase 2: Tech Architecture",
			desc: "Translate plan into technical plan",
		},
		{
			id: 3,
			name: "Phase 3: Execution Payload",
			desc: "Generate strict instruction set for local agent",
		},
	]

	phases.forEach((p) => {
		const item = document.createElement("div")
		item.className = `aios-dropdown-item ${p.id === currentPhase ? "active" : ""}`

		const check = document.createElement("div")
		check.className = "aios-dropdown-checkmark"
		check.textContent = "✓"

		const content = document.createElement("div")
		content.className = "aios-dropdown-content"

		const nameEl = document.createElement("div")
		nameEl.className = "aios-dropdown-name"
		nameEl.textContent = p.name

		const descEl = document.createElement("div")
		descEl.className = "aios-dropdown-desc"
		descEl.textContent = p.desc

		content.appendChild(nameEl)
		content.appendChild(descEl)

		item.appendChild(check)
		item.appendChild(content)

		item.addEventListener("click", () => {
			currentPhase = p.id
			btn.querySelector("span").textContent = `Phase ${currentPhase}`
			phaseDropdownMenu.style.display = "none"
			btn.querySelector("svg").style.transform = "rotate(0deg)"

			const editor = document.querySelector(
				'.ql-editor[contenteditable="true"]',
			)
			if (editor) {
				replaceEditorContent(editor, `/phase${currentPhase}`)
			}
		})

		phaseDropdownMenu.appendChild(item)
	})

	if (isDarkTheme()) {
		phaseDropdownMenu.classList.add("aios-dark")
	} else {
		phaseDropdownMenu.classList.remove("aios-dark")
	}

	const rect = btn.getBoundingClientRect()
	phaseDropdownMenu.style.display = "block"
	phaseDropdownMenu.style.top = `${window.scrollY + rect.top - phaseDropdownMenu.offsetHeight - 6}px`
	phaseDropdownMenu.style.left = `${rect.left}px`
	btn.querySelector("svg").style.transform = "rotate(180deg)"
}

// Inject Phase Controls & Listeners
function injectUI() {
	const promptContainer = document.querySelector(
		".input-area-container, .prompt-box-container, form .input-area",
	)
	if (!promptContainer) return

	// 1. Inject Phase Selection Pill Dropdown
	injectPhaseDropdown(promptContainer)

	// 1.5 Inject Quick Actions Pill Dropdown
	injectQuickActionsDropdown(promptContainer)

	// 2. Hook Input elements for `/` Autocomplete
	const inputEl = promptContainer.querySelector(
		'textarea, [contenteditable="true"]',
	)
	if (inputEl && !inputEl.dataset.aiosHooked) {
		inputEl.dataset.aiosHooked = "true"
		inputEl.addEventListener("input", (e) => {
			const text = inputEl.value || inputEl.innerText || ""
			const slashIdx = text.lastIndexOf("/")
			if (slashIdx !== -1 && slashIdx === text.length - 1) {
				renderAutocomplete(inputEl, "")
			} else if (slashIdx !== -1 && slashIdx < text.length - 1) {
				const query = text.substring(slashIdx + 1)
				if (!query.includes(" ") && !query.includes("\n")) {
					renderAutocomplete(inputEl, query)
				} else {
					if (autocompleteMenu) autocompleteMenu.style.display = "none"
				}
			} else {
				if (autocompleteMenu) autocompleteMenu.style.display = "none"
			}
		})

		inputEl.addEventListener("keydown", (e) => {
			if (autocompleteMenu && autocompleteMenu.style.display === "block") {
				const items = autocompleteMenu.querySelectorAll(".aios-dropdown-item")
				if (e.key === "ArrowDown") {
					e.preventDefault()
					selectedIndex = (selectedIndex + 1) % items.length
					renderAutocomplete(
						inputEl,
						inputEl.innerText
							.substring(inputEl.innerText.lastIndexOf("/") + 1)
							.trim(),
					)
				} else if (e.key === "ArrowUp") {
					e.preventDefault()
					selectedIndex = (selectedIndex - 1 + items.length) % items.length
					renderAutocomplete(
						inputEl,
						inputEl.innerText
							.substring(inputEl.innerText.lastIndexOf("/") + 1)
							.trim(),
					)
				} else if (e.key === "Enter") {
					e.preventDefault()
					const activeItem = items[selectedIndex]
					if (activeItem) {
						const name = activeItem
							.querySelector(".aios-dropdown-name")
							.innerText.substring(1) // strip leading slash
						applySkill(inputEl, name)
					}
				} else if (e.key === "Escape") {
					autocompleteMenu.style.display = "none"
				}
			}
		})
	}
}

// Quick Actions Dropdown Logic
let quickActionsMenu = null

function injectQuickActionsDropdown(promptContainer) {
	if (promptContainer.querySelector(".aios-quick-actions-container")) return

	const container = document.createElement("div")
	container.className = "aios-quick-actions-container"
	container.style.cssText = "position: relative; display: inline-block;"

	const btn = document.createElement("button")
	btn.className = "aios-phase-select-btn"
	btn.style.marginRight = "8px"

	const btnSpan = document.createElement("span")
	btnSpan.textContent = "⚡ Quick Actions"
	btn.appendChild(btnSpan)

	btn.addEventListener("click", (e) => {
		e.preventDefault()
		e.stopPropagation()
		toggleQuickActionsDropdown(container, btn)
	})

	container.appendChild(btn)

	const phaseContainer = promptContainer.querySelector(".aios-phase-select-container")
	if (phaseContainer && phaseContainer.nextSibling) {
		phaseContainer.parentNode.insertBefore(container, phaseContainer.nextSibling)
	} else if (phaseContainer) {
		phaseContainer.parentNode.appendChild(container)
	} else {
		promptContainer.appendChild(container)
	}
}

function toggleQuickActionsDropdown(container, btn) {
	if (quickActionsMenu && quickActionsMenu.style.display === "block") {
		quickActionsMenu.style.display = "none"
		return
	}

	if (!quickActionsMenu) {
		quickActionsMenu = document.createElement("div")
		quickActionsMenu.className = "aios-dropdown"
		document.body.appendChild(quickActionsMenu)

		document.addEventListener("click", (e) => {
			if (!container.contains(e.target) && !quickActionsMenu.contains(e.target)) {
				quickActionsMenu.style.display = "none"
			}
		})
	}

	quickActionsMenu.textContent = ""

	const actions = [
		{
			id: "save_last",
			name: "Save a note (last response)",
			desc: "Saves the last AI response. Add instructions in chatbox first to customize.",
		},
		{
			id: "save_summary",
			name: "Save a note (thread summary)",
			desc: "Prompts Gemini to summarize this thread and save as a note.",
		}
	]

	actions.forEach((a) => {
		const item = document.createElement("div")
		item.className = "aios-dropdown-item"

		const content = document.createElement("div")
		content.className = "aios-dropdown-content"
		
		const nameEl = document.createElement("div")
		nameEl.className = "aios-dropdown-name"
		nameEl.textContent = a.name
		
		const descEl = document.createElement("div")
		descEl.className = "aios-dropdown-desc"
		descEl.textContent = a.desc
		
		content.appendChild(nameEl)
		content.appendChild(descEl)
		item.appendChild(content)

		item.addEventListener("click", () => {
			quickActionsMenu.style.display = "none"
			handleQuickAction(a.id)
		})

		quickActionsMenu.appendChild(item)
	})

	if (isDarkTheme()) quickActionsMenu.classList.add("aios-dark")
	else quickActionsMenu.classList.remove("aios-dark")

	const rect = btn.getBoundingClientRect()
	quickActionsMenu.style.display = "block"
	quickActionsMenu.style.top = `${window.scrollY + rect.top - quickActionsMenu.offsetHeight - 6}px`
	quickActionsMenu.style.left = `${rect.left}px`
}

function handleQuickAction(actionId) {
	const editor = document.querySelector('.ql-editor[contenteditable="true"]')
	if (!editor) return
	const instruction = editor.innerText.trim()

	if (actionId === "save_last" && instruction === "") {
		// Directly scrape and save
		const responses = document.querySelectorAll("model-response")
		if (responses.length === 0) {
			alert("No AI response found to save.")
			return
		}
		const lastResponse = responses[responses.length - 1]
		
		let content = lastResponse.innerText
		// Try to find the inner text of the actual response body
		const body = lastResponse.querySelector(".message-content, .model-response-text")
		if (body) content = body.innerText
		
		let title = "Gemini Note - " + new Date().toLocaleDateString("en-CA") + " " + Date.now().toString().slice(-4)

		const pseudoToolCall = {
			tool: "save_note",
			args: {
				title: title,
				content: content + "\\n\\n---\\nThread Link: " + location.href,
				update: false
			}
		}
		
		if (window.executeToolCall) {
			window.executeToolCall(pseudoToolCall.tool, pseudoToolCall.args)
		} else {
			console.warn("Tool call executor not ready")
		}
	} else {
		// Send prompt to Gemini
		let promptText = ""
		if (actionId === "save_last") {
			promptText = "Please save a note about your last response. Output a `save_note` tool call."
			if (instruction) promptText += "\\nInstruction: " + instruction
		} else {
			promptText = "Please summarize this entire thread and save it as a note. Output a `save_note` tool call."
			if (instruction) promptText += "\\nInstruction: " + instruction
		}
		
		replaceEditorContent(editor, promptText)
		
		setTimeout(() => {
			const sendBtn = document.querySelector('button[aria-label*="Send" i], button[aria-label*="Submit" i], button.send-button')
			if (sendBtn) sendBtn.click()
		}, 100)
	}
}

// ═══════════════════════════════════════════════════════════
// KEYWORD-BASED CONTEXT CHIP DETECTOR
// ═══════════════════════════════════════════════════════════
window.gmtContexts = window.gmtContexts || {}

const KEYWORD_CONTEXT_DEFINITIONS = [
	{
		id: "kw-mac-apps",
		title: "Mac Apps & Automation Context",
		keywords: ["mac", "macos", "installed app", "installed apps", "app list", "automation", "hammerspoon", "raycast", "applescript", "shortcuts", "tcc", "system settings"],
		output: `[Mac Environment & Installed Applications Context]
Primary Directory: /Users/matt
Installed Development & Utility Apps:
- Raycast (Launcher & Extension Runner)
- Hammerspoon (Lua Desktop & Window Automation)
- Obsidian (Personal Vault & Project Notes)
- Xcode & Command Line Tools (macOS Development)
- Docker Desktop & Container Tools
- iTerm2 & Terminal (Zsh shell)
- VS Code & Antigravity / Cursor
- CleanShot X (Screen capture & recording)
- Karabiner-Elements (Keyboard remapping)
- Homebrew (/opt/homebrew)
- Bun, Node.js, Python 3.12, Rust / Cargo`
	},
	{
		id: "kw-obsidian-vault",
		title: "Obsidian Vault & Notes Context",
		keywords: ["obsidian", "vault", "project notes", "global todos", "make a note", "note taking", "markdown note"],
		output: `[Obsidian Vault Context]
Primary User Vault: /Users/matt/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal/
Project Notes Folder: Development/Project Notes/
Global Todos File: Development/Project Notes/Global Todos.md
Note Format: YAML Frontmatter (tags, date), # Title, High-Level Summary, Bulleted Breakdown, Expanded Details, Thread Link.`
	},
	{
		id: "kw-ai-os",
		title: "AI-OS Protocols Context",
		keywords: ["ai-os", "aios", "agent rules", "ag_context", "preflight", "auto-commit", "bun", "subagent"],
		output: `[AI-OS Protocols Context]
Project Root: /Users/matt/projects/ai-os
Preflight Routine: python3 /Users/matt/projects/ai-os/scripts/preflight.py
Auto-Commit Routine: python3 /Users/matt/projects/ai-os/scripts/auto_commit.py
Rules Summary: Bun is required for JS projects; ./tmp for temporary scripts; mv ~/.Trash/ for deletions; no heredocs; concise token-efficient outputs.`
	},
	{
		id: "kw-terminal-cli",
		title: "Terminal & CLI Context",
		keywords: ["terminal", "cli", "zsh", "bash", "tmux", "command", "shell"],
		output: `[Terminal & Local Execution Context]
Shell: Zsh on macOS (/bin/zsh)
Local Command Executor Service: http://127.0.0.1:3033/run-command
Headers: x-gemini-thread-saver-key (requires secret configuration)
Inline Terminal Sessions: tmux background sessions monitored via HTTP`
	}
]

const KeywordContextManager = {
	scanInput(text) {
		if (!text) text = ""
		const lower = text.toLowerCase()

		KEYWORD_CONTEXT_DEFINITIONS.forEach((def) => {
			const existing = window.gmtContexts[def.id]
			const matched = def.keywords.some((kw) => lower.includes(kw))

			if (matched) {
				if (!existing) {
					window.gmtContexts[def.id] = {
						id: def.id,
						active: true,
						title: def.title,
						command: def.title,
						output: def.output,
						isKeyword: true,
						userDismissed: false,
					}
				} else if (!existing.userDismissed) {
					existing.active = true
				}
			} else {
				if (existing && existing.isKeyword && !existing.userDismissed) {
					existing.active = false
				}
			}
		})

		if (typeof renderContextPills === "function") {
			renderContextPills()
		} else if (typeof terminalManager !== "undefined" && terminalManager.renderContextPills) {
			terminalManager.renderContextPills()
		}
	},
}

let keywordScanDebounceTimer = null
document.addEventListener(
	"input",
	(e) => {
		const editor = e.target.closest && e.target.closest('.ql-editor[contenteditable="true"]')
		if (editor) {
			clearTimeout(keywordScanDebounceTimer)
			keywordScanDebounceTimer = setTimeout(() => {
				KeywordContextManager.scanInput(editor.innerText || "")
			}, 300)
		}
	},
	true,
)

