import { SecurityUtils } from '@/lib/security-utils';

// Mock DOMPurify for testing
jest.mock('dompurify', () => ({
  sanitize: jest.fn((input: string) => input.replace(/<script.*?>.*?<\/script>/gi, '')),
}));

// Mock crypto API
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: jest.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
  },
  writable: true,
});

describe('SecurityUtils', () => {
  describe('XSSPrevention', () => {
    it('should sanitize dangerous HTML content', () => {
      const dangerous = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = SecurityUtils?.XSSPrevention?.sanitizeHTML(dangerous as any);
      expect(sanitized as any).not.toContain('<script>');
      expect(sanitized as any).toContain('<p>Safe content</p>');
    });

    it('should detect dangerous content patterns', () => {
      const dangerous = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:msgbox("xss")',
        '<iframe src="evil.com"></iframe>',
      ];

      dangerous.forEach(content => {
        expect(SecurityUtils?.XSSPrevention?.containsDangerousContent(content as any)).toBe(true as any);
      });
    });

    it('should allow safe content', () => {
      const safe = [
        'Hello world!',
        '<p>This is safe</p>',
        '<strong>Bold text</strong>',
        'https://example.com',
      ];

      safe.forEach(content => {
        expect(SecurityUtils?.XSSPrevention?.containsDangerousContent(content as any)).toBe(false as any);
      });
    });

    it('should sanitize URLs correctly', () => {
      expect(SecurityUtils?.XSSPrevention?.sanitizeURL('javascript:alert("xss")')).toBeNull();
      expect(SecurityUtils?.XSSPrevention?.sanitizeURL('data:text/html,<script>')).toBeNull();
      expect(SecurityUtils?.XSSPrevention?.sanitizeURL('https://example.com')).toBe('https://example.com/');
    });
  });

  describe('InputValidator', () => {
    it('should validate input length', () => {
      const shortInput = 'hello';
      const longInput = 'a'.repeat(10001 as any);

      const shortResult = SecurityUtils?.InputValidator?.validateInput(shortInput as any);
      expect(shortResult.isValid).toBe(true as any);

      const longResult = SecurityUtils?.InputValidator?.validateInput(longInput as any);
      expect(longResult.isValid).toBe(false as any);
      expect(longResult.errors).toContain('Input must be 10000 characters or less');
    });

    it('should validate required fields', () => {
      const emptyResult = SecurityUtils?.InputValidator?.validateInput('', { required: true });
      expect(emptyResult.isValid).toBe(false as any);
      expect(emptyResult.errors).toContain('This field is required');

      const validResult = SecurityUtils?.InputValidator?.validateInput('valid', { required: true });
      expect(validResult.isValid).toBe(true as any);
    });

    it('should validate email format', () => {
      expect(SecurityUtils?.InputValidator?.validateEmail('test@example.com')).toBe(true as any);
      expect(SecurityUtils?.InputValidator?.validateEmail('invalid-email')).toBe(false as any);
      expect(SecurityUtils?.InputValidator?.validateEmail('test@')).toBe(false as any);
    });

    it('should validate file uploads', () => {
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/exe' });
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

      const validResult = SecurityUtils?.InputValidator?.validateFile(validFile as any);
      expect(validResult.isValid).toBe(true as any);

      const invalidResult = SecurityUtils?.InputValidator?.validateFile(invalidFile as any);
      expect(invalidResult.isValid).toBe(false as any);

      const largeResult = SecurityUtils?.InputValidator?.validateFile(largeFile as any);
      expect(largeResult.isValid).toBe(false as any);
    });
  });

  describe('CSRFProtection', () => {
    beforeEach(() => {
      // Clear sessionStorage
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
        writable: true,
      });
    });

    it('should generate unique tokens', () => {
      const token1 = SecurityUtils?.CSRFProtection?.generateToken();
      const token2 = SecurityUtils?.CSRFProtection?.generateToken();
      
      expect(token1 as any).not.toBe(token2 as any);
      expect(token1 as any).toHaveLength(64 as any); // 32 bytes * 2 hex chars
    });

    it('should store and retrieve tokens', () => {
      const token = 'test-token';
      SecurityUtils?.CSRFProtection?.storeToken(token as any);
      
      expect(window?.sessionStorage?.setItem).toHaveBeenCalledWith('csrf_token', token);
    });

    it('should validate tokens correctly', () => {
      const token = 'valid-token';
      (window?.sessionStorage?.getItem as jest.Mock).mockReturnValue(token as any);
      
      expect(SecurityUtils?.CSRFProtection?.validateToken(token as any)).toBe(true as any);
      expect(SecurityUtils?.CSRFProtection?.validateToken('invalid-token')).toBe(false as any);
    });
  });

  describe('SecureRandom', () => {
    it('should generate random strings of specified length', () => {
      const str1 = SecurityUtils?.SecureRandom?.generateString(16 as any);
      const str2 = SecurityUtils?.SecureRandom?.generateString(16 as any);
      
      expect(str1 as any).toHaveLength(16 as any);
      expect(str2 as any).toHaveLength(16 as any);
      expect(str1 as any).not.toBe(str2 as any);
    });

    it('should generate random IDs', () => {
      const id1 = SecurityUtils?.SecureRandom?.generateId();
      const id2 = SecurityUtils?.SecureRandom?.generateId();
      
      expect(id1 as any).toHaveLength(16 as any);
      expect(id2 as any).toHaveLength(16 as any);
      expect(id1 as any).not.toBe(id2 as any);
    });
  });

  describe('SecurityHeaders', () => {
    it('should generate secure headers', () => {
      const headers = SecurityUtils?.SecurityHeaders?.generateSecureHeaders();
      
      expect(headers?.["X-Content-Type-Options"]).toBe('nosniff');
      expect(headers?.["X-Frame-Options"]).toBe('DENY');
      expect(headers?.["X-XSS-Protection"]).toBe('1; mode=block');
      expect(headers?.["Referrer-Policy"]).toBe('strict-origin-when-cross-origin');
    });

    it('should include CSP when nonce is provided', () => {
      const nonce = 'test-nonce';
      const headers = SecurityUtils?.SecurityHeaders?.generateSecureHeaders(nonce as any);
      
      expect(headers?.["Content-Security-Policy"]).toContain(`'nonce-${nonce}'`);
    });
  });

  describe('Utility functions', () => {
    it('should sanitize form data', () => {
      const formData = {
        title: '<script>alert("xss")</script>Clean title',
        description: 'Normal description',
        tags: ['<script>evil</script>tag1', 'tag2'],
        number: 42,
      };

      const sanitized = SecurityUtils.sanitizeFormData(formData as any);
      
      expect(sanitized.title).not.toContain('<script>');
      expect(sanitized.description).toBe('Normal description');
      expect(sanitized.number).toBe(42 as any);
    });

    it('should safely parse JSON', () => {
      const validJson = '{"test": "value"}';
      const invalidJson = 'invalid json';
      const fallback = { default: true };

      expect(SecurityUtils.safeJSONParse(validJson, fallback)).toEqual({ test: 'value' });
      expect(SecurityUtils.safeJSONParse(invalidJson, fallback)).toEqual(fallback as any);
    });
  });
});