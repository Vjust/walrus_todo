/**
 * Mock for @langchain modules to resolve ES module import issues in tests
 */

// Mock BasePromptTemplate and related classes
class MockBasePromptTemplate {
  constructor(input) {
    this.inputVariables = input?.inputVariables || [];
  }
  
  async format(values) {
    return 'mock formatted prompt';
  }
  
  async formatPromptValue(values) {
    return {
      toString: () => 'mock prompt value',
      toChatMessages: () => []
    };
  }
}

class MockPromptTemplate extends MockBasePromptTemplate {
  constructor(input) {
    super(input);
    this.template = input?.template || 'mock template';
  }
  
  static fromTemplate(template) {
    return new MockPromptTemplate({ template });
  }
}

class MockChatPromptTemplate extends MockBasePromptTemplate {
  constructor(input) {
    super(input);
    this.messages = input?.messages || [];
  }
  
  static fromMessages(messages) {
    return new MockChatPromptTemplate({ messages });
  }
}

// Mock message classes
class MockHumanMessage {
  constructor(content) {
    this.content = content;
    this.type = 'human';
  }
}

class MockSystemMessage {
  constructor(content) {
    this.content = content;
    this.type = 'system';
  }
}

class MockAIMessage {
  constructor(content) {
    this.content = content;
    this.type = 'ai';
  }
}

// Mock runnable interface
class MockRunnable {
  async invoke(input) {
    return 'mock runnable result';
  }
  
  async stream(input) {
    async function* mockStream() {
      yield 'mock';
      yield ' stream';
      yield ' result';
    }
    return mockStream();
  }
  
  pipe(other) {
    return new MockRunnable();
  }
}

// Export mocks for different langchain modules
module.exports = {
  // Core prompts
  BasePromptTemplate: MockBasePromptTemplate,
  PromptTemplate: MockPromptTemplate,
  ChatPromptTemplate: MockChatPromptTemplate,
  
  // Messages
  HumanMessage: MockHumanMessage,
  SystemMessage: MockSystemMessage,
  AIMessage: MockAIMessage,
  
  // Runnable
  Runnable: MockRunnable,
  
  // Output parsers
  StringOutputParser: class MockStringOutputParser extends MockRunnable {
    async parse(text) {
      return text;
    }
  },
  
  // Schema
  z: {
    object: () => ({ parse: (obj) => obj }),
    string: () => ({ parse: (str) => str }),
    number: () => ({ parse: (num) => num }),
    boolean: () => ({ parse: (bool) => bool }),
    array: () => ({ parse: (arr) => arr }),
  },
  
  // Callbacks
  CallbackManagerForLLMRun: class MockCallbackManager {
    async handleLLMNewToken() {}
    async handleLLMEnd() {}
    async handleLLMError() {}
  },
  
  // Default export (for default imports)
  default: MockPromptTemplate,
};

// Also support named exports for ES6 style imports
Object.assign(module.exports, {
  BasePromptTemplate: MockBasePromptTemplate,
  PromptTemplate: MockPromptTemplate,
  ChatPromptTemplate: MockChatPromptTemplate,
  HumanMessage: MockHumanMessage,
  SystemMessage: MockSystemMessage,
  AIMessage: MockAIMessage,
});