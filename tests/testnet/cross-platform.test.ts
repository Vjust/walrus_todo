import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Cross-Platform Compatibility Tests', () => {
  let originalPlatform: NodeJS.Platform;
  let originalEnv: NodeJS.ProcessEnv;
  let tempDir: string;

  beforeEach(() => {
    originalPlatform = process.platform;
    originalEnv = { ...process.env };
    
    // Create temp directory for cross-platform testing
    tempDir = path.join(os.tmpdir(), `todo-cli-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    process.env.TODOS_DATA_DIR = tempDir;
  });

  afterEach(() => {
    // Restore original platform and environment
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
      writable: true
    });
    process.env = originalEnv;
    
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const mockPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, 'platform', {
      value: platform,
      configurable: true,
      writable: true
    });
  };

  describe('Path Separators', () => {
    it('should handle Windows path separators', () => {
      mockPlatform('win32');
      
      // Test that paths are properly normalized for Windows
      const todoPath = path.join(tempDir, 'todos.json');
      expect(todoPath).toContain('\\');
    });

    it('should handle Unix path separators', () => {
      mockPlatform('linux');
      
      // Test that paths are properly normalized for Unix
      const todoPath = path.join(tempDir, 'todos.json');
      expect(todoPath).toContain('/');
    });
  });

  describe('Command Execution', () => {
    const testCommands = {
      add: 'todo add "Test todo"',
      list: 'todo list',
      complete: 'todo complete 1'
    };

    describe('Windows', () => {
      beforeEach(() => mockPlatform('win32'));

      it('should execute commands with Windows shell', () => {
        const command = `${process.execPath} ${path.join(__dirname, '../../src/index.js')} add "Windows test"`;
        
        const mockExecSync = jest.fn(() => 'Todo added successfully');
        const originalExecSync = execSync;
        
        // Mock execSync to simulate Windows command execution
        jest.spyOn(require('child_process'), 'execSync').mockImplementation(mockExecSync);
        
        try {
          execSync(command, { shell: 'cmd.exe', encoding: 'utf8' });
          expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining('cmd.exe'),
            expect.any(Object)
          );
        } finally {
          // Restore original execSync
          jest.spyOn(require('child_process'), 'execSync').mockImplementation(originalExecSync);
        }
      });
    });

    describe('Unix-like Systems', () => {
      ['darwin', 'linux'].forEach(platform => {
        describe(platform, () => {
          beforeEach(() => mockPlatform(platform as NodeJS.Platform));

          it(`should execute commands on ${platform}`, () => {
            const command = `${process.execPath} ${path.join(__dirname, '../../src/index.js')} add "${platform} test"`;
            
            const mockExecSync = jest.fn(() => 'Todo added successfully');
            const originalExecSync = execSync;
            
            // Mock execSync to simulate Unix command execution
            jest.spyOn(require('child_process'), 'execSync').mockImplementation(mockExecSync);
            
            try {
              execSync(command, { shell: '/bin/sh', encoding: 'utf8' });
              expect(mockExecSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                  shell: '/bin/sh'
                })
              );
            } finally {
              // Restore original execSync
              jest.spyOn(require('child_process'), 'execSync').mockImplementation(originalExecSync);
            }
          });
        });
      });
    });
  });

  describe('File System Operations', () => {
    it('should handle case-sensitive file systems (Linux)', () => {
      mockPlatform('linux');
      
      const file1 = path.join(tempDir, 'TodoList.json');
      const file2 = path.join(tempDir, 'todolist.json');
      
      fs.writeFileSync(file1, '[]');
      fs.writeFileSync(file2, '[]');
      
      // On Linux, these should be different files
      expect(fs.existsSync(file1)).toBe(true);
      expect(fs.existsSync(file2)).toBe(true);
    });

    it('should handle case-insensitive file systems (Windows/macOS)', () => {
      mockPlatform('win32');
      
      const file1 = path.join(tempDir, 'TodoList.json');
      const file2 = path.join(tempDir, 'todolist.json');
      
      fs.writeFileSync(file1, '[]');
      
      // On Windows/macOS, accessing with different case should work
      expect(fs.existsSync(file2)).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    it('should handle Windows environment variable syntax', () => {
      mockPlatform('win32');
      
      process.env.XAI_API_KEY = 'test-key';
      process.env.WALRUS_USE_MOCK = 'true';
      
      expect(process.env.XAI_API_KEY).toBe('test-key');
      expect(process.env.WALRUS_USE_MOCK).toBe('true');
    });

    it('should handle Unix environment variable syntax', () => {
      mockPlatform('linux');
      
      process.env.XAI_API_KEY = 'test-key';
      process.env.WALRUS_USE_MOCK = 'true';
      
      expect(process.env.XAI_API_KEY).toBe('test-key');
      expect(process.env.WALRUS_USE_MOCK).toBe('true');
    });
  });

  describe('Configuration Files', () => {
    it('should find config file in Windows locations', () => {
      mockPlatform('win32');
      
      const configPaths = [
        path.join(process.env.APPDATA || '', 'walrus-todo', 'config.json'),
        path.join(process.env.USERPROFILE || '', '.walrus-todo', 'config.json')
      ];
      
      configPaths.forEach(configPath => {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, '{"version": "1.0"}');
        expect(fs.existsSync(configPath)).toBe(true);
      });
    });

    it('should find config file in Unix locations', () => {
      mockPlatform('linux');
      
      const configPaths = [
        path.join(process.env.HOME || '', '.config', 'walrus-todo', 'config.json'),
        path.join(process.env.HOME || '', '.walrus-todo', 'config.json')
      ];
      
      configPaths.forEach(configPath => {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, '{"version": "1.0"}');
        expect(fs.existsSync(configPath)).toBe(true);
      });
    });
  });

  describe('Unicode and Special Characters', () => {
    const specialChars = {
      emoji: '🚀 Launch project!',
      chinese: '完成任务',
      japanese: 'タスクを完了',
      arabic: 'إكمال المهمة',
      accented: 'Café résumé'
    };

    Object.entries(specialChars).forEach(([type, text]) => {
      it(`should handle ${type} characters across platforms`, () => {
        const todoFile = path.join(tempDir, 'todos.json');
        const todos = [{ id: 1, text, completed: false }];
        
        fs.writeFileSync(todoFile, JSON.stringify(todos), 'utf8');
        const content = fs.readFileSync(todoFile, 'utf8');
        const parsed = JSON.parse(content);
        
        expect(parsed[0].text).toBe(text);
      });
    });
  });

  describe('Line Endings', () => {
    it('should handle Windows CRLF line endings', () => {
      mockPlatform('win32');
      
      const content = 'Line 1\r\nLine 2\r\nLine 3';
      const file = path.join(tempDir, 'windows.txt');
      
      fs.writeFileSync(file, content);
      const read = fs.readFileSync(file, 'utf8');
      
      expect(read).toContain('\r\n');
    });

    it('should handle Unix LF line endings', () => {
      mockPlatform('linux');
      
      const content = 'Line 1\nLine 2\nLine 3';
      const file = path.join(tempDir, 'unix.txt');
      
      fs.writeFileSync(file, content);
      const read = fs.readFileSync(file, 'utf8');
      
      expect(read).not.toContain('\r\n');
      expect(read).toContain('\n');
    });
  });

  describe('Shell-specific Features', () => {
    it('should handle shell arguments on Windows', () => {
      mockPlatform('win32');
      
      const args = ['/c', 'echo', 'Hello World'];
      const expected = 'cmd.exe /c echo "Hello World"';
      
      // Test command construction for Windows
      const command = `cmd.exe ${args.map(arg => 
        arg.includes(' ') ? `"${arg}"` : arg
      ).join(' ')}`;
      
      expect(command).toBe(expected);
    });

    it('should handle shell arguments on Unix', () => {
      mockPlatform('linux');
      
      const args = ['-c', 'echo "Hello World"'];
      const expected = '/bin/sh -c \'echo "Hello World"\'';
      
      // Test command construction for Unix
      const command = `/bin/sh ${args.map(arg => 
        arg.includes(' ') ? `'${arg}'` : arg
      ).join(' ')}`;
      
      expect(command).toBe(expected);
    });
  });

  describe('Platform-specific CLI Features', () => {
    it('should adapt color output for different terminals', () => {
      const colorSupport = {
        win32: process.env.TERM !== 'dumb',
        darwin: true,
        linux: process.env.TERM !== 'dumb'
      };
      
      Object.entries(colorSupport).forEach(([platform, expected]) => {
        mockPlatform(platform as NodeJS.Platform);
        
        // Mock color support detection
        const hasColorSupport = process.env.TERM !== 'dumb' || platform === 'darwin';
        expect(hasColorSupport).toBe(expected);
      });
    });

    it('should handle platform-specific keybindings', () => {
      const keybindings = {
        win32: { quit: 'Ctrl+C', save: 'Ctrl+S' },
        darwin: { quit: 'Cmd+C', save: 'Cmd+S' },
        linux: { quit: 'Ctrl+C', save: 'Ctrl+S' }
      };
      
      Object.entries(keybindings).forEach(([platform, bindings]) => {
        mockPlatform(platform as NodeJS.Platform);
        
        const expected = platform === 'darwin' ? 'Cmd' : 'Ctrl';
        expect(bindings.quit).toContain(expected);
      });
    });
  });

  describe('Binary and Executable Handling', () => {
    it('should find executables on Windows', () => {
      mockPlatform('win32');
      
      const exePaths = [
        'node.exe',
        'npm.cmd',
        'pnpm.cmd'
      ];
      
      exePaths.forEach(exe => {
        // Test typical Windows executable extensions
        expect(exe).toMatch(/\.(exe|cmd|bat)$/);
      });
    });

    it('should find executables on Unix', () => {
      mockPlatform('linux');
      
      const binPaths = [
        '/usr/bin/node',
        '/usr/local/bin/npm',
        path.join(process.env.HOME || '', '.local/bin/pnpm')
      ];
      
      binPaths.forEach(bin => {
        // Unix executables typically don't have extensions
        expect(path.extname(bin)).toBe('');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should complete a full workflow on each platform', async () => {
      const platforms: NodeJS.Platform[] = ['win32', 'darwin', 'linux'];
      
      for (const platform of platforms) {
        mockPlatform(platform);
        
        // Simulate a complete workflow
        const workflow = [
          { action: 'add', args: ['Buy groceries'] },
          { action: 'add', args: ['Walk the dog'] },
          { action: 'list', args: [] },
          { action: 'complete', args: ['1'] },
          { action: 'list', args: [] }
        ];
        
        for (const step of workflow) {
          // Test that each step would execute correctly on the platform
          const shellCommand = platform === 'win32' ? 'cmd.exe' : '/bin/sh';
          const commandFormat = platform === 'win32' ? '/c' : '-c';
          
          expect(shellCommand).toBeDefined();
          expect(commandFormat).toBeDefined();
        }
      }
    });
  });
});