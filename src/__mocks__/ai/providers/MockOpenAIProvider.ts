/**
 * MockOpenAIProvider - Mocked implementation of the OpenAI provider
 */

import { AIProvider, AIModelOptions } from '../../../types/adapters/AIModelAdapter';
import { MockAIProvider } from '../MockAIProvider';
import { MockResponseTemplate } from '../types';
import { DefaultMockResponses } from '../templates/DefaultResponses';

// OpenAI-specific response templates that can override the defaults
const OpenAISpecificResponses: Partial<Record<string, MockResponseTemplate>> = {
  summarize: {
    patterns: [
      {
        match: /work|project|task/i,
        text: "Your work tasks consist primarily of project milestones and client deliverables. There are several urgent items requiring immediate attention, particularly those related to upcoming deadlines and pending client reviews. The remaining tasks involve documentation updates and routine maintenance."
      },
      {
        match: /personal|home|family/i,
        text: "Your personal todo list includes household maintenance, family commitments, and several appointments. The most pressing items are scheduled appointments and time-sensitive tasks, while the remainder are routine chores and long-term planning items."
      }
    ]
  },
  
  suggest: {
    patterns: [
      {
        match: /project|work/i,
        structured: [
          "Schedule weekly team sync meeting",
          "Create project status dashboard",
          "Review team bandwidth for upcoming sprint",
          "Document lessons learned from previous milestone",
          "Update technical documentation with recent changes"
        ]
      }
    ]
  },
  
  // Add other OpenAI-specific response templates as needed
};

// Merge the default responses with OpenAI-specific overrides
const mergedResponses = {
  ...DefaultMockResponses,
  ...OpenAISpecificResponses
};

/**
 * Mocked OpenAI provider implementation with OpenAI-specific response characteristics
 */
export class MockOpenAIProvider extends MockAIProvider {
  constructor(
    modelName: string = 'gpt-3.5-turbo',
    options: AIModelOptions = {},
    customResponses: Record<string, MockResponseTemplate> = {}
  ) {
    // Combine default OpenAI responses with any custom ones provided
    const responses = {
      ...mergedResponses,
      ...customResponses
    };
    
    super(AIProvider.OPENAI, modelName, options, responses);
  }
}