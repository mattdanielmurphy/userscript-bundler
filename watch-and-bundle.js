#!/usr/bin/env node

/**
 * Userscript Bundler File Watcher
 *
 * This script watches the userscripts directory for changes and automatically
 * runs the bundler when files are modified, added, or removed.
 */

const fs = require("fs")
const path = require("path")
const https = require("https")
const { spawn, execSync } = require("child_process")

// Configuration
const PORT = 8765
const BUNDLE_FILE = "userscript_bundle.js"
const USERSCRIPTS_DIR = path.join(__dirname, "userscripts")
const BUNDLER_SCRIPT = path.join(__dirname, "bundler.js")
const LOG_FILE = path.join(__dirname, "watcher.log")
const ERROR_LOG_FILE = path.join(__dirname, "watcher.err")

// SSL Certificate implementation (Self-Signed)
// We generate these on the fly if they don't exist to allow HTTPS serving
function getCertificates() {
	const certPath = path.join(__dirname, "localhost.crt")
	const keyPath = path.join(__dirname, "localhost.key")

	if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
		console.log("🔒 Generating self-signed SSL certificates for localhost...")
		try {
			execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`, { stdio: "ignore" })
		} catch (e) {
			console.error("❌ Failed to generate SSL certs. Please install openssl or allow mixed content.")
		}
	}
	return {
		key: fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : null,
		cert: fs.existsSync(certPath) ? fs.readFileSync(certPath) : null,
	}
}

// Debounce settings
const DEBOUNCE_DELAY = 1000 // 1 second
let debounceTimer = null

/**
 * Log a message with timestamp
 */
function log(message, isError = false) {
	const timestamp = new Date().toISOString()
	const logMessage = `[${timestamp}] ${message}\n`

	try {
		fs.appendFileSync(isError ? ERROR_LOG_FILE : LOG_FILE, logMessage)
		console.log(logMessage.trim())
	} catch (err) {
		console.error("Failed to write to log file:", err.message)
		console.log(logMessage.trim())
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
				log("Bundler output: " + output.trim().replace(/\n/g, " | "))
			}
		} else {
			log(`❌ Bundler failed with exit code ${code}`, true)
			if (errorOutput.trim()) {
				log("Bundler error: " + errorOutput.trim().replace(/\n/g, " | "), true)
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

	/**
	 * Start a minimal HTTPS server to serve the bundle
	 */
	function startServer() {
		const { key, cert } = getCertificates()

		if (!key || !cert) {
			log("❌ Could not start HTTPS server (missing certs). Falling back to HTTP (might be blocked by browsers).", true)
			require("http")
				.createServer((req, res) => handleRequest(req, res))
				.listen(PORT, "127.0.0.1")
			return
		}

		const server = https.createServer({ key, cert }, handleRequest)

		server.listen(PORT, "127.0.0.1", () => {
			log(`🌐 Secure Hub server running at https://localhost:${PORT}/${BUNDLE_FILE}`)
			log(`⚠️  NOTE: You must visit https://localhost:${PORT}/${BUNDLE_FILE} once to accept the self-signed certificate!`)
		})
	}

	function handleRequest(req, res) {
		// Enable CORS and disable caching
		res.setHeader("Access-Control-Allow-Origin", "*")
		res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
		res.setHeader("Access-Control-Allow-Headers", "*")
		res.setHeader("Access-Control-Allow-Private-Network", "true") // Critical for Local Network Access
		res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		res.setHeader("Pragma", "no-cache")
		res.setHeader("Expires", "0")

		if (req.method === "OPTIONS") {
			res.writeHead(200)
			res.end()
			return
		}

		const bundlePath = path.join(__dirname, BUNDLE_FILE)

		if (fs.existsSync(bundlePath)) {
			res.writeHead(200, { "Content-Type": "application/javascript" })
			fs.createReadStream(bundlePath).pipe(res)
		} else {
			res.writeHead(404)
			res.end("Bundle not found")
		}
	}

	// Start the HTTP server
	startServer()

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
