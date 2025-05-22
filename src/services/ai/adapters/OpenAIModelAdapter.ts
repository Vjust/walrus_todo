/**
 * OpenAIModelAdapter - Implementation of AIModelAdapter for the OpenAI service
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { BaseModelAdapter } from './BaseModelAdapter';
import { 
  AICompletionParams, 
  AIResponse, 
  AIProvider,
  AIModelOptions
} from '../../../types/adapters/AIModelAdapter';
import { ResponseParser } from '../ResponseParser';

// OpenAI API client type definitions
interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    text?: string;
    message?: {
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIAPIOptions {
  model: string;
  messages?: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  prompt?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export class OpenAIModelAdapter extends BaseModelAdapter {
  private apiEndpoint: string;
  
  constructor(
    apiKey: string, 
    modelName: string = 'gpt-3.5-turbo',
    options: AIModelOptions = {}
  ) {
    super(AIProvider.OPENAI, apiKey, modelName, options);
    
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    
    // Chat completion models need different API endpoints than older completion models
    if (
      !modelName.startsWith('gpt-') && 
      !modelName.includes('instruct') && 
      !modelName.includes('turbo')
    ) {
      this.apiEndpoint = 'https://api.openai.com/v1/completions';
    }
  }

  /**
   * Generate a completion from the AI model
   */
  public async complete(params: AICompletionParams): Promise<AIResponse> {
    try {
      const options = { ...this.defaultOptions, ...params.options };
      const resolvedPrompt = await this.resolvePrompt(params.prompt);

      const isChatModel = this.apiEndpoint.includes('chat/completions');

      const requestOptions: OpenAIAPIOptions = {
        model: this.modelName,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
      };

      // Set the appropriate prompt format based on API endpoint
      if (isChatModel) {
        requestOptions.messages = [{
          role: 'user',
          content: resolvedPrompt
        }];
      } else {
        requestOptions.prompt = resolvedPrompt;
      }

      // Use the executeRequest method for proper timeout and retry handling
      // Convert requestOptions to string in the fetch options to match BodyInit type
      const data = await this.executeRequest<OpenAICompletionResponse>(
        this.apiEndpoint,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestOptions)
        },
        {
          timeout: options.timeout,
          retries: options.retries,
          operation: 'OpenAI completion',
          parseJson: true
        }
      );

      // Extract content based on response format
      let content: string;
      if (isChatModel) {
        content = data.choices[0]?.message?.content || '';
      } else {
        content = data.choices[0]?.text || '';
      }

      const aiResponse: AIResponse = {
        result: content,
        modelName: data.model || this.modelName,
        provider: this.provider,
        tokenUsage: data.usage ? {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens
        } : undefined,
        timestamp: Date.now(),
        metadata: {
          requestId: data.id,
          finishReason: data.choices[0]?.finish_reason
        }
      };

      return aiResponse;
    } catch (_error) {
      return this.handleError(_error, 'completion');
    }
  }

  /**
   * Generate a structured response from the AI model
   */
  public async completeStructured<T>(params: AICompletionParams): Promise<AIResponse<T>> {
    try {
      const options = { ...this.defaultOptions, ...params.options };
      const resolvedPrompt = await this.resolvePrompt(params.prompt);

      // For structured responses, we modify the prompt to request JSON format
      const jsonPrompt = `${resolvedPrompt}\n\nYou must respond with a valid, parseable JSON object and nothing else.`;

      const isChatModel = this.apiEndpoint.includes('chat/completions');

      const requestOptions: OpenAIAPIOptions = {
        model: this.modelName,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
      };

      // Set the appropriate prompt format based on API endpoint
      if (isChatModel) {
        requestOptions.messages = [
          {
            role: 'system',
            content: 'You are a helpful assistant that always responds with valid JSON.'
          },
          {
            role: 'user',
            content: jsonPrompt
          }
        ];
      } else {
        requestOptions.prompt = jsonPrompt;
      }

      // Use the executeRequest method for proper timeout and retry handling
      // Convert requestOptions to string in the fetch options to match BodyInit type
      const data = await this.executeRequest<OpenAICompletionResponse>(
        this.apiEndpoint,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestOptions)
        },
        {
          timeout: options.timeout,
          retries: options.retries,
          operation: 'OpenAI structured completion',
          parseJson: true
        }
      );

      // Extract content based on response format
      let content: string;
      if (isChatModel) {
        content = data.choices[0]?.message?.content || '';
      } else {
        content = data.choices[0]?.text || '';
      }

      const parsedResult = ResponseParser.parseJson<T>(content, {} as T);

      const aiResponse: AIResponse<T> = {
        result: parsedResult,
        modelName: data.model || this.modelName,
        provider: this.provider,
        tokenUsage: data.usage ? {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens
        } : undefined,
        timestamp: Date.now(),
        metadata: {
          requestId: data.id,
          finishReason: data.choices[0]?.finish_reason
        }
      };

      return aiResponse;
    } catch (_error) {
      return this.handleError(_error, 'structured completion');
    }
  }

  /**
   * Process a prompt through a LangChain chain
   * 
   * Note: This is a simplified implementation. In a real-world scenario,
   * you would use LangChain's OpenAI integration directly.
   */
  public async processWithPromptTemplate(
    promptTemplate: PromptTemplate, 
    input: Record<string, any>
  ): Promise<AIResponse> {
    await this.enforceRateLimit();
    
    try {
      const formattedPrompt = await promptTemplate.format(input);
      
      // Use the complete method internally
      return this.complete({
        prompt: formattedPrompt
      });
    } catch (_error) {
      return this.handleError(_error, 'prompt template processing');
    }
  }
}