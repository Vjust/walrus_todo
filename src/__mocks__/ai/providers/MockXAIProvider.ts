/**
 * MockXAIProvider - Mocked implementation of the XAI provider
 */

import { AIProvider, AIModelOptions } from '../../../types/adapters/AIModelAdapter';
import { MockAIProvider } from '../MockAIProvider';
import { MockResponseTemplate } from '../types';
import { DefaultMockResponses } from '../templates/DefaultResponses';

// XAI-specific response templates that can override the defaults
const XAISpecificResponses: Partial<Record<string, MockResponseTemplate>> = {
  summarize: {
    patterns: [
      {
        match: /work|project|task/i,
        text: "Your work-related todos include several high-priority items focused on project deliverables and client communications. Most tasks appear to be related to documentation, presentations, and pending reviews. Consider addressing the blocking items first to maintain project momentum."
      },
      {
        match: /personal|home|family/i,
        text: "Your personal todo list contains a mix of household tasks, appointments, and family commitments. The highest priority items are time-sensitive appointments and deadlines, while the rest are routine maintenance and organizational tasks."
      }
    ]
  },
  
  // Add other XAI-specific response templates as needed
};

// Merge the default responses with XAI-specific overrides
const mergedResponses = {
  ...DefaultMockResponses,
  ...XAISpecificResponses
};

/**
 * Mocked XAI provider implementation with XAI-specific response characteristics
 */
export class MockXAIProvider extends MockAIProvider {
  constructor(
    modelName: string = 'grok-beta',
    options: AIModelOptions = {},
    customResponses: Record<string, MockResponseTemplate> = {}
  ) {
    // Combine default XAI responses with any custom ones provided
    const responses = {
      ...mergedResponses,
      ...customResponses
    };
    
    super(AIProvider.XAI, modelName, options, responses);
  }
}