// Use actual packages for production
import { ChatXAI } from '@langchain/xai';
import { PromptTemplate } from '@langchain/core/prompts';
import { HumanMessage } from '@langchain/core/messages';
import { Todo, TodoList } from '../../types/todo';
import { CLIError } from '../../types/error';
import { AI_CONFIG } from '../../constants';

/**
 * Represents the types of AI operations available for todos
 */
export type TodoAIOperation = 
  | 'summarize' 
  | 'categorize'
  | 'prioritize'
  | 'suggest'
  | 'analyze';

/**
 * AiService - A service for AI-powered todo operations using LangChain.
 * 
 * This service provides AI capabilities for todo management including:
 * - Summarizing todo lists
 * - Categorizing todos by adding tags
 * - Suggesting priority levels
 * - Recommending new tasks based on existing ones
 * - Analyzing completion patterns and productivity insights
 * 
 * It uses LangChain and XAI (Grok) for natural language processing.
 */
export class AiService {
  private chatModel: ChatXAI;
  private apiKey: string | null;

  constructor(xaiApiKey?: string) {
    this.apiKey = xaiApiKey || AI_CONFIG.API_KEY || null;
    
    console.log('API Key from constructor:', xaiApiKey ? '[provided]' : '[not provided]');
    console.log('API Key from AI_CONFIG:', AI_CONFIG.API_KEY ? '[found]' : '[not found]');
    console.log('Environment XAI_API_KEY:', process.env.XAI_API_KEY ? '[found]' : '[not found]');
    
    if (!this.apiKey) {
      console.error('No API key found from any source.');
      throw new CLIError(
        'XAI API key is required. Set XAI_API_KEY environment variable or pass it to the constructor.',
        'MISSING_API_KEY'
      );
    }

    console.log('Creating ChatXAI with API key');
    this.chatModel = new ChatXAI({
      apiKey: this.apiKey,
      model: AI_CONFIG.DEFAULT_MODEL,
      temperature: AI_CONFIG.TEMPERATURE,
    });
  }

  /**
   * Summarizes a todo list, providing insights into overall themes and status
   * 
   * @param todoList The TodoList to summarize
   * @returns A summary of the todo list
   */
  async summarizeTodoList(todoList: TodoList): Promise<string> {
    const template = `
      Summarize the following todo list in a concise way.
      Include:
      - A count of completed vs. incomplete tasks
      - Key themes or categories of tasks
      - Any urgent (high priority) tasks
      
      Todo List: ${JSON.stringify(todoList, null, 2)}
    `;
    
    const message = new HumanMessage({ content: template });
    const response = await this.chatModel.invoke([message]);
    return response.content.toString();
  }

  /**
   * Suggests tags for a todo item based on its content
   * 
   * @param todo The Todo to categorize
   * @returns An array of suggested tags
   */
  async suggestTags(todo: Todo): Promise<string[]> {
    const template = `
      Suggest 2-4 relevant tags for the following todo item.
      Respond ONLY with a JSON array of strings (e.g., ["work", "urgent"]).
      
      Todo item: ${JSON.stringify(todo, null, 2)}
    `;
    
    const message = new HumanMessage({ content: template });
    const response = await this.chatModel.invoke([message]);
    
    try {
      // Clean up the response to extract the JSON part
      let content = response.content.toString();
      
      // If the response is wrapped in markdown code blocks, extract just the content
      if (content.includes('```json')) {
        content = content.replace(/```json\s*([\s\S]*?)\s*```/g, '$1');
      } else if (content.includes('```')) {
        content = content.replace(/```\s*([\s\S]*?)\s*```/g, '$1');
      }
      
      // Try to parse the content
      const tags = JSON.parse(content.trim()) as string[];
      return Array.isArray(tags) ? tags : [];
    } catch (e) {
      console.error('JSON parsing error:', e);
      throw new CLIError(
        `Failed to parse tags from AI response: ${response.content.toString()}`,
        'AI_RESPONSE_PARSING_ERROR'
      );
    }
  }

  /**
   * Suggests a priority level for a todo item based on its content
   * 
   * @param todo The Todo to prioritize
   * @returns A suggested priority level
   */
  async suggestPriority(todo: Todo): Promise<'high' | 'medium' | 'low'> {
    const template = `
      Based on this todo item, suggest a priority level. 
      Respond ONLY with "high", "medium", or "low".
      
      Todo item: ${JSON.stringify(todo, null, 2)}
    `;
    
    const message = new HumanMessage({ content: template });
    const response = await this.chatModel.invoke([message]);
    const priority = response.content.toString().toLowerCase().trim();
    
    if (priority === 'high' || priority === 'medium' || priority === 'low') {
      return priority;
    }
    
    return 'medium'; // Default to medium if response is invalid
  }

  /**
   * Suggests new related tasks based on existing todos
   * 
   * @param todoList The TodoList to analyze for suggestions
   * @param count Number of new tasks to suggest
   * @returns An array of suggested task titles
   */
  async suggestRelatedTasks(todoList: TodoList, count: number = 3): Promise<string[]> {
    const template = `
      Based on this todo list, suggest ${count} new related tasks that would complement the existing ones.
      Respond ONLY with a JSON array of strings, each representing a task title.
      
      Todo list: ${JSON.stringify(todoList, null, 2)}
    `;
    
    const message = new HumanMessage({ content: template });
    const response = await this.chatModel.invoke([message]);
    
    try {
      // Clean up the response to extract the JSON part
      let content = response.content.toString();
      
      // If the response is wrapped in markdown code blocks, extract just the content
      if (content.includes('```json')) {
        content = content.replace(/```json\s*([\s\S]*?)\s*```/g, '$1');
      } else if (content.includes('```')) {
        content = content.replace(/```\s*([\s\S]*?)\s*```/g, '$1');
      }
      
      // Try to parse the content
      const tasks = JSON.parse(content.trim()) as string[];
      return Array.isArray(tasks) ? tasks : [];
    } catch (e) {
      console.error('JSON parsing error:', e);
      throw new CLIError(
        `Failed to parse task suggestions from AI response: ${response.content.toString()}`,
        'AI_RESPONSE_PARSING_ERROR'
      );
    }
  }

  /**
   * Analyzes productivity patterns in the todo list
   * 
   * @param todoList The TodoList to analyze
   * @returns An analysis of completion patterns and productivity insights
   */
  async analyzeProductivity(todoList: TodoList): Promise<string> {
    const template = `
      Analyze the productivity patterns in this todo list. Include:
      - Completion rate (% of completed todos)
      - Average time to completion (if completedAt timestamps are available)
      - Patterns in task types or priorities
      - Suggestions for improving productivity
      
      Todo list: ${JSON.stringify(todoList, null, 2)}
    `;
    
    const message = new HumanMessage({ content: template });
    const response = await this.chatModel.invoke([message]);
    return response.content.toString();
  }
}