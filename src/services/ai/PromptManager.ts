/**
 * PromptManager - Central system for managing and accessing prompts
 * 
 * Provides consistent prompting across different AI providers, enabling:
 * - Centralized prompt management
 * - Template variables for dynamic content
 * - Version control for prompts
 * - Provider-specific optimizations
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { AIProvider } from '../../types/adapters/AIModelAdapter';

// Core operation prompts
const PROMPTS = {
  summarize: {
    default: `Summarize the following todos in 2-3 sentences, focusing on key themes and priorities:\n\n{todos}`,
    enhanced: `Provide a comprehensive summary of the following todos in 2-3 sentences.
Focus on key themes, priorities, and potential bottlenecks or dependencies.
Include both urgent and important items in your summary.
\n\n{todos}`
  },
  
  categorize: {
    default: `Categorize the following todos into logical groups. Return the result as a JSON object where keys are category names and values are arrays of todo IDs.\n\n{todos}`,
    enhanced: `Categorize the following todos into logical groups based on task type, domain, priority, or project.
Consider relationships between tasks and their natural groupings.
Return the result as a JSON object where keys are descriptive category names 
and values are arrays of todo IDs.
\n\n{todos}`
  },
  
  prioritize: {
    default: `Prioritize the following todos on a scale of 1-10 (10 being highest priority). Consider urgency, importance, and dependencies.
Return the result as a JSON object where keys are todo IDs and values are numeric priority scores.\n\n{todos}`,
    enhanced: `Prioritize the following todos on a scale of 1-10 (10 being highest priority).
Consider the following factors in your prioritization:
- Urgency: How time-sensitive is the task?
- Importance: How valuable is completing this task?
- Dependencies: Does this task block or enable other tasks?
- Effort: How much work is required to complete the task?
- Impact: What is the potential positive outcome of completing this task?

Return the result as a JSON object where keys are todo IDs and values are numeric priority scores.
\n\n{todos}`
  },
  
  suggest: {
    default: `Based on the following todos, suggest 3-5 additional todos that would be logical next steps or related tasks.
Return the result as a JSON array of strings, where each string is a suggested todo title.\n\n{todos}`,
    enhanced: `Based on the following todos, suggest 3-5 additional todos that would be logical next steps or related tasks.
Your suggestions should:
- Fill any obvious gaps in the workflow
- Include any prerequisites that might be missing
- Suggest follow-up tasks that would naturally come next
- Consider both short-term and long-term planning
- Be specific and actionable

Return the result as a JSON array of strings, where each string is a suggested todo title.
\n\n{todos}`
  },
  
  analyze: {
    default: `Analyze the following todos for patterns, dependencies, and insights. 
Provide analysis including:
- Key themes
- Potential bottlenecks or dependencies
- Time estimates if possible
- Suggested workflow

Return the result as a JSON object with analysis categories as keys.\n\n{todos}`,
    enhanced: `Perform a comprehensive analysis of the following todos:

Provide analysis including:
1. Key themes: Identify the main themes or areas of focus
2. Dependencies: Map out any task dependencies or blockers
3. Effort estimation: Estimate relative effort (low/medium/high) for each task
4. Bottlenecks: Identify potential workflow bottlenecks
5. Critical path: Determine the sequence of tasks that forms the critical path
6. Risk assessment: Highlight tasks with high uncertainty or potential issues
7. Optimization opportunities: Suggest where parallel work or other optimizations are possible

Return the result as a JSON object with these analysis categories as keys.
\n\n{todos}`
  },
  
  // New operations
  group: {
    default: `Group the following todos into workflow sequences or parallel tracks.
Identify which todos can be worked on simultaneously and which must be completed in sequence.
Return the result as a JSON object with sequential tracks as keys and arrays of todo IDs in execution order.
\n\n{todos}`
  },
  
  schedule: {
    default: `Create a suggested schedule for the following todos.
For each todo, estimate:
- A relative start time (in days from now: 0 for today, 1 for tomorrow, etc.)
- A duration (in days)
- A suggested due date (in days from now)

Return the result as a JSON object where keys are todo IDs and values are objects 
with "start", "duration", and "due" properties (all in days).
\n\n{todos}`
  },
  
  detect_dependencies: {
    default: `Analyze the following todos to detect dependencies between tasks.
Return a JSON object with two properties:
1. "dependencies": An object where keys are todo IDs and values are arrays of todo IDs that must be completed before the key todo can begin
2. "blockers": An object where keys are todo IDs and values are arrays of todo IDs that are currently blocking the key todo

\n\n{todos}`
  },
  
  estimate_effort: {
    default: `Estimate the relative effort required for each todo on a scale of 1-5 (1 being minimal effort, 5 being significant effort).
Consider factors like complexity, scope, and technical requirements.
Return the result as a JSON object where keys are todo IDs and values are objects with:
- "effort": Numeric score (1-5)
- "reasoning": Brief explanation of the estimate
- "estimated_hours": Rough estimate of hours required (if possible)

\n\n{todos}`
  }
};

// Provider-specific optimizations
const PROVIDER_OPTIMIZATIONS = {
  [AIProvider.XAI]: {
    summarize: `${PROMPTS.summarize.enhanced}\n\nBe objective and factual in your summary.`,
    prioritize: `${PROMPTS.prioritize.enhanced}\n\nBe objective in your prioritization, focusing on measurable criteria.`
  },
  [AIProvider.OPENAI]: {
    analyze: `${PROMPTS.analyze.enhanced}\n\nProvide concrete, specific insights rather than general observations.`
  },
  [AIProvider.ANTHROPIC]: {
    schedule: `${PROMPTS.schedule.default}\n\nFocus on realistic timelines that consider dependencies between tasks.`
  }
};

export class PromptManager {
  private static instance: PromptManager;
  private promptOverrides: Record<string, string> = {};
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    
    return PromptManager.instance;
  }
  
  /**
   * Get a prompt template for a specific operation
   */
  public getPromptTemplate(
    operation: string,
    provider?: AIProvider,
    enhanced: boolean = true
  ): PromptTemplate {
    // Check for user override
    if (this.promptOverrides[operation]) {
      return PromptTemplate.fromTemplate(this.promptOverrides[operation]);
    }
    
    // Check for provider-specific optimization
    if (provider && PROVIDER_OPTIMIZATIONS[provider]?.[operation]) {
      return PromptTemplate.fromTemplate(PROVIDER_OPTIMIZATIONS[provider][operation]);
    }
    
    // Fall back to standard prompts
    const promptKey = enhanced ? 'enhanced' : 'default';
    const promptText = PROMPTS[operation]?.[promptKey] || PROMPTS[operation]?.default;
    
    if (!promptText) {
      throw new Error(`No prompt template found for operation: ${operation}`);
    }
    
    return PromptTemplate.fromTemplate(promptText);
  }
  
  /**
   * Set a custom prompt override
   */
  public setPromptOverride(operation: string, promptTemplate: string): void {
    this.promptOverrides[operation] = promptTemplate;
  }
  
  /**
   * Clear a prompt override
   */
  public clearPromptOverride(operation: string): void {
    delete this.promptOverrides[operation];
  }
  
  /**
   * Clear all prompt overrides
   */
  public clearAllPromptOverrides(): void {
    this.promptOverrides = {};
  }
}