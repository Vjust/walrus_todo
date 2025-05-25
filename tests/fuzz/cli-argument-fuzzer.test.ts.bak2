import { Command, Interfaces } from '@oclif/core';
import { describe, it, expect } from '@jest/globals';
import path from 'path';
import { execSync } from 'child_process';

// Helper to safely execute CLI commands
function executeCLI(args: string[]): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  try {
    const stdout = execSync(
      `node ${path.join(__dirname, '../../dist/index.js')} ${args.join(' ')}`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
}

// Generator for random strings
function generateRandomString(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:"<>?,./`~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generator for edge-case strings
function generateEdgeCaseStrings(): string[] {
  return [
    '', // Empty string
    ' ', // Single space
    '   ', // Multiple spaces
    '\t', // Tab
    '\n', // Newline
    '\r\n', // Windows newline
    '\\', // Backslash
    '/', // Forward slash
    '../', // Directory traversal
    '../../', // Deep directory traversal
    'null', // String null
    'undefined', // String undefined
    'true', // Boolean as string
    'false', // Boolean as string
    '0', // Zero as string
    '-1', // Negative number
    '999999999999999999999', // Very large number
    'Infinity', // Infinity as string
    '-Infinity', // Negative infinity
    'NaN', // Not a number
    '1e308', // Scientific notation
    '0x1234', // Hexadecimal
    '0o777', // Octal
    '0b1010', // Binary
    '[]', // Empty array
    '{}', // Empty object
    '<script>alert("xss")</script>', // XSS attempt
    '$(whoami)', // Command injection
    '`date`', // Command injection backticks
    ';ls;', // Command separator
    '&&ls', // Command chaining
    '||ls', // Command chaining
    '|ls', // Pipe command
    '>output.txt', // Redirect output
    '<input.txt', // Redirect input
    '2>&1', // Redirect stderr
    'a'.repeat(256), // Long string
    'a'.repeat(1024), // Very long string
    'a'.repeat(65536), // Extremely long string
    '🔥', // Emoji
    '中文', // Chinese characters
    'العربية', // Arabic characters
    'עברית', // Hebrew characters
    '日本語', // Japanese characters
    '한국어', // Korean characters
    '\u0000', // Null character
    '\u001F', // Control character
    '\u007F', // Delete character
    '\u200B', // Zero-width space
    '\uFEFF', // BOM character
    String.fromCharCode(0), // Null character
    String.fromCharCode(127), // Delete character
    '-', // Single dash
    '--', // Double dash
    '---', // Triple dash
    '--key=value', // Flag with value
    '--key="value with spaces"', // Flag with quoted value
    '--key=', // Flag with empty value
    '-abc', // Combined short flags
    '@file.txt', // File reference
    'http://example.com', // URL
    'https://example.com', // Secure URL
    'file:///etc/passwd', // File URL
    'javascript:alert(1)', // JavaScript URL
    '%00', // Null byte URL encoded
    '%20', // Space URL encoded
    '%0A', // Newline URL encoded
    '%%', // Double percent
    '\\x00', // Null byte escape
    '\\x41', // 'A' as hex escape
    '\\u0041', // 'A' as unicode escape
    '$PATH', // Environment variable
    '${PATH}', // Environment variable with braces
    '$(echo test)', // Command substitution
    '`echo test`', // Command substitution backticks
    '!history', // History expansion
    '!!', // Last command
    '!$', // Last argument
    '~', // Home directory
    '~/file', // Home directory file
    '.', // Current directory
    '..', // Parent directory
    '*', // Wildcard
    '?', // Single character wildcard
    '[a-z]', // Character class
    '{a,b}', // Brace expansion
    '\\\\server\\share', // UNC path
    'C:\\Windows\\System32', // Windows path
    'CON', // Windows device name
    'PRN', // Windows device name
    'AUX', // Windows device name
    'NUL', // Windows device name
    'COM1', // Windows device name
    'LPT1', // Windows device name
  ];
}

// Generator for malformed arguments
function generateMalformedArguments(): string[][] {
  return [
    ['--flag', '--another-flag'], // Multiple flags without command
    ['add', '--invalid-flag'], // Invalid flag
    ['nonexistent-command'], // Non-existent command
    ['add', 'todo', '--priority=invalid'], // Invalid priority value
    ['add', '--deadline=not-a-date'], // Invalid date format
    ['complete', 'not-a-number'], // Invalid ID format
    ['--flag-without-command'], // Flag without command
    ['add', '--tag', '--tag', '--tag'], // Repeated flags
    ['add', 'todo', '--tag', '--deadline'], // Flags without values
    ['add', '--tag=', '--deadline='], // Empty flag values
    ['add', 'todo', '--=value'], // Empty flag name
    ['add', 'todo', '--flag=val=ue'], // Multiple equals in flag
    ['add', 'todo', '-a-b-c'], // Invalid short flag format
    ['add', 'todo', '--123flag'], // Flag starting with number
    ['add', 'todo', '--flag-with-@'], // Special characters in flag
    ['add', 'todo', '--flag with spaces'], // Spaces in flag name
    ['add', '"unclosed quote'], // Unclosed quote
    ['add', "'unclosed quote"], // Unclosed single quote
    ['add', 'todo\\', 'with\\', 'backslashes\\'], // Trailing backslashes
    [
      'add',
      'todo',
      '--flag1',
      '--flag2',
      '--flag3',
      '--flag4',
      '--flag5',
      '--flag6',
      '--flag7',
      '--flag8',
      '--flag9',
      '--flag10',
    ], // Too many flags
    Array(100).fill('--flag'), // Extremely many flags
    Array(1000).fill('arg'), // Extremely many arguments
    ['add'].concat(Array(50).fill('--tag=value')), // Many repeated flags
    ['add', 'todo', '--flag=' + 'x'.repeat(10000)], // Very long flag value
    ['add', 'todo with \x00 null byte'], // Null byte in argument
    ['add', 'todo with \r\n newlines \n\r'], // Various newlines
    ['add', 'todo', '--flag=value\x00with\x00nulls'], // Null bytes in flag value
    ['add', '--recursive', '--recursive', '--recursive'], // Recursive flags
    ['add', '--flag1=--flag2=--flag3=value'], // Nested flag syntax
    ['add', 'todo', '---triple-dash'], // Triple dash
    ['add', 'todo', '----quad-dash'], // Quad dash
    ['add', 'todo', '/absolute/path/injection'], // Absolute path
    ['add', 'todo', 'C:\\windows\\path\\injection'], // Windows absolute path
    ['add', 'todo', '${INJECTION}'], // Environment variable injection
    ['add', 'todo', '$(command injection)'], // Command injection
    ['add', 'todo', '`backtick injection`'], // Backtick injection
    ['add', 'todo', '; injected ; command ;'], // Command separator injection
    ['add', 'todo', '&& injected && command'], // Command chaining
    ['add', 'todo', '|| injected || command'], // Command chaining
    ['add', 'todo', '| piped | command'], // Pipe injection
    ['add', 'todo', '> output.txt'], // Output redirection
    ['add', 'todo', '< input.txt'], // Input redirection
    ['add', 'todo', '2>&1'], // Stderr redirection
  ];
}

describe('CLI Argument Fuzzing Tests', () => {
  // Test with completely random arguments
  it('should handle random argument combinations', () => {
    for (let i = 0; i < 100; i++) {
      const numArgs = Math.floor(Math.random() * 10);
      const args: string[] = [];

      for (let j = 0; j < numArgs; j++) {
        const argLength = Math.floor(Math.random() * 50) + 1;
        args.push(generateRandomString(argLength));
      }

      const result = executeCLI(args);

      // CLI should not crash - it should either handle the input or show an error
      expect([0, 1, 2]).toContain(result.exitCode);
      expect(result.stdout + result.stderr).toBeTruthy();
    }
  });

  // Test with edge-case strings
  it('should handle edge-case string arguments', () => {
    const edgeCases = generateEdgeCaseStrings();
    const commands = ['add', 'list', 'complete', 'delete', 'update'];

    for (const command of commands) {
      for (const edgeCase of edgeCases) {
        const result = executeCLI([command, edgeCase]);

        // Should handle gracefully without crashing
        expect([0, 1, 2]).toContain(result.exitCode);

        // Should not expose system information
        expect(result.stdout).not.toMatch(/\/etc\/passwd/);
        expect(result.stderr).not.toMatch(/\/etc\/passwd/);

        // Should not execute injected commands
        expect(result.stdout).not.toMatch(/root/); // From whoami
        expect(result.stderr).not.toMatch(/root/);
      }
    }
  });

  // Test with malformed argument structures
  it('should handle malformed argument structures', () => {
    const malformedArgs = generateMalformedArguments();

    for (const args of malformedArgs) {
      const result = executeCLI(args);

      // Should handle gracefully
      expect([0, 1, 2]).toContain(result.exitCode);

      // Should provide meaningful error messages
      if (result.exitCode !== 0) {
        expect(result.stdout + result.stderr).toBeTruthy();
      }
    }
  });

  // Test command-specific fuzzing
  describe('Command-specific fuzzing', () => {
    it('should handle fuzzing for add command', () => {
      const fuzzInputs = [
        ['add'], // No todo text
        ['add', ''], // Empty todo text
        ['add', ' '], // Whitespace only
        ['add', 'todo', '--tag'], // Flag without value
        ['add', 'todo', '--tag='], // Empty tag value
        ['add', 'todo', '--deadline=invalid'], // Invalid deadline
        ['add', 'todo', '--priority=5'], // Invalid priority
        ['add', 'todo', '--unknown-flag'], // Unknown flag
        ['add', 'todo', '--tag='.repeat(100)], // Many repeated flags
        ['add', 'x'.repeat(10000)], // Very long todo text
        ['add', 'todo', '--tag=' + 'x'.repeat(10000)], // Very long tag
      ];

      for (const args of fuzzInputs) {
        const result = executeCLI(args);
        expect([0, 1, 2]).toContain(result.exitCode);
      }
    });

    it('should handle fuzzing for complete command', () => {
      const fuzzInputs = [
        ['complete'], // No ID
        ['complete', ''], // Empty ID
        ['complete', ' '], // Whitespace ID
        ['complete', 'not-a-number'], // Non-numeric ID
        ['complete', '-1'], // Negative ID
        ['complete', '0'], // Zero ID
        ['complete', '999999999'], // Very large ID
        ['complete', 'Infinity'], // Infinity
        ['complete', 'NaN'], // Not a number
        ['complete', '1.5'], // Decimal
        ['complete', '0x123'], // Hexadecimal
        ['complete', '1', '2', '3'], // Multiple IDs
        ['complete', '1', '--unknown-flag'], // Unknown flag
      ];

      for (const args of fuzzInputs) {
        const result = executeCLI(args);
        expect([0, 1, 2]).toContain(result.exitCode);
      }
    });

    it('should handle fuzzing for list command', () => {
      const fuzzInputs = [
        ['list', '--tag='], // Empty tag filter
        ['list', '--tag=' + 'x'.repeat(1000)], // Very long tag
        ['list', '--status=invalid'], // Invalid status
        ['list', '--sort=invalid'], // Invalid sort option
        ['list', '--completed', '--pending'], // Conflicting filters
        ['list', '--from=invalid-date'], // Invalid date
        ['list', '--to=invalid-date'], // Invalid date
        ['list', '--limit=not-a-number'], // Non-numeric limit
        ['list', '--limit=-1'], // Negative limit
        ['list', '--limit=0'], // Zero limit
        ['list', '--limit=999999'], // Very large limit
        ['list', '--format=invalid'], // Invalid format
      ];

      for (const args of fuzzInputs) {
        const result = executeCLI(args);
        expect([0, 1, 2]).toContain(result.exitCode);
      }
    });
  });

  // Test Unicode and special character handling
  it('should handle Unicode and special characters', () => {
    const unicodeTests = [
      '𝐇𝐞𝐥𝐥𝐨', // Mathematical bold text
      '🔥💯✨', // Emojis
      '零一二三四五六七八九', // Chinese numbers
      'مرحبا بالعالم', // Arabic
      'Здравствуй, мир', // Russian
      '🏳️‍🌈', // Composite emoji
      '\u200B\u200C\u200D', // Zero-width characters
      'A\u0301', // Combining characters
      '𓂀𓃀𓄀𓅀', // Egyptian hieroglyphs
      '🧑‍💻👨‍👩‍👧‍👦', // Complex emoji sequences
    ];

    for (const text of unicodeTests) {
      const result = executeCLI(['add', text]);
      expect([0, 1, 2]).toContain(result.exitCode);
    }
  });

  // Test argument length limits
  it('should handle extreme argument lengths', () => {
    const lengths = [0, 1, 10, 100, 1000, 10000, 100000];

    for (const length of lengths) {
      const longArg = 'x'.repeat(length);
      const result = executeCLI(['add', longArg]);

      expect([0, 1, 2]).toContain(result.exitCode);

      // Very long arguments should be rejected
      if (length > 10000) {
        expect(result.exitCode).toBe(1);
      }
    }
  });

  // Test argument count limits
  it('should handle extreme argument counts', () => {
    const counts = [0, 1, 10, 100, 1000];

    for (const count of counts) {
      const args = ['add'].concat(Array(count).fill('arg'));
      const result = executeCLI(args);

      expect([0, 1, 2]).toContain(result.exitCode);

      // Too many arguments should be rejected
      if (count > 100) {
        expect(result.exitCode).toBe(1);
      }
    }
  });

  // Test mixed valid and invalid arguments
  it('should handle mixed valid and invalid arguments', () => {
    const mixedTests = [
      ['add', 'valid todo', '--tag=valid', '--invalid-flag'],
      ['add', 'valid todo', '--priority=high', '--priority=invalid'],
      ['list', '--tag=valid', '--tag='],
      ['complete', '1', 'extra', 'arguments'],
      ['add', 'todo', '--tag=valid', '--tag=\x00'],
      ['add', 'todo', '--deadline=2024-01-01', '--deadline=invalid'],
    ];

    for (const args of mixedTests) {
      const result = executeCLI(args);
      expect([0, 1, 2]).toContain(result.exitCode);
    }
  });

  // Test parsing edge cases
  it('should handle argument parsing edge cases', () => {
    const parsingTests = [
      ['add', '--', 'todo'], // Double dash separator
      ['add', 'todo', '--'], // Trailing double dash
      ['add', '-', 'todo'], // Single dash as argument
      ['add', 'todo', '-'], // Trailing single dash
      ['add', 'todo=value'], // Equals in argument
      ['add', 'todo:value'], // Colon in argument
      ['add', '[todo]'], // Brackets in argument
      ['add', '{todo}'], // Braces in argument
      ['add', '<todo>'], // Angle brackets
      ['add', '(todo)'], // Parentheses
      ['add', '"todo"'], // Quoted argument
      ['add', "'todo'"], // Single quoted
      ['add', '`todo`'], // Backtick quoted
      ['add', 'todo\\with\\backslashes'], // Backslashes
      ['add', 'todo/with/slashes'], // Forward slashes
      ['add', 'todo\twith\ttabs'], // Tabs
      ['add', 'todo\nwith\nnewlines'], // Newlines
    ];

    for (const args of parsingTests) {
      const result = executeCLI(args);
      expect([0, 1, 2]).toContain(result.exitCode);
    }
  });

  // Test security-related fuzzing
  it('should resist security-related attacks', () => {
    const securityTests = [
      ['add', '../../../etc/passwd'], // Path traversal
      ['add', '$(cat /etc/passwd)'], // Command injection
      ['add', '`cat /etc/passwd`'], // Backtick injection
      ['add', 'todo; cat /etc/passwd'], // Command separator
      ['add', 'todo && cat /etc/passwd'], // Command chaining
      ['add', 'todo || cat /etc/passwd'], // Command chaining
      ['add', 'todo | cat'], // Pipe command
      ['add', '${PATH}'], // Environment variable
      ['add', '$HOME'], // Environment variable
      ['add', '~/.ssh/id_rsa'], // Home directory expansion
      ['add', '<script>alert(1)</script>'], // XSS attempt
      ['add', 'javascript:alert(1)'], // JavaScript URL
      ['add', 'file:///etc/passwd'], // File URL
      ['add', String.fromCharCode(0)], // Null byte
      ['add', '%00'], // URL encoded null
      ['add', '\\x00'], // Hex encoded null
      ['add', '\\u0000'], // Unicode null
    ];

    for (const args of securityTests) {
      const result = executeCLI(args);

      // Should not expose system files
      expect(result.stdout).not.toMatch(/root:|daemon:/);
      expect(result.stderr).not.toMatch(/root:|daemon:/);

      // Should not execute injected commands
      expect(result.stdout).not.toMatch(/\/bin\/sh/);
      expect(result.stderr).not.toMatch(/\/bin\/sh/);
    }
  });
});
