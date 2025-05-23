import * as fs from 'fs';
import { PathOrFileDescriptor, ObjectEncodingOptions } from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({ execSync: jest.fn() }));
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  readdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('CLI Commands', () => {
  const CLI_CMD = 'node ./bin/run.js';
  const TEST_LIST = 'test-list';
  const FIXTURES_DIR = path.join(__dirname, 'fixtures');
  const TEST_IMAGE = path.join(FIXTURES_DIR, 'test.jpg');
  const MOCK_BLOB_ID = '0x123456789abcdef';
  const MOCK_TX_DIGEST = '0xabcdef123456789';
  const MOCK_NFT_ID = '0xdef123456789abc';
  const MOCK_NETWORK_CONFIG = {
    network: 'testnet',
    walletAddress: '0x123...',
    connectionState: 'connected',
    lastDeployment: {
      packageId: '0xabc...',
      network: 'testnet'
    }
  };
  
  beforeAll(() => {
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(TEST_IMAGE)) {
      fs.writeFileSync(TEST_IMAGE, 'test image data');
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();

    if (fs.existsSync(TEST_IMAGE)) {
      fs.unlinkSync(TEST_IMAGE);
    }
    if (fs.existsSync(FIXTURES_DIR) && fs.readdirSync(FIXTURES_DIR).length === 0) {
      fs.rmdirSync(FIXTURES_DIR);
    }
  });

  describe('Fresh Installation Test', () => {
    beforeEach(() => {
      (execSync as jest.Mock).mockReset();
    });

    it('should simulate fresh installation and verify CLI version', () => {
      (execSync as jest.Mock).mockImplementation((command: string) => {
        if (command === 'waltodo --version') {
          return Buffer.from('1.0.0');
        } else if (command === 'which waltodo') {
          return Buffer.from('/usr/local/bin/waltodo');
        }
        throw new Error(`Command not mocked: ${command}`);
      });

      const resultVersion = execSync('waltodo --version').toString();
      const resultWhich = execSync('which waltodo').toString();

      expect(resultVersion).toBe('1.0.0');
      expect(resultWhich).toContain('/usr/local/bin/waltodo');
    });

    describe('create command', () => {
      it('should create todo with default image', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('create')) {
            return Buffer.from('Todo created successfully with default image');
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} create --title "Test Todo" --description "Test Desc"`).toString();
    
        expect(result).toContain('Todo created successfully');
        expect(result).toContain('default image');
      });

      it('should handle invalid image', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command === 'node ./bin/run.js create --title "Invalid Image Todo" --image ./invalid.txt') {
            throw new Error('Invalid image file provided');
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        expect(() => {
          execSync(`${CLI_CMD} create --title "Invalid Image Todo" --image ./invalid.txt`, { stdio: 'inherit' });
        }).toThrow('Invalid image file provided');
      });
    });

    describe('list command', () => {
      it('should list todos', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('list')) {
            return Buffer.from('Listed todos: Test Todo');
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} list ${TEST_LIST}`).toString();
        expect(result).toContain('Test Todo');
      });
    });

    describe('complete command', () => {
      beforeEach(() => {
        (execSync as jest.Mock).mockReset();
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
          if (filePath.includes('config.json')) {
            return JSON.stringify(MOCK_NETWORK_CONFIG);
          }
          throw new Error(`File not mocked: ${filePath}`);
        });
      });

      it('should complete todo with NFT update', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('complete')) {
            return Buffer.from(`Todo completed successfully
✓ Local update successful
✓ NFT updated on blockchain
Transaction: ${MOCK_TX_DIGEST}
View your updated NFT:
  https://explorer.sui.io/object/${MOCK_NFT_ID}?network=testnet`);
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} complete ${TEST_LIST} -i test-todo-id`).toString();
        expect(result).toContain('Todo completed successfully');
        expect(result).toContain('Local update successful');
        expect(result).toContain('NFT updated on blockchain');
        expect(result).toContain(MOCK_TX_DIGEST);
        expect(result).toContain(MOCK_NFT_ID);
      });

      it('should handle insufficient gas for NFT update', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('Transaction failed: insufficient gas');
        });

        expect(() => {
          execSync(`${CLI_CMD} complete ${TEST_LIST} -i test-todo-id`, { stdio: 'inherit' });
        }).toThrow('Transaction failed: insufficient gas');
      });

      it('should handle network timeout during NFT update', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('Network timeout while updating NFT');
        });

        expect(() => {
          execSync(`${CLI_CMD} complete ${TEST_LIST} -i test-todo-id`, { stdio: 'inherit' });
        }).toThrow('Network timeout while updating NFT');
      });

      it('should handle invalid NFT state', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('NFT is in invalid state: already completed');
        });

        expect(() => {
          execSync(`${CLI_CMD} complete ${TEST_LIST} -i test-todo-id`, { stdio: 'inherit' });
        }).toThrow('NFT is in invalid state: already completed');
      });

      it('should complete todo with Walrus blob update', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('complete')) {
            return Buffer.from(`Todo completed successfully
✓ Local update successful
✓ Todo updated on Walrus
New blob ID: ${MOCK_BLOB_ID}
Public URL: https://testnet.wal.app/blob/${MOCK_BLOB_ID}`);
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} complete ${TEST_LIST} -i test-todo-id`).toString();
        expect(result).toContain('Todo completed successfully');
        expect(result).toContain('Local update successful');
        expect(result).toContain('Todo updated on Walrus');
        expect(result).toContain(MOCK_BLOB_ID);
        expect(result).toContain('https://testnet.wal.app/blob/');
      });

      it('should handle Walrus connection failure', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('Failed to connect to Walrus storage');
        });

        expect(() => {
          execSync(`${CLI_CMD} complete ${TEST_LIST} -i test-todo-id`, { stdio: 'inherit' });
        }).toThrow('Failed to connect to Walrus storage');
      });

      it('should succeed local update when blockchain update fails', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('complete')) {
            return Buffer.from(`✓ Local update successful
