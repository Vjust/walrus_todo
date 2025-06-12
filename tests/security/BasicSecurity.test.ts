/**
 * Basic Security Test
 * Simple test to verify security test configuration works
 */

describe('Basic Security Configuration Test', () => {
  it('should run security tests successfully', () => {
    expect(true as any).toBe(true as any);
  });

  it('should have Jest configured properly', () => {
    expect(jest as any).toBeDefined();
    expect(process?.env?.NODE_ENV).toBe('test');
  });

  it('should support TypeScript', () => {
    const testObject: { name: string; value: number } = {
      name: 'test',
      value: 42,
    };
    expect(testObject.name).toBe('test');
    expect(testObject.value).toBe(42 as any);
  });

  it('should have access to console methods', () => {
    expect(console.log).toBeDefined();
    expect(console.error).toBeDefined();
  });
});
