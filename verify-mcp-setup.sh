#!/bin/bash

echo "Verifying MCP setup..."
echo ""

# Check if mcp-omnisearch directory exists
if [ -d "/Users/angel/Documents/Projects/mcp-omnisearch" ]; then
    echo "✓ mcp-omnisearch directory exists"
    
    # Check for package.json
    if [ -f "/Users/angel/Documents/Projects/mcp-omnisearch/package.json" ]; then
        echo "✓ package.json found"
    else
        echo "✗ package.json not found - repository may not be properly cloned"
    fi
    
    # Check for dist directory
    if [ -d "/Users/angel/Documents/Projects/mcp-omnisearch/dist" ]; then
        echo "✓ dist directory found - project is built"
    else
        echo "✗ dist directory not found - project needs to be built"
        echo "  Run: cd /Users/angel/Documents/Projects/mcp-omnisearch && npm install && npm run build"
    fi
else
    echo "✗ mcp-omnisearch directory not found"
    echo "  Run: ./setup-mcp-omnisearch.sh to set it up"
fi

echo ""
echo "Checking Claude Code MCP configuration..."
if [ -f "/Users/angel/Library/Application Support/Claude/claude-code-mcp-config.json" ]; then
    echo "✓ Claude Code MCP configuration file exists"
    echo ""
    echo "Current configuration:"
    cat "/Users/angel/Library/Application Support/Claude/claude-code-mcp-config.json"
else
    echo "✗ Claude Code MCP configuration file not found"
fi

echo ""
echo "To complete setup:"
echo "1. Run ./setup-mcp-omnisearch.sh if mcp-omnisearch is not properly installed"
echo "2. Add your API keys to the configuration file"
echo "3. Restart Claude Code"