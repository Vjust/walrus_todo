/**
 * ResponseTemplateManager - Manages templates for AI response mocking
 */

import { MockResponseTemplate } from './types';
import { DefaultMockResponses } from './templates/DefaultResponses';

export class ResponseTemplateManager {
  private templates: Record<string, MockResponseTemplate>;
  
  constructor(initialTemplates: Record<string, MockResponseTemplate> = DefaultMockResponses) {
    this.templates = { ...initialTemplates };
  }
  
  /**
   * Add or replace response templates
   */
  public addTemplates(templates: Record<string, MockResponseTemplate>): void {
    this.templates = {
      ...this.templates,
      ...templates
    };
  }
  
  /**
   * Remove a template for a specific operation
   */
  public removeTemplate(operation: string): void {
    delete this.templates[operation];
  }
  
  /**
   * Get all registered templates
   */
  public getAllTemplates(): Record<string, MockResponseTemplate> {
    return { ...this.templates };
  }
  
  /**
   * Get a text response for a prompt and operation
   */
  public getTextResponse(prompt: string, operation: string): string {
    const template = this.templates[operation] || this.templates.default;
    
    if (!template) {
      return "No template available for this operation";
    }
    
    // Check if there are pattern-specific responses
    if (template.patterns && Array.isArray(template.patterns)) {
      for (const pattern of template.patterns) {
        const isMatch = typeof pattern.match === 'string'
          ? prompt.includes(pattern.match)
          : pattern.match.test(prompt);
          
        if (isMatch && pattern.text) {
          return typeof pattern.text === 'function'
            ? pattern.text(prompt)
            : pattern.text;
        }
      }
    }
    
    // Return the default text response
    if (template.text) {
      return typeof template.text === 'function'
        ? template.text(prompt)
        : template.text;
    }
    
    // If we have a structured response but no text, stringify it
    if (template.structured) {
      const structured = typeof template.structured === 'function'
        ? template.structured(prompt)
        : template.structured;
      
      return JSON.stringify(structured);
    }
    
    return "Default mock response";
  }
  
  /**
   * Get a structured response for a prompt and operation
   */
  public getStructuredResponse<T>(prompt: string, operation: string): T {
    const template = this.templates[operation] || this.templates.default;
    
    if (!template) {
      return {} as T;
    }
    
    // Check if there are pattern-specific responses
    if (template.patterns && Array.isArray(template.patterns)) {
      for (const pattern of template.patterns) {
        const isMatch = typeof pattern.match === 'string'
          ? prompt.includes(pattern.match)
          : pattern.match.test(prompt);
          
        if (isMatch && pattern.structured) {
          return typeof pattern.structured === 'function'
            ? pattern.structured(prompt)
            : pattern.structured;
        }
      }
    }
    
    // Return the default structured response
    if (template.structured) {
      return typeof template.structured === 'function'
        ? template.structured(prompt)
        : template.structured;
    }
    
    // If we only have text but need structured, try to parse it as JSON
    if (template.text) {
      const text = typeof template.text === 'function'
        ? template.text(prompt)
        : template.text;
      
      try {
        return JSON.parse(text);
      } catch (e) {
        // If parsing fails, return an empty object
        return {} as T;
      }
    }
    
    return {} as T;
  }
}