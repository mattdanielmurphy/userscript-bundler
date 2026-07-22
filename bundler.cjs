#!/usr/bin/env node

/**
 * Userscript Bundler
 *
 * This Node.js script automates the creation of a single, CSP-safe JavaScript file
 * (userscript_bundle.js) which will be loaded by a userscript manager (like Tampermonkey)
 * via a single local @require line. The bundled file contains logic to check the current
 * page URL and conditionally execute code from separate source files.
 */

const fs = require("fs")
const path = require("path")
const vm = require("vm")

// Constants
const MANIFEST_FILE = "script_manifest.json"
const OUTPUT_FILE = "userscript_bundle.js"
const SOURCE_DIR = "./"
const USERSCRIPTS_DIR = "./userscripts/"

/**
 * Encodes a number to Base64 VLQ.
 * Used for source map mappings.
 */
const VLQ_CHARS =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
function encodeVLQ(value) {
	let signed = value < 0 ? (-value << 1) | 1 : value << 1
	let encoded = ""
	do {
		let digit = signed & 31
		signed >>>= 5
		if (signed > 0) {
			digit |= 32
		}
		encoded += VLQ_CHARS[digit]
	} while (signed > 0)
	return encoded
}

/**
 * Parse userscript header to extract @name and @match information
 * @param {string} filePath - Path to the userscript file
 * @returns {Object|null} - Object with name, match, and file properties, or null if parsing fails
 */
function parseUserscriptHeader(filePath) {
	try {
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")

		let name = null
		let matches = []
		let inHeader = false

		for (const line of lines) {
			const trimmedLine = line.trim()

			// Check for start of userscript header
			if (trimmedLine === "// ==UserScript==") {
				inHeader = true
				continue
			}

			// Check for end of userscript header
			if (trimmedLine === "// ==/UserScript==") {
				break
			}

			// Parse header directives
			if (inHeader) {
				const nameMatch = trimmedLine.match(/^\/\/\s*@name\s+(.+)$/)
				if (nameMatch) {
					name = nameMatch[1].trim()
					continue
				}

				const matchMatch = trimmedLine.match(/^\/\/\s*@match\s+(.+)$/)
				if (matchMatch) {
					const matchPattern = matchMatch[1].trim()

					// Extract domain from match pattern for simpler matching
					let domain = null
					if (matchPattern === "*://*/*") {
						domain = "*"
					} else {
						const domainMatch = matchPattern.match(
							/(?:https?|\*):\/\/(?:\*\.)?([^\/\*]+)/,
						)
						if (domainMatch) {
							domain = domainMatch[1]
						}
					}

					if (domain) {
						matches.push(domain)
					}
					continue
				}
			}
		}

		if (name && matches.length > 0) {
			return {
				name: name,
				match: matches[0], // Keep for backward compatibility if needed
				matches: matches,
				file: path.basename(filePath),
			}
		}

		return null
	} catch (error) {
		console.warn(
			`⚠️  Error parsing userscript header for ${filePath}:`,
			error.message,
		)
		return null
	}
}

/**
 * Auto-generate manifest from userscript files
 * @returns {Array} - Array of manifest entries
 */
function generateManifestFromUserscripts() {
	const manifest = []
	const manifestPath = path.join(__dirname, MANIFEST_FILE)
	const manifestFilesSet = new Set()

	if (fs.existsSync(manifestPath)) {
		console.log(`📋 Loading manifest from: ${MANIFEST_FILE}`)
		try {
			const content = fs.readFileSync(manifestPath, "utf8")
			const parsed = JSON.parse(content)
			for (const entry of parsed) {
				const matches = entry.matches || (entry.match ? [entry.match] : [])
				const normalized = {
					...entry,
					matches: matches,
				}
				manifest.push(normalized)
				if (entry.file) {
					manifestFilesSet.add(entry.file)
				}
				if (entry.files && Array.isArray(entry.files)) {
					entry.files.forEach((f) => manifestFilesSet.add(f))
				}
			}
		} catch (e) {
			console.error(`❌ Failed to parse ${MANIFEST_FILE}: ${e.message}`)
			process.exit(1)
		}
	}

	console.log(`🔍 Scanning userscripts directory for standalone scripts: ${USERSCRIPTS_DIR}`)

	if (!fs.existsSync(USERSCRIPTS_DIR)) {
		throw new Error(`Userscripts directory not found: ${USERSCRIPTS_DIR}`)
	}

	const files = fs.readdirSync(USERSCRIPTS_DIR)
	const jsFiles = files.filter(
		(file) => file.endsWith(".js") && !file.includes(".disabled.") && file !== "compat.js" && !manifestFilesSet.has(file),
	)

	for (const file of jsFiles) {
		const filePath = path.join(USERSCRIPTS_DIR, file)
		console.log(`📋 Parsing standalone userscript: ${file}`)

		const parsed = parseUserscriptHeader(filePath)
		if (parsed) {
			manifest.push({
				file: parsed.file,
				matches: parsed.matches,
				name: parsed.name,
			})
			console.log(
				`✅ Parsed: "${parsed.name}" -> matches [${parsed.matches.join(", ")}]`,
			)
		} else {
			console.warn(`⚠️  Could not parse userscript header for: ${file}`)
		}
	}

	if (manifest.length === 0) {
		throw new Error(
			"No valid userscripts or manifest entries found",
		)
	}

	console.log(`📊 Final manifest has ${manifest.length} script entries`)
	return manifest
}

