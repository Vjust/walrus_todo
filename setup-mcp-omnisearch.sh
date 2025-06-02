#!/bin/bash

# Setup script for mcp-omnisearch without Docker

echo "Setting up mcp-omnisearch..."

# Navigate to Projects directory
cd /Users/angel/Documents/Projects

# Backup existing mcp-omnisearch if it exists
if [ -d "mcp-omnisearch" ]; then
    echo "Backing up existing mcp-omnisearch directory..."
    mv mcp-omnisearch mcp-omnisearch-backup-$(date +%Y%m%d-%H%M%S)
fi

# Clone the repository
echo "Cloning mcp-omnisearch repository..."
git clone https://github.com/spences10/mcp-omnisearch.git

# Enter the directory
cd mcp-omnisearch

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building the project..."
npm run build

# Create the Claude Code MCP configuration
echo "Creating Claude Code MCP configuration..."
cat > /Users/angel/Library/Application\ Support/Claude/claude-code-mcp-config.json << 'EOF'
{
  "mcpServers": {
    "mcp-omnisearch": {
      "command": "node",
      "args": ["/Users/angel/Documents/Projects/mcp-omnisearch/dist/index.js"],
      "env": {
        "TAVILY_API_KEY": "",
        "PERPLEXITY_API_KEY": "",
        "KAGI_API_KEY": "",
        "JINA_AI_API_KEY": "",
        "BRAVE_API_KEY": "",
        "FIRECRAWL_API_KEY": ""
      },
      "disabled": false,
      "autoApprove": []
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "playwright-mcp": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-playwright"]
    }
  }
}
EOF

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your API keys to the configuration file:"
echo "   /Users/angel/Library/Application Support/Claude/claude-code-mcp-config.json"
echo ""
echo "2. Restart Claude Code to load the new MCP configuration"
echo ""
echo "3. Available API key environment variables:"
echo "   - TAVILY_API_KEY"
echo "   - PERPLEXITY_API_KEY"
echo "   - KAGI_API_KEY"
echo "   - JINA_AI_API_KEY"
echo "   - BRAVE_API_KEY"
echo "   - FIRECRAWL_API_KEY"
echo ""
echo "Note: You only need API keys for the search providers you want to use."