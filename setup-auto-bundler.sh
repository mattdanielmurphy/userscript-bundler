#!/bin/bash

# Userscript Bundler Auto-Setup Script
# This script installs the file watcher as a LaunchAgent

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_NAME="com.mattmurphy.userscript-bundler.plist"
PLIST_SOURCE="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
WATCHER_SCRIPT="$SCRIPT_DIR/watch-and-bundle.js"

echo -e "${BLUE}🚀 Setting up Userscript Bundler Auto-Watcher${NC}"
echo ""

# Check if we're in the right directory
if [[ ! -f "$SCRIPT_DIR/bundler.js" ]]; then
    echo -e "${RED}❌ Error: bundler.js not found in current directory${NC}"
    echo "Please run this script from the userscript-bundler directory"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js not found${NC}"
    echo "Please install Node.js first"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found: $(which node)${NC}"

# Make the watcher script executable
chmod +x "$WATCHER_SCRIPT"
echo -e "${GREEN}✅ Made watcher script executable${NC}"

# Stop existing service if it's running
if launchctl list | grep -q "com.mattmurphy.userscript-bundler"; then
    echo -e "${YELLOW}🛑 Stopping existing service...${NC}"
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Copy plist to LaunchAgents directory
echo -e "${BLUE}📋 Installing LaunchAgent plist...${NC}"
cp "$PLIST_SOURCE" "$PLIST_DEST"
echo -e "${GREEN}✅ Plist copied to: $PLIST_DEST${NC}"

# Load the service
echo -e "${BLUE}🔄 Loading LaunchAgent...${NC}"
launchctl load "$PLIST_DEST"
echo -e "${GREEN}✅ LaunchAgent loaded successfully${NC}"

# Check if service is running
sleep 2
if launchctl list | grep -q "com.mattmurphy.userscript-bundler"; then
    echo -e "${GREEN}✅ Service is running${NC}"
else
    echo -e "${YELLOW}⚠️  Service may not be running yet, check logs${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${BLUE}📊 Service Information:${NC}"
echo "  • Service Name: com.mattmurphy.userscript-bundler"
echo "  • Plist Location: $PLIST_DEST"
echo "  • Watcher Script: $WATCHER_SCRIPT"
echo "  • Log File: $SCRIPT_DIR/watcher.log"
echo "  • Error Log: $SCRIPT_DIR/watcher.err"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  • Check status: launchctl list | grep userscript-bundler"
echo "  • Stop service: launchctl unload $PLIST_DEST"
echo "  • Start service: launchctl load $PLIST_DEST"
echo "  • View logs: tail -f $SCRIPT_DIR/watcher.log"
echo "  • View errors: tail -f $SCRIPT_DIR/watcher.err"
echo ""
echo -e "${BLUE}💡 Usage:${NC}"
echo "  • The watcher will automatically run when you start your Mac"
echo "  • It monitors the userscripts/ directory for changes"
echo "  • When you edit a .js file, it automatically runs the bundler"
echo "  • Check the log files to see activity"
echo ""
echo -e "${GREEN}✨ Your userscript bundler is now running automatically!${NC}"
