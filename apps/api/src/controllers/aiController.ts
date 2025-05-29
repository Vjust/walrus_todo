import { RequestHandler } from 'express';
import { logger } from '../utils/logger';
import { TodoService } from '../services/todoService';
import {
  ApiResponse,
  AISuggestionRequest,
  AISuggestionsResponse,
  AISummarizeRequest,
  AISummaryResponse,
  AICategorizeRequest,
  AICategorizeResponse,
  AIPrioritizeRequest,
  AIPrioritizeResponse,
  AIAnalyzeRequest,
  AIAnalyzeResponse,
  AISuggestion,
  AICategoryMapping,
  AIPriorityMapping,
  AIProductivityInsight,
} from '../types';

export class AIController {
  constructor(private todoService: TodoService) {}

  /**
   * Get AI-powered task suggestions
   */
  suggest: RequestHandler = async (req, res) => {
    try {
      const { wallet, context, limit = 5 } = req.body as AISuggestionRequest;

      if (!wallet) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

      // Get user's existing todos for context
      const { todos: existingTodos } = await this.todoService.getTodos(
        wallet,
        { page: 1, limit: 100 }
      );

      // Generate mock suggestions based on existing todos
      const suggestions: AISuggestion[] = this.generateSuggestions(
        existingTodos,
        context,
        limit
      );

      const response: AISuggestionsResponse = {
        suggestions,
        context: context || 'general productivity',
      };

      return res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      } as ApiResponse<AISuggestionsResponse>);
    } catch (error) {
      logger.error('Error generating AI suggestions', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate suggestions',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Summarize todo list with AI
   */
  summarize: RequestHandler = async (req, res) => {
    try {
      const {
        wallet,
        timeframe = 'all',
        includeCompleted = true,
      } = req.body as AISummarizeRequest;

      if (!wallet) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

      // Get user's todos
      const { todos } = await this.todoService.getTodos(wallet, { page: 1, limit: 1000 });
      
      // Filter by timeframe
      const filteredTodos = this.filterByTimeframe(todos, timeframe);
      
      // Generate summary
      const summary = this.generateSummary(filteredTodos, includeCompleted);

      const response: AISummaryResponse = {
        summary: summary.text,
        stats: summary.stats,
        insights: summary.insights,
      };

      return res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      } as ApiResponse<AISummaryResponse>);
    } catch (error) {
      logger.error('Error generating AI summary', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate summary',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Suggest categories and tags for todos
   */
  categorize: RequestHandler = async (req, res) => {
    try {
      const { wallet, todoIds } = req.body as AICategorizeRequest;

      if (!wallet) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

      // Get user's todos
      const { todos } = await this.todoService.getTodos(wallet, { page: 1, limit: 1000 });
      
      // Filter by todoIds if provided
      const todosToAnalyze = todoIds
        ? todos.filter(t => todoIds.includes(t.id))
        : todos.filter(t => !t.category || t.tags?.length === 0);

      // Generate category mappings
      const mappings = this.generateCategoryMappings(todosToAnalyze);

      const response: AICategorizeResponse = {
        mappings,
        newCategories: ['Work', 'Personal', 'Health', 'Finance', 'Learning'],
        newTags: ['urgent', 'important', 'quick-win', 'long-term', 'recurring'],
      };

      return res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      } as ApiResponse<AICategorizeResponse>);
    } catch (error) {
      logger.error('Error generating AI categories', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate categories',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Suggest priority levels for todos
   */
  prioritize: RequestHandler = async (req, res) => {
    try {
      const {
        wallet,
        considerDeadlines = true,
        considerDependencies = false,
      } = req.body as AIPrioritizeRequest;

      if (!wallet) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

      // Get user's todos
      const { todos } = await this.todoService.getTodos(wallet, { page: 1, limit: 1000 });
      
      // Generate priority mappings
      const priorities = this.generatePriorityMappings(
        todos.filter(t => !t.completed),
        considerDeadlines,
        considerDependencies
      );

      const response: AIPrioritizeResponse = {
        priorities,
        topPriorities: priorities
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(p => p.todoId),
      };

      return res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      } as ApiResponse<AIPrioritizeResponse>);
    } catch (error) {
      logger.error('Error generating AI priorities', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate priorities',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Analyze productivity patterns
   */
  analyze: RequestHandler = async (req, res) => {
    try {
      const { wallet, timeframe = 'week' } = req.body as AIAnalyzeRequest;

      if (!wallet) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

      // Get user's todos
      const { todos } = await this.todoService.getTodos(wallet, { page: 1, limit: 1000 });
      
      // Filter by timeframe
      const filteredTodos = this.filterByTimeframe(todos, timeframe);
      
      // Generate analysis
      const analysis = this.generateProductivityAnalysis(filteredTodos);

      const response: AIAnalyzeResponse = {
        productivityScore: analysis.score,
        insights: analysis.insights,
        patterns: analysis.patterns,
        recommendations: analysis.recommendations,
      };

      return res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      } as ApiResponse<AIAnalyzeResponse>);
    } catch (error) {
      logger.error('Error generating AI analysis', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate analysis',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  // Helper methods for generating mock data

  private generateSuggestions(
    existingTodos: any[],
    context?: string,
    limit: number = 5
  ): AISuggestion[] {
    const suggestions: AISuggestion[] = [];
    
    // Common task templates based on context
    const templates = {
      general: [
        { title: 'Review weekly goals', description: 'Take time to review and adjust your weekly goals', priority: 'medium', category: 'Planning' },
        { title: 'Clean up email inbox', description: 'Process and organize unread emails', priority: 'low', category: 'Admin' },
        { title: 'Update project documentation', description: 'Ensure all project docs are current', priority: 'medium', category: 'Work' },
        { title: 'Schedule health checkup', description: 'Book annual health examination', priority: 'high', category: 'Health' },
        { title: 'Plan weekend activities', description: 'Research and plan relaxing weekend activities', priority: 'low', category: 'Personal' },
      ],
      work: [
        { title: 'Prepare meeting agenda', description: 'Create agenda for upcoming team meeting', priority: 'high', category: 'Work' },
        { title: 'Update task tracking', description: 'Log progress on current projects', priority: 'medium', category: 'Work' },
        { title: 'Code review backlog', description: 'Review pending pull requests', priority: 'medium', category: 'Work' },
        { title: 'Update skills profile', description: 'Add recent certifications and skills', priority: 'low', category: 'Career' },
        { title: 'Network follow-ups', description: 'Send follow-up messages to recent contacts', priority: 'medium', category: 'Career' },
      ],
      personal: [
        { title: 'Call family member', description: 'Schedule regular check-in with family', priority: 'high', category: 'Personal' },
        { title: 'Organize photos', description: 'Sort and backup recent photos', priority: 'low', category: 'Personal' },
        { title: 'Plan healthy meals', description: 'Create meal plan for the week', priority: 'medium', category: 'Health' },
        { title: 'Exercise routine', description: 'Schedule workout sessions', priority: 'high', category: 'Health' },
        { title: 'Read pending articles', description: 'Catch up on saved reading list', priority: 'low', category: 'Learning' },
      ],
    };

    const selectedTemplates = templates[context as keyof typeof templates] || templates.general;
    
    // Generate suggestions avoiding duplicates with existing todos
    for (let i = 0; i < Math.min(limit, selectedTemplates.length); i++) {
      const template = selectedTemplates[i];
      const exists = existingTodos.some(t => 
        t.description.toLowerCase().includes(template.title.toLowerCase())
      );
      
      if (!exists) {
        suggestions.push({
          id: `suggest-${Date.now()}-${i}`,
          title: template.title,
          description: template.description,
          priority: template.priority as 'high' | 'medium' | 'low',
          category: template.category,
          tags: this.generateTags(template.category),
          reasoning: `Based on your ${context || 'general'} context and current task list`,
        });
      }
    }

    return suggestions;
  }

  private generateSummary(todos: any[], includeCompleted: boolean) {
    const relevantTodos = includeCompleted ? todos : todos.filter(t => !t.completed);
    const completed = todos.filter(t => t.completed).length;
    const pending = todos.filter(t => !t.completed).length;
    const highPriority = todos.filter(t => t.priority === 'high' && !t.completed).length;
    
    const categories: Record<string, number> = {};
    todos.forEach(todo => {
      const cat = todo.category || 'Uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    const insights: string[] = [];
    
    if (completed > pending) {
      insights.push('Great progress! You\'ve completed more tasks than you have pending.');
    }
    
    if (highPriority > 3) {
      insights.push(`You have ${highPriority} high-priority tasks. Consider focusing on these first.`);
    }
    
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      insights.push(`Most of your tasks are in the "${topCategory[0]}" category.`);
    }

    // Calculate overdue tasks
    const now = new Date();
    const overdue = todos.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate < now;
    }).length;

    return {
      text: `You have ${pending} pending tasks and have completed ${completed} tasks. ${overdue} tasks are overdue.`,
      stats: {
        total: todos.length,
        completed,
        pending,
        overdue,
      },
      insights,
    };
  }

  private generateCategoryMappings(todos: any[]): AICategoryMapping[] {
    return todos.map(todo => {
      // Simple keyword-based categorization
      const description = todo.description.toLowerCase();
      let category = 'Personal';
      let confidence = 0.7;
      
      if (description.includes('work') || description.includes('meeting') || description.includes('project')) {
        category = 'Work';
        confidence = 0.9;
      } else if (description.includes('exercise') || description.includes('health') || description.includes('doctor')) {
        category = 'Health';
        confidence = 0.85;
      } else if (description.includes('learn') || description.includes('study') || description.includes('course')) {
        category = 'Learning';
        confidence = 0.85;
      } else if (description.includes('pay') || description.includes('bill') || description.includes('budget')) {
        category = 'Finance';
        confidence = 0.9;
      }

      return {
        todoId: todo.id,
        suggestedCategory: category,
        suggestedTags: this.generateTags(category),
        confidence,
      };
    });
  }

  private generatePriorityMappings(
    todos: any[],
    considerDeadlines: boolean,
    considerDependencies: boolean
  ): AIPriorityMapping[] {
    return todos.map(todo => {
      let score = 50; // Base score
      let reasoning = 'Based on task description';
      
      // Keyword-based priority scoring
      const description = todo.description.toLowerCase();
      
      if (description.includes('urgent') || description.includes('asap') || description.includes('immediately')) {
        score += 30;
        reasoning = 'Contains urgency keywords';
      } else if (description.includes('important') || description.includes('critical')) {
        score += 20;
        reasoning = 'Marked as important';
      }
      
      // Category-based adjustments
      if (todo.category === 'Work') {
        score += 10;
      } else if (todo.category === 'Health') {
        score += 15;
      }
      
      // Time-based adjustments
      const age = new Date().getTime() - new Date(todo.createdAt).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      if (daysOld > 7) {
        score += 10;
        reasoning += '; Task has been pending for over a week';
      }

      let suggestedPriority: 'high' | 'medium' | 'low' = 'medium';
      if (score >= 80) suggestedPriority = 'high';
      else if (score <= 40) suggestedPriority = 'low';

      return {
        todoId: todo.id,
        currentPriority: todo.priority,
        suggestedPriority,
        reasoning,
        score,
      };
    });
  }

  private generateProductivityAnalysis(todos: any[]) {
    const completed = todos.filter(t => t.completed).length;
    const total = todos.length;
    const completionRate = total > 0 ? completed / total : 0;
    const score = Math.round(completionRate * 100);

    const insights: AIProductivityInsight[] = [];
    
    if (completionRate > 0.8) {
      insights.push({
        type: 'achievement',
        title: 'High Productivity',
        description: 'Excellent completion rate! You\'re being very productive.',
        impact: 'positive',
      });
    } else if (completionRate < 0.3) {
      insights.push({
        type: 'suggestion',
        title: 'Improve Completion Rate',
        description: 'Low completion rate. Consider breaking down large tasks.',
        impact: 'negative',
      });
    }

    const categoryCounts: Record<string, number> = {};
    todos.forEach(todo => {
      const cat = todo.category || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const recommendations: string[] = [];
    
    if (score < 50) {
      recommendations.push('Try focusing on one task at a time');
      recommendations.push('Break large tasks into smaller, manageable pieces');
    }
    
    if (todos.filter(t => t.priority === 'high').length > 5) {
      recommendations.push('Review your high-priority tasks - not everything can be urgent');
    }

    recommendations.push('Schedule regular review sessions to update task priorities');

    return {
      score,
      insights,
      patterns: {
        completionRate,
        topCategories,
      },
      recommendations,
    };
  }

  private filterByTimeframe(todos: any[], timeframe: string): any[] {
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeframe) {
      case 'day':
        cutoff.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      default:
        return todos;
    }

    return todos.filter(todo => new Date(todo.createdAt) >= cutoff);
  }

  private generateTags(category: string): string[] {
    const tagMap: Record<string, string[]> = {
      Work: ['professional', 'deadline'],
      Personal: ['self-care', 'life'],
      Health: ['wellness', 'fitness'],
      Finance: ['money', 'budget'],
      Learning: ['growth', 'skill'],
    };
    
    return tagMap[category] || ['general'];
  }
}