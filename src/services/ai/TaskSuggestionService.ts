import { Todo } from '../../types/todo';
import { EnhancedAIService } from './EnhancedAIService';
import { AIVerificationService, VerifiedAIResult } from './AIVerificationService';
import { AIPrivacyLevel, AIActionType } from '../../types/adapters/AIVerifierAdapter';
import { Logger } from '../../utils/Logger';

/**
 * Represents a suggested task with relevance scoring
 */
export interface SuggestedTask {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  score: number;  // Relevance score (0-100)
  reasoning: string;
  tags?: string[];
  type: SuggestionType;
  relatedTodoIds?: string[];  // IDs of related todos that triggered this suggestion
}

/**
 * Types of task suggestions
 */
export enum SuggestionType {
  RELATED = 'related',       // Tasks related to existing todos
  NEXT_STEP = 'next_step',   // Natural next steps based on current todos
  DEPENDENCY = 'dependency', // Tasks that should be completed before others
  COMPLETION = 'completion', // Tasks to complete a sequence or group
  IMPROVEMENT = 'improvement' // Tasks that improve or enhance existing todos
}

/**
 * Context-aware filters for suggestions
 */
export interface SuggestionContext {
  includeTypes?: SuggestionType[];  // Only include these suggestion types
  excludeTypes?: SuggestionType[];  // Exclude these suggestion types
  minScore?: number;               // Minimum relevance score (0-100)
  maxResults?: number;             // Maximum number of suggestions to return
  priorityFilter?: ('high' | 'medium' | 'low')[];  // Only include suggestions with these priorities
  tags?: string[];                 // Suggest tasks related to these tags
  relatedToTodoIds?: string[];     // Suggest tasks related to these specific todos
}

/**
 * Result format for task suggestions
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
 */
export class TaskSuggestionService {
  private aiService: EnhancedAIService;
  private verificationService?: AIVerificationService;
  private logger: Logger;

  constructor(
    aiService: EnhancedAIService,
    verificationService?: AIVerificationService
  ) {
    this.aiService = aiService;
    this.verificationService = verificationService;
    this.logger = new Logger('TaskSuggestionService');
  }

