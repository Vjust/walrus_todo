#!/bin/bash

# Reset console
clear

# Print header
echo -e "\n===== Testing Fixed AI Integration =====\n"

# Set executable permissions on CLI scripts
chmod +x ./bin/waltodo ./bin/waltodo-direct

# Step 1: Test the direct AI service
echo -e "\n--- Step 1: Testing AiService directly ---"

# Create a temporary test script
cat > test-ai-service-fixed.js << 'EOF'
// Direct test of fixed AiService
require('dotenv').config();
const { AiService } = require('./dist/src/services/ai/aiService');

async function testAiService() {
  try {
    console.log('Testing AiService directly...');
    console.log('XAI_API_KEY from env:', process.env.XAI_API_KEY ? '[found]' : '[not found]');
    
    const aiService = new AiService();
    console.log('AiService initialized successfully');
    
    const testTodo = {
      id: 'test-id',
      title: 'Create documentation for the AI integration',
      description: '',
      completed: false,
      priority: 'medium',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: true,
      storageLocation: 'local'
    };
    
    console.log('Getting tag suggestions...');
    const tags = await aiService.suggestTags(testTodo);
    console.log('Suggested tags:', tags);
    
    console.log('Getting priority suggestion...');
    const priority = await aiService.suggestPriority(testTodo);
    console.log('Suggested priority:', priority);
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAiService();
EOF

# Run the test
echo "Running direct API test..."
node test-ai-service-fixed.js

# Clean up
rm test-ai-service-fixed.js

# Step 2: Testing adding a todo with AI
echo -e "\n--- Step 2: Testing 'add' command with AI ---"
echo "Adding a todo with AI suggestions..."
./bin/waltodo-direct add "Fix error handling in user authentication flow" --ai

# Step 3: Testing AI command
echo -e "\n--- Step 3: Testing 'ai' command - Suggest ---"
echo "Getting AI task suggestions..."
./bin/waltodo-direct ai suggest

echo -e "\n===== Fixed AI Integration Testing Complete =====\n"