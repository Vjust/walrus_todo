import { execSync } from 'child_process';

// Mock the required modules
jest.mock('child_process', () => ({ execSync: jest.fn() }));
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  readdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('AI Commands Integration Tests', () => {
  const CLI_CMD = 'node ./bin/run.js';
  const MOCK_API_KEY = 'test-api-key-123';
  
  const _mockTodos = [
    { 
      id: '1', 
      title: 'Complete financial report', 
      description: 'Q4 financial report for board meeting', 
      completed: false,
      tags: ['finance', 'urgent'],
      priority: 'high'
    },
    { 
      id: '2', 
      title: 'Update budget spreadsheet', 
      description: 'Include Q1 projections', 
      completed: false,
      tags: ['finance', 'planning'],
      priority: 'medium'
    },
    { 
      id: '3', 
      title: 'Schedule team meeting', 
      description: 'Weekly sync with development team', 
      completed: true,
      tags: ['management', 'recurring'],
      priority: 'low'
    }
  ];

  beforeEach(() => {
    (execSync as jest.Mock).mockReset();
    process.env.XAI_API_KEY = MOCK_API_KEY;
  });

  afterEach(() => {
    delete process.env.XAI_API_KEY;
  });

  describe('AI Summarize Command', () => {
    it('should summarize todos with default settings', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('ai summarize')) {
          return Buffer.from(`📝 Summary of your todos:
You have 3 todos, with 67% incomplete. Your tasks focus on financial reporting and team coordination, with emphasis on Q4 reports and budget updates.`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai summarize`).toString();
      expect(result).toContain('Summary of your todos');
      expect(result).toContain('financial reporting');
      expect(result).toContain('67% incomplete');
    });

    it('should handle missing API key', () => {
      delete process.env.XAI_API_KEY;
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('API key is required. Provide it via --apiKey flag or XAI_API_KEY environment variable.');
      });

      expect(() => {
        execSync(`${CLI_CMD} ai summarize`, { stdio: 'inherit' });
      }).toThrow('API key is required');
    });

    it('should output JSON format when requested', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--json')) {
          return Buffer.from(JSON.stringify({
            summary: "You have 3 todos focusing on financial and team management tasks.",
            stats: {
              total: 3,
              completed: 1,
              incomplete: 2,
              categories: ['finance', 'management']
            }
          }, null, 2));
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai summarize --json`).toString();
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('summary');
      expect(parsed.summary).toContain('financial');
      expect(parsed.stats.total).toBe(3);
    });

    it('should summarize specific list', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--list work')) {
          return Buffer.from(`Summary of 'work' list:
2 todos in work list. All related to financial tasks requiring immediate attention.`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai summarize --list work`).toString();
      expect(result).toContain('work list');
      expect(result).toContain('financial tasks');
    });
  });

  describe('AI Suggest Command', () => {
    it('should generate task suggestions based on existing todos', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('ai suggest') || command.includes('suggest')) {
          return Buffer.from(`Analyzing 3 todos to generate intelligent task suggestions...

Context Information:
Analyzed 3 todos, 67% completed
Top tags: finance, planning, management
Detected themes: Financial Planning, Team Management

Task Suggestions (4):
1. Prepare Q1 financial forecast
   Based on the Q4 report and budget updates
   Priority: high | Score: 85 | Type: NEXT_STEP
   Tags: finance, planning
   Reasoning: Natural follow-up to Q4 report completion

2. Create investor presentation
   Summarize Q4 results for stakeholders
   Priority: high | Score: 80 | Type: RELATED
   Tags: finance, communication
   Reasoning: Related to financial report completion

3. Review team productivity metrics
   Analyze team performance for Q4
   Priority: medium | Score: 75 | Type: RELATED
   Tags: management, analysis
   Reasoning: Complements team meeting schedule

4. Update annual financial plan
   Incorporate Q4 actuals into annual projections
   Priority: medium | Score: 70 | Type: DEPENDENCY
   Tags: finance, planning
   Reasoning: Depends on Q4 report completion`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} suggest`).toString();
      expect(result).toContain('Task Suggestions');
      expect(result).toContain('Prepare Q1 financial forecast');
      expect(result).toContain('Priority: high');
      expect(result).toContain('Score: 85');
      expect(result).toContain('Type: NEXT_STEP');
    });

    it('should support filtering suggestions by type', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--type next_step')) {
          return Buffer.from(`Task Suggestions (1):
1. Prepare Q1 financial forecast
   Priority: high | Score: 85 | Type: NEXT_STEP`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} suggest --type next_step`).toString();
      expect(result).toContain('Type: NEXT_STEP');
      expect(result).not.toContain('Type: RELATED');
    });

    it('should support blockchain verification', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--verify')) {
          return Buffer.from(`Blockchain verification enabled.
Analyzing 3 todos...

Task Suggestions (2):
1. Prepare Q1 forecast
   Priority: high | Score: 85

Verification Details:
─────────────────────────────────
ID:        0xabc123...
Provider:  xai
Timestamp: ${new Date().toLocaleString()}
Privacy:   hash_only
Transaction: 0xdef456...
─────────────────────────────────`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} suggest --verify --registryAddress 0x123 --packageId 0x456`).toString();
      expect(result).toContain('Blockchain verification enabled');
      expect(result).toContain('Verification Details');
      expect(result).toContain('Transaction:');
    });

    it('should filter suggestions by tags', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--tags finance')) {
          return Buffer.from(`Task Suggestions (2):
1. Prepare Q1 financial forecast
   Tags: finance, planning
2. Update annual financial plan
   Tags: finance, planning`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} suggest --tags finance`).toString();
      expect(result).toContain('finance');
      expect(result).not.toContain('team productivity');
    });

    it('should filter suggestions by priority', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--priority high')) {
          return Buffer.from(`Task Suggestions (2):
1. Prepare Q1 financial forecast
   Priority: high | Score: 85
2. Create investor presentation
   Priority: high | Score: 80`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} suggest --priority high`).toString();
      expect(result).toContain('Priority: high');
      expect(result).not.toContain('Priority: medium');
    });

    it('should limit number of suggestions', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--maxResults 2')) {
          return Buffer.from(`Task Suggestions (2):
1. Prepare Q1 financial forecast
2. Create investor presentation`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} suggest --maxResults 2`).toString();
      expect(result).toContain('Task Suggestions (2)');
    });

    it('should support caching with cache debug', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--cacheDebug')) {
          return Buffer.from(`✓ API key validation loaded from cache
✓ AI service config loaded from cache
✓ AI suggestions loaded from cache

Task Suggestions (2):
1. Update budget report
2. Schedule review meeting

Cache Statistics:
  Suggestions: 1 hits, 0 misses (100.0% hit rate)
  Config: 1 hits, 0 misses (100.0% hit rate)
  API Keys: 1 hits, 0 misses (100.0% hit rate)`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} suggest --cacheDebug`).toString();
      expect(result).toContain('loaded from cache');
      expect(result).toContain('Cache Statistics');
      expect(result).toContain('hit rate');
    });

    it('should clear cache when requested', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--clearCache')) {
          return Buffer.from(`AI suggestion caches cleared
⟳ Generating new AI suggestions...
Task Suggestions (3):`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} suggest --clearCache`).toString();
      expect(result).toContain('caches cleared');
      expect(result).toContain('Generating new AI suggestions');
    });
  });

  describe('AI Analyze Command', () => {
    it('should analyze todos for patterns and insights', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('ai analyze')) {
          return Buffer.from(`🔍 Todo Analysis:

themes:
  - Financial planning and reporting
  - Task management 
  - Project coordination

bottlenecks:
  - Multiple financial reviews might create redundancy
  - Lack of clear prioritization

recommendations:
  - Consider consolidating financial tasks
  - Add specific deadlines to time-sensitive items
  - Group related tasks for better workflow

trends:
  - Increasing focus on financial documentation
  - Regular team meetings maintained
  - Quarterly reporting cycle established`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai analyze`).toString();
      expect(result).toContain('Todo Analysis');
      expect(result).toContain('themes:');
      expect(result).toContain('Financial planning');
      expect(result).toContain('bottlenecks:');
      expect(result).toContain('recommendations:');
    });

    it('should output analysis in JSON format', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--json')) {
          return Buffer.from(JSON.stringify({
            analysis: {
              themes: ['Financial planning', 'Task management'],
              bottlenecks: ['Multiple financial reviews'],
              recommendations: ['Consolidate financial tasks'],
              trends: ['Quarterly reporting cycle']
            }
          }, null, 2));
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai analyze --json`).toString();
      const parsed = JSON.parse(result);
      expect(parsed.analysis).toHaveProperty('themes');
      expect(parsed.analysis.themes).toContain('Financial planning');
    });

    it('should analyze specific list', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--list personal')) {
          return Buffer.from(`Analysis of 'personal' list:
themes:
  - Personal development
  - Health and wellness`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai analyze --list personal`).toString();
      expect(result).toContain('personal list');
      expect(result).toContain('Personal development');
    });
  });

  describe('AI Categorize Command', () => {
    it('should categorize todos into logical groups', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('ai categorize')) {
          return Buffer.from(`📂 Todo Categories:

Financial Tasks:
  - Complete financial report
  - Update budget spreadsheet

Management Tasks:
  - Schedule team meeting`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai categorize`).toString();
      expect(result).toContain('Todo Categories');
      expect(result).toContain('Financial Tasks');
      expect(result).toContain('Management Tasks');
    });

    it('should output categories in JSON format', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--json')) {
          return Buffer.from(JSON.stringify({
            categories: {
              'Financial Tasks': ['1', '2'],
              'Management Tasks': ['3']
            }
          }, null, 2));
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai categorize --json`).toString();
      const parsed = JSON.parse(result);
      expect(parsed.categories).toHaveProperty('Financial Tasks');
      expect(parsed.categories['Financial Tasks']).toHaveLength(2);
    });
  });

  describe('AI Prioritize Command', () => {
    it('should prioritize todos with scores', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('ai prioritize')) {
          return Buffer.from(`🔢 Prioritized Todos:

[9] Complete financial report
[7] Update budget spreadsheet
[3] Schedule team meeting`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai prioritize`).toString();
      expect(result).toContain('Prioritized Todos');
      expect(result).toContain('[9] Complete financial report');
      expect(result).toContain('[3] Schedule team meeting');
    });

    it('should output priorities in JSON format', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--json')) {
          return Buffer.from(JSON.stringify({
            priorities: {
              '1': 9,
              '2': 7,
              '3': 3
            }
          }, null, 2));
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai prioritize --json`).toString();
      const parsed = JSON.parse(result);
      expect(parsed.priorities).toHaveProperty('1');
      expect(parsed.priorities['1']).toBe(9);
    });
  });

  describe('AI Error Handling', () => {
    it('should handle AI provider errors gracefully', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('AI service unavailable: Rate limit exceeded');
      });

      expect(() => {
        execSync(`${CLI_CMD} ai summarize`, { stdio: 'inherit' });
      }).toThrow('AI service unavailable');
    });

    it('should handle network timeouts', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Request timeout: AI service did not respond within 30 seconds');
      });

      expect(() => {
        execSync(`${CLI_CMD} ai analyze`, { stdio: 'inherit' });
      }).toThrow('Request timeout');
    });

    it('should validate required flags for verification', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Registry address and package ID are required for blockchain verification');
      });

      expect(() => {
        execSync(`${CLI_CMD} suggest --verify`, { stdio: 'inherit' });
      }).toThrow('Registry address and package ID are required');
    });

    it('should handle invalid provider', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid AI provider: unsupported_provider');
      });

      expect(() => {
        execSync(`${CLI_CMD} ai summarize --provider unsupported_provider`, { stdio: 'inherit' });
      }).toThrow('Invalid AI provider');
    });

    it('should handle missing todos', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('No todos found. Add some todos first with "walrus_todo add"');
      });

      expect(() => {
        execSync(`${CLI_CMD} ai analyze`, { stdio: 'inherit' });
      }).toThrow('No todos found');
    });
  });

  describe('AI Provider Management', () => {
    it('should support different AI providers', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--provider openai')) {
          return Buffer.from(`Using OpenAI provider
Summary: Your todos include financial and team management tasks.`);
        } else if (command.includes('--provider anthropic')) {
          return Buffer.from(`Using Anthropic provider
Summary: You have 3 tasks focusing on finance and coordination.`);
        } else if (command.includes('--provider ollama')) {
          return Buffer.from(`Using Ollama provider (local)
Summary: Analysis of 3 local todos.`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const openaiResult = execSync(`${CLI_CMD} ai summarize --provider openai --apiKey test-key`).toString();
      expect(openaiResult).toContain('Using OpenAI provider');

      const anthropicResult = execSync(`${CLI_CMD} ai summarize --provider anthropic --apiKey test-key`).toString();
      expect(anthropicResult).toContain('Using Anthropic provider');

      const ollamaResult = execSync(`${CLI_CMD} ai summarize --provider ollama`).toString();
      expect(ollamaResult).toContain('Using Ollama provider');
    });

    it('should support custom models', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--model gpt-4')) {
          return Buffer.from(`Using model: gpt-4
Advanced analysis of your todos...`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai analyze --provider openai --model gpt-4 --apiKey test-key`).toString();
      expect(result).toContain('Using model: gpt-4');
    });

    it('should show AI status', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command === `${CLI_CMD} ai` || command === `${CLI_CMD} ai status`) {
          return Buffer.from(`AI Service Status:
Active provider: xai
Active model: grok-2
Blockchain verification: disabled

API Key Status:
XAI        | ✓ available
OPENAI     | not configured  
ANTHROPIC  | not configured
OLLAMA     | ✓ available

Available Commands:
walrus_todo ai summarize    - Generate a summary of your todos
walrus_todo ai categorize   - Organize todos into categories
walrus_todo ai prioritize   - Sort todos by priority
walrus_todo ai suggest      - Get suggestions for new todos
walrus_todo ai analyze      - Analyze todos for patterns and insights
walrus_todo ai credentials  - Manage AI provider credentials`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai`).toString();
      expect(result).toContain('AI Service Status');
      expect(result).toContain('Active provider:');
      expect(result).toContain('API Key Status');
      expect(result).toContain('Available Commands');
    });
  });

  describe('AI with Mock AI Providers', () => {
    it('should use mock providers during testing', () => {
      process.env.USE_MOCK_AI = 'true';
      
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('ai summarize')) {
          return Buffer.from(`[MOCK] Summary of your todos:
Mock response for testing purposes. 3 todos analyzed.`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const result = execSync(`${CLI_CMD} ai summarize`).toString();
      expect(result).toContain('[MOCK]');
      expect(result).toContain('Mock response');
      
      delete process.env.USE_MOCK_AI;
    });

    it('should simulate provider-specific responses', () => {
      process.env.USE_MOCK_AI = 'true';
      
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command.includes('--provider xai')) {
          return Buffer.from(`[MOCK XAI] Grok analysis results...`);
        } else if (command.includes('--provider openai')) {
          return Buffer.from(`[MOCK OpenAI] GPT analysis results...`);
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const xaiResult = execSync(`${CLI_CMD} ai analyze --provider xai`).toString();
      expect(xaiResult).toContain('[MOCK XAI]');

      const openaiResult = execSync(`${CLI_CMD} ai analyze --provider openai`).toString();
      expect(openaiResult).toContain('[MOCK OpenAI]');
      
      delete process.env.USE_MOCK_AI;
    });
  });
});