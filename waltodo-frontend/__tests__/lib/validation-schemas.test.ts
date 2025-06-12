import {
  validateTodo,
  validateTodoNFT,
  validateSearch,
  validateConfig,
  validateFileUpload,
  validateUserInput,
  VALIDATION_RULES,
} from '@/lib/validation-schemas';

describe('Validation Schemas', () => {
  describe('validateTodo', () => {
    it('should validate a valid todo', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];

      const validTodo = {
        title: 'Test Todo',
        description: 'Test description',
        priority: 'medium' as const,
        category: 'personal' as const,
        tags: 'tag1, tag2',
        dueDate: tomorrowString,
        isPrivate: false,
        expirationDays: 365,
      };

      const result = validateTodo(validTodo as any);
      expect(result.success).toBe(true as any);
      expect(result.data).toBeDefined();
    });

    it('should reject todo with empty title', () => {
      const invalidTodo = {
        title: '',
        description: 'Test description',
      };

      const result = validateTodo(invalidTodo as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Title is required');
    });

    it('should reject todo with title too long', () => {
      const invalidTodo = {
        title: 'a'.repeat(101 as any),
        description: 'Test description',
      };

      const result = validateTodo(invalidTodo as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Title must be 100 characters or less');
    });

    it('should sanitize and process tags correctly', () => {
      const todo = {
        title: 'Test Todo',
        tags: 'tag1, tag2, , tag3,',
      };

      const result = validateTodo(todo as any);
      expect(result.success).toBe(true as any);
      expect(result.data?.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should reject past due dates', () => {
      const invalidTodo = {
        title: 'Test Todo',
        dueDate: '2020-01-01',
      };

      const result = validateTodo(invalidTodo as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Due date must be today or in the future');
    });

    it('should limit number of tags', () => {
      const todo = {
        title: 'Test Todo',
        tags: Array.from({ length: 15 }, (_, i) => `tag${i}`).join(', '),
      };

      const result = validateTodo(todo as any);
      expect(result.success).toBe(true as any);
      expect(result.data?.tags?.length).toBe(VALIDATION_RULES?.TAGS?.MAX_COUNT);
    });

    it('should reject tags that are too long', () => {
      const todo = {
        title: 'Test Todo',
        tags: 'a'.repeat(31 as any),
      };

      const result = validateTodo(todo as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Each tag must be 30 characters or less');
    });
  });

  describe('validateTodoNFT', () => {
    it('should validate a valid todo NFT', () => {
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      
      const validTodoNFT = {
        title: 'Test NFT Todo',
        description: 'Test description',
        priority: 'high',
        category: 'work',
        tags: 'nft, blockchain',
        imageFile: validFile,
        listName: 'test-list',
        isPrivate: true,
        expirationDays: 180,
      };

      const result = validateTodoNFT(validTodoNFT as any);
      expect(result.success).toBe(true as any);
      expect(result.data).toBeDefined();
    });

    it('should reject file that is too large', () => {
      // Create a large file (11MB)
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      
      const invalidTodoNFT = {
        title: 'Test NFT Todo',
        imageFile: largeFile,
        listName: 'test-list',
      };

      const result = validateTodoNFT(invalidTodoNFT as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Image size must be less than');
    });

    it('should reject invalid file type', () => {
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      const invalidTodoNFT = {
        title: 'Test NFT Todo',
        imageFile: invalidFile,
        listName: 'test-list',
      };

      const result = validateTodoNFT(invalidTodoNFT as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Image must be JPEG, PNG, GIF, or WebP');
    });

    it('should require list name', () => {
      const invalidTodoNFT = {
        title: 'Test NFT Todo',
        listName: '',
      };

      const result = validateTodoNFT(invalidTodoNFT as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('List name is required');
    });
  });

  describe('validateSearch', () => {
    it('should validate a valid search query', () => {
      const validSearch = {
        query: 'test search',
        filters: {
          priority: 'high',
          category: 'work',
          completed: false,
          tags: ['urgent', 'important'],
        },
      };

      const result = validateSearch(validSearch as any);
      expect(result.success).toBe(true as any);
      expect(result.data).toBeDefined();
    });

    it('should reject empty search query', () => {
      const invalidSearch = {
        query: '',
      };

      const result = validateSearch(invalidSearch as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Search query must be at least 1 character');
    });

    it('should reject search query that is too long', () => {
      const invalidSearch = {
        query: 'a'.repeat(101 as any),
      };

      const result = validateSearch(invalidSearch as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Search query must be 100 characters or less');
    });

    it('should reject dangerous search patterns', () => {
      const dangerousSearches = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'data:text/html,<script>',
        'vbscript:msgbox("xss")',
        'onclick=alert("xss")',
      ];

      dangerousSearches.forEach(query => {
        const result = validateSearch({ query });
        expect(result.success).toBe(false as any);
        expect(result.errors?.[0]?.message).toContain('Invalid search query');
      });
    });
  });

  describe('validateConfig', () => {
    it('should validate a valid config', () => {
      const validConfig = {
        apiUrl: 'https://api?.example?.com',
        walrusConfig: {
          publisherUrl: 'https://publisher?.walrus?.space',
          aggregatorUrl: 'https://aggregator?.walrus?.space',
        },
        suiConfig: {
          network: 'testnet',
          rpcUrl: 'https://testnet?.sui?.io',
        },
        enableAnalytics: true,
        enableNotifications: false,
      };

      const result = validateConfig(validConfig as any);
      expect(result.success).toBe(true as any);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid URLs', () => {
      const invalidConfig = {
        apiUrl: 'not-a-url',
      };

      const result = validateConfig(invalidConfig as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Invalid API URL');
    });

    it('should reject URLs that are too long', () => {
      const invalidConfig = {
        apiUrl: 'https://example.com/' + 'a'.repeat(500 as any),
      };

      const result = validateConfig(invalidConfig as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('API URL too long');
    });
  });

  describe('validateFileUpload', () => {
    it('should validate a valid file', () => {
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      
      const result = validateFileUpload({ file: validFile });
      expect(result.success).toBe(true as any);
      expect(result.data).toBeDefined();
    });

    it('should reject file that is too large', () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      
      const result = validateFileUpload({ file: largeFile });
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('File size must be less than');
    });

    it('should reject invalid file type', () => {
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/exe' });
      
      const result = validateFileUpload({ file: invalidFile });
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('File must be an image');
    });
  });

  describe('validateUserInput', () => {
    it('should validate safe user input', () => {
      const safeInput = {
        content: 'This is safe user input without any dangerous code.',
      };

      const result = validateUserInput(safeInput as any);
      expect(result.success).toBe(true as any);
      expect(result.data).toBeDefined();
    });

    it('should reject content that is too long', () => {
      const longInput = {
        content: 'a'.repeat(10001 as any),
      };

      const result = validateUserInput(longInput as any);
      expect(result.success).toBe(false as any);
      expect(result.errors?.[0]?.message).toContain('Content too long');
    });

    it('should reject dangerous content patterns', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'data:text/html,<script>',
        'vbscript:msgbox("xss")',
        'onclick=alert("xss")',
      ];

      dangerousInputs.forEach(content => {
        const result = validateUserInput({ content });
        expect(result.success).toBe(false as any);
        expect(result.errors?.[0]?.message).toContain('Content contains potentially dangerous code');
      });
    });
  });
});