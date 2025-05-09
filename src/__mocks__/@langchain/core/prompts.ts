/**
 * Mock implementation of @langchain/core/prompts module
 */

export class PromptTemplate {
  private template: string;
  private inputVariables: string[];

  constructor(options: { template: string; inputVariables: string[] }) {
    this.template = options.template;
    this.inputVariables = options.inputVariables;
  }

  async format(values: Record<string, string>): Promise<string> {
    let result = this.template;
    
    for (const key of this.inputVariables) {
      const placeholder = `{${key}}`;
      if (values[key]) {
        result = result.replace(new RegExp(placeholder, 'g'), values[key]);
      }
    }
    
    return result;
  }
}