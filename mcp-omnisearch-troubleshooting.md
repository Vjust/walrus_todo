# MCP Omnisearch Troubleshooting

## Current Status
- ✅ MCP Omnisearch is installed correctly
- ✅ Configuration file has valid API keys
- ✅ Server can run without errors
- ❌ Tools not visible in Claude Code

## Solution Steps

1. **Complete Restart of Claude Code**
   - Completely quit Claude Code (Cmd+Q on Mac)
   - Wait 5 seconds
   - Start Claude Code again
   - Open your project

2. **Check MCP Status**
   - In Claude Code, type `/mcp`
   - Look for "mcp-omnisearch" in the list
   - Check if it shows as "connected" or has any error messages

3. **If Still Not Working**
   - Check if other MCP servers (memory, playwright) are working
   - Try disabling and re-enabling the omnisearch server:
   ```bash
   # Edit the config file
   open "/Users/angel/Library/Application Support/Claude/claude-code-mcp-config.json"
   
   # Change "disabled": false to "disabled": true
   # Save, restart Claude Code
   # Change back to "disabled": false
   # Save, restart Claude Code again
   ```

4. **Alternative: Reinstall MCP Omnisearch**
   ```bash
   cd /Users/angel/Documents/Projects/mcp-omnisearch
   npm install
   npm run build
   ```

5. **Check Claude Code Version**
   - Make sure you're using the latest version of Claude Code
   - MCP support requires a recent version

## Expected Tools When Working

When MCP Omnisearch is properly connected, you should see tools like:
- `mcp__omnisearch__search`
- `mcp__omnisearch__tavily_search`
- `mcp__omnisearch__perplexity_search`
- `mcp__omnisearch__jina_reader`
- etc.

## Current Working Tools
- Playwright MCP tools are working (mcp__playwright-mcp__*)
- This confirms MCP system is functional
- Issue is specific to omnisearch connection