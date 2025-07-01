/**
 * TaskSuggestionService - Intelligent AI-powered task suggestion system
 *
 * This service analyzes existing todos to generate contextually relevant task suggestions.
 * It provides several types of suggestions including:
 * - Related tasks that complement existing todos
 * - Logical next steps based on workflow analysis
 * - Prerequisite dependencies that should be completed first
 *
 * Features:
 * - Relevance scoring (0-100) for suggested tasks
 * - Context-aware filtering based on types, tags, priority, etc.
 * - Parallel processing of different suggestion types
 * - Optional blockchain verification of AI-generated suggestions
 * - Automatic metrics calculation for suggestion quality
 */

import { Todo } from '../../types/todo';
import { aiService } from './index';
import {
  AIVerificationService,
  VerifiedAIResult,
} from './AIVerificationService';
import {
  AIPrivacyLevel,
  AIActionType,
} from '../../types/adapters/AIVerifierAdapter';
import { Logger } from '../../utils/Logger';
import {
  EnhancedErrorHandler,
  withEnhancedErrorHandling,
} from '../../utils/enhanced-error-handler';

/**
 * Represents a suggested task with relevance scoring
 *
 * @property title - The title/name of the suggested task
 * @property description - Optional detailed description of the task
 * @property priority - Optional priority level (high/medium/low)
 * @property score - Relevance score from 0-100 indicating how relevant this suggestion is
 * @property reasoning - Explanation of why this task was suggested
 * @property tags - Optional array of tags categorizing this suggestion
 * @property type - The type of suggestion (related, next_step, dependency, etc.)
 * @property relatedTodoIds - IDs of existing todos that triggered this suggestion
 */
export interface SuggestedTask {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  score: number; // Relevance score (0-100)
  reasoning: string;
  tags?: string[];
  type: SuggestionType;
  relatedTodoIds?: string[]; // IDs of related todos that triggered this suggestion
}

/**
 * Types of task suggestions
 *
 * Each type represents a different relationship to existing todos:
 * - RELATED: Tasks that complement or relate to existing todos
 * - NEXT_STEP: Natural next steps based on current todos and workflow analysis
 * - DEPENDENCY: Tasks that should be completed before others (prerequisites)
 * - COMPLETION: Tasks that help complete a sequence or group
 * - IMPROVEMENT: Tasks that enhance or improve existing todos
 */
export enum SuggestionType {
  RELATED = 'related', // Tasks related to existing todos
  NEXT_STEP = 'next_step', // Natural next steps based on current todos
  DEPENDENCY = 'dependency', // Tasks that should be completed before others
  COMPLETION = 'completion', // Tasks to complete a sequence or group
  IMPROVEMENT = 'improvement', // Tasks that improve or enhance existing todos
}

/**
 * Context-aware filters for suggestions
 *
 * These parameters allow fine-tuning of the suggestion algorithm:
 *
 * @property includeTypes - Only include these suggestion types
 * @property excludeTypes - Exclude these suggestion types
 * @property minScore - Minimum relevance score threshold (0-100)
 * @property maxResults - Maximum number of suggestions to return
 * @property priorityFilter - Only include suggestions with these priorities
 * @property tags - Suggest tasks related to these specific tags
 * @property relatedToTodoIds - Suggest tasks related to these specific todos
 */
export interface SuggestionContext {
  includeTypes?: SuggestionType[]; // Only include these suggestion types
  excludeTypes?: SuggestionType[]; // Exclude these suggestion types
  minScore?: number; // Minimum relevance score (0-100)
  maxResults?: number; // Maximum number of suggestions to return
  priorityFilter?: ('high' | 'medium' | 'low')[]; // Only include suggestions with these priorities
  tags?: string[]; // Suggest tasks related to these tags
  relatedToTodoIds?: string[]; // Suggest tasks related to these specific todos
}

/**
 * Result format for task suggestions
 *
 * @property suggestions - Array of suggested tasks with relevance scores
 * @property contextInfo - Contextual information extracted from analyzed todos
 * @property metrics - Statistical metrics about the generated suggestions
 */
export interface TaskSuggestionResult {
  suggestions: SuggestedTask[];
  contextInfo: {
    analyzedTodoCount: number;
    topContextualTags: string[];
    completionPercentage: number;
    detectedThemes: string[];
  };
  metrics: {
    averageScore: number;
    suggestionsByType: Record<SuggestionType, number>;
  };
}

/**
 * Service for intelligent task suggestion based on AI analysis
 *
 * This service leverages AI to analyze existing todos and generate
 * contextually relevant task suggestions with relevance scoring.
 */
