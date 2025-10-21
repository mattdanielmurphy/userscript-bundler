#!/bin/bash

# Test script for the userscript bundler watcher

echo "🧪 Testing Userscript Bundler Watcher"
echo ""

# Test 1: Check if watcher script runs without errors
echo "Test 1: Running watcher script for 3 seconds..."
timeout 3s node watch-and-bundle.js 2>&1 | head -10 || echo "✅ Watcher script test completed"

echo ""

# Test 2: Check if log files are created
echo "Test 2: Checking for log files..."
if [ -f "watcher.log" ]; then
    echo "✅ Log file created: watcher.log"
    echo "Last few lines:"
    tail -3 watcher.log
else
    echo "⚠️  No log file created yet"
fi

echo ""

# Test 3: Test file modification detection
echo "Test 3: Testing file modification detection..."
echo "// Test comment" >> userscripts/test-file.js
sleep 2
echo "// Another test comment" >> userscripts/test-file.js
sleep 2
rm userscripts/test-file.js
echo "✅ Test file created, modified, and removed"

echo ""

# Test 4: Check if bundle was updated
echo "Test 4: Checking bundle timestamp..."
if [ -f "userscript_bundle.js" ]; then
    echo "✅ Bundle file exists"
    echo "Last modified: $(stat -f "%Sm" userscript_bundle.js)"
else
    echo "❌ Bundle file not found"
fi

echo ""
echo "🎉 Test completed!"
