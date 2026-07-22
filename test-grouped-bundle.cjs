/**
 * Regression test for Grouped Userscript Bundling
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const vm = require("vm")

const testDir = path.join(__dirname, "tmp_test_grouped")
const userscriptsDir = path.join(testDir, "userscripts")
const groupDir = path.join(userscriptsDir, "test-group")
const manifestPath = path.join(testDir, "script_manifest.json")

console.log("🧪 Starting Grouped Userscript Bundler Regression Test...")

try {
	// Cleanup test dir if exists
	if (fs.existsSync(testDir)) {
		fs.rmSync(testDir, { recursive: true, force: true })
	}

	fs.mkdirSync(groupDir, { recursive: true })

	// Write file 1: defines shared state and function
	const file1Path = path.join(groupDir, "00-setup.js")
	fs.writeFileSync(
		file1Path,
		`// ==UserScript==
// @name Test Grouped Script
// @match https://test.example.com/*
// @run-at document-start
// ==/UserScript==
(function() {
  'use strict';
  const SHARED_SECRET = "SHARED_LEXICAL_SCOPE_SUCCESS";
  function getSharedSecret() { return SHARED_SECRET; }
`,
		"utf8",
	)

	// Write file 2: uses function and constant from file 1
	const file2Path = path.join(groupDir, "01-feature.js")
	fs.writeFileSync(
		file2Path,
		`  window.__TEST_OUTPUT__ = getSharedSecret();
  window.__TEST_DISPATCH_COUNT__ = (window.__TEST_DISPATCH_COUNT__ || 0) + 1;
})();
`,
		"utf8",
	)

	// Write script_manifest.json
	const manifestContent = [
		{
			name: "Test Grouped Script",
			match: "test.example.com",
			group: "test-group",
			files: ["test-group/00-setup.js", "test-group/01-feature.js"],
		},
	]
	fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2), "utf8")

	// We can invoke bundler logic by copying bundler.js or running node bundler inside test dir
	// Let's create a small script runner inside testDir that requires bundler logic
	const bundlerScript = fs.readFileSync(path.join(__dirname, "bundler.cjs"), "utf8")
		.replace('const MANIFEST_FILE = "script_manifest.json"', `const MANIFEST_FILE = "script_manifest.json"`)
		.replace('const USERSCRIPTS_DIR = "./userscripts/"', `const USERSCRIPTS_DIR = "${userscriptsDir}/"`)
		.replace('const OUTPUT_FILE = "userscript_bundle.js"', `const OUTPUT_FILE = "${path.join(testDir, "userscript_bundle.js")}"`)

	const testBundlerPath = path.join(testDir, "test_bundler.cjs")
	fs.writeFileSync(testBundlerPath, bundlerScript, "utf8")

	execSync(`node "${testBundlerPath}"`, { cwd: testDir, stdio: "pipe" })

	const bundleContent = fs.readFileSync(path.join(testDir, "userscript_bundle.js"), "utf8")

	// 1. Confirm source boundary comments
	if (!bundleContent.includes("/* ===== test-group/00-setup.js ===== */")) {
		throw new Error("Missing boundary comment for file 1")
	}
	if (!bundleContent.includes("/* ===== test-group/01-feature.js ===== */")) {
		throw new Error("Missing boundary comment for file 2")
	}

	// 2. Confirm order is preserved
	const idx1 = bundleContent.indexOf("/* ===== test-group/00-setup.js ===== */")
	const idx2 = bundleContent.indexOf("/* ===== test-group/01-feature.js ===== */")
	if (idx1 >= idx2) {
		throw new Error("Group load order was not preserved!")
	}

	// 3. Confirm lexical sharing & single dispatch execution
	const sandbox = {
		window: {
			location: { href: "https://test.example.com/page" },
			addEventListener: () => {},
			removeEventListener: () => {},
		},
		console: console,
		document: {
			readyState: "complete",
			addEventListener: () => {},
		},
		setTimeout: (fn) => fn(),
		setInterval: () => {},
	}
	sandbox.globalThis = sandbox.window
	sandbox.window.window = sandbox.window

	vm.createContext(sandbox)
	vm.runInContext(bundleContent, sandbox)

	if (sandbox.window.__TEST_OUTPUT__ !== "SHARED_LEXICAL_SCOPE_SUCCESS") {
		throw new Error(`Lexical sharing failed! Got: ${sandbox.window.__TEST_OUTPUT__}`)
	}

	if (sandbox.window.__TEST_DISPATCH_COUNT__ !== 1) {
		throw new Error(`Dispatcher call count incorrect! Got: ${sandbox.window.__TEST_DISPATCH_COUNT__}`)
	}

	console.log("✅ Grouped execution, lexical sharing, order, and dispatch count verified!")

	// 4. Confirm missing file fails clearly
	fs.rmSync(file2Path)
	let failedAsExpected = false
	try {
		execSync(`node "${testBundlerPath}"`, { cwd: testDir, stdio: "pipe" })
	} catch (err) {
		const stderr = err.stderr ? err.stderr.toString() : err.stdout.toString()
		if (stderr.includes("Grouped source file missing")) {
			failedAsExpected = true;
		}
	}

	if (!failedAsExpected) {
		throw new Error("Missing grouped source file did not trigger clear build failure error!")
	}

	console.log("✅ Missing file build failure check verified!")
	console.log("🎉 All regression tests passed successfully!")
} finally {
	if (fs.existsSync(testDir)) {
		fs.rmSync(testDir, { recursive: true, force: true })
	}
}