export class TaskSuggestionService {
  private aiService: typeof aiService;
  private verificationService?: AIVerificationService;
  private logger: Logger;

  /**
   * Creates a new TaskSuggestionService instance
   *
   * @param aiService - The AI service used for task analysis and generation, or API key string for backward compatibility
   * @param verificationService - Optional service for blockchain verification of suggestions
   * @param logger - Optional Logger instance for Jest isolation (if not provided, creates new Logger)
   */
  constructor(
    aiService: typeof aiService | string,
    verificationService?: AIVerificationService,
    logger?: Logger
  ) {
    // Handle backward compatibility with API key string parameter
    if (typeof aiService === 'string') {
      // This path is for backward compatibility with tests that pass API key
      // In practice, this would create a real EnhancedAIService instance
      throw new Error(
        'TaskSuggestionService constructor: String API key parameter is deprecated. Please pass AI service instance directly. Received type: string'
      );
    }

    this?.aiService = aiService;
    this?.verificationService = verificationService;
    this?.logger = logger || new Logger('TaskSuggestionService');
  }

  /**
   * Generate intelligent task suggestions based on existing todos
   *
   * This method analyzes the provided todos and generates relevant task suggestions
   * based on their content, relationships, and workflow context. It uses multiple
   * specialized suggestion algorithms in parallel, then combines and filters
   * the results based on the provided context.
   *
   * @param todos - List of existing todos to analyze
   * @param context - Optional context parameters to refine suggestions
   * @returns TaskSuggestionResult with scored and categorized suggestions
   *
   * @example
   * ```typescript
   * // Basic usage
   * const suggestions = await taskSuggestionService.suggestTasks(myTodos);
   *
   * // With filtering context
   * const suggestions = await taskSuggestionService.suggestTasks(myTodos, {
   *   includeTypes: [SuggestionType.NEXT_STEP],
   *   minScore: 70,
   *   maxResults: 5
   * });
   * ```
   */
  async suggestTasks(
    todos: Todo[],
    context: SuggestionContext = {}
  ): Promise<TaskSuggestionResult> {
    // Add type guards for parameters
    if (!Array.isArray(todos)) {
      throw new Error('Todos parameter must be an array');
    }

    if (context && typeof context !== 'object') {
      throw new Error('Context parameter must be an object');
    }

    this?.logger?.debug(`Generating task suggestions for ${todos.length} todos`);

    // Handle empty todo list
    if (todos?.length === 0) {
      return {
        suggestions: [],
        contextInfo: {
          analyzedTodoCount: 0,
          completionPercentage: 0,
          detectedThemes: [],
          topContextualTags: [],
        },
        metrics: {
          suggestionsByType: {
            [SuggestionType.NEXT_STEP]: 0,
            [SuggestionType.RELATED]: 0,
            [SuggestionType.DEPENDENCY]: 0,
            [SuggestionType.COMPLETION]: 0,
            [SuggestionType.IMPROVEMENT]: 0,
          },
          averageScore: 0,
        },
      };
    }

    try {
      // Get contextual information from existing todos
      const contextInfo = await this.analyzeContext(todos);

      // Generate different types of suggestions in parallel
      const [relatedTasks, nextStepTasks, dependencyTasks] = await Promise.all([
        this.generateRelatedTasks(todos, context),
        this.generateNextStepTasks(todos, context),
        this.generateDependencyTasks(todos, context),
      ]);

      // Combine all suggestions
      let allSuggestions = [
        ...relatedTasks,
        ...nextStepTasks,
        ...dependencyTasks,
      ];

      // Apply context filters
      allSuggestions = this.applySuggestionFilters(allSuggestions, context);

      // Sort by score (descending)
      allSuggestions.sort((a, b) => b.score - a.score);

      // Limit to maxResults if specified
      if (context.maxResults && allSuggestions.length > context.maxResults) {
        allSuggestions = allSuggestions.slice(0, context.maxResults);
      }

      // Calculate metrics
      const metrics = this.calculateMetrics(allSuggestions);

      return {
        suggestions: allSuggestions,
        contextInfo,
        metrics,
      };
    } catch (error) {
      this?.logger?.error(`Error generating task suggestions: ${error}`);
      throw new Error(
        `Failed to generate task suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate task suggestions with blockchain verification
   *
   * This method extends the standard suggestion process by adding blockchain
   * verification of the AI-generated results. This provides an audit trail
   * and verification mechanism for the suggestions.
   *
   * @param todos - List of existing todos to analyze
   * @param context - Optional context parameters to refine suggestions
   * @param privacyLevel - The level of data privacy for blockchain verification
   * @returns VerifiedAIResult containing both suggestions and their verification
   *
   * @throws Error if verification service is not initialized
   */
  async suggestTasksWithVerification(
    todos: Todo[],
    context: SuggestionContext = {},
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<TaskSuggestionResult>> {
    if (!this.verificationService) {
      throw new Error(
        'TaskSuggestionService: Verification service not initialized. Call setVerificationService() or pass verificationService to constructor.'
      );
    }

    const suggestions = await this.suggestTasks(todos, context);

    // Prepare metadata for verification
    const metadata = {
      todoCount: todos?.length?.toString(),
      suggestionCount: suggestions?.suggestions?.length.toString(),
      averageScore: suggestions?.metrics?.averageScore.toFixed(2),
      timestamp: Date.now().toString(),
      contextFilters: JSON.stringify(context),
    };

    // Create blockchain verification
    const verification = await this?.verificationService?.createVerification(
      AIActionType.SUGGEST, // Using the closest matching action type
      { todos, context },
      suggestions,
      metadata,
      privacyLevel
    );

    return {
      result: suggestions,
      verification,
    };
  }

  /**
   * Generate related task suggestions
   *
   * This method generates suggestions for tasks that are related to or
   * complement the existing todos. It focuses on tasks that have thematic
   * or functional relationships with current tasks.
   *
   * @param todos - List of existing todos to analyze
   * @param context - Context parameters to refine the suggestions
   * @returns Array of suggested tasks with relevance scores
   *
   * @private
   */
  private async generateRelatedTasks(
    todos: Todo[],
    context: SuggestionContext
  ): Promise<SuggestedTask[]> {
    // Focus on specific todos if specified in context
    const targetTodos = context.relatedToTodoIds
      ? todos.filter(todo => context.relatedToTodoIds?.includes(todo.id))
      : todos;

    if (targetTodos?.length === 0) {
      return [];
    }

    try {
      // Get related task suggestions from AI
      const prompt = `Analyze these todos and suggest RELATED tasks that complement them.
        Each suggestion should include a title, description, priority (high/medium/low),
        relevance score (0-100), reasoning for the suggestion, and tags.

        Return result as JSON array of objects with: title, description, priority, score, reasoning, tags

        Todos:
        ${targetTodos.map(t => `- ID: ${t.id}, Title: ${t.title}, Desc: ${t.description || 'No description'}, Priority: ${t.priority}, Tags: [${t?.tags?.join(', ')}]`).join('\n')}`;

      const result = await this.aiService
        .getProvider()
        .completeStructured<SuggestedTask[]>({
          prompt,
          options: { temperature: 0.7 },
        });

      // Add suggestion type and related todo IDs
      const suggestions = (result.result || []).map(suggestion => ({
        ...suggestion,
        type: SuggestionType.RELATED,
        relatedTodoIds: targetTodos.map(t => t.id),
      }));

      return suggestions;
    } catch (error) {
      this?.logger?.error(`Error generating related tasks: ${error}`);
      throw error;
    }
  }

  /**
   * Generate next step task suggestions
   *
   * This method identifies the logical next steps in a workflow based on
   * completed todos and dependency analysis. It suggests tasks that would
   * naturally follow in sequence after current completed tasks.
   *
   * The algorithm:
   * 1. Analyzes dependencies between todos
   * 2. Identifies completed todos
   * 3. Finds todos that were blocked by now-completed tasks
   * 4. Suggests logical next steps based on workflow analysis
   *
   * @param todos - List of existing todos to analyze
   * @param context - Context parameters to refine the suggestions
   * @returns Array of suggested next step tasks
   *
   * @private
   */
  private async generateNextStepTasks(
    todos: Todo[],
    _context: SuggestionContext
  ): Promise<SuggestedTask[]> {
    try {
      // First, get dependency information to understand the workflow
      const dependencies = await this?.aiService?.detectDependencies(todos);

      // Find completed todos and their potential next steps
      const completedTodos = todos.filter(todo => todo.completed);

      if (completedTodos?.length === 0) {
        // If no todos are completed, suggest initial tasks
        const prompt = `Based on these todos, suggest NEXT STEP tasks that would logically come next in a workflow.
          Each suggestion should include a title, description, priority (high/medium/low),
          relevance score (0-100), reasoning for the suggestion, and tags.

          Return result as JSON array of objects with: title, description, priority, score, reasoning, tags

          Todos:
          ${todos.map(t => `- ID: ${t.id}, Title: ${t.title}, Desc: ${t.description || 'No description'}, Priority: ${t.priority}, Tags: [${t?.tags?.join(', ')}]`).join('\n')}`;

        const result = await this.aiService
          .getProvider()
          .completeStructured<SuggestedTask[]>({
            prompt,
            options: { temperature: 0.7 },
          });

        return (result.result || []).map(suggestion => ({
          ...suggestion,
          type: SuggestionType.NEXT_STEP,
          relatedTodoIds: todos.map(t => t.id),
        }));
      }

      // Find todos that are blocked by completed todos
      const potentialNextSteps: string[] = [];
      completedTodos.forEach(todo => {
        const blockedTodos = Object.entries(dependencies.dependencies)
          .filter(([_, deps]) => deps.includes(todo.id))
          .map(([todoId]) => todoId);

        potentialNextSteps.push(...blockedTodos);
      });

      // Get todos that could be started next based on completed dependencies
      const todoIdsToFocus = [...new Set(potentialNextSteps)];
      const todosToFocus = todos.filter(todo =>
        todoIdsToFocus.includes(todo.id)
      );

      // Generate next step suggestions
      const prompt = `Based on these todos, suggest NEXT STEP tasks that would logically come after them.
        Each suggestion should include a title, description, priority (high/medium/low),
        relevance score (0-100), reasoning for the suggestion, and tags.

        Return result as JSON array of objects with: title, description, priority, score, reasoning, tags

        Todos:
        ${todosToFocus.map(t => `- ID: ${t.id}, Title: ${t.title}, Desc: ${t.description || 'No description'}, Priority: ${t.priority}, Tags: [${t?.tags?.join(', ')}]`).join('\n')}`;

      const result = await this.aiService
        .getProvider()
        .completeStructured<SuggestedTask[]>({
          prompt,
          options: { temperature: 0.7 },
        });

      return (result.result || []).map(suggestion => ({
        ...suggestion,
        type: SuggestionType.NEXT_STEP,
        relatedTodoIds: todosToFocus.map(t => t.id),
      }));
    } catch (error) {
      this?.logger?.error(`Error generating next step tasks: ${error}`);
      throw error;
    }
  }

  /**
   * Generate dependency task suggestions (prerequisites or blockers)
   *
   * This method identifies potential prerequisite tasks that should be
   * completed before the current incomplete todos. It focuses on finding
   * missing dependencies and suggesting them as new tasks.
   *
   * The algorithm:
   * 1. Identifies incomplete todos that don't have dependencies
   * 2. Analyzes these todos to determine what prerequisites they might need
   * 3. Generates suggestions for dependency tasks
   *
   * @param todos - List of existing todos to analyze
   * @param context - Context parameters to refine the suggestions
   * @returns Array of suggested dependency tasks
   *
   * @private
   */
  private async generateDependencyTasks(
    todos: Todo[],
    _context: SuggestionContext
  ): Promise<SuggestedTask[]> {
    try {
      // Find incomplete todos that don't have dependencies identified
      const incompleteTodos = todos.filter(todo => !todo.completed);

      // Get dependency information to identify missing prerequisites
      const dependencies = await this?.aiService?.detectDependencies(todos);

      // Find todos that might need prerequisites
      const todosWithoutDependencies = incompleteTodos.filter(
        todo =>
          !dependencies?.dependencies?.[todo.id] ||
          dependencies?.dependencies?.[todo.id].length === 0
      );

      if (todosWithoutDependencies?.length === 0) {
        return [];
      }

      // Generate dependency suggestions
      const prompt = `Analyze these todos and suggest PREREQUISITE tasks that would need to be completed before these todos.
        Each suggestion should include a title, description, priority (high/medium/low),
        relevance score (0-100), reasoning for the suggestion, and tags.

        Return result as JSON array of objects with: title, description, priority, score, reasoning, tags

        Todos:
        ${todosWithoutDependencies.map(t => `- ID: ${t.id}, Title: ${t.title}, Desc: ${t.description || 'No description'}, Priority: ${t.priority}, Tags: [${t?.tags?.join(', ')}]`).join('\n')}`;

      const result = await this.aiService
        .getProvider()
        .completeStructured<SuggestedTask[]>({
          prompt,
          options: { temperature: 0.7 },
        });

      return (result.result || []).map(suggestion => ({
        ...suggestion,
        type: SuggestionType.DEPENDENCY,
        relatedTodoIds: todosWithoutDependencies.map(t => t.id),
      }));
    } catch (error) {
      this?.logger?.error(`Error generating dependency tasks: ${error}`);
      throw error;
    }
  }

  /**
   * Analyze the todos to extract contextual information
   *
   * This method extracts useful contextual information from the todos:
   * - Completion percentage of all todos
   * - Most common tags used across todos
   * - Themes detected through AI analysis
   *
   * This contextual information helps improve suggestion relevance and
   * provides insightful metadata in the results.
   *
   * @param todos - List of todos to analyze
   * @returns Contextual information object
   *
   * @private
   */
  private async analyzeContext(todos: Todo[]): Promise<{
    analyzedTodoCount: number;
    topContextualTags: string[];
    completionPercentage: number;
    detectedThemes: string[];
  }> {
    try {
      // Get completion percentage
      const completionPercentage =
        todos.length > 0
          ? (todos.filter(todo => todo.completed).length / todos.length) * 100
          : 0;

      // Get top tags by counting occurrences
      const tagCounts: Record<string, number> = {};
      todos.forEach(todo => {
        todo?.tags?.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      // Sort tags by frequency and take top 5
      const topContextualTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      // Get themes through AI analysis
      const analysis = await this?.aiService?.analyze(todos);
      const detectedThemes =
        analysis.keyThemes || analysis.themes || analysis.categories || [];

      return {
        analyzedTodoCount: todos.length,
        topContextualTags,
        completionPercentage,
        detectedThemes: Array.isArray(detectedThemes) ? detectedThemes : [],
      };
    } catch (error) {
      this?.logger?.error(`Error analyzing context: ${error}`);
      return {
        analyzedTodoCount: todos.length,
        topContextualTags: [],
        completionPercentage: 0,
        detectedThemes: [],
      };
    }
  }

  /**
   * Apply filters based on the suggestion context
   *
   * This method filters suggestions based on the specified context parameters:
   * - Filter by suggestion types (include/exclude)
   * - Filter by minimum relevance score
   * - Filter by priority levels
   * - Filter by tags
   *
   * @param suggestions - Array of suggested tasks to filter
   * @param context - Context parameters containing filter criteria
   * @returns Filtered array of suggestions
   *
   * @private
   */
  private applySuggestionFilters(
    suggestions: SuggestedTask[],
    context: SuggestionContext
  ): SuggestedTask[] {
    let filteredSuggestions = [...suggestions];

    // Filter by suggestion type (include)
    if (context.includeTypes && context?.includeTypes?.length > 0) {
      filteredSuggestions = filteredSuggestions.filter(suggestion =>
        context.includeTypes?.includes(suggestion.type)
      );
    }

    // Filter by suggestion type (exclude)
    if (context.excludeTypes && context?.excludeTypes?.length > 0) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion => !context.excludeTypes?.includes(suggestion.type)
      );
    }

    // Filter by minimum score
    if (context.minScore !== undefined) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion => suggestion.score >= context.minScore
      );
    }

    // Filter by priority
    if (context.priorityFilter && context?.priorityFilter?.length > 0) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion =>
          suggestion.priority &&
          context.priorityFilter?.includes(suggestion.priority)
      );
    }

    // Filter by tags
    if (context.tags && context?.tags?.length > 0) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion =>
          suggestion.tags &&
          suggestion?.tags?.some(tag => context.tags?.includes(tag))
      );
    }

    return filteredSuggestions;
  }

  /**
   * Calculate metrics for the generated suggestions
   *
   * This method calculates statistical metrics about the suggestions:
   * - Average relevance score across all suggestions
   * - Count of suggestions by type
   *
   * These metrics help evaluate the quality and distribution of suggestions.
   *
   * @param suggestions - Array of suggested tasks
   * @returns Metrics object with statistical information
   *
   * @private
   */
  private calculateMetrics(suggestions: SuggestedTask[]): {
    averageScore: number;
    suggestionsByType: Record<SuggestionType, number>;
  } {
    // Calculate average relevance score
    const totalScore = suggestions.reduce(
      (sum, suggestion) => sum + suggestion.score,
      0
    );
    const averageScore =
      suggestions.length > 0 ? totalScore / suggestions.length : 0;

    // Initialize counters for each suggestion type
    const suggestionsByType: Record<SuggestionType, number> = {
      [SuggestionType.RELATED]: 0,
      [SuggestionType.NEXT_STEP]: 0,
      [SuggestionType.DEPENDENCY]: 0,
      [SuggestionType.COMPLETION]: 0,
      [SuggestionType.IMPROVEMENT]: 0,
    };

    // Count suggestions by type
    suggestions.forEach(suggestion => {
      suggestionsByType[suggestion.type] =
        (suggestionsByType[suggestion.type] || 0) + 1;
    });

    return {
      averageScore,
      suggestionsByType,
    };
  }
}
