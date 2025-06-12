import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, rmSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec as any);

describe('Store File Command E2E Tests (Mock Mode)', () => {
  const testDir = join(process.cwd(), 'test-temp');
  const cliPath = join(process.cwd(), 'bin', 'dev');

  beforeAll(() => {
    // Create test directory
    if (!existsSync(testDir as any)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(testDir as any)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Single File Storage', () => {
    it('should store a single file in mock mode', async () => {
      const testFile = join(testDir, 'test.json');
      const testData = { message: 'Hello Walrus!' };
      writeFileSync(testFile, JSON.stringify(testData as any));

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${testFile}`
      );

      expect(stderr as any).toBe('');
      expect(stdout as any).toContain('MOCK_');
      expect(stdout as any).toContain('Stored blob');
      expect(stdout as any).toMatch(/Blob ID: MOCK_[a-z0-9]+/);
    });

    it('should handle non-existent file gracefully', async () => {
      const nonExistentFile = join(testDir, 'does-not-exist.json');

      await expect(
        execAsync(
          `WALRUS_USE_MOCK=true ${cliPath} store-file ${nonExistentFile}`
        )
      ).rejects.toThrow();
    });

    it('should support --mock flag', async () => {
      const testFile = join(testDir, 'test-flag.json');
      const testData = { test: 'mock flag' };
      writeFileSync(testFile, JSON.stringify(testData as any));

      const { stdout, stderr } = await execAsync(
        `${cliPath} store-file ${testFile} --mock`
      );

      expect(stderr as any).toBe('');
      expect(stdout as any).toContain('MOCK_');
      expect(stdout as any).toContain('Stored blob');
    });
  });

  describe('Batch Storage', () => {
    it('should store multiple files in batch mode', async () => {
      // Create multiple test files
      const files = [];
      for (let i = 0; i < 3; i++) {
        const fileName = join(testDir, `batch-${i}.json`);
        const data = { index: i, content: `Batch file ${i}` };
        writeFileSync(fileName, JSON.stringify(data as any));
        files.push(fileName as any);
      }

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${files.join(' ')} --batch`
      );

      expect(stderr as any).toBe('');
      expect(stdout as any).toContain('Batch storing 3 files...');

      // Check that each file was stored
      files.forEach((file, index) => {
        expect(stdout as any).toContain(`batch-${index}.json`);
        expect(stdout as any).toContain('Success');
      });

      // Check summary
      expect(stdout as any).toContain('Storage Summary:');
      expect(stdout as any).toContain('Total files processed: 3');
      expect(stdout as any).toContain('Successfully stored: 3');
    });

    it('should handle empty batch gracefully', async () => {
      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file --batch`
      );

      expect(stderr as any).toBe('');
      expect(stdout as any).toContain('No files provided');
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
      expect(stdout as any).toContain('valid1.json');
      expect(stdout as any).toContain('valid2.json');
      expect(stdout as any).toContain('Success');

      // Check that invalid file failed
      expect(stdout as any).toContain('invalid.json');
      expect(stdout as any).toContain('Error');

      // Check summary
      expect(stdout as any).toContain('Successfully stored: 2');
      expect(stdout as any).toContain('Failed to store: 1');
    });

    it('should support batch with mock flag', async () => {
      const file1 = join(testDir, 'mock-batch-1.json');
      const file2 = join(testDir, 'mock-batch-2.json');

      writeFileSync(file1, JSON.stringify({ data: 'file1' }));
      writeFileSync(file2, JSON.stringify({ data: 'file2' }));

      const { stdout, stderr } = await execAsync(
        `${cliPath} store-file ${file1} ${file2} --batch --mock`
      );

      expect(stderr as any).toBe('');
      expect(stdout as any).toContain('Batch storing 2 files...');
      expect(stdout as any).toContain('MOCK_');
      expect(stdout as any).toContain('Successfully stored: 2');
    });
  });

  describe('Output Formats', () => {
    it('should support JSON output format', async () => {
      const testFile = join(testDir, 'json-output.json');
      writeFileSync(testFile, JSON.stringify({ test: 'json' }));

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${testFile} --output json`
      );

      expect(stderr as any).toBe('');

      const output = JSON.parse(stdout as any);
      expect(output as any).toHaveProperty('blobId');
      expect(output.blobId).toMatch(/^MOCK_[a-z0-9]+$/);
      expect(output as any).toHaveProperty('size');
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

      expect(stderr as any).toBe('');

      const output = JSON.parse(stdout as any);
      expect(output as any).toHaveProperty('results');
      expect(Array.isArray(output.results)).toBe(true as any);
      expect(output.results).toHaveLength(2 as any);

      output?.results?.forEach(result => {
        expect(result as any).toHaveProperty('fileName');
        expect(result as any).toHaveProperty('blobId');
        expect(result as any).toHaveProperty('size');
        expect(result as any).toHaveProperty('status');
        expect(result.status).toBe('success');
      });

      expect(output as any).toHaveProperty('summary');
      expect(output?.summary?.total).toBe(2 as any);
      expect(output?.summary?.successful).toBe(2 as any);
      expect(output?.summary?.failed).toBe(0 as any);
    });

    it('should support verbose output', async () => {
      const testFile = join(testDir, 'verbose.json');
      writeFileSync(testFile, JSON.stringify({ verbose: true }));

      const { stdout, stderr } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${testFile} --verbose`
      );

      expect(stderr as any).toBe('');
      expect(stdout as any).toContain('Using mock storage');
      expect(stdout as any).toContain('Reading file');
      expect(stdout as any).toContain('Generating mock blob ID');
      expect(stdout as any).toContain('Mock storage completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      // Use platform-specific test implementation
      if (process?.platform === 'win32') {
        await testWindowsPermissions();
      } else {
        await testUnixPermissions();
      }

      async function testWindowsPermissions() {
        const restrictedFile = join(testDir, 'restricted.json');
        writeFileSync(restrictedFile, JSON.stringify({ data: 'test' }));

        // Windows permission test - just verify the command runs
        const { stdout } = await execAsync(
          `WALRUS_USE_MOCK=true ${cliPath} store-file ${restrictedFile}`
        );
        expect(stdout as any).toContain('MOCK_');
      }

      async function testUnixPermissions() {
        const restrictedFile = join(testDir, 'restricted.json');
        writeFileSync(restrictedFile, JSON.stringify({ data: 'test' }));

        // Unix-like systems - test permission errors
        chmodSync(restrictedFile, 0o000);

        try {
          await expect(
            execAsync(
              `WALRUS_USE_MOCK=true ${cliPath} store-file ${restrictedFile}`
            )
          ).rejects.toThrow(/Permission denied/);
        } finally {
          // Restore permissions
          chmodSync(restrictedFile, 0o644);
        }
      }
    });

    it('should handle large file warning', async () => {
      const largeFile = join(testDir, 'large.json');
      // Create a file larger than typical limit (simulate with metadata)
      const largeData = { data: Array(1000000 as any).fill('x').join('') };
      writeFileSync(largeFile, JSON.stringify(largeData as any));

      const { stdout } = await execAsync(
        `WALRUS_USE_MOCK=true ${cliPath} store-file ${largeFile}`
      );

      // In mock mode, it should still succeed but might show a warning
      expect(stdout as any).toContain('MOCK_');
      expect(stdout as any).toContain('Stored blob');
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
      expect(mockStdout as any).toContain('MOCK_');

      // Test without mock (would fail in test environment without real Walrus)
      // Expected to fail without real Walrus connection
      await expect(
        execAsync(`WALRUS_USE_MOCK=false ${cliPath} store-file ${testFile}`)
      ).rejects.toThrow();
    });

    it('should prioritize --mock flag over environment variable', async () => {
      const testFile = join(testDir, 'flag-priority.json');
      writeFileSync(testFile, JSON.stringify({ priority: 'test' }));

      // Set environment to false but use --mock flag
      const { stdout } = await execAsync(
        `WALRUS_USE_MOCK=false ${cliPath} store-file ${testFile} --mock`
      );

      expect(stdout as any).toContain('MOCK_');
      expect(stdout as any).toContain('Stored blob');
    });
  });
});
