// Load dotenv
import { Logger } from './src/utils/Logger';

const logger = new Logger('debugadd');
try {
  require('dotenv').config();
  process.stdout.write('Dotenv loaded\n');
} catch (error) {
  process.stderr.write('Error loading dotenv: ' + error + '\n');
}

process.stdout.write('Args: ' + JSON.stringify(process.argv) + '\n');
process.stdout.write(
  'Environment before: ' +
    (process.env.XAI_API_KEY ? 'API key found' : 'No API key') +
    '\n'
);

// Manually set it
process.env.XAI_API_KEY =
  'xai-RsEhuzYfPAgw5U08JWLg5wnMfa4jSpORWyKo9uz7aUtMYRhFQgaETK1edPOXdPlg3i6m0yWrpXu2wf06';
process.stdout.write(
  'Environment after: ' +
    (process.env.XAI_API_KEY ? 'API key found' : 'No API key') +
    '\n'
);

// Try to create AiService directly
try {
  const AiService = require('./dist/src/services/ai/aiService').AiService;
  process.stdout.write('AiService imported\n');

  const aiService = new AiService();
  process.stdout.write('AiService instance created\n');

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
    storageLocation: 'local',
  };

  logger.info('Calling AI service methods...');
  aiService
    .suggestTags(testTodo)
    .then(tags => logger.info('Suggested tags:', tags))
    .catch(error => logger.error('Error suggesting tags:', error));
} catch (error) {
  logger.error('Error with AiService:', error);
}
