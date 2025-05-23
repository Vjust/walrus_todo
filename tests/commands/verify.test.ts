import { test } from '@oclif/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';
import { BlobVerificationManager } from '../../src/utils/blob-verification';

// Mock configuration values that would normally be in the user's home directory
const mockBaseConfig = {
  privateKey: 'mock-private-key',
  network: 'testnet',
  walrusEndpoint: 'https://testnet.wal.app',
  storage: {
    defaultSize: 1000000,
    defaultEpochs: 52
  }
};

// Create temporary directory for test files
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'walrus-verify-test-'));

// Mock the SuiClient initialization
jest.mock('@mysten/sui/client', () => {
  return {
    SuiClient: jest.fn().mockImplementation(() => ({
      getLatestSuiSystemState: jest.fn().mockResolvedValue({ epoch: '42' }),
      getObject: jest.fn().mockResolvedValue({ data: { content: { fields: {} } } }),
      signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({ digest: 'mock-transaction-digest' })
    }))
  };
});

// Mock the BlobVerificationManager
jest.mock('../../src/utils/blob-verification', () => {
  return {
    BlobVerificationManager: jest.fn().mockImplementation(() => ({
      verifyBlob: jest.fn().mockResolvedValue({
        success: true,
        details: {
          size: 1000,
          checksum: 'mock-checksum',
          blobId: 'mock-blob-id',
          certified: true,
          certificateEpoch: 41,
          registeredEpoch: 40,
          attributes: { contentType: 'application/json' }
        },
        attempts: 1,
        poaComplete: true,
        providers: 2,
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: '1000',
            hashes: [{
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }
      }),
      verifyUpload: jest.fn().mockResolvedValue({
        blobId: 'mock-blob-id',
        checksums: {
          sha256: 'mock-sha256',
          sha512: 'mock-sha512',
          blake2b: 'mock-blake2b'
        },
        certified: true,
        poaComplete: true,
        hasMinProviders: true
      }),
      monitorBlobAvailability: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

// Mock the createMockWalrusClient function
jest.mock('../../src/utils/MockWalrusClient', () => {
  const mockClient = {
    readBlob: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('{"test":"data"}'))),
    getBlobInfo: jest.fn().mockResolvedValue({
      blob_id: 'mock-blob-id',
      registered_epoch: 40,
      certified_epoch: 41,
      size: '1000',
      metadata: { V1: { encoding_type: { RedStuff: true, $kind: 'RedStuff' } } }
    }),
    getBlobMetadata: jest.fn().mockResolvedValue({
      V1: {
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        unencoded_length: '1000',
        contentType: 'application/json',
        $kind: 'V1'
      },
      $kind: 'V1'
    }),
    writeBlob: jest.fn().mockResolvedValue({
      blobId: 'mock-blob-id',
      blobObject: { blob_id: 'mock-blob-id' }
    }),
    getUnderlyingClient: jest.fn().mockReturnValue({
      // Mock the underlying client methods
      readBlob: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('{"test":"data"}'))),
      getBlobInfo: jest.fn().mockResolvedValue({
        blob_id: 'mock-blob-id',
        registered_epoch: 40,
        certified_epoch: 41,
        size: '1000'
      })
    })
  };
  
  return {
    createMockWalrusClient: jest.fn().mockReturnValue(mockClient)
  };
});

describe('verify commands', () => {
  beforeEach(() => {
    // Create test files
    const testJsonContent = JSON.stringify({ test: 'data' }, null, 2);
    fs.writeFileSync(path.join(tmpDir, 'test-data.json'), testJsonContent);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up config in home directory
    const configDir = path.join(os.homedir(), '.walrus-todo');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify(mockBaseConfig, null, 2)
    );
  });
  
  afterEach(() => {
    // Clean up test files
    fs.readdirSync(tmpDir).forEach(file => {
      fs.unlinkSync(path.join(tmpDir, file));
    });
    
    // Restore clock
    if (sinon.clock.hasOwnProperty('restore')) {
      sinon.clock.restore();
    }
  });
  
  after(() => {
    // Remove temporary directory
    fs.rmdirSync(tmpDir, { recursive: true });
  });

  describe('verify blob', () => {
    test
      .stdout()
      .command(['verify', 'blob', 'mock-blob-id'])
      .it('successfully verifies an existing blob', ctx => {
        expect(ctx.stdout).to.contain('Verification successful');
        expect(ctx.stdout).to.contain('Blob ID: mock-blob-id');
        expect(ctx.stdout).to.contain('Certified: true');
        expect(ctx.stdout).to.contain('Registered at epoch: 40');
        expect(ctx.stdout).to.contain('Certified at epoch: 41');
      });
      
    test
      .stdout()
      .command(['verify', 'blob', 'mock-blob-id', '--full-metadata'])
      .it('verifies a blob with full metadata display', ctx => {
        expect(ctx.stdout).to.contain('Verification successful');
        expect(ctx.stdout).to.contain('Metadata:');
        expect(ctx.stdout).to.contain('contentType: application/json');
      });
      
    test
      .stderr()
      .command(['verify', 'blob', 'invalid-blob-id'])
      .catch(error => {
        // Mock the verification manager to fail for this test
        const verifyBlob = BlobVerificationManager.prototype.verifyBlob as jest.Mock;
        verifyBlob.mockRejectedValueOnce(new Error('Blob not found'));
      })
      .it('handles verification failure for non-existent blob', ctx => {
        expect(ctx.stderr).to.contain('Error: Blob not found');
      });
  });
  
  describe('verify file', () => {
    test
      .stdout()
      .command(['verify', 'file', path.join(tmpDir, 'test-data.json'), 'mock-blob-id'])
      .it('successfully verifies a file against a blob', ctx => {
        expect(ctx.stdout).to.contain('File verification successful');
        expect(ctx.stdout).to.contain('File: ' + path.join(tmpDir, 'test-data.json'));
        expect(ctx.stdout).to.contain('Blob ID: mock-blob-id');
        expect(ctx.stdout).to.contain('Content matches: true');
      });
      
    test
      .stderr()
      .command(['verify', 'file', 'non-existent-file.json', 'mock-blob-id'])
      .catch(error => {
        // The error is expected because the file doesn't exist
        expect(error.message).to.contain('ENOENT');
      })
      .it('handles non-existent file');
      
    test
      .stderr()
      .command(['verify', 'file', path.join(tmpDir, 'test-data.json'), 'invalid-blob-id'])
      .catch(error => {
        // Mock the verification manager to fail for this test
        const verifyBlob = BlobVerificationManager.prototype.verifyBlob as jest.Mock;
        verifyBlob.mockRejectedValueOnce(new Error('Blob not found'));
      })
      .it('handles verification failure for non-existent blob', ctx => {
        expect(ctx.stderr).to.contain('Error: Blob not found');
      });
  });
  
  describe('verify upload', () => {
    test
      .stdout()
      .command(['verify', 'upload', path.join(tmpDir, 'test-data.json')])
      .it('successfully uploads and verifies a file', ctx => {
        expect(ctx.stdout).to.contain('Upload and verification successful');
        expect(ctx.stdout).to.contain('File: ' + path.join(tmpDir, 'test-data.json'));
        expect(ctx.stdout).to.contain('Blob ID: mock-blob-id');
        expect(ctx.stdout).to.contain('Certified: true');
      });
      
    test
      .stdout()
      .command(['verify', 'upload', path.join(tmpDir, 'test-data.json'), '--wait-for-certification'])
      .it('uploads and waits for certification', ctx => {
        expect(ctx.stdout).to.contain('Upload and verification successful');
        expect(ctx.stdout).to.contain('Waiting for certification...');
        expect(ctx.stdout).to.contain('Certified: true');
      });
      
    test
      .stdout()
      .command(['verify', 'upload', path.join(tmpDir, 'test-data.json'), '--monitor'])
      .it('uploads and monitors availability', ctx => {
        expect(ctx.stdout).to.contain('Upload and verification successful');
        expect(ctx.stdout).to.contain('Monitoring availability...');
        expect(ctx.stdout).to.contain('Monitoring completed successfully');
      });
      
    test
      .stderr()
      .command(['verify', 'upload', 'non-existent-file.json'])
      .catch(error => {
        // The error is expected because the file doesn't exist
        expect(error.message).to.contain('ENOENT');
      })
      .it('handles non-existent file');
  });
  
  describe('verify todo', () => {
    test
      .stdout()
      .command(['verify', 'todo', 'mock-todo-id'])
      .it('successfully verifies a todo', ctx => {
        expect(ctx.stdout).to.contain('Todo verification successful');
        expect(ctx.stdout).to.contain('Todo ID: mock-todo-id');
        expect(ctx.stdout).to.contain('Blockchain verified: true');
      });
      
    test
      .stdout()
      .command(['verify', 'todo', 'mock-todo-id', '--show-content'])
      .it('verifies a todo and shows its content', ctx => {
        expect(ctx.stdout).to.contain('Todo verification successful');
        expect(ctx.stdout).to.contain('Todo content:');
        expect(ctx.stdout).to.contain('"test": "data"');
      });
  });
  
  describe('verify credential', () => {
    test
      .stdout()
      .command(['verify', 'credential', 'mock-credential-id'])
      .it('successfully verifies a credential', ctx => {
        expect(ctx.stdout).to.contain('Credential verification successful');
        expect(ctx.stdout).to.contain('Credential ID: mock-credential-id');
        expect(ctx.stdout).to.contain('Signature: Valid');
        expect(ctx.stdout).to.contain('Blockchain verification: Passed');
      });
      
    test
      .stdout()
      .command(['verify', 'credential', 'mock-credential-id', '--skip-revocation-check'])
      .it('verifies a credential without revocation check', ctx => {
        expect(ctx.stdout).to.contain('Credential verification successful');
        expect(ctx.stdout).to.contain('Revocation check: Skipped');
      });
  });
});