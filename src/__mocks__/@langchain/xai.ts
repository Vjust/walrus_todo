/**
 * Mock implementation of the @langchain/xai module
 */

export class ChatXAI {
  constructor(options: any) {
    // Store configs for later validation
    this.options = options;
  }

  private options: any;

  // Add the invoke method to fix the TypeScript error
  async invoke(params: { content: string }): Promise<{ content: string }> {
    // Return a mock response
    return { content: `Mock response to: ${params.content}` };
  }
}