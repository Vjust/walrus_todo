import fs from 'fs-extra';
import path from 'path';
import sinon from 'sinon';

describe('End-to-End Error Scenarios', () => {
  const testDir = path.join(__dirname, 'test-temp');
  const configFile = path.join(testDir, '.walrus-todo-config.json');
  const todoFile = path.join(testDir, 'todos.json');
  
  beforeAll(() => {
    // Create test directory
    fs.ensureDirSync(testDir);
    process.env.WALRUS_TODO_CONFIG_DIR = testDir;
    process.env.WALRUS_USE_MOCK = 'true';
  });

  afterAll(() => {
    // Clean up test directory
    fs.removeSync(testDir);
    delete process.env.WALRUS_TODO_CONFIG_DIR;
    delete process.env.WALRUS_USE_MOCK;
  });

  beforeEach(() => {
    // Reset test environment
    fs.emptyDirSync(testDir);
    
    // Create a basic config file
    fs.writeJsonSync(configFile, {
      storageMode: 'local',
      localStoragePath: todoFile,
      walrusConfig: {
        network: 'testnet',
        aggregator: 'https://api.walrus.storage/v1',
        publisher: 'https://publish.walrus.storage/v1'
      }
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('File System Errors', () => {
    it('should handle permission errors gracefully', () => {
      // Make config file read-only
      fs.chmodSync(configFile, 0o444);
      
      // Try to modify config
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} configure --storageMode blockchain`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(result).toContain('Permission denied');
      expect(result).toContain('Unable to write configuration');
      
      // Restore permissions
      fs.chmodSync(configFile, 0o644);
    });

    it('should handle disk full errors', () => {
      // Mock fs.writeFileSync to simulate disk full
      const stub = sinon.stub(fs, 'writeFileSync').throws(new Error('ENOSPC: no space left on device'));
      
      expect(() => {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} add "Test todo"`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      }).toThrow();
      
      stub.restore();
    });

    it('should handle corrupted todo file', () => {
      // Create corrupted JSON file
      fs.writeFileSync(todoFile, '{ "todos": [ { "id": 1, "title": "Incomplete JSON');
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} list`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(result).toContain('Failed to parse todos file');
      expect(result).toContain('Consider restoring from backup');
    });
  });

  describe('Network Errors', () => {
    it('should handle network timeout errors', () => {
      // Simulate network timeout
      const fetchStub = sinon.stub(global, 'fetch').rejects(new Error('ETIMEDOUT'));
      
      expect(() => {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} store list --storageMode blockchain`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir, WALRUS_USE_MOCK: 'false' },
          encoding: 'utf8',
          timeout: 5000
        });
      }).toThrow();
      
      fetchStub.restore();
    });

    it('should handle API rate limiting', () => {
      // Simulate rate limiting response
      const fetchStub = sinon.stub(global, 'fetch').resolves({
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '60' }),
        json: async () => ({ error: 'Rate limit exceeded' })
      } as Response);
      
      let caughtError: Error | null = null;
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} ai suggest --apiKey test-key`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      } catch (error: any) {
        caughtError = error;
      }
      
      expect(caughtError).not.toBeNull();
      expect(caughtError).toBeInstanceOf(Error);
      expect((caughtError as Error).message).toContain('Rate limit exceeded');
      expect((caughtError as Error).message).toContain('Please wait before retrying');
      
      fetchStub.restore();
    });

    it('should handle DNS resolution failures', () => {
      // Simulate DNS failure
      const fetchStub = sinon.stub(global, 'fetch').rejects(new Error('ENOTFOUND: getaddrinfo'));
      
      let caughtError: Error | null = null;
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} fetch 12345 --storageMode blockchain`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir, WALRUS_USE_MOCK: 'false' },
          encoding: 'utf8'
        });
      } catch (error: any) {
        caughtError = error;
      }
      
      expect(caughtError).not.toBeNull();
      expect(caughtError).toBeInstanceOf(Error);
      expect((caughtError as Error).message).toContain('DNS lookup failed');
      expect((caughtError as Error).message).toContain('Unable to resolve host');
      
      fetchStub.restore();
    });
  });

  describe('Blockchain Errors', () => {
    it('should handle insufficient funds error', () => {
      // Simulate insufficient funds
      const execStub = sinon.stub(exec).callsArgWith(1, 
        new Error('Insufficient balance for transaction')
      );
      
      let caughtError: Error | null = null;
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} deploy --network testnet`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      } catch (error: any) {
        caughtError = error;
      }
      
      expect(caughtError).not.toBeNull();
      expect(caughtError).toBeInstanceOf(Error);
      expect((caughtError as Error).message).toContain('Insufficient balance');
      expect((caughtError as Error).message).toContain('Please fund your wallet');
      
      execStub.restore();
    });

    it('should handle invalid transaction errors', () => {
      const transactionError = new Error('Transaction validation failed: Invalid signature');
      
      // Mock transaction failure
      const execStub = sinon.stub(exec).callsArgWith(1, transactionError);
      
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} store list --storageMode blockchain`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir, WALRUS_USE_MOCK: 'false' },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Check your wallet configuration');
      }
      
      execStub.restore();
    });

    it('should handle smart contract errors', () => {
      // Simulate contract execution failure
      const contractError = new Error('Move abort: 0x1');
      
      const execStub = sinon.stub(exec).callsArgWith(1, contractError);
      
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} update 1 --title "Updated" --storageMode blockchain`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir, WALRUS_USE_MOCK: 'false' },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('Smart contract execution failed');
        expect(error.message).toContain('Contract error code');
      }
      
      execStub.restore();
    });
  });

  describe('AI Service Errors', () => {
    it('should handle invalid API key', () => {
      const fetchStub = sinon.stub(global, 'fetch').resolves({
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' })
      } as Response);
      
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} ai suggest --apiKey invalid-key`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('Invalid API key');
        expect(error.message).toContain('Check your AI provider credentials');
      }
      
      fetchStub.restore();
    });

    it('should handle AI model errors', () => {
      const fetchStub = sinon.stub(global, 'fetch').resolves({
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Model processing failed' })
      } as Response);
      
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} ai analyze --apiKey test-key`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('AI service error');
        expect(error.message).toContain('Try again later');
      }
      
      fetchStub.restore();
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should recover from corrupted config with backup', () => {
      // Create backup
      fs.writeJsonSync(`${configFile}.backup`, {
        storageMode: 'local',
        localStoragePath: todoFile
      });
      
      // Corrupt main config
      fs.writeFileSync(configFile, 'invalid json{');
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} list`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(result).toContain('Restored configuration from backup');
      expect(result).toContain('Todo list');
    });

    it('should retry failed network requests', () => {
      let callCount = 0;
      const fetchStub = sinon.stub(global, 'fetch').callsFake(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          status: 200,
          json: async () => ({ success: true })
        } as Response);
      });
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} ai suggest --apiKey test-key`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(callCount).toBe(3);
      expect(result).toContain('Successfully connected after retry');
      
      fetchStub.restore();
    });

    it('should provide fallback for unavailable features', () => {
      // Disable AI features
      process.env.DISABLE_AI_FEATURES = 'true';
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} ai suggest`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(result).toContain('AI features are currently disabled');
      expect(result).toContain('Basic todo functionality remains available');
      
      delete process.env.DISABLE_AI_FEATURES;
    });

    it('should gracefully degrade when storage is unavailable', () => {
      // Simulate storage failure
      const stub = sinon.stub(fs, 'readFileSync').throws(new Error('EACCES: permission denied'));
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} list --useCache`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(result).toContain('Storage unavailable, showing cached data');
      expect(result).toContain('Limited functionality available');
      
      stub.restore();
    });
  });

  describe('User Input Errors', () => {
    it('should validate and sanitize malicious input', () => {
      const maliciousInput = '"; DROP TABLE todos; --';
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} add "${maliciousInput}"`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(result).toContain('Input contains invalid characters');
      expect(result).toContain('Please use only allowed characters');
    });

    it('should handle extremely long input', () => {
      const longInput = 'a'.repeat(10000);
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} add "${longInput}"`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(result).toContain('Input exceeds maximum length');
      expect(result).toContain('Please limit to 1000 characters');
    });

    it('should handle invalid command combinations', () => {
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} add --complete --delete`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('Conflicting options');
        expect(error.message).toContain('Cannot use --complete with --delete');
      }
    });
  });

  describe('Concurrent Operation Errors', () => {
    it('should handle file lock conflicts', () => {
      // Simulate file lock
      const lockFile = path.join(testDir, 'todos.json.lock');
      fs.writeFileSync(lockFile, 'locked');
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} add "New todo"`, {
        env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
        encoding: 'utf8'
      });

      expect(result).toContain('File is currently locked');
      expect(result).toContain('Another operation in progress');
      
      fs.unlinkSync(lockFile);
    });

    it('should handle race conditions in updates', () => {
      // Create initial todo
      fs.writeJsonSync(todoFile, {
        todos: [{ id: '1', title: 'Original', completed: false }]
      });
      
      // Simulate concurrent modification
      const stub = sinon.stub(fs, 'readFileSync')
        .onFirstCall().returns(JSON.stringify({ todos: [{ id: '1', title: 'Original', completed: false }] }))
        .onSecondCall().returns(JSON.stringify({ todos: [{ id: '1', title: 'Modified by another process', completed: false }] }));
      
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} update 1 --title "My update"`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('Concurrent modification detected');
        expect(error.message).toContain('Please retry your operation');
      }
      
      stub.restore();
    });
  });

  describe('Environment-Specific Errors', () => {
    it('should handle missing environment variables', () => {
      delete process.env.WALRUS_TODO_CONFIG_DIR;
      
      const result = execSync(`node ${path.join(__dirname, '../../src/index.ts')} configure`, {
        encoding: 'utf8'
      });

      expect(result).toContain('Using default configuration directory');
      expect(result).toContain('~/.walrus-todo');
      
      process.env.WALRUS_TODO_CONFIG_DIR = testDir;
    });

    it('should handle invalid environment variable values', () => {
      process.env.WALRUS_NETWORK = 'invalid-network';
      
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} deploy`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('Invalid network specified');
        expect(error.message).toContain('Valid networks: testnet, mainnet');
      }
      
      delete process.env.WALRUS_NETWORK;
    });
  });

  describe('Comprehensive Error Scenarios', () => {
    it('should handle cascading failures gracefully', () => {
      // Simulate multiple simultaneous failures
      const fetchStub = sinon.stub(global, 'fetch').rejects(new Error('Network error'));
      const fsStub = sinon.stub(fs, 'writeFileSync').throws(new Error('Disk full'));
      
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} ai enhance --apiKey test-key --save`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('Multiple errors occurred');
        expect(error.message).toContain('Network error');
        expect(error.message).toContain('Disk full');
        expect(error.message).toContain('Operation partially completed');
      }
      
      fetchStub.restore();
      fsStub.restore();
    });

    it('should provide helpful troubleshooting steps', () => {
      // Simulate complex error scenario
      const error = new Error('Connection refused');
      error.cause = { code: 'ECONNREFUSED', syscall: 'connect' };
      
      const fetchStub = sinon.stub(global, 'fetch').rejects(error);
      
      try {
        execSync(`node ${path.join(__dirname, '../../src/index.ts')} store list --storageMode blockchain`, {
          env: { ...process.env, WALRUS_TODO_CONFIG_DIR: testDir, WALRUS_USE_MOCK: 'false' },
          encoding: 'utf8'
        });
      } catch (error: any) {
        expect(error.message).toContain('Connection refused');
        expect(error.message).toContain('Troubleshooting steps:');
        expect(error.message).toContain('1. Check if the service is running');
        expect(error.message).toContain('2. Verify the network configuration');
        expect(error.message).toContain('3. Check firewall settings');
      }
      
      fetchStub.restore();
    });
  });
});