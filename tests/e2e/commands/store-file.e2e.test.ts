import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

describe('Store File Command E2E Tests (Mock Mode)', () => {
  const testDir = join(process.cwd(), 'test-temp');
  const cliPath = join(process.cwd(), 'bin', 'dev');
  
  beforeAll(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Single File Storage', () => {
    it('should store a single file in mock mode', async () => {
      const testFile = join(testDir, 'test.json');
      const testData = { message: 'Hello Walrus!' };
      writeFileSync(testFile, JSON.stringify(testData));

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${testFile}`
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('MOCK_');
      expect(stdout).toContain('Stored blob');
      expect(stdout).toMatch(/Blob ID: MOCK_[a-z0-9]+/);
    });

    it('should handle non-existent file gracefully', async () => {
      const nonExistentFile = join(testDir, 'does-not-exist.json');

      await expect(execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${nonExistentFile}`
      )).rejects.toThrow();
    });

    it('should support --mock flag', async () => {
      const testFile = join(testDir, 'test-flag.json');
      const testData = { test: 'mock flag' };
      writeFileSync(testFile, JSON.stringify(testData));

      const { stdout, stderr } = await execAsync(
        `${cliPath} store-file ${testFile} --mock`
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('MOCK_');
      expect(stdout).toContain('Stored blob');
    });
  });

  describe('Batch Storage', () => {
    it('should store multiple files in batch mode', async () => {
      // Create multiple test files
      const files = [];
      for (let i = 0; i < 3; i++) {
        const fileName = join(testDir, `batch-${i}.json`);
        const data = { index: i, content: `Batch file ${i}` };
        writeFileSync(fileName, JSON.stringify(data));
        files.push(fileName);
      }

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${files.join(' ')} --batch`
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('Batch storing 3 files...');
      
      // Check that each file was stored
      files.forEach((file, index) => {
        expect(stdout).toContain(`batch-${index}.json`);
        expect(stdout).toContain('Success');
      });

      // Check summary
      expect(stdout).toContain('Storage Summary:');
      expect(stdout).toContain('Total files processed: 3');
      expect(stdout).toContain('Successfully stored: 3');
    });

    it('should handle empty batch gracefully', async () => {
      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file --batch`
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('No files provided');
    });

    it('should continue batch processing on individual failures', async () => {
      // Create a mix of valid and invalid files
      const validFile1 = join(testDir, 'valid1.json');
      const invalidFile = join(testDir, 'invalid.json');
      const validFile2 = join(testDir, 'valid2.json');

      writeFileSync(validFile1, JSON.stringify({ valid: 1 }));
      writeFileSync(validFile2, JSON.stringify({ valid: 2 }));
      // Don't create invalidFile to simulate missing file

      const files = [validFile1, invalidFile, validFile2];
      
      const { stdout } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${files.join(' ')} --batch`
      );

      // Check that valid files were stored
      expect(stdout).toContain('valid1.json');
      expect(stdout).toContain('valid2.json');
      expect(stdout).toContain('Success');

      // Check that invalid file failed
      expect(stdout).toContain('invalid.json');
      expect(stdout).toContain('Error');

      // Check summary
      expect(stdout).toContain('Successfully stored: 2');
      expect(stdout).toContain('Failed to store: 1');
    });

    it('should support batch with mock flag', async () => {
      const file1 = join(testDir, 'mock-batch-1.json');
      const file2 = join(testDir, 'mock-batch-2.json');

      writeFileSync(file1, JSON.stringify({ data: 'file1' }));
      writeFileSync(file2, JSON.stringify({ data: 'file2' }));

      const { stdout, stderr } = await execAsync(
        `${cliPath} store-file ${file1} ${file2} --batch --mock`
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('Batch storing 2 files...');
      expect(stdout).toContain('MOCK_');
      expect(stdout).toContain('Successfully stored: 2');
    });
  });

  describe('Output Formats', () => {
    it('should support JSON output format', async () => {
      const testFile = join(testDir, 'json-output.json');
      writeFileSync(testFile, JSON.stringify({ test: 'json' }));

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${testFile} --output json`
      );

      expect(stderr).toBe('');
      
      const output = JSON.parse(stdout);
      expect(output).toHaveProperty('blobId');
      expect(output.blobId).toMatch(/^MOCK_[a-z0-9]+$/);
      expect(output).toHaveProperty('size');
      expect(typeof output.size).toBe('number');
    });

    it('should support JSON output for batch operations', async () => {
      const file1 = join(testDir, 'json-batch-1.json');
      const file2 = join(testDir, 'json-batch-2.json');

      writeFileSync(file1, JSON.stringify({ test: 1 }));
      writeFileSync(file2, JSON.stringify({ test: 2 }));

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${file1} ${file2} --batch --output json`
      );

      expect(stderr).toBe('');
      
      const output = JSON.parse(stdout);
      expect(output).toHaveProperty('results');
      expect(Array.isArray(output.results)).toBe(true);
      expect(output.results).toHaveLength(2);
      
      output.results.forEach(result => {
        expect(result).toHaveProperty('fileName');
        expect(result).toHaveProperty('blobId');
        expect(result).toHaveProperty('size');
        expect(result).toHaveProperty('status');
        expect(result.status).toBe('success');
      });

      expect(output).toHaveProperty('summary');
      expect(output.summary.total).toBe(2);
      expect(output.summary.successful).toBe(2);
      expect(output.summary.failed).toBe(0);
    });

    it('should support verbose output', async () => {
      const testFile = join(testDir, 'verbose.json');
      writeFileSync(testFile, JSON.stringify({ verbose: true }));

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${testFile} --verbose`
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('Using mock storage');
      expect(stdout).toContain('Reading file');
      expect(stdout).toContain('Generating mock blob ID');
      expect(stdout).toContain('Mock storage completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      const restrictedFile = join(testDir, 'restricted.json');
      writeFileSync(restrictedFile, JSON.stringify({ data: 'test' }));
      
      // Remove read permissions (Unix-like systems only)
      if (process.platform !== 'win32') {
        const fs = require('fs');
        fs.chmodSync(restrictedFile, 0o000);

        try {
          await execAsync(
            `WALRUS_USE_MOCK=true ${cliPath} store-file ${restrictedFile}`
          );
        } catch (error: any) {
          expect(error.message).toContain('Permission denied');
        } finally {
          // Restore permissions
          fs.chmodSync(restrictedFile, 0o644);
        }
      }
    });

    it('should handle large file warning', async () => {
      const largeFile = join(testDir, 'large.json');
      // Create a file larger than typical limit (simulate with metadata)
      const largeData = { data: Array(1000000).fill('x').join('') };
      writeFileSync(largeFile, JSON.stringify(largeData));

      const { stdout } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${largeFile}`
      );

      // In mock mode, it should still succeed but might show a warning
      expect(stdout).toContain('MOCK_');
      expect(stdout).toContain('Stored blob');
    });
  });

  describe('Environment and Configuration', () => {
    it('should respect WALRUS_USE_MOCK environment variable', async () => {
      const testFile = join(testDir, 'env-test.json');
      writeFileSync(testFile, JSON.stringify({ env: 'test' }));

      // Test with mock enabled via environment
      const { stdout: mockStdout } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${testFile}`
      );
      expect(mockStdout).toContain('MOCK_');

      // Test without mock (would fail in test environment without real Walrus)
      try {
        await execAsync(`WALRUS_USE_MOCK=false ${cliPath} store-file ${testFile}`);
      } catch (error: any) {
        // Expected to fail without real Walrus connection
        expect(error.message).toBeTruthy();
      }
    });

    it('should prioritize --mock flag over environment variable', async () => {
      const testFile = join(testDir, 'flag-priority.json');
      writeFileSync(testFile, JSON.stringify({ priority: 'test' }));

      // Set environment to false but use --mock flag
      const { stdout } = await execAsync(
        `WALRUS_USE_MOCK=false ${cliPath} store-file ${testFile} --mock`
      );

      expect(stdout).toContain('MOCK_');
      expect(stdout).toContain('Stored blob');
    });
  });
});