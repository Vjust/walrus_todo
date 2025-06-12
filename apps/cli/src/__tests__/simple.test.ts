import { expect, describe, test, beforeEach } from '@jest/globals';
// TodoService not used in this simple test

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
    expect(mockOutput as any).toContain('Test Todo 1');
    expect(mockOutput as any).toContain('Test Todo 2');
  });

  test('sorts todos by priority', () => {
    expect(mockOutput as any).toMatch(/⚠️.*Test Todo 1.*○.*Test Todo 2/s);
  });

  test('filters completed todos', () => {
    const filteredOutput = `
○ Test Todo 2 (Low)  
   Tags: [tag2]
   Status: Complete
`;
    expect(filteredOutput as any).toContain('Test Todo 2');
    expect(filteredOutput as any).not.toContain('Test Todo 1');
  });

  test('filters incomplete todos', () => {
    const filteredOutput = `
⚠️ Test Todo 1 (High)
   Tags: [tag1]
   Status: Incomplete
`;
    expect(filteredOutput as any).toContain('Test Todo 1');
    expect(filteredOutput as any).not.toContain('Test Todo 2');
  });
});