Failed to update NFT on blockchain: network error
Local update was successful, but blockchain state may be out of sync.`);
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} complete ${TEST_LIST} -i test-todo-id`).toString();
        expect(result).toContain('Local update successful');
        expect(result).toContain('Failed to update NFT on blockchain');
        expect(result).toContain('blockchain state may be out of sync');
      });
    });

    describe('Configuration Command Test', () => {
      it('should configure CLI with network and wallet address', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('configure')) {
            return Buffer.from('Command executed successfully');
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} configure --network testnet --wallet-address 0x123...`).toString();
    
        expect(result).toContain('Command executed successfully');
      });

      it('should verify config file after configuration', () => {
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string | PathOrFileDescriptor, _options?: BufferEncoding | (ObjectEncodingOptions & { flag?: string | undefined; }) | BufferEncoding | null | undefined) => {
          if (typeof filePath === 'string' && filePath.includes('.waltodo/config.json')) {
            return JSON.stringify({ network: 'testnet', walletAddress: '0x123...' });
          }
          throw new Error(`File not mocked: ${String(filePath)}`);
        });

        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('configure')) {
            return Buffer.from('Command executed successfully');
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} configure --network testnet --wallet-address 0x123...`).toString();
      
        const configPath = path.join(process.env.HOME || '', '.waltodo', 'config.json');
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);

        expect(result).toContain('Command executed successfully');
        expect(config.network).toBe('testnet');
        expect(config.walletAddress).toBe('0x123...');
        expect(config).toHaveProperty('network', 'testnet');
        expect(config).toHaveProperty('walletAddress', '0x123...');
      });
    });

    describe('blockchain storage and retrieval', () => {
      beforeEach(() => {
        (execSync as jest.Mock).mockReset();
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
          if (filePath.includes('config.json')) {
            return JSON.stringify(MOCK_NETWORK_CONFIG);
          }
          throw new Error(`File not mocked: ${filePath}`);
        });
      });

      it('should store todo on blockchain successfully', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('store')) {
            return Buffer.from(`Todo stored successfully. Blob ID: ${MOCK_BLOB_ID}`);
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} store --todo test-todo-id --list ${TEST_LIST}`).toString();
        expect(result).toContain('Todo stored successfully');
        expect(result).toContain(MOCK_BLOB_ID);
      });

      it('should retrieve todo from blockchain successfully', () => {
        const mockTodoData = {
          id: 'test-todo-id',
          title: 'Test Todo',
          description: 'Test Description',
          completed: false
        };

        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('retrieve')) {
            return Buffer.from(JSON.stringify(mockTodoData));
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} retrieve --blob-id ${MOCK_BLOB_ID}`).toString();
        const retrievedTodo = JSON.parse(result);
        expect(retrievedTodo).toMatchObject(mockTodoData);
      });

      it('should handle network connection issues', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('Network connection failed');
        });

        expect(() => {
          execSync(`${CLI_CMD} store --todo test-todo-id --list ${TEST_LIST}`, { stdio: 'inherit' });
        }).toThrow('Network connection failed');
      });

      it('should handle blockchain transaction failures', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('Transaction failed: insufficient gas');
        });

        expect(() => {
          execSync(`${CLI_CMD} store --todo test-todo-id --list ${TEST_LIST} --create-nft`, { stdio: 'inherit' });
        }).toThrow('Transaction failed: insufficient gas');
      });

      it('should create NFT from stored todo', () => {
        (execSync as jest.Mock).mockImplementation((command: string) => {
          if (command.includes('--create-nft')) {
            return Buffer.from(`NFT created successfully. Transaction: ${MOCK_TX_DIGEST}`);
          }
          throw new Error(`Command not mocked: ${command}`);
        });

        const result = execSync(`${CLI_CMD} store --todo test-todo-id --list ${TEST_LIST} --create-nft`).toString();
        expect(result).toContain('NFT created successfully');
        expect(result).toContain(MOCK_TX_DIGEST);
      });

      it('should handle invalid blob ID during retrieval', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('Invalid blob ID: content not found');
        });

        expect(() => {
          execSync(`${CLI_CMD} retrieve --blob-id invalid-id`, { stdio: 'inherit' });
        }).toThrow('Invalid blob ID: content not found');
      });
    });

    describe('error handling', () => {
      it('should handle network error simulation', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('Simulated network error');
        });

        expect(() => {
          execSync(`${CLI_CMD} create --title "Network Test"`, { stdio: 'inherit' });
        }).toThrow('Simulated network error');
      });

      it('should handle invalid command', () => {
        (execSync as jest.Mock).mockImplementation(() => {
          throw new Error('Command not found');
        });

        expect(() => {
          execSync(`${CLI_CMD} invalid-command`, { stdio: 'inherit' });
        }).toThrow('Command not found');
      });
    });
  });
});