// Simple test to verify execa import works in Jest
const { execa } = require('execa');

describe('Execa Import Test', () => {
  test('should import execa without ESM errors', () => {
    expect(typeof execa).toBe('function');
  });
  
  test('should execute a simple command', async () => {
    const result = await execa('node', ['-v']);
    expect(result.stdout).toMatch(/^v\d+\.\d+\.\d+/);
  });
});