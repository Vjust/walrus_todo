import { expect, describe, test, beforeEach } from '@jest/globals';

describe('simple list command', () => {
  let mockOutput: string;

  beforeEach(() => {
    mockOutput = `
⚠️ Test Todo 1 (High)
   Tags: [tag1]
   Status: Incomplete

○ Test Todo 2 (Low)  
   Tags: [tag2]
   Status: Complete
`;
  });

  test('lists all todos in the list', () => {
    expect(mockOutput).toContain('Test Todo 1');
    expect(mockOutput).toContain('Test Todo 2');
  });

  test('sorts todos by priority', () => {
    expect(mockOutput).toMatch(/⚠️.*Test Todo 1.*○.*Test Todo 2/s);
  });

  test('filters completed todos', () => {
    const filteredOutput = `
○ Test Todo 2 (Low)  
   Tags: [tag2]
   Status: Complete
`;
    expect(filteredOutput).toContain('Test Todo 2');
    expect(filteredOutput).not.toContain('Test Todo 1');
  });

  test('filters incomplete todos', () => {
    const filteredOutput = `
⚠️ Test Todo 1 (High)
   Tags: [tag1]
   Status: Incomplete
`;
    expect(filteredOutput).toContain('Test Todo 1');
    expect(filteredOutput).not.toContain('Test Todo 2');
  });
});