// Mock problematic ES module dependencies
jest.mock('@langchain/xai', () => ({
  ChatXAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'mocked response' }),
  })),
}));

jest.mock('p-retry', () => {
  return jest.fn().mockImplementation((fn) => fn());
});

import {
  TaskSuggestionService,
  SuggestionType,
} from '../../apps/cli/src/services/ai/TaskSuggestionService';
import { EnhancedAIService } from '../../apps/cli/src/services/ai/EnhancedAIService';

describe('suggest command (Sinon conflict test)', () => {
  // Sample suggested tasks for testing
  const sampleSuggestions = {
    suggestions: [
      {
        title: 'Implement password reset functionality',
        description: 'Add ability for users to reset their passwords via email',
        priority: 'medium' as const,
        score: 85,
        reasoning: 'This is a common feature needed alongside authentication',
        tags: ['backend', 'security', 'user-experience'],
        type: SuggestionType.RELATED,
        relatedTodoIds: ['todo1'],
      },
      {
        title: 'Add form validation to authentication',
        description:
          'Implement client and server-side validation for login forms',
        priority: 'high' as const,
        score: 90,
        reasoning: 'Authentication requires proper validation for security',
        tags: ['frontend', 'security', 'validation'],
        type: SuggestionType.DEPENDENCY,
        relatedTodoIds: ['todo1'],
      },
    ],
    contextInfo: {
      analyzedTodoCount: 3,
      topContextualTags: ['security', 'backend', 'frontend'],
      completionPercentage: 33.33,
      detectedThemes: ['Authentication', 'UI/UX', 'Infrastructure'],
    },
    metrics: {
      averageScore: 87.5,
      suggestionsByType: {
        related: 1,
        next_step: 0,
        dependency: 1,
        completion: 0,
        improvement: 0,
      },
    },
  };

  beforeEach(() => {
    // Set up environment variable
    process.env.XAI_API_KEY = 'test-api-key';

    // Jest mocks - no Sinon conflicts here
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.XAI_API_KEY;

    // Restore all mocks - uses Jest, not Sinon
    jest.restoreAllMocks();
  });

  it('can create multiple mocks without Sinon conflicts', () => {
    // Mock the TaskSuggestionService methods using Jest
    const mockSuggestTasks = jest.spyOn(TaskSuggestionService.prototype, 'suggestTasks')
      .mockResolvedValue(sampleSuggestions);
    
    const mockSuggestTasksWithVerification = jest.spyOn(TaskSuggestionService.prototype, 'suggestTasksWithVerification')
      .mockResolvedValue({
        result: sampleSuggestions,
        verification: {
          id: 'mock-verification-id',
          timestamp: Date.now(),
          provider: 'xai',
          metadata: {} as Record<string, never>,
          requestHash: 'hash1',
          responseHash: 'hash2',
          user: 'user1',
          verificationType: 0,
        },
      });

    const mockGetProvider = jest.spyOn(EnhancedAIService.prototype, 'getProvider')
      .mockReturnValue({} as any);

    // Verify mocks are set up
    expect(mockSuggestTasks).toBeDefined();
    expect(mockSuggestTasksWithVerification).toBeDefined();
    expect(mockGetProvider).toBeDefined();

    // Test that we can call the mocked methods
    const service = new TaskSuggestionService({} as any, {} as any);
    
    expect(service.suggestTasks()).resolves.toBe(sampleSuggestions);
    expect(mockSuggestTasks).toHaveBeenCalled();
  });

  it('handles repeated mocking without conflicts', () => {
    // This test verifies that we can mock the same methods multiple times
    // without getting "already wrapped" errors
    
    const mock1 = jest.spyOn(TaskSuggestionService.prototype, 'suggestTasks')
      .mockResolvedValue(sampleSuggestions);
    
    expect(mock1).toBeDefined();
    
    // Clean up
    mock1.mockRestore();
    
    // Mock again - should not conflict
    const mock2 = jest.spyOn(TaskSuggestionService.prototype, 'suggestTasks')
      .mockResolvedValue(sampleSuggestions);
    
    expect(mock2).toBeDefined();
    expect(mock2).not.toBe(mock1);
  });

  it('uses global sinon helpers without conflicts', () => {
    // Test the global helpers we added to jest.setup.js
    expect(global.createSafeStub).toBeDefined();
    expect(global.createSinonSandbox).toBeDefined();
    expect(global.restoreAllSinon).toBeDefined();
    expect(global.performCleanup).toBeDefined();

    // These should not throw errors
    global.restoreAllSinon();
    global.performCleanup();
  });

  it('verifies Jest setup cleanup works', () => {
    // Create mocks
    const mockSuggestTasks = jest.spyOn(TaskSuggestionService.prototype, 'suggestTasks');
    const mockGetProvider = jest.spyOn(EnhancedAIService.prototype, 'getProvider');

    expect(mockSuggestTasks).toBeDefined();
    expect(mockGetProvider).toBeDefined();

    // After test cleanup (handled by Jest automatically), these should be restored
    // This test just verifies the setup works without errors
  });
});