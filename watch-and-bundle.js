#!/usr/bin/env node

/**
 * Userscript Bundler File Watcher
 *
 * This script watches the userscripts directory for changes and automatically
 * runs the bundler when files are modified, added, or removed.
 */

const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")
const BUNDLE_FILE = "userscript_bundle.js"
const USERSCRIPTS_DIR = path.join(__dirname, "userscripts")
const BUNDLER_SCRIPT = path.join(__dirname, "bundler.js")
const LOG_FILE = path.join(__dirname, "watcher.log")
const ERROR_LOG_FILE = path.join(__dirname, "watcher.err")

// Debounce settings
const DEBOUNCE_DELAY = 1000 // 1 second
let debounceTimer = null

function formatDate(date) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const day = String(date.getDate()).padStart(2, "0")
	let hours = date.getHours()
	const minutes = String(date.getMinutes()).padStart(2, "0")
	const seconds = String(date.getSeconds()).padStart(2, "0")
	const ampm = hours >= 12 ? "pm" : "am"
	hours = hours % 12
	hours = hours ? hours : 12 // the hour '0' should be '12'
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${ampm}`
}

/**
 * Log a message with timestamp
 */
function log(message, isError = false) {
	const timestamp = formatDate(new Date())
	const logMessage = `[${timestamp}] ${message}`

	if (isError) {
		console.error(logMessage)
	} else {
		console.log(logMessage)
	}
}

/**
 * Run the bundler script
 */
function runBundler() {
	log("🔄 File change detected, running bundler...")

	const bundler = spawn("node", [BUNDLER_SCRIPT], {
		cwd: __dirname,
		stdio: ["ignore", "pipe", "pipe"],
	})

	let output = ""
	let errorOutput = ""

	bundler.stdout.on("data", (data) => {
		output += data.toString()
	})

	bundler.stderr.on("data", (data) => {
		errorOutput += data.toString()
	})

	bundler.on("close", (code) => {
		if (code === 0) {
			log("✅ Bundler completed successfully")
			if (output.trim()) {
				const lines = output.trim().split("\n")
				lines.forEach((line) => log(`  ${line}`))
			}
		} else {
			log(`❌ Bundler failed with exit code ${code}`, true)
			if (errorOutput.trim()) {
				const lines = errorOutput.trim().split("\n")
				lines.forEach((line) => log(`  ${line}`, true))
			}
		}
	})

	bundler.on("error", (err) => {
		log(`❌ Failed to start bundler: ${err.message}`, true)
	})
}

/**
 * Debounced file change handler
 */
function handleFileChange(eventType, filename) {
	// Clear existing timer
	if (debounceTimer) {
		clearTimeout(debounceTimer)
	}

	// Set new timer
	debounceTimer = setTimeout(() => {
		log(`📁 File ${eventType}: ${filename}`)
		runBundler()
	}, DEBOUNCE_DELAY)
}

/**
 * Initialize the file watcher
 */
function startWatcher() {
	log("🚀 Starting userscript bundler file watcher...")

	// Check if userscripts directory exists
	if (!fs.existsSync(USERSCRIPTS_DIR)) {
		log(`❌ Userscripts directory not found: ${USERSCRIPTS_DIR}`, true)
		process.exit(1)
	}

	// Check if bundler script exists
	if (!fs.existsSync(BUNDLER_SCRIPT)) {
		log(`❌ Bundler script not found: ${BUNDLER_SCRIPT}`, true)
		process.exit(1)
	}

	log(`📁 Watching directory: ${USERSCRIPTS_DIR}`)
	log(`🔧 Bundler script: ${BUNDLER_SCRIPT}`)

	// Run bundler once on startup
	log("🔄 Running initial bundle...")
	runBundler()

	// Start watching the userscripts directory
	const userscriptWatcher = fs.watch(USERSCRIPTS_DIR, { recursive: true }, (eventType, filename) => {
		// Only watch for JavaScript files
		if (filename && filename.endsWith(".js")) {
			handleFileChange(eventType, filename)
		}
	})

	// Start watching the bundler script itself
	const bundlerWatcher = fs.watch(BUNDLER_SCRIPT, (eventType, filename) => {
		handleFileChange(eventType, "bundler.js")
	})

	// Handle watcher errors
	userscriptWatcher.on("error", (err) => {
		log(`❌ Userscript watcher error: ${err.message}`, true)
	})

	bundlerWatcher.on("error", (err) => {
		log(`❌ Bundler watcher error: ${err.message}`, true)
	})

	// Handle process termination
	process.on("SIGINT", () => {
		log("🛑 Received SIGINT, shutting down watchers...")
		userscriptWatcher.close()
		bundlerWatcher.close()
		process.exit(0)
	})

	process.on("SIGTERM", () => {
		log("🛑 Received SIGTERM, shutting down watchers...")
		userscriptWatcher.close()
		bundlerWatcher.close()
		process.exit(0)
	})

	log("✅ File watcher started successfully")
	log("💡 Watching for changes to .js files in userscripts directory and bundler.js...")
}

// Start the watcher
startWatcher()
