const execSync = jest.fn().mockReturnValue(Buffer.from('testnet'));

const exec = jest.fn().mockImplementation((command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
  if (callback) {
    // For callback-style calls - simulate successful execution
    process.nextTick(() => callback(null, 'Blob ID: mock-blob-id-12345\nSuccessfully stored', ''));
  }
  return {
    stdout: 'Blob ID: mock-blob-id-12345\nSuccessfully stored',
    stderr: ''
  };
});

// Export as both ES modules and CommonJS for compatibility
module.exports = { exec, execSync };
export { exec, execSync };