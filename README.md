# Userscript Bundler

A Node.js-based automation system that creates a single, CSP-safe JavaScript bundle for Tampermonkey userscripts. This system allows you to manage multiple userscripts locally and have them dynamically loaded based on the current page URL.

## Purpose

This bundler solves the problem of managing multiple userscripts in Tampermonkey by:

1. **Avoiding CSP errors**: Creates a single bundled file that can be loaded via `@require`
2. **Dynamic loading**: Automatically executes the appropriate script based on the current page URL
3. **Easy management**: Add new userscripts without manually updating Tampermonkey configurations
4. **Local development**: Edit scripts locally and have them automatically bundled

## How It Works

### 1. Master Userscript
You install one master userscript in Tampermonkey that loads the bundled file:

```javascript
// ==UserScript==
// @name         Local Userscript Dynamic Loader
// @version      0.1
// @description  Loads local userscripts from bundle in ~/projects/userscript-bundler
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @require      file:///Users/matthewmurphy/projects/userscript-bundler/userscript_bundle.js
// ==/UserScript==
```

### 2. Source Scripts
Create individual JavaScript files for different websites or functionalities. Each script contains immediately executing code (not wrapped in functions).

### 3. Manifest Configuration
Define which scripts should run on which URLs using `script_manifest.json`.

### 4. Bundling Process
Run `node bundler.js` to:
- Read all source scripts
- Wrap each script in a unique function
- Generate a dispatcher that checks the current URL
- Create a single `userscript_bundle.js` file

### 5. Dynamic Execution
The bundled file automatically:
- Checks the current page URL
- Matches it against configured patterns
- Executes the appropriate script function
i
## File Structure

```
userscript-bundler/
├── README.md                           # This file
├── AUTO-BUNDLING.md                    # Auto-bundling documentation
├── bundler.js                          # Main bundling script
├── watch-and-bundle.js                 # File watcher for auto-bundling
├── setup-auto-bundler.sh               # Auto-bundling setup script
├── test-watcher.sh                     # Test script for file watcher
├── com.mattmurphy.userscript-bundler.plist  # LaunchAgent configuration
├── userscripts/                        # Source scripts directory
│   ├── source_script_a.js              # Example script for GitHub
│   ├── source_script_b.js              # Example script for Wikipedia
│   └── youtube search exclude terms.js # Example YouTube script
└── userscript_bundle.js                # Generated output (created by bundler)
```

## Usage

### Manual Bundling

1. **Create your source scripts**:
   - Add JavaScript files to the `userscripts/` directory
   - Include proper userscript headers with `@name` and `@match`
   - Write immediately executing code (no manual function wrapping)
   - Include logging to confirm execution

2. **Generate the bundle**:
   ```bash
   node bundler.js
   ```

3. **Install in Tampermonkey**:
   - Create a new userscript with the master template
   - Update the `@require` path to point to your `userscript_bundle.js`

### Automatic Bundling (Recommended)

For seamless development, set up automatic bundling that watches for file changes:

1. **Set up auto-bundling**:
   ```bash
   ./setup-auto-bundler.sh
   ```

2. **Edit and save userscripts**:
   - The bundle automatically updates when you save `.js` files
   - No need to manually run the bundler
   - See `AUTO-BUNDLING.md` for complete documentation

3. **Add new scripts**:
   - Create new source files in `userscripts/`
   - Include proper userscript headers
   - The bundle automatically updates
   - No need to update Tampermonkey!

## Example Source Scripts

### GitHub Script (`source_script_a.js`)
```javascript
console.log('GitHub script loaded!');
// Add GitHub-specific functionality here
```

### Wikipedia Script (`source_script_b.js`)
```javascript
console.log('Wikipedia script loaded!');
// Add Wikipedia-specific functionality here
```

## Manifest Configuration

```json
[
  {
    "file": "source_script_a.js",
    "match": "github.com"
  },
  {
    "file": "source_script_b.js", 
    "match": "wikipedia.org"
  }
]
```

## Benefits

- **No CSP issues**: Single bundled file avoids Content Security Policy restrictions
- **Easy maintenance**: Add/remove scripts without touching Tampermonkey
- **Local development**: Edit scripts in your preferred editor
- **Automatic bundling**: File watcher automatically rebuilds when you save changes
- **URL-based routing**: Scripts automatically run on the right pages
- **System integration**: Auto-bundling runs as a macOS LaunchAgent (starts with your Mac)
- **Zero manual work**: Just edit and save - everything else is automatic

## Technical Details

The bundler:
1. **Auto-generates manifest** from userscript headers (`@name` and `@match`)
2. **Wraps each source script** in a unique function name with DOM ready logic
3. **Creates a dispatcher** that checks `window.location.href`
4. **Uses simple string matching** to determine which script to run
5. **Outputs a single, self-contained JavaScript file**

### Auto-Bundling System
- **File watcher** monitors the `userscripts/` directory for changes
- **Debounced execution** prevents rapid rebuilds during editing
- **LaunchAgent integration** runs automatically on system startup
- **Full logging** tracks all activity and errors

This approach ensures compatibility with Tampermonkey's CSP restrictions while providing a flexible, automated development workflow.

## Documentation

- **`AUTO-BUNDLING.md`** - Complete guide to the automatic bundling system
- **`README.md`** - This overview and usage guide
