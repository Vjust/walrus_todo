// Mock for @langchain modules
module.exports = {
  ChatPromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({
      format: jest.fn().mockResolvedValue('mocked prompt'),
    }),
  },
  PromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({
      format: jest.fn().mockResolvedValue('mocked prompt'),
    }),
  },
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'mocked response' }),
  })),
  ChatXAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'mocked response' }),
  })),
  OpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'mocked response' }),
  })),
  // Add other mock implementations as needed
  default: jest.fn(),
};
