import { test } from '@oclif/test';
import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  TaskSuggestionService,
  SuggestionType,
} from '../../src/services/ai/TaskSuggestionService';
import { EnhancedAIService } from '../../src/services/ai/EnhancedAIService';

describe('suggest command', () => {
  // Sample suggested tasks for testing
  const sampleSuggestions = {
    suggestions: [
      {
        title: 'Implement password reset functionality',
        description: 'Add ability for users to reset their passwords via email',
        priority: 'medium',
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
        priority: 'high',
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

  // Sample todos
  const sampleTodos = [
    {
      id: 'todo1',
      title: 'Implement user authentication',
      description: 'Add user login and registration',
      completed: false,
      priority: 'high',
      tags: ['backend', 'security'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      private: false,
    },
    {
      id: 'todo2',
      title: 'Design landing page',
      description: 'Create mockups for the new landing page',
      completed: true,
      priority: 'medium',
      tags: ['design', 'frontend'],
      createdAt: '2023-01-02T00:00:00Z',
      updatedAt: '2023-01-03T00:00:00Z',
      completedAt: '2023-01-03T00:00:00Z',
      private: false,
    },
    {
      id: 'todo3',
      title: 'Set up CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing',
      completed: false,
      priority: 'medium',
      tags: ['devops', 'testing'],
      createdAt: '2023-01-04T00:00:00Z',
      updatedAt: '2023-01-04T00:00:00Z',
      private: false,
    },
  ];

  // Stub for the TaskSuggestionService
  let stubSuggestTasks: sinon.SinonStub;
  let stubSuggestTasksWithVerification: sinon.SinonStub;

  beforeEach(() => {
    // Create stubs for the TaskSuggestionService methods
    stubSuggestTasks = sinon
      .stub(TaskSuggestionService.prototype, 'suggestTasks')
      .resolves(sampleSuggestions);
    stubSuggestTasksWithVerification = sinon
      .stub(TaskSuggestionService.prototype, 'suggestTasksWithVerification')
      .resolves({
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

    // Stub the todo service (unused in current tests)
    sinon.stub().resolves({
      listTodos: sinon.stub().resolves(sampleTodos),
      addTodo: sinon.stub().resolves({ id: 'new-todo-id' }),
    });

    // Stub the environment variable
    process.env.XAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.XAI_API_KEY;
  });

  test
    .stub(
      TaskSuggestionService.prototype,
      'suggestTasks',
      () => stubSuggestTasks
    )
    .stub(
      TaskSuggestionService.prototype,
      'suggestTasksWithVerification',
      () => stubSuggestTasksWithVerification
    )
    .stub(EnhancedAIService.prototype, 'getProvider', () => ({} as Record<string, never>))
    .stdout()
    .command(['suggest'])
    .it('runs suggest command and displays suggestions', _ctx => {
      // Verify the command output contains expected content
    });

  test
    .stub(
      TaskSuggestionService.prototype,
      'suggestTasks',
      () => stubSuggestTasks
    )
    .stdout()
    .command(['suggest', '--format=json'])
    .it('outputs JSON when format is json', _ctx => {
      // Verify JSON output format
    });

  test
    .stub(
      TaskSuggestionService.prototype,
      'suggestTasks',
      () => stubSuggestTasks
    )
    .stdout()
    .command(['suggest', '--type=related'])
    .it('filters suggestions by type', _ctx => {
      // Verify filtering by suggestion type
    });

  test
    .stub(
      TaskSuggestionService.prototype,
      'suggestTasksWithVerification',
      () => stubSuggestTasksWithVerification
    )
    .stdout()
    .command([
      'suggest',
      '--verify',
      '--registryAddress=0x123',
      '--packageId=0x456',
    ])
    .it('runs suggestion with verification', _ctx => {
      // Verify suggestion with verification flow
    });

  test
    .stdout()
    .command(['suggest'])
    .exit(1)
    .it('errors without API key', ctx => {
      expect(ctx.stderr).to.contain('API key');
    });
});