/**
 * Main bundler function
 */
async function bundleUserscripts() {
	try {
		console.log("🚀 Starting userscript bundling process...")

		// Step 1: Auto-generate manifest from userscript files
		console.log("📋 Auto-generating manifest from userscript files...")
		const manifest = generateManifestFromUserscripts()

		console.log(`✅ Generated manifest with ${manifest.length} script entries`)

		// Step 2: Initialize code bundle string
		// Step 2: Initialize code bundle array and line mappings
		const outputLines = []
		const lineMappings = []

		function addLine(content) {
			outputLines.push(content)
			lineMappings.push(null)
		}

		function addTemplate(templateStr) {
			const lines = templateStr.split("\n")
			for (const line of lines) {
				addLine(line)
			}
		}

		function addSourceLine(content, sourceIndex, sourceLine) {
			outputLines.push(content)
			lineMappings.push({ sourceIndex, sourceLine })
		}

		addLine("// Userscript Bundle - Auto-generated by bundler.js")
		const generationDate = new Date().toISOString()
		addLine("// Generated on: " + generationDate)
		addLine("")

		const buildId = Date.now().toString()

		addTemplate(`console.log("📦 [Bundler] Userscript Bundle Loaded! (Build: ${buildId})");
try {
const __BUILD_ID__ = "${buildId}";`)
		addLine("")

		// Inject centralized compatibility layer
		const compatPath = path.join(USERSCRIPTS_DIR, "compat.js")
		if (fs.existsSync(compatPath)) {
			console.log("🧩 Prepending compatibility layer (compat.js)...")
			const compatContent = fs.readFileSync(compatPath, "utf8")
			addTemplate(compatContent)
			addLine("")
		}

		// Step 3: Iterative wrapping - process each manifest entry
		const processedManifest = []
		const allGrants = new Set()
		const allConnects = new Set()
		
		allGrants.add("GM_setClipboard")

		const baseResolved = path.resolve(USERSCRIPTS_DIR)

		for (let i = 0; i < manifest.length; i++) {
			const entry = manifest[i]
			const functionName = `script_func_${i}`

			if (entry.files && Array.isArray(entry.files)) {
				// Grouped Script Entry
				const groupName = entry.group || entry.name || `group_${i}`
				console.log(`📦 Processing script group ${i + 1}/${manifest.length}: ${groupName} (${entry.files.length} files)`)

				if (entry.files.length === 0) {
					console.error(`❌ [Error] Empty files array in group: ${groupName}`)
					process.exit(1)
				}

				const groupSeen = new Set()
				let combinedContent = ""
				let accumulatedRunAt = "document-idle"

				for (const relFile of entry.files) {
					const fullPath = path.resolve(USERSCRIPTS_DIR, relFile)

					// Path safety validation: must be inside USERSCRIPTS_DIR
					if (!fullPath.startsWith(baseResolved + path.sep)) {
						console.error(`❌ [Error] Grouped source file escapes userscripts directory: ${relFile}`)
						process.exit(1)
					}

					// Existence check
					if (!fs.existsSync(fullPath)) {
						console.error(`❌ [Error] Grouped source file missing: ${relFile}`)
						process.exit(1)
					}

					// Duplication check
					if (groupSeen.has(fullPath)) {
						console.error(`❌ [Error] Duplicate file in group: ${relFile}`)
						process.exit(1)
					}
					groupSeen.add(fullPath)

					// Read file
					let fileContent = ""
					try {
						fileContent = fs.readFileSync(fullPath, "utf8")
					} catch (readErr) {
						console.error(`❌ [Error] Unreadable grouped source file: ${relFile}`)
						console.error(readErr.message)
						process.exit(1)
					}

					// Header parsing
					const headerLines = fileContent.split("\n")
					let inSourceHeader = false
					for (const line of headerLines) {
						const trimmed = line.trim()
						if (trimmed === "// ==UserScript==") {
							inSourceHeader = true
							continue
						}
						if (trimmed === "// ==/UserScript==") {
							break
						}
						if (inSourceHeader) {
							const grantMatch = trimmed.match(/^\/\/\s*@grant\s+(.+)$/)
							if (grantMatch) {
								const grant = grantMatch[1].trim()
								if (grant !== "none") allGrants.add(grant)
							}
							const connectMatch = trimmed.match(/^\/\/\s*@connect\s+(.+)$/)
							if (connectMatch) {
								const connect = connectMatch[1].trim()
								allConnects.add(connect)
							}
						}
					}

					const runAtMatch = fileContent.match(/\/\/\s*@run-at\s+(.+)$/m)
					if (runAtMatch) {
						accumulatedRunAt = runAtMatch[1].trim()
					}

					combinedContent += `/* ===== ${relFile} ===== */\n` + fileContent + "\n\n"
				}

				// Validate syntax of combined group
				try {
					new vm.Script(combinedContent, { filename: groupName })
				} catch (syntaxError) {
					console.error(`\n❌ [Syntax Error] In grouped userscript: ${groupName}`)
					console.error(syntaxError.stack || syntaxError.message)
					console.error("Bundling aborted.\n")
					process.exit(1)
				}

				const runAt = accumulatedRunAt

				if (runAt === "document-start") {
					addTemplate(`const ${functionName} = () => {
    console.log("🚀 [Bundler] Executing group ${groupName} immediately (@run-at document-start)");`)

					const sourceLines = combinedContent.split("\n")
					sourceLines.forEach((line, index) => {
						addSourceLine(line, i, index)
					})

					addTemplate(`};`)
				} else {
					addTemplate(`const ${functionName} = () => {
    const executeScript = () => {
        console.log("🚀 [Bundler] Executing group ${groupName}");`)

					const sourceLines = combinedContent.split("\n")
					sourceLines.forEach((line, index) => {
						addSourceLine(line, i, index)
					})

					addTemplate(`    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', executeScript);
    } else {
        executeScript();
    }
};`)
				}

				addTemplate(`// Expose function to global scope for dispatcher access
window.${functionName} = ${functionName};

`)

				processedManifest.push({
					functionName: functionName,
					matches: entry.matches || (entry.match ? [entry.match] : []),
					originalFile: entry.group || entry.files[0],
					name: entry.name || groupName,
				})

				console.log(
					`✅ Wrapped group ${groupName} (${entry.files.length} files) as ${functionName} (run-at: ${runAt})`,
				)
			} else {
				// Standalone Single File Entry
				if (!entry.file || !entry.matches) {
					console.warn(
						`⚠️  Skipping invalid manifest entry at index ${i}: missing file or match property`,
					)
					continue
				}

				console.log(
					`📦 Processing script ${i + 1}/${manifest.length}: ${entry.file}`,
				)

				// Path safety check
				const sourcePath = path.resolve(USERSCRIPTS_DIR, entry.file)
				if (!sourcePath.startsWith(baseResolved + path.sep)) {
					console.error(`❌ [Error] Source file escapes userscripts directory: ${entry.file}`)
					process.exit(1)
				}

				if (!fs.existsSync(sourcePath)) {
					console.warn(`⚠️  Source file not found: ${sourcePath}, skipping...`)
					continue
				}

				let sourceContent = ""
				try {
					sourceContent = fs.readFileSync(sourcePath, "utf8")
				} catch (readErr) {
					console.error(`❌ [Error] Unreadable source file: ${entry.file}`)
					process.exit(1)
				}

				// Validate syntax before wrapping
				try {
					new vm.Script(sourceContent, { filename: entry.file })
				} catch (syntaxError) {
					console.error(`\n❌ [Syntax Error] In userscript: ${entry.file}`)
					console.error(syntaxError.stack || syntaxError.message)
					console.error("Bundling aborted.\n")
					process.exit(1)
				}

				// Enhanced parsing for grants, connects and run-at
				const headerLines = sourceContent.split("\n")
				let inSourceHeader = false
				for (const line of headerLines) {
					const trimmed = line.trim()
					if (trimmed === "// ==UserScript==") {
						inSourceHeader = true
						continue
					}
					if (trimmed === "// ==/UserScript==") {
						break
					}
					if (inSourceHeader) {
						const grantMatch = trimmed.match(/^\/\/\s*@grant\s+(.+)$/)
						if (grantMatch) {
							const grant = grantMatch[1].trim()
							if (grant !== "none") allGrants.add(grant)
						}
						const connectMatch = trimmed.match(/^\/\/\s*@connect\s+(.+)$/)
						if (connectMatch) {
							const connect = connectMatch[1].trim()
							allConnects.add(connect)
						}
					}
				}

				const runAtMatch = sourceContent.match(/\/\/\s*@run-at\s+(.+)$/m)
				const runAt = runAtMatch ? runAtMatch[1].trim() : "document-idle"

				// Wrap content into function definition template
				if (runAt === "document-start") {
					addTemplate(`const ${functionName} = () => {
    console.log("🚀 [Bundler] Executing ${entry.file} immediately (@run-at document-start)");`)

					const sourceLines = sourceContent.split("\n")
					sourceLines.forEach((line, index) => {
						addSourceLine(line, i, index)
					})

					addTemplate(`};`)
				} else {
					addTemplate(`const ${functionName} = () => {
    // Wait for DOM to be ready before executing (@run-at ${runAt})
    const executeScript = () => {
        console.log("🚀 [Bundler] Executing ${entry.file}");`)

					const sourceLines = sourceContent.split("\n")
					sourceLines.forEach((line, index) => {
						addSourceLine(line, i, index)
					})

					addTemplate(`    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', executeScript);
    } else {
        executeScript();
    }
};`)
				}

				addTemplate(`// Expose function to global scope for dispatcher access
window.${functionName} = ${functionName};

`)

				// Update processed manifest
				processedManifest.push({
					functionName: functionName,
					matches: entry.matches,
					originalFile: entry.file,
					name: entry.name,
				})

				console.log(
					`✅ Wrapped ${entry.file} as ${functionName} (run-at: ${runAt})`,
				)
			}
		}

		// Step 4: Append execution logic (Dispatcher)
		console.log("🔧 Adding execution dispatcher...")

		// Check README.md for matching grants and connects to warn the user
		let buildTimeMissingGrants = []
		let buildTimeMissingConnects = []
		const readmePath = path.join(__dirname, "README.md")
		if (fs.existsSync(readmePath)) {
			const readmeContent = fs.readFileSync(readmePath, "utf8")
			const masterBlockMatch = readmeContent.match(
				/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/,
			)
			if (masterBlockMatch) {
				const masterBlock = masterBlockMatch[0]
				const readmeGrants = new Set(
					(masterBlock.match(/\/\/\s*@grant\s+[^\r\n]+/g) || []).map((m) =>
						m.match(/\/\/\s*@grant\s+(.+)$/)[1].trim(),
					),
				)
				const readmeConnects = new Set(
					(masterBlock.match(/\/\/\s*@connect\s+[^\r\n]+/g) || []).map((m) =>
						m.match(/\/\/\s*@connect\s+(.+)$/)[1].trim(),
					),
				)
				const normalizeGrant = (g) => g.replace("GM.", "GM_")

				allGrants.forEach((grant) => {
					const normalized = normalizeGrant(grant)
					let found = false
					readmeGrants.forEach((rg) => {
						if (normalizeGrant(rg) === normalized) found = true
					})
					if (!found) buildTimeMissingGrants.push(grant)
				})

				allConnects.forEach((connect) => {
					if (!readmeConnects.has(connect)) {
						buildTimeMissingConnects.push(connect)
					}
				})
			}
		}

		const dispatcherCode = `
// Execution Dispatcher
(function() {
    'use strict';
    
    // Inject runtime verification of grants/connects
    const expectedGrants = ${JSON.stringify(Array.from(allGrants))};
    const expectedConnects = ${JSON.stringify(Array.from(allConnects))};
    const buildTimeMissingGrants = ${JSON.stringify(buildTimeMissingGrants)};
    const buildTimeMissingConnects = ${JSON.stringify(buildTimeMissingConnects)};

    function checkGrantsAndConnects() {
        const missingGrants = [];
        expectedGrants.forEach(grant => {
            if (grant === 'none' || grant === 'unsafeWindow') return;
            if (grant.startsWith('GM_') || grant.startsWith('GM.')) {
                const apiName = grant.replace('GM.', 'GM_');
                // Check in global scope, globalThis, and GM object
                const hasAPI = (typeof globalThis !== 'undefined' && globalThis[apiName] !== undefined) ||
                               (typeof window !== 'undefined' && window[apiName] !== undefined) ||
                               (typeof GM !== 'undefined' && GM[grant.replace('GM.', '')] !== undefined) ||
                               (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.grant && GM_info.script.grant.includes(grant));
                if (!hasAPI) {
                    missingGrants.push(grant);
                }
            }
        });

        // Also check if any grants or connects were flagged as missing from the README master block at compile time
        const combinedMissingGrants = Array.from(new Set(missingGrants.concat(buildTimeMissingGrants)));

        if (combinedMissingGrants.length > 0 || buildTimeMissingConnects.length > 0) {
            console.log(
                "%c 🚨 WARNING: MASTER USERSCRIPT CONFIGURATION IS OUT OF SYNC! 🚨 %c\\n" +
                "The compiled bundle requires configurations that are missing from your Tampermonkey loader or README.md:\\n" +
                (combinedMissingGrants.length > 0 ? "\\n%cMissing @grant(s):%c\\n" + combinedMissingGrants.map(function(g) { return " - @grant " + g; }).join('\\n') : "") +
                (buildTimeMissingConnects.length > 0 ? "\\n%cMissing @connect(s):%c\\n" + buildTimeMissingConnects.map(function(c) { return " - @connect " + c; }).join('\\n') : "") +
                "\\n\\n%c👉 Please update the Master Userscript block in README.md and copy the updated version to Tampermonkey!",
                "background: #aa0000; color: #ffffff; font-weight: bold; padding: 4px 8px; font-size: 13px; border-radius: 4px;",
                "color: #ff5555; font-weight: bold;",
                // Style variables for log replacement
                "color: #ff9999; font-weight: bold;", "color: #ff5555;",
                "color: #ff9999; font-weight: bold;", "color: #ff5555;",
                "color: #ffcc00; font-weight: bold;"
            );
        }
    }

    // --- Menu Settings logic ---
    let isMenuExpanded = false;
    try {
        if (typeof GM_getValue !== 'undefined') {
            isMenuExpanded = GM_getValue('us_menu_expanded', false);
        }
    } catch (e) {}

    let menuIds = [];

    function refreshMenu() {
        if (typeof GM_unregisterMenuCommand === 'undefined' || typeof GM_registerMenuCommand === 'undefined') return;
        
        menuIds.forEach(id => {
            try {
                GM_unregisterMenuCommand(id);
            } catch (e) {}
        });
        menuIds = [];
        
        const processedManifest = ${JSON.stringify(processedManifest, null, 4)};
        const opts = { autoClose: false };
        
        try {
            const toggleText = \`⚙️ Manage Bundled Scripts (\${isMenuExpanded ? 'Click to collapse ⬆️' : 'Click to expand ⬇️'})\`;
            menuIds.push(
                GM_registerMenuCommand(toggleText, () => {
                    isMenuExpanded = !isMenuExpanded;
                    try {
                        GM_setValue('us_menu_expanded', isMenuExpanded);
                    } catch (e) {}
                    refreshMenu();
                }, opts)
            );
            
            if (isMenuExpanded) {
                processedManifest.forEach(entry => {
                    const key = 'us_enabled_' + entry.originalFile;
                    let isEnabled = true;
                    try {
                        if (typeof GM_getValue !== 'undefined') {
                            isEnabled = GM_getValue(key, true);
                        }
                    } catch (e) {}
                    
                    const itemText = \` ├─ \${isEnabled ? '🟢' : '🔴'} \${entry.name}\`;
                    menuIds.push(
                        GM_registerMenuCommand(itemText, () => {
                            try {
                                if (typeof GM_setValue !== 'undefined') {
                                    GM_setValue(key, !isEnabled);
                                }
                            } catch (e) {}
                            refreshMenu();
                        }, opts)
                    );
                });
            }
        } catch (e) {
            console.error("Error building userscript settings menu:", e);
        }
    }

    try {
        refreshMenu();
    } catch (e) {
        console.error("Error initializing settings menu:", e);
    }

    function matchesPattern(matchPatterns) {
        if (!Array.isArray(matchPatterns)) matchPatterns = [matchPatterns];
        const currentUrl = window.location.href;
        return matchPatterns.some(pattern => {
            if (pattern === '*') return true;
            return currentUrl.includes(pattern);
        });
    }
    
    function executeDispatcher() {
        // Run the check on load
        try {
            checkGrantsAndConnects();
        } catch (e) {
            console.error("Error verifying grants:", e);
        }

        const processedManifest = ${JSON.stringify(processedManifest, null, 4)};
        
        processedManifest.forEach((entry) => {
            try {
                // Check if this script is enabled in menu settings
                let isEnabled = true;
                try {
                    if (typeof GM_getValue !== 'undefined') {
                        isEnabled = GM_getValue('us_enabled_' + entry.originalFile, true);
                    }
                } catch (e) {}

                if (!isEnabled) {
                    console.log(\`🔌 [Bundler] \${entry.name} is disabled via menu settings.\`);
                    return;
                }

                if (matchesPattern(entry.matches)) {
                    if (typeof window[entry.functionName] === 'function') {
                        window[entry.functionName]();
                    } else {
                        console.error(\`❌ Function \${entry.functionName} not found\`);
                    }
                }
            } catch (error) {
                reportError(entry.name, error);
            }
        });
    }
    
    const errorQueue = [];
    let errorDotElement = null;

    function reportError(nameOrType, errorObj) {
        const errorMsg = errorObj ? (errorObj.message || String(errorObj)) : "Unknown error";
        const errorStack = errorObj && errorObj.stack ? errorObj.stack : String(errorObj || "No stack trace available");
        
        errorQueue.push({
            source: nameOrType,
            message: errorMsg,
            stack: errorStack,
            time: new Date().toLocaleTimeString()
        });

        console.error(\`❌ [Bundler] Error in \${nameOrType}:\`, errorMsg, errorObj);

        try {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(errorStack);
            }
        } catch (e) {}

        if (!document.body) {
            if (!window._bundlerErrorListenerAdded) {
                window._bundlerErrorListenerAdded = true;
                const checkBody = setInterval(() => {
                    if (document.body) {
                        clearInterval(checkBody);
                        renderErrorDot();
                    }
                }, 100);
                document.addEventListener('DOMContentLoaded', () => {
                    clearInterval(checkBody);
                    renderErrorDot();
                });
            }
        } else {
            renderErrorDot();
        }
    }

    function renderErrorDot() {
        if (!document.body) return;
        if (errorDotElement && errorDotElement.parentNode) {
            updateErrorDot();
            return;
        }

        errorDotElement = document.createElement('div');
        errorDotElement.id = 'userscript-error-dot';
        
        const styleId = 'userscript-error-dot-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = \`
                #userscript-error-dot {
                    position: fixed !important;
                    bottom: 20px !important;
                    right: 20px !important;
                    width: 16px !important;
                    height: 16px !important;
                    border-radius: 50% !important;
                    background-color: #ff4d4f !important;
                    box-shadow: 0 0 10px rgba(255, 77, 79, 0.8), 0 2px 8px rgba(0, 0, 0, 0.3) !important;
                    cursor: pointer !important;
                    z-index: 2147483647 !important;
                    transition: transform 0.2s ease, background-color 0.3s ease, box-shadow 0.3s ease !important;
                    animation: userscript-error-pulse 2s infinite !important;
                }
                #userscript-error-dot:hover {
                    transform: scale(1.25) !important;
                }
                #userscript-error-dot.copied {
                    background-color: #52c41a !important;
                    box-shadow: 0 0 10px rgba(82, 196, 26, 0.8), 0 2px 8px rgba(0, 0, 0, 0.3) !important;
                }
                @keyframes userscript-error-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.7); }
                    70% { box-shadow: 0 0 0 8px rgba(255, 77, 79, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
                }
            \`;
            document.head.appendChild(style);
        }

        errorDotElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const combinedStack = errorQueue.map((err, idx) => {
                return \`[Error #\${idx + 1}] Source: \${err.source} (\${err.time})\\nMessage: \${err.message}\\nStack:\\n\${err.stack}\`;
            }).join('\\n\\n' + '='.repeat(50) + '\\n\\n');

            try {
                if (typeof GM_setClipboard !== 'undefined') {
                    GM_setClipboard(combinedStack);
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(combinedStack).catch(() => {});
                }
            } catch (err) {}

            errorDotElement.classList.add('copied');
            const originalTitle = errorDotElement.title;
            errorDotElement.title = 'Stack trace copied to clipboard!';
            setTimeout(() => {
                if (errorDotElement) {
                    errorDotElement.classList.remove('copied');
                    errorDotElement.title = originalTitle;
                }
            }, 1500);
        });

        errorDotElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (errorDotElement) {
                errorDotElement.remove();
                errorDotElement = null;
            }
        });

        document.body.appendChild(errorDotElement);
        updateErrorDot();
    }

    function updateErrorDot() {
        if (!errorDotElement) return;
        const count = errorQueue.length;
        const lastErr = errorQueue[count - 1];
        errorDotElement.title = \`❌ Userscript Error in \${lastErr.source} (\${count} total)\\nMessage: \${lastErr.message}\\n\\nClick to copy full stack trace.\\nDouble-click to dismiss.\`;
    }

    // Set up global error reporting for async/runtime userscript errors
    function handleGlobalError(type, message, errorObj) {
        try {
            const stack = errorObj && errorObj.stack ? errorObj.stack : String(errorObj);
            // Only report if it looks like it originated from our bundle/userscript context
            if (stack && (stack.includes('userscript.html') || stack.includes('userscript_bundle') || stack.includes('eval'))) {
                reportError(type, errorObj || message);
            }
        } catch (e) {}
    }

    window.addEventListener('error', function(event) {
        handleGlobalError("Runtime Error", event.message, event.error);
    });

    window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason;
        handleGlobalError("Unhandled Promise Rejection", reason ? reason.message : "Unknown", reason);
    });

    // Dispatcher itself should run early to catch document-start scripts
    executeDispatcher();
})();`
		addTemplate(dispatcherCode)
		addTemplate(`} catch (e) {
    console.error("❌ [Bundler] Critical Error:", e);
}`)

		// Step 5: Generate Source Map
		console.log("🗺️  Generating Source Map...")
		let prevSourceIndex = 0
		let prevSourceLine = 0
		let mappings = ""

		for (let i = 0; i < lineMappings.length; i++) {
			const mapping = lineMappings[i]
			if (i > 0) {
				mappings += ";"
			}
			if (mapping !== null) {
				const deltaSourceIndex = mapping.sourceIndex - prevSourceIndex
				const deltaSourceLine = mapping.sourceLine - prevSourceLine

				// 4 VLQ fields:
				// 1. Column in generated line (always 0, delta from 0 is 0)
				// 2. Index in sources array
				// 3. Line in source file
				// 4. Column in source file (always 0, delta from 0 is 0)
				const segment =
					encodeVLQ(0) +
					encodeVLQ(deltaSourceIndex) +
					encodeVLQ(deltaSourceLine) +
					encodeVLQ(0)
				mappings += segment

				prevSourceIndex = mapping.sourceIndex
				prevSourceLine = mapping.sourceLine
			}
		}

		// Read all sources to include content inline
		const sourcesContent = []
		for (const entry of manifest) {
			if (entry.files && Array.isArray(entry.files)) {
				let groupCombined = ""
				for (const f of entry.files) {
					const sp = path.join(USERSCRIPTS_DIR, f)
					if (fs.existsSync(sp)) {
						groupCombined += `/* ===== ${f} ===== */\n` + fs.readFileSync(sp, "utf8") + "\n\n"
					}
				}
				sourcesContent.push(groupCombined)
			} else if (entry.file) {
				const sourcePath = path.join(USERSCRIPTS_DIR, entry.file)
				if (fs.existsSync(sourcePath)) {
					sourcesContent.push(fs.readFileSync(sourcePath, "utf8"))
				} else {
					sourcesContent.push("")
				}
			} else {
				sourcesContent.push("")
			}
		}

		const sourceMap = {
			version: 3,
			file: OUTPUT_FILE,
			sources: manifest.map((entry) => `webpack://userscripts/${entry.file || entry.group || entry.name}`),
			sourcesContent: sourcesContent,
			names: [],
			mappings: mappings,
		}

		const sourceMapBase64 = Buffer.from(JSON.stringify(sourceMap)).toString(
			"base64",
		)
		const sourceMapUrl = `\n//# sourceURL=userscript_bundle.js\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${sourceMapBase64}`

		const bundleCode = outputLines.join("\n") + sourceMapUrl

		// Step 6: Write output file
		console.log(`💾 Writing bundle to: ${OUTPUT_FILE}`)
		fs.writeFileSync(OUTPUT_FILE, bundleCode, "utf8")

		const stats = fs.statSync(OUTPUT_FILE)
		console.log("🎉 Bundling completed successfully!")
		console.log(
			`📊 Stats: ${(stats.size / 1024).toFixed(2)} KB, ${processedManifest.length} scripts`,
		)

		// Step 7: Compile multi-module (grouped) userscripts into standalone files
		const COMPILED_DIR = path.join(__dirname, "compiled")
		const groupedEntries = manifest.filter(entry => entry.files && Array.isArray(entry.files))

		if (groupedEntries.length > 0) {
			if (!fs.existsSync(COMPILED_DIR)) {
				fs.mkdirSync(COMPILED_DIR, { recursive: true })
			}

			console.log(`\n📦 Compiling ${groupedEntries.length} multi-module userscript(s) into standalone files in: ${COMPILED_DIR}`)

			for (const groupEntry of groupedEntries) {
				const idName = groupEntry.id || groupEntry.group || (groupEntry.name ? groupEntry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "grouped-script")
				const outputFilename = `${idName}.user.js`
				const outputPath = path.join(COMPILED_DIR, outputFilename)

				let standaloneCode = `// ==UserScript==\n`
				standaloneCode += `// @name         ${groupEntry.name || groupEntry.group || "Grouped Userscript"}\n`
				if (groupEntry.description) {
					standaloneCode += `// @description  ${groupEntry.description}\n`
				}

				const matches = groupEntry.matches || (groupEntry.match ? [groupEntry.match] : [])
				matches.forEach(m => {
					standaloneCode += `// @match        ${m}\n`
				})

				const groupGrants = new Set()
				const groupConnects = new Set()
				let groupRunAt = "document-idle"
				let concatenatedBody = ""

				for (const relFile of groupEntry.files) {
					const fullPath = path.resolve(USERSCRIPTS_DIR, relFile)
					if (!fs.existsSync(fullPath)) continue

					const fileContent = fs.readFileSync(fullPath, "utf8")
					const headerLines = fileContent.split("\n")
					let inHeader = false

					for (const line of headerLines) {
						const trimmed = line.trim()
						if (trimmed === "// ==UserScript==") {
							inHeader = true
							continue
						}
						if (trimmed === "// ==/UserScript==") {
							break
						}
						if (inHeader) {
							const grantMatch = trimmed.match(/^\/\/\s*@grant\s+(.+)$/)
							if (grantMatch && grantMatch[1].trim() !== "none") {
								groupGrants.add(grantMatch[1].trim())
							}
							const connectMatch = trimmed.match(/^\/\/\s*@connect\s+(.+)$/)
							if (connectMatch) {
								groupConnects.add(connectMatch[1].trim())
							}
						}
					}

					const runAtMatch = fileContent.match(/\/\/\s*@run-at\s+(.+)$/m)
					if (runAtMatch) {
						groupRunAt = runAtMatch[1].trim()
					}

					concatenatedBody += `/* ===== ${relFile} ===== */\n${fileContent}\n\n`
				}

				Array.from(groupGrants).sort().forEach(g => {
					standaloneCode += `// @grant        ${g}\n`
				})
				Array.from(groupConnects).sort().forEach(c => {
					standaloneCode += `// @connect      ${c}\n`
				})
				standaloneCode += `// @run-at       ${groupRunAt}\n`
				standaloneCode += `// ==/UserScript==\n\n`
				standaloneCode += concatenatedBody

				// Validate syntax of compiled standalone userscript
				try {
					new vm.Script(standaloneCode, { filename: outputFilename })
				} catch (syntaxError) {
					console.error(`❌ [Syntax Error] In compiled standalone script: ${outputFilename}`)
					console.error(syntaxError.stack || syntaxError.message)
					process.exit(1)
				}

				fs.writeFileSync(outputPath, standaloneCode, "utf8")
				const fileStats = fs.statSync(outputPath)
				console.log(`  ✅ Compiled: ${outputFilename} (${(fileStats.size / 1024).toFixed(2)} KB)`)
			}
		}

		// Display usage instructions
		const absoluteBundlePath = path.resolve(OUTPUT_FILE)
		console.log("\n📖 Master Userscript Configuration:")
		console.log("---------------------------------------")
		console.log("// ==UserScript==")
		console.log("// @name         Local Userscript Bundle Loader")
		console.log("// @match        *://*/*")
		console.log("// @run-at       document-start")
		Array.from(allGrants)
			.sort()
			.forEach((grant) => {
				console.log(`// @grant        ${grant}`)
			})
		if (allGrants.size === 0) console.log("// @grant        none")
		console.log(`// @require      file://${absoluteBundlePath}`)
		console.log("// ==/UserScript==")
		console.log("---------------------------------------")
		console.log(
			"⚠️ Make sure to update your loader script in Tampermonkey with the grants above!",
		)
		console.log(
			"3. The bundle will automatically detect the current page URL and execute the appropriate scripts",
		)

		if (
			buildTimeMissingGrants.length > 0 ||
			buildTimeMissingConnects.length > 0
		) {
			console.log(
				"\n\x1b[41m\x1b[37m\x1b[1m 🚨 WARNING: MASTER USERSCRIPT CONFIGURATION IS OUT OF SYNC! 🚨 \x1b[0m",
			)
			if (buildTimeMissingGrants.length > 0) {
				console.log(
					`\x1b[31m\x1b[1mMissing @grant(s) in README.md Master Userscript:\x1b[0m`,
				)
				buildTimeMissingGrants.forEach((g) =>
					console.log(`  \x1b[31m- @grant ${g}\x1b[0m`),
				)
			}
			if (buildTimeMissingConnects.length > 0) {
				console.log(
					`\x1b[31m\x1b[1mMissing @connect(s) in README.md Master Userscript:\x1b[0m`,
				)
				buildTimeMissingConnects.forEach((c) =>
					console.log(`  \x1b[31m- @connect ${c}\x1b[0m`),
				)
			}
			console.log(
				"\x1b[33m👉 Please update the Master Userscript block in README.md and copy the updated version to Tampermonkey!\x1b[0m\n",
			)
		}
	} catch (error) {
		console.error("❌ Bundling failed:", error.message)
		process.exit(1)
	}
}

// Execute the bundler if this script is run directly
if (require.main === module) {
	bundleUserscripts()
}

module.exports = { bundleUserscripts }
