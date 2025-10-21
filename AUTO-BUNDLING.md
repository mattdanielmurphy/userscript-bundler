# Automatic Userscript Bundling

This system automatically watches your `userscripts/` directory and runs the bundler whenever you edit a JavaScript file. It integrates with your existing LaunchAgent setup using the same naming convention as your other automation scripts.

## 🚀 Quick Setup

Run the setup script to install everything:

```bash
./setup-auto-bundler.sh
```

This will:
- Install the file watcher as a LaunchAgent
- Start the service immediately
- Configure it to run automatically on system startup

## 📁 Files Created

- `watch-and-bundle.js` - Node.js file watcher script
- `com.mattmurphy.userscript-bundler.plist` - LaunchAgent configuration
- `setup-auto-bundler.sh` - Installation script
- `test-watcher.sh` - Test script

## 🔧 How It Works

1. **File Watching**: Uses Node.js built-in `fs.watch()` to monitor the `userscripts/` directory
2. **Debouncing**: Waits 1 second after file changes to avoid multiple rapid rebuilds
3. **Automatic Bundling**: Runs `node bundler.js` whenever a `.js` file is modified
4. **Logging**: All activity is logged to `watcher.log` and errors to `watcher.err`

## 📊 Service Management

### Check Status
```bash
launchctl list | grep userscript-bundler
```

### View Logs
```bash
# View activity log
tail -f watcher.log

# View error log
tail -f watcher.err
```

### Stop Service
```bash
launchctl unload ~/Library/LaunchAgents/com.mattmurphy.userscript-bundler.plist
```

### Start Service
```bash
launchctl load ~/Library/LaunchAgents/com.mattmurphy.userscript-bundler.plist
```

### Restart Service
```bash
launchctl unload ~/Library/LaunchAgents/com.mattmurphy.userscript-bundler.plist
launchctl load ~/Library/LaunchAgents/com.mattmurphy.userscript-bundler.plist
```

## 🧪 Testing

Run the test script to verify everything works:

```bash
./test-watcher.sh
```

## 🔄 Workflow

1. **Edit a userscript** in the `userscripts/` directory
2. **Save the file** - the watcher detects the change
3. **Wait 1 second** - debouncing prevents rapid rebuilds
4. **Bundle updates** - `userscript_bundle.js` is automatically regenerated
5. **Check logs** - see the activity in `watcher.log`

## 🎯 Integration with Your Existing Setup

This follows the same pattern as your existing automation:
- **Naming Convention**: `com.mattmurphy.userscript-bundler`
- **LaunchAgent Location**: `~/Library/LaunchAgents/`
- **Logging**: Separate log and error files
- **Auto-start**: Runs automatically on system startup

## 🛠️ Troubleshooting

### Service Not Starting
```bash
# Check if the plist is valid
plutil ~/Library/LaunchAgents/com.mattmurphy.userscript-bundler.plist

# Check for errors
tail -f watcher.err
```

### File Changes Not Detected
```bash
# Check if the watcher is running
launchctl list | grep userscript-bundler

# Check logs
tail -f watcher.log
```

### Bundle Not Updating
```bash
# Test the bundler manually
node bundler.js

# Check for bundler errors
tail -f watcher.err
```

## 🔧 Configuration

### Change Debounce Delay
Edit `watch-and-bundle.js` and modify:
```javascript
const DEBOUNCE_DELAY = 1000; // Change to desired milliseconds
```

### Change Log Locations
Edit `com.mattmurphy.userscript-bundler.plist` and modify:
```xml
<key>StandardOutPath</key>
<string>/path/to/your/log/file.log</string>
```

## 🎉 Benefits

- **Zero Manual Work**: Just edit and save userscripts
- **Always Up-to-Date**: Bundle is automatically regenerated
- **System Integration**: Runs with your other automation scripts
- **Reliable**: Uses macOS LaunchAgent system
- **Logged**: Full activity and error logging
- **Debounced**: Prevents excessive rebuilds during rapid editing

## 🔄 Uninstall

To remove the auto-bundling system:

```bash
# Stop and unload the service
launchctl unload ~/Library/LaunchAgents/com.mattmurphy.userscript-bundler.plist

# Remove the plist file
rm ~/Library/LaunchAgents/com.mattmurphy.userscript-bundler.plist

# Remove log files (optional)
rm watcher.log watcher.err
```

Your userscript bundler will continue to work manually with `node bundler.js`.
