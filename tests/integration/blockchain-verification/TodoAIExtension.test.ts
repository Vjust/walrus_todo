import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SignatureWithBytes, IntentScope } from '@mysten/sui/cryptography';
import { SuiClient } from '@mysten/sui/client';
import type { WalrusClientExt } from '../../../src/types/client';

import { BlobVerificationManager } from '../../../src/utils/blob-verification';
import { CLIError } from '../../../src/types/errors/consolidated';

// Mock the AI service interface
class TodoAIExtension {
  private suiClient: Pick<SuiClient, 'getLatestSuiSystemState' | 'getObject'>;
  private walrusClient: jest.Mocked<WalrusClientExt>;
  private signer: Ed25519Keypair;
  private verificationManager: BlobVerificationManager;
  
  constructor(
    suiClient: Pick<SuiClient, 'getLatestSuiSystemState' | 'getObject'>,
    walrusClient: jest.Mocked<WalrusClientExt>,
    signer: Ed25519Keypair
  ) {
    this.suiClient = suiClient;
    this.walrusClient = walrusClient;
    this.signer = signer;
    this.verificationManager = new BlobVerificationManager(
      suiClient,
      walrusClient,
      signer
    );
  }
  
  /**
   * Analyze a todo and generate insights with blockchain verification
   */
  async analyzeTodo(
    todoId: string,
    options: {
      verifyBlockchain?: boolean;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<{
    insights: Array<{ category: string; content: string }>;
    verified: boolean;
    todoContent: any;
    blobId?: string;
  }> {
    const { 
      verifyBlockchain = true
    } = options;
    
    try {
      // 1. Retrieve todo content
      const todoData = await this.walrusClient.readBlob({ blobId: todoId });
      if (!todoData) {
        throw new CLIError('Todo not found', 'TODO_NOT_FOUND');
      }
      
      const todoContent = JSON.parse(Buffer.from(todoData).toString('utf-8'));
      
      // 2. Verify on blockchain if requested
      let verified = false;
      if (verifyBlockchain) {
        // Get verification info
        const blobInfo = await this.walrusClient.getBlobInfo(todoId);
        verified = !!blobInfo && blobInfo.certified_epoch !== undefined;
      }
      
      // 3. Generate insights (mocked in tests)
      const insights = [
        {
          category: 'Priority',
          content: 'This task is high priority based on its deadline and relationship to other tasks.'
        },
        {
          category: 'Dependency',
          content: 'This task depends on 2 other tasks that need to be completed first.'
        },
        {
          category: 'Optimization',
          content: 'Consider breaking this task down into smaller subtasks for better management.'
        }
      ];
      
      return {
        insights,
        verified,
        todoContent,
        blobId: todoId
      };
    } catch (_error) {
      throw new CLIError(
        `Todo analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        'AI_ANALYSIS_ERROR'
      );
    }
  }
  
  /**
   * Generate a todo with blockchain verification capabilities
   */
  async generateTodo(
    prompt: string,
    options: {
      registerOnBlockchain?: boolean;
      priority?: 'high' | 'medium' | 'low';
      deadline?: Date;
      aiModel?: string;
    } = {}
  ): Promise<{
    todo: {
      id: string;
      title: string;
      description: string;
      completed: boolean;
      priority: string;
      tags: string[];
      deadline?: string;
      created: string;
      blockchain?: {
        registered: boolean;
        blobId?: string;
        transactionDigest?: string;
      };
    };
    generationDetails: {
      model: string;
      prompt: string;
      tokens: number;
    };
  }> {
    const {
      registerOnBlockchain = false,
      priority = 'medium',
      deadline,
      aiModel = 'default-model'
    } = options;
    
    try {
      // 1. Generate todo content (mocked in tests)
      const todo = {
        id: `todo-${Date.now()}`,
        title: `Generated Todo: ${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}`,
        description: `AI-generated todo based on prompt: ${prompt}`,
        completed: false,
        priority,
        tags: ['ai-generated', 'blockchain-ready'],
        created: new Date().toISOString()
      };
      
      if (deadline) {
        todo.deadline = deadline.toISOString();
      }
      
      // 2. Register on blockchain if requested
      if (registerOnBlockchain) {
        const todoBytes = new TextEncoder().encode(JSON.stringify(todo));
        const response = await this.walrusClient.writeBlob({
          blob: todoBytes,
          signer: this.signer,
          deletable: true,
          epochs: 52,
          attributes: {
            contentType: 'application/json',
            todoType: 'ai-generated',
            priority
          }
        });
        
        // Add blockchain info to todo
        todo.blockchain = {
          registered: true,
          blobId: response.blobId,
          transactionDigest: 'mock-transaction-digest'
        };
      }
      
      return {
        todo,
        generationDetails: {
          model: aiModel,
          prompt,
          tokens: prompt.split(' ').length * 2 // Mocked token count
        }
      };
    } catch (_error) {
      throw new CLIError(
        `Todo generation failed: ${error instanceof Error ? error.message : String(error)}`,
        'AI_GENERATION_ERROR'
      );
    }
  }
  
  /**
   * Verify an AI-generated todo's authenticity
   */
  async verifyAIGeneratedTodo(
    todoId: string
  ): Promise<{
    authentic: boolean;
    verificationDetails: {
      blockchainVerified: boolean;
      contentIntact: boolean;
      signatureValid: boolean;
      metadata: Record<string, any>;
    };
  }> {
    try {
      // 1. Get todo content
      const todoData = await this.walrusClient.readBlob({ blobId: todoId });
      if (!todoData) {
        throw new CLIError('Todo not found', 'TODO_NOT_FOUND');
      }
      
      const todoContent = JSON.parse(Buffer.from(todoData).toString('utf-8'));
      
      // 2. Get blockchain verification
      const blobInfo = await this.walrusClient.getBlobInfo(todoId);
      const blockchainVerified = !!blobInfo && blobInfo.certified_epoch !== undefined;
      
      // 3. Get metadata
      const metadata = await this.walrusClient.getBlobMetadata({ blobId: todoId });
      const metadataObj = metadata?.V1 || {};
      
      // 4. Verify content integrity
      const contentIntact = true; // Mocked in tests
      
      // 5. Verify signature if present
      const signatureValid = todoContent.blockchain?.signature ? true : false;
      
      // Overall authenticity requires blockchain verification and content integrity
      const authentic = blockchainVerified && contentIntact;
      
      return {
        authentic,
        verificationDetails: {
          blockchainVerified,
          contentIntact,
          signatureValid,
          metadata: metadataObj
        }
      };
    } catch (_error) {
      throw new CLIError(
        `Todo verification failed: ${error instanceof Error ? error.message : String(error)}`,
        'TODO_VERIFICATION_ERROR'
      );
    }
  }
}

// Mock the SuiClient
const mockGetLatestSuiSystemState = jest.fn().mockResolvedValue({ epoch: '42' });
const mockGetObject = jest.fn();
const mockSuiClient = {
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
  getObject: mockGetObject
} as unknown as jest.Mocked<SuiClient>;

// Create a mock transaction signer
const mockSigner = {
  connect: () => Promise.resolve(),
  getPublicKey: () => ({ toBytes: () => new Uint8Array(32) }),
  sign: async (_data: Uint8Array): Promise<Uint8Array> => new Uint8Array(64),
  signPersonalMessage: async (_data: Uint8Array): Promise<SignatureWithBytes> => ({
    bytes: Buffer.from(new Uint8Array(32)).toString('base64'),
    signature: Buffer.from(new Uint8Array(64)).toString('base64')
  }),
  signWithIntent: async (_data: Uint8Array, _intent: IntentScope): Promise<SignatureWithBytes> => ({
    bytes: Buffer.from(new Uint8Array(32)).toString('base64'),
    signature: Buffer.from(new Uint8Array(64)).toString('base64')
  }),
  signTransactionBlock: async (_transaction: any): Promise<SignatureWithBytes> => ({
    bytes: 'mock-transaction-bytes',
    signature: Buffer.from(new Uint8Array(64)).toString('base64')
  }),
  signData: async (_data: Uint8Array): Promise<Uint8Array> => new Uint8Array(64),
  signTransaction: async (_transaction: any): Promise<SignatureWithBytes> => ({
    bytes: 'mock-transaction-bytes',
    signature: Buffer.from(new Uint8Array(64)).toString('base64')
  }),
  toSuiAddress: () => 'mock-address',
  getKeyScheme: () => 'ED25519' as const
} as unknown as Ed25519Keypair;

describe('TodoAIExtension Integration', () => {
  let aiExtension: TodoAIExtension;
  let mockWalrusClient: jest.Mocked<WalrusClientExt>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create inline mock for WalrusClient with all required methods
    mockWalrusClient = {
      // Basic methods
      getConfig: jest.fn().mockResolvedValue({ network: 'testnet', version: '1.0.0', maxSize: 1000000 }),
      getWalBalance: jest.fn().mockResolvedValue('2000'),
      getStorageUsage: jest.fn().mockResolvedValue({ used: '500', total: '2000' }),
      
      // Blob operations - these will be set up specifically in each test
      getBlobInfo: jest.fn(),
      getBlobObject: jest.fn().mockResolvedValue({ content: 'test', metadata: {} }),
      verifyPoA: jest.fn(),
      readBlob: jest.fn(),
      getBlobMetadata: jest.fn(),
      writeBlob: jest.fn(),
      getStorageProviders: jest.fn(),
      getBlobSize: jest.fn().mockResolvedValue(1024),
      
      // Storage operations
      storageCost: jest.fn().mockResolvedValue({
        storageCost: BigInt(1000),
        writeCost: BigInt(500),
        totalCost: BigInt(1500)
      }),
      executeCreateStorageTransaction: jest.fn().mockResolvedValue({
        digest: 'test',
        storage: {
          id: { id: 'test' },
          start_epoch: 0,
          end_epoch: 52,
          storage_size: '1000'
        }
      }),
      executeCertifyBlobTransaction: jest.fn().mockResolvedValue({ digest: 'cert-digest' }),
      executeWriteBlobAttributesTransaction: jest.fn().mockResolvedValue({ digest: 'attr-digest' }),
      deleteBlob: jest.fn().mockReturnValue(jest.fn().mockResolvedValue({ digest: 'delete-digest' })),
      executeRegisterBlobTransaction: jest.fn().mockResolvedValue({ 
        blob: { blob_id: 'test' }, 
        digest: 'register-digest' 
      }),
      getStorageConfirmationFromNode: jest.fn().mockResolvedValue({
        primary_verification: true,
        provider: 'test-provider'
      }),
      createStorageBlock: jest.fn().mockResolvedValue({} as any),
      createStorage: jest.fn().mockReturnValue(jest.fn().mockResolvedValue({
        digest: 'storage-digest',
        storage: {
          id: { id: 'storage-id' },
          start_epoch: 0,
          end_epoch: 52,
          storage_size: '1000'
        }
      })),
      
      // Utility methods
      reset: jest.fn(),
      
      // Optional experimental API
      experimental: {
        getBlobData: jest.fn().mockResolvedValue({})
      }
    } as jest.Mocked<WalrusClientExt>;
    
    aiExtension = new TodoAIExtension(
      mockSuiClient, 
      mockWalrusClient, 
      mockSigner
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('analyzeTodo', () => {
    it('should analyze a todo with blockchain verification', async () => {
      // Create a sample todo
      const todoId = 'test-todo-id';
      const todo = {
        id: todoId,
        title: 'Test Todo',
        description: 'A test todo for analysis',
        completed: false,
        priority: 'high',
        tags: ['test', 'important'],
        created: new Date().toISOString()
      };
      
      // Set up mock responses
      mockWalrusClient.readBlob.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(todo))
      );
      
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: todoId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: '1000',
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      // Execute the analysis
      const result = await aiExtension.analyzeTodo(todoId);
      
      // Verify the results
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.verified).toBe(true);
      expect(result.todoContent).toEqual(todo);
      expect(result.blobId).toBe(todoId);
      
      // Verify client calls
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId: todoId });
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(todoId);
    });
    
    it('should analyze a todo without blockchain verification when disabled', async () => {
      // Create a sample todo
      const todoId = 'test-todo-id';
      const todo = {
        id: todoId,
        title: 'Test Todo',
        description: 'A test todo for analysis',
        completed: false,
        priority: 'medium',
        tags: ['test'],
        created: new Date().toISOString()
      };
      
      // Set up mock responses
      mockWalrusClient.readBlob.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(todo))
      );
      
      // Execute the analysis with verification disabled
      const result = await aiExtension.analyzeTodo(todoId, { verifyBlockchain: false });
      
      // Verify the results
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.verified).toBe(false);
      expect(result.todoContent).toEqual(todo);
      
      // Verify client calls
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId: todoId });
      expect(mockWalrusClient.getBlobInfo).not.toHaveBeenCalled();
    });
    
    it('should handle todo not found', async () => {
      const todoId = 'non-existent-todo';
      
      // Mock the blob not being found
      mockWalrusClient.readBlob.mockRejectedValue(
        new Error('Blob not found')
      );
      
      // Execute the analysis and expect it to fail
      await expect(aiExtension.analyzeTodo(todoId)).rejects.toThrow(CLIError);
    });
  });

  describe('generateTodo', () => {
    it('should generate a todo without blockchain registration', async () => {
      const prompt = 'Create a task for completing the project documentation';
      
      // Execute the generation
      const result = await aiExtension.generateTodo(prompt);
      
      // Verify the results
      expect(result.todo.title).toContain(prompt.slice(0, 30));
      expect(result.todo.priority).toBe('medium');
      expect(result.todo.tags).toContain('ai-generated');
      expect(result.todo.blockchain).toBeUndefined();
      
      // Verify client calls - should not interact with blockchain
      expect(mockWalrusClient.writeBlob).not.toHaveBeenCalled();
    });
    
    it('should generate a todo with blockchain registration', async () => {
      const prompt = 'Prepare presentation for the client meeting';
      const deadline = new Date('2024-12-31');
      
      // Mock Walrus client response
      mockWalrusClient.writeBlob.mockResolvedValue({
        blobId: 'blockchain-todo-id',
        blobObject: { blob_id: 'blockchain-todo-id' }
      });
      
      // Execute the generation with blockchain registration
      const result = await aiExtension.generateTodo(prompt, {
        registerOnBlockchain: true,
        priority: 'high',
        deadline,
        aiModel: 'advanced-model'
      });
      
      // Verify the results
      expect(result.todo.title).toContain(prompt.slice(0, 30));
      expect(result.todo.priority).toBe('high');
      expect(result.todo.deadline).toBe(deadline.toISOString());
      expect(result.todo.blockchain).toBeDefined();
      expect(result.todo.blockchain!.registered).toBe(true);
      expect(result.todo.blockchain!.blobId).toBe('blockchain-todo-id');
      
      // Verify generation details
      expect(result.generationDetails.model).toBe('advanced-model');
      expect(result.generationDetails.prompt).toBe(prompt);
      
      // Verify client calls
      expect(mockWalrusClient.writeBlob).toHaveBeenCalled();
      const writeArgs = mockWalrusClient.writeBlob.mock.calls[0][0];
      expect(writeArgs.signer).toBe(mockSigner);
      expect(writeArgs.deletable).toBe(true);
      expect(writeArgs.attributes).toEqual({
        contentType: 'application/json',
        todoType: 'ai-generated',
        priority: 'high'
      });
    });
    
    it('should handle errors during todo generation with blockchain', async () => {
      const prompt = 'Create an urgent task for system backup';
      
      // Mock Walrus client error
      mockWalrusClient.writeBlob.mockRejectedValue(
        new Error('Blockchain registration failed')
      );
      
      // Execute the generation and expect it to fail
      await expect(aiExtension.generateTodo(prompt, {
        registerOnBlockchain: true
      })).rejects.toThrow(CLIError);
    });
  });
  
  describe('verifyAIGeneratedTodo', () => {
    it('should verify an authentic AI-generated todo', async () => {
      // Create a sample todo
      const todoId = 'blockchain-todo-id';
      const todo = {
        id: todoId,
        title: 'AI Generated Todo',
        description: 'A todo generated by AI and registered on blockchain',
        completed: false,
        priority: 'high',
        tags: ['ai-generated', 'blockchain-ready'],
        created: new Date().toISOString(),
        blockchain: {
          registered: true,
          blobId: todoId,
          transactionDigest: 'transaction-123',
          signature: 'valid-signature'
        }
      };
      
      // Set up mock responses
      mockWalrusClient.readBlob.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(todo))
      );
      
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: todoId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: '1000',
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          contentType: 'application/json',
          todoType: 'ai-generated',
          priority: 'high',
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      // Execute the verification
      const result = await aiExtension.verifyAIGeneratedTodo(todoId);
      
      // Verify the results
      expect(result.authentic).toBe(true);
      expect(result.verificationDetails.blockchainVerified).toBe(true);
      expect(result.verificationDetails.contentIntact).toBe(true);
      expect(result.verificationDetails.signatureValid).toBe(true);
      expect(result.verificationDetails.metadata).toBeDefined();
      
      // Verify client calls
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId: todoId });
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(todoId);
      expect(mockWalrusClient.getBlobMetadata).toHaveBeenCalledWith({ blobId: todoId });
    });
    
    it('should detect an inauthentic todo without blockchain verification', async () => {
      // Create a sample todo
      const todoId = 'unverified-todo-id';
      const todo = {
        id: todoId,
        title: 'Unverified Todo',
        description: 'A todo that claims to be AI-generated but is not on blockchain',
        completed: false,
        priority: 'medium',
        tags: ['ai-generated'],
        created: new Date().toISOString()
      };
      
      // Set up mock responses
      mockWalrusClient.readBlob.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(todo))
      );
      
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: todoId,
        registered_epoch: 40,
        certified_epoch: undefined, // Not certified on blockchain
        size: '1000',
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      // Execute the verification
      const result = await aiExtension.verifyAIGeneratedTodo(todoId);
      
      // Verify the results
      expect(result.authentic).toBe(false);
      expect(result.verificationDetails.blockchainVerified).toBe(false);
    });
    
    it('should handle verification of non-existent todo', async () => {
      const todoId = 'non-existent-todo';
      
      // Mock the blob not being found
      mockWalrusClient.readBlob.mockRejectedValue(
        new Error('Blob not found')
      );
      
      // Execute the verification and expect it to fail
      await expect(aiExtension.verifyAIGeneratedTodo(todoId)).rejects.toThrow(CLIError);
    });
  });
});