/**
 * AI mock scenarios - Predefined test scenarios for AI mocking
 */

import { MockScenario, MockErrorType } from '../types';
import { AIProvider } from '../../../types/adapters/AIModelAdapter';

/**
 * Error simulation scenarios
 */
export const ErrorScenarios: Record<string, MockScenario> = {
  // Authentication error scenario
  authError: {
    name: 'Authentication Error',
    description: 'Simulates failed authentication with the AI provider',
    provider: AIProvider.XAI,
    templates: {},
    errors: {
      enabled: true,
      errorType: MockErrorType.AUTHENTICATION,
      probability: 1.0,
      errorMessage: '401 Unauthorized: Invalid API key or token'
    }
  },
  
  // Rate limit error scenario
  rateLimit: {
    name: 'Rate Limit Exceeded',
    description: 'Simulates rate limiting from the AI provider',
    provider: AIProvider.OPENAI,
    templates: {},
    errors: {
      enabled: true,
      errorType: MockErrorType.RATE_LIMIT,
      probability: 1.0,
      errorMessage: '429 Too Many Requests: Rate limit exceeded. Please try again later.'
    }
  },
  
  // Network connectivity error scenario
  networkError: {
    name: 'Network Connectivity Issues',
    description: 'Simulates network connectivity problems',
    provider: AIProvider.XAI,
    templates: {},
    errors: {
      enabled: true,
      errorType: MockErrorType.NETWORK,
      probability: 1.0,
      errorMessage: 'Network error: Unable to connect to AI service. Please check your connection.'
    }
  },
  
  // Timeout error scenario
  timeout: {
    name: 'Request Timeout',
    description: 'Simulates a request timeout',
    provider: AIProvider.ANTHROPIC,
    templates: {},
    errors: {
      enabled: true,
      errorType: MockErrorType.TIMEOUT,
      probability: 1.0,
      errorMessage: 'Request timed out after 30000ms'
    },
    latency: {
      enabled: true,
      minLatencyMs: 30000,
      maxLatencyMs: 31000,
      jitterEnabled: false,
      timeoutProbability: 1.0,
      timeoutAfterMs: 30000
    }
  },
  
  // Content policy violation scenario
  contentPolicy: {
    name: 'Content Policy Violation',
    description: 'Simulates content policy violations from the AI provider',
    provider: AIProvider.OPENAI,
    templates: {},
    errors: {
      enabled: true,
      errorType: MockErrorType.CONTENT_POLICY,
      probability: 1.0,
      errorMessage: 'Your request was rejected as a result of our safety system. Your prompt may contain text that is not allowed by our safety system.'
    }
  },
  
  // Intermittent failure scenario
  intermittentFailure: {
    name: 'Intermittent Failures',
    description: 'Simulates occasional random failures',
    provider: AIProvider.XAI,
    templates: {},
    errors: {
      enabled: true,
      errorType: MockErrorType.SERVER,
      probability: 0.3,
      errorMessage: '500 Internal Server Error: Something went wrong. Please try again.'
    }
  }
};

/**
 * Response customization scenarios
 */
export const ResponseScenarios: Record<string, MockScenario> = {
  // Minimal responses scenario
  minimalResponses: {
    name: 'Minimal Responses',
    description: 'Provides very brief, minimal responses',
    provider: AIProvider.XAI,
    templates: {
      summarize: {
        text: "Todo list contains 5 work items and 3 personal tasks. Most are medium priority."
      },
      categorize: {
        structured: {
          "Work": ["todo-1", "todo-2", "todo-3"],
          "Personal": ["todo-4", "todo-5"]
        }
      },
      prioritize: {
        structured: {
          "todo-1": 8,
          "todo-2": 6,
          "todo-3": 4,
          "todo-4": 2,
          "todo-5": 1
        }
      },
      suggest: {
        structured: [
          "Add status report",
          "Schedule meeting",
          "Update documentation"
        ]
      },
      analyze: {
        structured: {
          "themes": ["work", "personal"],
          "priority": "medium",
          "timeEstimate": "2 days"
        }
      }
    }
  },
  
  // Verbose responses scenario
  verboseResponses: {
    name: 'Verbose Responses',
    description: 'Provides very detailed, verbose responses',
    provider: AIProvider.ANTHROPIC,
    templates: {
      summarize: {
        text: "Your todo list contains a comprehensive mix of professional and personal responsibilities that require careful prioritization and time management. The professional tasks are primarily centered around project deliverables, client communications, and team coordination activities that appear to have upcoming deadlines. Personal tasks focus on home management, family commitments, and self-care activities that maintain work-life balance. Several high-priority items require immediate attention, particularly those with external dependencies or time-sensitive deadlines, while others represent ongoing maintenance activities that can be addressed as time permits."
      },
      // Add other verbose templates as needed
    }
  },
  
  // High latency scenario
  highLatency: {
    name: 'High Latency',
    description: 'Simulates high latency responses',
    provider: AIProvider.OPENAI,
    templates: {}, // Use default responses
    latency: {
      enabled: true,
      minLatencyMs: 2000,
      maxLatencyMs: 5000,
      jitterEnabled: true,
      timeoutProbability: 0,
      timeoutAfterMs: 30000
    }
  }
};

/**
 * Load a specific scenario by name
 */
export function getScenario(scenarioName: string): MockScenario | undefined {
  if (ErrorScenarios[scenarioName]) {
    return ErrorScenarios[scenarioName];
  }
  
  if (ResponseScenarios[scenarioName]) {
    return ResponseScenarios[scenarioName];
  }
  
  return undefined;
}