const https = require("https")
const fs = require("fs")
const { execSync } = require("child_process")

const PORT = 8765
const KEY_FILE = "localhost.key"
const CRT_FILE = "localhost.crt"

// Generate certs if missing
if (!fs.existsSync(KEY_FILE) || !fs.existsSync(CRT_FILE)) {
	console.log("🔑 Generating self-signed certificates...")
	try {
		execSync(`openssl req -x509 -newkey rsa:2048 -keyout ${KEY_FILE} -out ${CRT_FILE} -days 365 -nodes -subj "/CN=localhost"`)
	} catch (e) {
		console.error("❌ Failed to generate certificates. Do you have openssl installed?")
		process.exit(1)
	}
}

const options = {
	key: fs.readFileSync(KEY_FILE),
	cert: fs.readFileSync(CRT_FILE),
}

https
	.createServer(options, (req, res) => {
		// Enable CORS for userscript managers
		res.setHeader("Access-Control-Allow-Origin", "*")
		res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
		res.setHeader("Access-Control-Allow-Headers", "*")

		// Prevent caching absolutely everywhere
		res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		res.setHeader("Pragma", "no-cache")
		res.setHeader("Expires", "0")
		res.setHeader("Surrogate-Control", "no-store")

		if (req.method === "OPTIONS") {
			res.writeHead(204)
			res.end()
			return
		}

		if (req.url === "/" || req.url.includes("userscript_bundle.js")) {
			const filePath = "./userscript_bundle.js"
			if (fs.existsSync(filePath)) {
				res.writeHead(200, { "Content-Type": "application/javascript" })
				fs.createReadStream(filePath).pipe(res)
				console.log(`📤 Served bundle to ${req.socket.remoteAddress}`)
			} else {
				res.writeHead(404)
				res.end("userscript_bundle.js not found - run bundler first!")
			}
		} else {
			res.writeHead(404)
			res.end("Not found. The only valid endpoint is /userscript_bundle.js")
		}
	})
	.listen(PORT, () => {
		console.log(`\n🚀 HTTPS Server running at https://localhost:${PORT}/userscript_bundle.js`)
		console.log(
			`\n⚠️  IMPORTANT: Open https://localhost:${PORT}/userscript_bundle.js in your browser and click "Advanced" -> "Proceed" to accept the self-signed certificate. Otherwise scripts will fail to load.\n`
		)
	})
