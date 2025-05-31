# MCP (Model Context Protocol) Setup for Claude Code

This guide explains how to set up MCP servers for Claude Code without Docker.

## Overview

MCP servers extend Claude Code's capabilities. We've configured three MCP servers:

1. **mcp-omnisearch**: Web search capabilities using multiple search providers
2. **memory**: Persistent memory across conversations
3. **playwright-mcp**: Browser automation and web scraping

## Setup Instructions

### 1. Initial Setup

Run the setup script to install mcp-omnisearch:

```bash
./setup-mcp-omnisearch.sh
```

This script will:
- Clone the mcp-omnisearch repository to `/Users/angel/Documents/Projects/mcp-omnisearch`
- Install dependencies
- Build the project
- Configure Claude Code to use the MCP servers

### 2. Add API Keys

Edit the configuration file to add your API keys:

```bash
open "/Users/angel/Library/Application Support/Claude/claude-code-mcp-config.json"
```

Add your API keys for the search providers you want to use:
- `TAVILY_API_KEY`: Get from https://tavily.com
- `PERPLEXITY_API_KEY`: Get from https://perplexity.ai
- `KAGI_API_KEY`: Get from https://kagi.com
- `JINA_AI_API_KEY`: Get from https://jina.ai
- `BRAVE_API_KEY`: Get from https://brave.com/search/api
- `FIRECRAWL_API_KEY`: Get from https://firecrawl.com

Note: You only need API keys for the providers you want to use.

### 3. Verify Setup

Run the verification script to check if everything is set up correctly:

```bash
./verify-mcp-setup.sh
```

### 4. Restart Claude Code

After configuration, restart Claude Code to load the new MCP servers.

## Troubleshooting

### MCP Server Status

You can check the status of MCP servers by running:
```bash
mcp
```

### Common Issues

1. **"mcp-omnisearch: connecting..." forever**
   - Check if the dist directory exists in mcp-omnisearch
   - Rebuild if necessary: `cd /Users/angel/Documents/Projects/mcp-omnisearch && npm run build`

2. **"memory: failed"**
   - This is normal if you haven't used it yet
   - It will activate when you start using memory features

3. **"playwright-mcp: connecting..."**
   - This requires playwright to be installed
   - It will install automatically when first used

## Configuration File Location

The MCP configuration is stored at:
```
/Users/angel/Library/Application Support/Claude/claude-code-mcp-config.json
```

## Removing Docker

We've removed the Docker-based setup in favor of a direct Node.js approach. This provides:
- Faster startup times
- Less resource usage
- Easier debugging
- Direct integration with Claude Code