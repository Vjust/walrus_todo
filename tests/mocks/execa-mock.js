// Mock for execa to avoid ESM import issues in Jest tests
const { spawn } = require('child_process');
const { promisify } = require('util');

// Mock ExecaError class
class ExecaError extends Error {
  constructor(message, exitCode = 1, stdout = '', stderr = '') {
    super(message);
    this.name = 'ExecaError';
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
    this.failed = true;
  }
}

// Mock execa function that mimics the real API
function execa(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const {
      timeout = 30000,
      stripFinalNewline = true,
      env = process.env,
      cwd = process.cwd(),
      preferLocal = false,
      ...restOptions
    } = options;

    // For test environment, return predictable results
    if (process.env.NODE_ENV === 'test') {
      // Mock common commands used in tests
      if (command === 'node' && args.includes('-v')) {
        return resolve({
          stdout: 'v18.0.0',
          stderr: '',
          exitCode: 0,
          failed: false,
          command: `${command} ${args.join(' ')}`
        });
      }

      if (command === 'waltodo' || command.includes('waltodo')) {
        return resolve({
          stdout: '{"todos": []}',
          stderr: '',
          exitCode: 0,
          failed: false,
          command: `${command} ${args.join(' ')}`
        });
      }

      // Default success response for other commands
      return resolve({
        stdout: 'mock success',
        stderr: '',
        exitCode: 0,
        failed: false,
        command: `${command} ${args.join(' ')}`
      });
    }

    // In non-test environments, actually execute the command
    const child = spawn(command, args, {
      ...restOptions,
      env,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    const timer = timeout ? setTimeout(() => {
      child.kill('SIGTERM');
      reject(new ExecaError(`Command timed out after ${timeout}ms`, 1, stdout, stderr));
    }, timeout) : null;

    child.on('close', (exitCode) => {
      if (timer) clearTimeout(timer);

      if (stripFinalNewline) {
        stdout = stdout.replace(/\n$/, '');
        stderr = stderr.replace(/\n$/, '');
      }

      const result = {
        stdout,
        stderr,
        exitCode: exitCode || 0,
        failed: exitCode !== 0,
        command: `${command} ${args.join(' ')}`
      };

      if (exitCode === 0) {
        resolve(result);
      } else {
        reject(new ExecaError(`Command failed with exit code ${exitCode}`, exitCode, stdout, stderr));
      }
    });

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(new ExecaError(error.message, 1, stdout, stderr));
    });
  });
}

// Export both named and default exports to match execa API
module.exports = {
  execa,
  ExecaError
};

// For default import compatibility
module.exports.default = execa;