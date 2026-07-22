import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

test("Script Manifest Integrity", (t) => {
	const manifestPath = path.join(process.cwd(), "script_manifest.json")
	assert.ok(fs.existsSync(manifestPath), "script_manifest.json exists")

	const raw = fs.readFileSync(manifestPath, "utf8")
	const manifest = JSON.parse(raw)
	assert.ok(Array.isArray(manifest), "Manifest is array")

	manifest.forEach((entry) => {
		assert.ok(entry.id, `Entry missing id: ${entry.name}`)
		assert.ok(entry.name, `Entry missing name: ${entry.id}`)
		assert.ok(entry.kind === "standalone" || entry.kind === "grouped", `Invalid kind for ${entry.id}`)
		assert.ok(Array.isArray(entry.matches), `Matches must be array for ${entry.id}`)

		if (entry.kind === "grouped") {
			assert.ok(Array.isArray(entry.files), `Files array missing for grouped ${entry.id}`)
			entry.files.forEach((f) => {
				const p = path.join(process.cwd(), "userscripts", f)
				assert.ok(fs.existsSync(p), `Grouped source file missing: ${f}`)
			})
		} else {
			assert.ok(entry.file, `File missing for standalone ${entry.id}`)
			const p = path.join(process.cwd(), "userscripts", entry.file)
			assert.ok(fs.existsSync(p), `Standalone source file missing: ${entry.file}`)
		}
	})
})

test("Bundle Output Generation", (t) => {
	const bundlePath = path.join(process.cwd(), "userscript_bundle.js")
	assert.ok(fs.existsSync(bundlePath), "userscript_bundle.js created")

	const bundleContent = fs.readFileSync(bundlePath, "utf8")
	assert.ok(bundleContent.includes("Userscript Control Center"), "Control Center included in bundle")
	assert.ok(bundleContent.includes("uscc-root"), "Control Center UI root element included")
})
