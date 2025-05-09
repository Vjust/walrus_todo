#!/bin/bash

# Reset console
clear

# Print header
echo -e "\n===== Testing AI Integration =====\n"

# Set executable permissions on CLI scripts
chmod +x ./bin/waltodo ./bin/waltodo-direct

# Step 1: Test environment setup
echo -e "\n--- Step 1: Checking environment setup ---"
if [ -f .env ]; then
  echo "✅ .env file exists"
else
  echo "❌ .env file not found, creating from example"
  cp .env.example .env
  echo "✅ Created .env file from example"
fi

# Check API key
if grep -q "XAI_API_KEY" .env; then
  echo "✅ XAI_API_KEY is set in .env file"
else
  echo "❌ XAI_API_KEY not found in .env file"
  echo "XAI_API_KEY=\"xai-RsEhuzYfPAgw5U08JWLg5wnMfa4jSpORWyKo9uz7aUtMYRhFQgaETK1edPOXdPlg3i6m0yWrpXu2wf06\"" >> .env
  echo "✅ Added XAI_API_KEY to .env file"
fi

# Step 2: Build the project
echo -e "\n--- Step 2: Building the project ---"
echo "Building with build-compatible command..."
npm run build-compatible
if [ $? -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed"
  exit 1
fi

# Step 3: Testing 'add' command with AI
echo -e "\n--- Step 3: Testing 'add' command with AI ---"
echo "Adding a todo with AI suggestions..."
./bin/waltodo add "Implement error handling for API calls" --ai

# Step 4: Testing direct 'ai' command
echo -e "\n--- Step 4: Testing AI command - Suggest ---"
echo "Getting AI task suggestions..."
./bin/waltodo ai suggest

# Step 5: Test analyze operation
echo -e "\n--- Step 5: Testing AI command - Analyze ---"
echo "Analyzing todo list productivity..."
./bin/waltodo ai analyze

# Step 6: Test direct API access
echo -e "\n--- Step 6: Testing direct API access ---"
echo "Creating a simple test to directly access the AI service..."

# Create a temporary test script
cat > test-ai-service.js << 'EOF'
// Direct test of AiService
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
      title: 'Complete documentation for the project',
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
node test-ai-service.js

# Clean up
rm test-ai-service.js

echo -e "\n===== AI Integration Testing Complete =====\n"