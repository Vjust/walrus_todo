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
      const sanitized = SecurityUtils.XSSPrevention.sanitizeHTML(dangerous);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
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
        expect(SecurityUtils.XSSPrevention.containsDangerousContent(content)).toBe(true);
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
        expect(SecurityUtils.XSSPrevention.containsDangerousContent(content)).toBe(false);
      });
    });

    it('should sanitize URLs correctly', () => {
      expect(SecurityUtils.XSSPrevention.sanitizeURL('javascript:alert("xss")')).toBeNull();
      expect(SecurityUtils.XSSPrevention.sanitizeURL('data:text/html,<script>')).toBeNull();
      expect(SecurityUtils.XSSPrevention.sanitizeURL('https://example.com')).toBe('https://example.com/');
    });
  });

  describe('InputValidator', () => {
    it('should validate input length', () => {
      const shortInput = 'hello';
      const longInput = 'a'.repeat(10001);

      const shortResult = SecurityUtils.InputValidator.validateInput(shortInput);
      expect(shortResult.isValid).toBe(true);

      const longResult = SecurityUtils.InputValidator.validateInput(longInput);
      expect(longResult.isValid).toBe(false);
      expect(longResult.errors).toContain('Input must be 10000 characters or less');
    });

    it('should validate required fields', () => {
      const emptyResult = SecurityUtils.InputValidator.validateInput('', { required: true });
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.errors).toContain('This field is required');

      const validResult = SecurityUtils.InputValidator.validateInput('valid', { required: true });
      expect(validResult.isValid).toBe(true);
    });

    it('should validate email format', () => {
      expect(SecurityUtils.InputValidator.validateEmail('test@example.com')).toBe(true);
      expect(SecurityUtils.InputValidator.validateEmail('invalid-email')).toBe(false);
      expect(SecurityUtils.InputValidator.validateEmail('test@')).toBe(false);
    });

    it('should validate file uploads', () => {
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/exe' });
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

      const validResult = SecurityUtils.InputValidator.validateFile(validFile);
      expect(validResult.isValid).toBe(true);

      const invalidResult = SecurityUtils.InputValidator.validateFile(invalidFile);
      expect(invalidResult.isValid).toBe(false);

      const largeResult = SecurityUtils.InputValidator.validateFile(largeFile);
      expect(largeResult.isValid).toBe(false);
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
      const token1 = SecurityUtils.CSRFProtection.generateToken();
      const token2 = SecurityUtils.CSRFProtection.generateToken();
      
      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64); // 32 bytes * 2 hex chars
    });

    it('should store and retrieve tokens', () => {
      const token = 'test-token';
      SecurityUtils.CSRFProtection.storeToken(token);
      
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('csrf_token', token);
    });

    it('should validate tokens correctly', () => {
      const token = 'valid-token';
      (window.sessionStorage.getItem as jest.Mock).mockReturnValue(token);
      
      expect(SecurityUtils.CSRFProtection.validateToken(token)).toBe(true);
      expect(SecurityUtils.CSRFProtection.validateToken('invalid-token')).toBe(false);
    });
  });

  describe('SecureRandom', () => {
    it('should generate random strings of specified length', () => {
      const str1 = SecurityUtils.SecureRandom.generateString(16);
      const str2 = SecurityUtils.SecureRandom.generateString(16);
      
      expect(str1).toHaveLength(16);
      expect(str2).toHaveLength(16);
      expect(str1).not.toBe(str2);
    });

    it('should generate random IDs', () => {
      const id1 = SecurityUtils.SecureRandom.generateId();
      const id2 = SecurityUtils.SecureRandom.generateId();
      
      expect(id1).toHaveLength(16);
      expect(id2).toHaveLength(16);
      expect(id1).not.toBe(id2);
    });
  });

  describe('SecurityHeaders', () => {
    it('should generate secure headers', () => {
      const headers = SecurityUtils.SecurityHeaders.generateSecureHeaders();
      
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include CSP when nonce is provided', () => {
      const nonce = 'test-nonce';
      const headers = SecurityUtils.SecurityHeaders.generateSecureHeaders(nonce);
      
      expect(headers['Content-Security-Policy']).toContain(`'nonce-${nonce}'`);
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

      const sanitized = SecurityUtils.sanitizeFormData(formData);
      
      expect(sanitized.title).not.toContain('<script>');
      expect(sanitized.description).toBe('Normal description');
      expect(sanitized.number).toBe(42);
    });

    it('should safely parse JSON', () => {
      const validJson = '{"test": "value"}';
      const invalidJson = 'invalid json';
      const fallback = { default: true };

      expect(SecurityUtils.safeJSONParse(validJson, fallback)).toEqual({ test: 'value' });
      expect(SecurityUtils.safeJSONParse(invalidJson, fallback)).toEqual(fallback);
    });
  });
});