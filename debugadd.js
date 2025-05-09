// Load dotenv
try {
  require('dotenv').config();
  console.log('Dotenv loaded');
} catch (error) {
  console.error('Error loading dotenv:', error);
}

console.log('Args:', process.argv);
console.log('Environment before:', process.env.XAI_API_KEY ? 'API key found' : 'No API key');

// Manually set it
process.env.XAI_API_KEY = "xai-RsEhuzYfPAgw5U08JWLg5wnMfa4jSpORWyKo9uz7aUtMYRhFQgaETK1edPOXdPlg3i6m0yWrpXu2wf06";
console.log('Environment after:', process.env.XAI_API_KEY ? 'API key found' : 'No API key');

// Try to create AiService directly
try {
  const AiService = require('./dist/src/services/ai/aiService').AiService;
  console.log('AiService imported');
  
  const aiService = new AiService();
  console.log('AiService instance created');
  
  // Try to use it
  const testTodo = {
    id: 'test-id',
    title: 'Test todo',
    description: '',
    completed: false,
    priority: 'medium',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: true,
    storageLocation: 'local'
  };
  
  console.log('Calling AI service methods...');
  aiService.suggestTags(testTodo)
    .then(tags => console.log('Suggested tags:', tags))
    .catch(error => console.error('Error suggesting tags:', error));
    
} catch (error) {
  console.error('Error with AiService:', error);
}