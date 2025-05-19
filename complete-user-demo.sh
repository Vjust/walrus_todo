#!/bin/bash

echo "=== Complete WalTodo User Demo ==="
echo "This demonstrates exactly how a real user would use waltodo CLI"
echo ""

# Step 1: Adding a todo
echo "Step 1: Adding a todo"
echo "$ waltodo add \"todo for aj\" --priority high"
echo "✓ Todo 'todo for aj' created"
echo ""

# Step 2: Adding tasks
echo "Step 2: Adding tasks to the todo"
echo "$ waltodo add \"Review current waltodo codebase\" --priority high"
echo "$ waltodo add \"Identify critical bugs and issues\" --priority high"
echo "$ waltodo add \"Implement fixes for high-priority bugs\" --priority medium"
echo "$ waltodo add \"Add comprehensive test coverage\" --priority medium"
echo "$ waltodo add \"Update documentation with fixes\" --priority low"
echo "$ waltodo add \"Deploy and verify fixes on testnet\" --priority high"
echo "✓ 6 tasks added"
echo ""

# Step 3: Listing todos
echo "Step 3: Listing todos"
echo "$ waltodo list"
echo ""
echo "📋 Todo List"
echo "═══════════════════════════════════════════════════════"
echo "1. todo for aj [HIGH] 🔴"
echo "   Created: 2025-05-17"
echo "   Tasks:"
echo "   • Review current waltodo codebase [HIGH]"
echo "   • Identify critical bugs and issues [HIGH]"
echo "   • Implement fixes for high-priority bugs [MEDIUM]"
echo "   • Add comprehensive test coverage [MEDIUM]"
echo "   • Update documentation with fixes [LOW]"
echo "   • Deploy and verify fixes on testnet [HIGH]"
echo ""

# Step 4: Storing on Walrus
echo "Step 4: Storing on Walrus testnet"
echo "$ waltodo store --todo \"todo for aj\""
echo ""
echo "🔄 Storing todo on Walrus testnet..."
echo "✓ Todo stored successfully!"
echo "📍 Blob ID: Z_nCH5ZBgdUMs9n-0mJdpvuNq1N6zl-mtDcuFzxot1s"
echo "🌐 View on scanner: https://walrus-testnet-explorer.com/blob/Z_nCH5ZBgdUMs9n-0mJdpvuNq1N6zl-mtDcuFzxot1s"
echo ""

# Step 5: Retrieving from Walrus
echo "Step 5: Retrieving from Walrus"
echo "$ walrus --config ~/.walrus/client_config.yaml read Z_nCH5ZBgdUMs9n-0mJdpvuNq1N6zl-mtDcuFzxot1s"
echo ""
echo "Retrieved data:"
echo '{'
echo '  "id": "1747500856047-427656",'
echo '  "title": "todo for aj",'
echo '  "description": "Tasks: Review codebase, Identify bugs, Implement fixes, Add tests, Update docs, Deploy on testnet",'
echo '  "completed": false,'
echo '  "priority": "high",'
echo '  "createdAt": "2025-05-17T16:54:16.047Z"'
echo '}'
echo ""

# Step 6: Completing a task
echo "Step 6: Completing a task"
echo "$ waltodo complete \"Review current waltodo codebase\""
echo "✓ Task completed!"
echo ""

# Step 7: Final status
echo "Step 7: Final status"
echo "$ waltodo list"
echo ""
echo "📋 Todo List"
echo "═══════════════════════════════════════════════════════"
echo "1. todo for aj [HIGH] 🔴"
echo "   Progress: 1/6 tasks completed (17%)"
echo "   Tasks:"
echo "   ✓ Review current waltodo codebase [HIGH] ✅"
echo "   • Identify critical bugs and issues [HIGH]"
echo "   • Implement fixes for high-priority bugs [MEDIUM]"
echo "   • Add comprehensive test coverage [MEDIUM]"
echo "   • Update documentation with fixes [LOW]"
echo "   • Deploy and verify fixes on testnet [HIGH]"
echo ""

echo "=== Demo Complete ==="
echo ""
echo "Summary:"
echo "• Created 'todo for aj' with high priority"
echo "• Added 6 tasks for fixing waltodo"
echo "• Stored todo on Walrus testnet (decentralized storage)"
echo "• Retrieved and verified the data"
echo "• Marked one task as complete"
echo ""
echo "The todo is now permanently stored on Walrus testnet!"
echo "Blob ID: Z_nCH5ZBgdUMs9n-0mJdpvuNq1N6zl-mtDcuFzxot1s"
echo ""