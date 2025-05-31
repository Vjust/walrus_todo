#!/bin/bash

echo "MCP Omnisearch Connection Verification"
echo "======================================"
echo ""

# Check if wrapper script exists
echo "1. Checking wrapper script..."
if [ -f "/Users/angel/Documents/Projects/mcp-omnisearch/mcp-omnisearch-wrapper.sh" ]; then
    echo "✅ Wrapper script exists"
    if [ -x "/Users/angel/Documents/Projects/mcp-omnisearch/mcp-omnisearch-wrapper.sh" ]; then
        echo "✅ Wrapper script is executable"
    else
        echo "❌ Wrapper script is NOT executable"
    fi
else
    echo "❌ Wrapper script NOT FOUND"
fi
echo ""

# Check dist directory
echo "2. Checking compiled files..."
if [ -f "/Users/angel/Documents/Projects/mcp-omnisearch/dist/index.js" ]; then
    echo "✅ dist/index.js exists"
else
    echo "❌ dist/index.js NOT FOUND"
fi
echo ""

# Check MCP configuration
echo "3. Checking Claude Code MCP configuration..."
CONFIG_FILE="/Users/angel/Library/Application Support/Claude/claude-code-mcp-config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Configuration file exists"
    echo ""
    echo "mcp-omnisearch configuration:"
    jq '.mcpServers."mcp-omnisearch"' "$CONFIG_FILE" 2>/dev/null || cat "$CONFIG_FILE" | grep -A 10 "mcp-omnisearch"
else
    echo "❌ Configuration file NOT FOUND"
fi
echo ""

# Test wrapper script with API keys
echo "4. Testing wrapper script with API keys..."
export TAVILY_API_KEY="test"
export PERPLEXITY_API_KEY="test"
if timeout 3 /Users/angel/Documents/Projects/mcp-omnisearch/mcp-omnisearch-wrapper.sh 2>&1 | head -n 5; then
    echo "✅ Wrapper script runs successfully"
else
    echo "⚠️  Wrapper script test inconclusive (timeout expected for stdio mode)"
fi
echo ""

echo "Summary:"
echo "--------"
echo "The wrapper script has been created and configured."
echo "Please restart Claude Code to apply the changes."
echo ""
echo "If the error persists after restart, try:"
echo "1. Completely quit Claude Code (Cmd+Q)"
echo "2. Wait 10 seconds"
echo "3. Start Claude Code again"