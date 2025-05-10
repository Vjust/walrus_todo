/**
 * MockAnthropicProvider - Mocked implementation of the Anthropic provider
 */

import { AIProvider, AIModelOptions } from '../../../types/adapters/AIModelAdapter';
import { MockAIProvider } from '../MockAIProvider';
import { MockResponseTemplate } from '../types';
import { DefaultMockResponses } from '../templates/DefaultResponses';

// Anthropic-specific response templates that can override the defaults
const AnthropicSpecificResponses: Partial<Record<string, MockResponseTemplate>> = {
  summarize: {
    patterns: [
      {
        match: /work|project|task/i,
        text: "These work tasks are centered around an ongoing project with multiple deliverables and stakeholder touchpoints. The most urgent items involve upcoming presentations and client review sessions, while secondary tasks focus on documentation and internal process improvements. There appears to be a sequence dependency between several of the tasks."
      },
      {
        match: /personal|home|family/i,
        text: "This personal todo list encompasses home maintenance, family responsibilities, and scheduled appointments. The time-sensitive items are mainly related to upcoming appointments and deadlines, with the remaining tasks focused on general organization and routine upkeep."
      }
    ]
  },
  
  analyze: {
    structured: {
      "themes": [
        "Project coordination",
        "Stakeholder communication",
        "Documentation and knowledge management"
      ],
      "bottlenecks": [
        "Dependency on stakeholder feedback",
        "Coordination across multiple team members",
        "Technical documentation gaps"
      ],
      "timeEstimates": {
        "total": "4-5 days",
        "breakdown": {
          "urgent": "1-2 days",
          "important": "2-3 days",
          "maintenance": "ongoing"
        }
      },
      "suggestedWorkflow": [
        "Begin with blocker resolution",
        "Batch similar communication tasks",
        "Schedule focused documentation sessions",
        "Implement regular check-in cadence",
        "Plan buffer time for unexpected issues"
      ]
    }
  },
  
  // Add other Anthropic-specific response templates as needed
};

// Merge the default responses with Anthropic-specific overrides
const mergedResponses = {
  ...DefaultMockResponses,
  ...AnthropicSpecificResponses
};

/**
 * Mocked Anthropic provider implementation with Anthropic-specific response characteristics
 */
export class MockAnthropicProvider extends MockAIProvider {
  constructor(
    modelName: string = 'claude-2',
    options: AIModelOptions = {},
    customResponses: Record<string, MockResponseTemplate> = {}
  ) {
    // Combine default Anthropic responses with any custom ones provided
    const responses = {
      ...mergedResponses,
      ...customResponses
    };
    
    super(AIProvider.ANTHROPIC, modelName, options, responses);
  }
}