  /**
   * Generate intelligent task suggestions based on existing todos
   * 
   * @param todos List of existing todos to analyze
   * @param context Optional context parameters to refine suggestions
   * @returns TaskSuggestionResult with scored and categorized suggestions
   */
  async suggestTasks(
    todos: Todo[],
    context: SuggestionContext = {}
  ): Promise<TaskSuggestionResult> {
    this.logger.debug(`Generating task suggestions for ${todos.length} todos`);

    try {
      // Get contextual information from existing todos
      const contextInfo = await this.analyzeContext(todos);
      
      // Generate different types of suggestions in parallel
      const [relatedTasks, nextStepTasks, dependencyTasks] = await Promise.all([
        this.generateRelatedTasks(todos, context),
        this.generateNextStepTasks(todos, context),
        this.generateDependencyTasks(todos, context)
      ]);
      
      // Combine all suggestions
      let allSuggestions = [
        ...relatedTasks,
        ...nextStepTasks,
        ...dependencyTasks
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
        metrics
      };
    } catch (error) {
      this.logger.error(`Error generating task suggestions: ${error}`);
      throw new Error(`Failed to generate task suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate task suggestions with blockchain verification
   */
  async suggestTasksWithVerification(
    todos: Todo[],
    context: SuggestionContext = {},
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
  ): Promise<VerifiedAIResult<TaskSuggestionResult>> {
    if (!this.verificationService) {
      throw new Error('Verification service not initialized');
    }
    
    const suggestions = await this.suggestTasks(todos, context);
    
    const metadata = {
      todoCount: todos.length.toString(),
      suggestionCount: suggestions.suggestions.length.toString(),
      averageScore: suggestions.metrics.averageScore.toFixed(2),
      timestamp: Date.now().toString(),
      contextFilters: JSON.stringify(context)
    };
    
    const verification = await this.verificationService.createVerification(
      AIActionType.SUGGEST, // Using the closest matching action type
      { todos, context },
      suggestions,
      metadata,
      privacyLevel
    );
    
    return {
      result: suggestions,
      verification
    };
  }

  /**
   * Generate related task suggestions
   */
  private async generateRelatedTasks(
    todos: Todo[], 
    context: SuggestionContext
  ): Promise<SuggestedTask[]> {
    // Focus on specific todos if specified in context
    const targetTodos = context.relatedToTodoIds
      ? todos.filter(todo => context.relatedToTodoIds?.includes(todo.id))
      : todos;
    
    if (targetTodos.length === 0) {
      return [];
    }
    
    try {
      // Get related task suggestions from AI
      const prompt = `Analyze these todos and suggest RELATED tasks that complement them.
        Each suggestion should include a title, description, priority (high/medium/low), 
        relevance score (0-100), reasoning for the suggestion, and tags.
        
        Return result as JSON array of objects with: title, description, priority, score, reasoning, tags
        
        Todos:
        ${targetTodos.map(t => `- ID: ${t.id}, Title: ${t.title}, Desc: ${t.description || 'No description'}, Priority: ${t.priority}, Tags: [${t.tags.join(', ')}]`).join('\n')}`;
      
      const result = await this.aiService.getProvider().completeStructured<SuggestedTask[]>({
        prompt,
        options: { temperature: 0.7 }
      });
      
      // Add suggestion type and related todo IDs
      const suggestions = (result.result || []).map(suggestion => ({
        ...suggestion,
        type: SuggestionType.RELATED,
        relatedTodoIds: targetTodos.map(t => t.id)
      }));
      
      return suggestions;
    } catch (error) {
      this.logger.error(`Error generating related tasks: ${error}`);
      return [];
    }
  }

  /**
   * Generate next step task suggestions
   */
  private async generateNextStepTasks(
    todos: Todo[],
    context: SuggestionContext
  ): Promise<SuggestedTask[]> {
    try {
      // First, get dependency information to understand the workflow
      const dependencies = await this.aiService.detectDependencies(todos);
      
      // Find completed todos and their potential next steps
      const completedTodos = todos.filter(todo => todo.completed);
      
      if (completedTodos.length === 0) {
        // If no todos are completed, suggest initial tasks
        const prompt = `Based on these todos, suggest NEXT STEP tasks that would logically come next in a workflow.
          Each suggestion should include a title, description, priority (high/medium/low), 
          relevance score (0-100), reasoning for the suggestion, and tags.
          
          Return result as JSON array of objects with: title, description, priority, score, reasoning, tags
          
          Todos:
          ${todos.map(t => `- ID: ${t.id}, Title: ${t.title}, Desc: ${t.description || 'No description'}, Priority: ${t.priority}, Tags: [${t.tags.join(', ')}]`).join('\n')}`;
        
        const result = await this.aiService.getProvider().completeStructured<SuggestedTask[]>({
          prompt,
          options: { temperature: 0.7 }
        });
        
        return (result.result || []).map(suggestion => ({
          ...suggestion,
          type: SuggestionType.NEXT_STEP,
          relatedTodoIds: todos.map(t => t.id)
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
      const todosToFocus = todos.filter(todo => todoIdsToFocus.includes(todo.id));
      
      // Generate next step suggestions
      const prompt = `Based on these todos, suggest NEXT STEP tasks that would logically come after them.
        Each suggestion should include a title, description, priority (high/medium/low), 
        relevance score (0-100), reasoning for the suggestion, and tags.
        
        Return result as JSON array of objects with: title, description, priority, score, reasoning, tags
        
        Todos:
        ${todosToFocus.map(t => `- ID: ${t.id}, Title: ${t.title}, Desc: ${t.description || 'No description'}, Priority: ${t.priority}, Tags: [${t.tags.join(', ')}]`).join('\n')}`;
      
      const result = await this.aiService.getProvider().completeStructured<SuggestedTask[]>({
        prompt,
        options: { temperature: 0.7 }
      });
      
      return (result.result || []).map(suggestion => ({
        ...suggestion,
        type: SuggestionType.NEXT_STEP,
        relatedTodoIds: todosToFocus.map(t => t.id)
      }));
    } catch (error) {
      this.logger.error(`Error generating next step tasks: ${error}`);
      return [];
    }
  }

  /**
   * Generate dependency task suggestions (prerequisites or blockers)
   */
  private async generateDependencyTasks(
    todos: Todo[],
    context: SuggestionContext
  ): Promise<SuggestedTask[]> {
    try {
      // Find incomplete todos that don't have dependencies identified
      const incompleteTodos = todos.filter(todo => !todo.completed);
      
      // Get dependency information to identify missing prerequisites
      const dependencies = await this.aiService.detectDependencies(todos);
      
      // Find todos that might need prerequisites
      const todosWithoutDependencies = incompleteTodos.filter(todo => 
        !dependencies.dependencies[todo.id] || 
        dependencies.dependencies[todo.id].length === 0
      );
      
      if (todosWithoutDependencies.length === 0) {
        return [];
      }
      
      // Generate dependency suggestions
      const prompt = `Analyze these todos and suggest PREREQUISITE tasks that would need to be completed before these todos.
        Each suggestion should include a title, description, priority (high/medium/low), 
        relevance score (0-100), reasoning for the suggestion, and tags.
        
        Return result as JSON array of objects with: title, description, priority, score, reasoning, tags
        
        Todos:
        ${todosWithoutDependencies.map(t => `- ID: ${t.id}, Title: ${t.title}, Desc: ${t.description || 'No description'}, Priority: ${t.priority}, Tags: [${t.tags.join(', ')}]`).join('\n')}`;
      
      const result = await this.aiService.getProvider().completeStructured<SuggestedTask[]>({
        prompt,
        options: { temperature: 0.7 }
      });
      
      return (result.result || []).map(suggestion => ({
        ...suggestion,
        type: SuggestionType.DEPENDENCY,
        relatedTodoIds: todosWithoutDependencies.map(t => t.id)
      }));
    } catch (error) {
      this.logger.error(`Error generating dependency tasks: ${error}`);
      return [];
    }
  }

  /**
   * Analyze the todos to extract contextual information
   */
  private async analyzeContext(todos: Todo[]): Promise<{
    analyzedTodoCount: number;
    topContextualTags: string[];
    completionPercentage: number;
    detectedThemes: string[];
  }> {
    try {
      // Get completion percentage
      const completionPercentage = todos.length > 0
        ? (todos.filter(todo => todo.completed).length / todos.length) * 100
        : 0;
      
      // Get top tags
      const tagCounts: Record<string, number> = {};
      todos.forEach(todo => {
        todo.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      
      const topContextualTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);
      
      // Get themes through analysis
      const analysis = await this.aiService.analyze(todos);
      const detectedThemes = analysis.keyThemes || 
        analysis.themes || 
        analysis.categories || 
        [];
      
      return {
        analyzedTodoCount: todos.length,
        topContextualTags,
        completionPercentage,
        detectedThemes: Array.isArray(detectedThemes) ? detectedThemes : []
      };
    } catch (error) {
      this.logger.error(`Error analyzing context: ${error}`);
      return {
        analyzedTodoCount: todos.length,
        topContextualTags: [],
        completionPercentage: 0,
        detectedThemes: []
      };
    }
  }

  /**
   * Apply filters based on the suggestion context
   */
  private applySuggestionFilters(
    suggestions: SuggestedTask[],
    context: SuggestionContext
  ): SuggestedTask[] {
    let filteredSuggestions = [...suggestions];
    
    // Filter by suggestion type (include)
    if (context.includeTypes && context.includeTypes.length > 0) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion => context.includeTypes?.includes(suggestion.type)
      );
    }
    
    // Filter by suggestion type (exclude)
    if (context.excludeTypes && context.excludeTypes.length > 0) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion => !context.excludeTypes?.includes(suggestion.type)
      );
    }
    
    // Filter by minimum score
    if (context.minScore !== undefined) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion => suggestion.score >= context.minScore!
      );
    }
    
    // Filter by priority
    if (context.priorityFilter && context.priorityFilter.length > 0) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion => suggestion.priority && context.priorityFilter?.includes(suggestion.priority)
      );
    }
    
    // Filter by tags
    if (context.tags && context.tags.length > 0) {
      filteredSuggestions = filteredSuggestions.filter(
        suggestion => suggestion.tags && 
          suggestion.tags.some(tag => context.tags?.includes(tag))
      );
    }
    
    return filteredSuggestions;
  }

  /**
   * Calculate metrics for the generated suggestions
   */
  private calculateMetrics(suggestions: SuggestedTask[]): {
    averageScore: number;
    suggestionsByType: Record<SuggestionType, number>;
  } {
    const totalScore = suggestions.reduce((sum, suggestion) => sum + suggestion.score, 0);
    const averageScore = suggestions.length > 0 ? totalScore / suggestions.length : 0;
    
    const suggestionsByType: Record<SuggestionType, number> = {
      [SuggestionType.RELATED]: 0,
      [SuggestionType.NEXT_STEP]: 0,
      [SuggestionType.DEPENDENCY]: 0,
      [SuggestionType.COMPLETION]: 0,
      [SuggestionType.IMPROVEMENT]: 0
    };
    
    suggestions.forEach(suggestion => {
      suggestionsByType[suggestion.type] = (suggestionsByType[suggestion.type] || 0) + 1;
    });
    
    return {
      averageScore,
      suggestionsByType
    };
  }
}