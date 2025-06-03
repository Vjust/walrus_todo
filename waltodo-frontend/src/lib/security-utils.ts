'use client';

import DOMPurify from 'dompurify';

// Security configuration
export const SECURITY_CONFIG = {
  // XSS Prevention
  ALLOWED_HTML_TAGS: ['p', 'br', 'strong', 'em', 'u', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'],
  ALLOWED_ATTRIBUTES: ['class', 'id'],
  
  // Input limits
  MAX_INPUT_LENGTH: 10000,
  MAX_URL_LENGTH: 2048,
  
  // Rate limiting
  DEFAULT_RATE_LIMIT: 10, // requests per minute
  STRICT_RATE_LIMIT: 5,   // for sensitive operations
  
  // File upload security
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// XSS Prevention utilities
export class XSSPrevention {
  private static isClient = typeof window !== 'undefined';
  
  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  static sanitizeHTML(dirty: string, options?: {
    allowedTags?: string[];
    allowedAttributes?: string[];
  }): string {
    if (!this.isClient) {
      // Server-side fallback - strip all HTML
      return dirty.replace(/<[^>]*>/g, '');
    }
    
    const config = {
      ALLOWED_TAGS: options?.allowedTags || SECURITY_CONFIG.ALLOWED_HTML_TAGS,
      ALLOWED_ATTR: options?.allowedAttributes || SECURITY_CONFIG.ALLOWED_ATTRIBUTES,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
    };
    
    return DOMPurify.sanitize(dirty, config);
  }
  
  /**
   * Sanitize text content - strips all HTML
   */
  static sanitizeText(dirty: string): string {
    if (!this.isClient) {
      return dirty.replace(/<[^>]*>/g, '');
    }
    
    return DOMPurify.sanitize(dirty, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  }
  
  /**
   * Check if input contains potentially dangerous patterns
   */
  static containsDangerousContent(input: string): boolean {
    const dangerousPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /<link/gi,
      /<meta/gi,
      /<style/gi,
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(input));
  }
  
  /**
   * Escape special characters for safe inclusion in HTML attributes
   */
  static escapeHTML(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  /**
   * Validate and sanitize URL
   */
  static sanitizeURL(url: string): string | null {
    try {
      // Check for dangerous protocols
      if (url.match(/^(javascript|data|vbscript):/i)) {
        return null;
      }
      
      // Validate URL format
      const urlObj = new URL(url);
      
      // Only allow safe protocols
      const allowedProtocols = ['http:', 'https:', 'mailto:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return null;
      }
      
      return urlObj.toString();
    } catch {
      return null;
    }
  }
}

// Input validation and sanitization
export class InputValidator {
  /**
   * Validate and sanitize user input
   */
  static validateInput(input: string, options?: {
    maxLength?: number;
    allowHTML?: boolean;
    required?: boolean;
  }): { isValid: boolean; sanitized: string; errors: string[] } {
    const errors: string[] = [];
    const maxLength = options?.maxLength || SECURITY_CONFIG.MAX_INPUT_LENGTH;
    const allowHTML = options?.allowHTML || false;
    const required = options?.required || false;
    
    // Check required
    if (required && (!input || input.trim().length === 0)) {
      errors.push('This field is required');
      return { isValid: false, sanitized: '', errors };
    }
    
    // Check length
    if (input.length > maxLength) {
      errors.push(`Input must be ${maxLength} characters or less`);
    }
    
    // Check for dangerous content
    if (XSSPrevention.containsDangerousContent(input)) {
      errors.push('Input contains potentially dangerous content');
    }
    
    // Sanitize based on options
    const sanitized = allowHTML 
      ? XSSPrevention.sanitizeHTML(input)
      : XSSPrevention.sanitizeText(input);
    
    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }
  
  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 320; // RFC 5321 limit
  }
  
  /**
   * Validate file upload
   */
  static validateFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check file size
    if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
      errors.push(`File size must be less than ${SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    
    // Check file type
    if (!SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
      errors.push('File type not allowed. Please use JPEG, PNG, GIF, or WebP');
    }
    
    // Check file name for dangerous characters
    if (/[<>:"/\\|?*]/.test(file.name)) {
      errors.push('File name contains invalid characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// CSRF Protection utilities
export class CSRFProtection {
  private static tokenKey = 'csrf_token';
  
  /**
   * Generate CSRF token
   */
  static generateToken(): string {
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback for SSR
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Store CSRF token
   */
  static storeToken(token: string): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.tokenKey, token);
    }
  }
  
  /**
   * Get stored CSRF token
   */
  static getToken(): string | null {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(this.tokenKey);
    }
    return null;
  }
  
  /**
   * Validate CSRF token
   */
  static validateToken(token: string): boolean {
    const storedToken = this.getToken();
    return storedToken !== null && storedToken === token;
  }
  
  /**
   * Clear CSRF token
   */
  static clearToken(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.tokenKey);
    }
  }
}

// Content Security Policy helpers
export class CSPHelpers {
  /**
   * Generate nonce for inline scripts/styles
   */
  static generateNonce(): string {
    const array = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return btoa(String.fromCharCode(...array));
  }
  
  /**
   * Validate if URL is allowed by CSP
   */
  static isURLAllowed(url: string, allowedDomains: string[]): boolean {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      return allowedDomains.some(allowed => {
        if (allowed.startsWith('*.')) {
          const baseDomain = allowed.slice(2);
          return domain === baseDomain || domain.endsWith('.' + baseDomain);
        }
        return domain === allowed;
      });
    } catch {
      return false;
    }
  }
}

// Secure random utilities
export class SecureRandom {
  /**
   * Generate cryptographically secure random string
   */
  static generateString(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback for SSR
      for (let i = 0; i < length; i++) {
        array[i] = Math.floor(Math.random() * charset.length);
      }
    }
    
    return Array.from(array, byte => charset[byte % charset.length]).join('');
  }
  
  /**
   * Generate secure random ID
   */
  static generateId(): string {
    return this.generateString(16);
  }
}

// Security headers validation
export class SecurityHeaders {
  /**
   * Validate request headers for security
   */
  static validateHeaders(headers: Record<string, string>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for required security headers
    const requiredHeaders = ['x-content-type-options', 'x-frame-options', 'x-xss-protection'];
    
    for (const header of requiredHeaders) {
      if (!headers[header.toLowerCase()]) {
        errors.push(`Missing security header: ${header}`);
      }
    }
    
    // Validate Content-Type
    const contentType = headers['content-type'];
    if (contentType && !contentType.includes('charset=utf-8')) {
      errors.push('Content-Type should include charset=utf-8');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Generate secure headers object
   */
  static generateSecureHeaders(nonce?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    };
    
    if (nonce) {
      headers['Content-Security-Policy'] = this.generateCSP(nonce);
    }
    
    return headers;
  }
  
  /**
   * Generate Content Security Policy
   */
  private static generateCSP(nonce: string): string {
    return [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
      "img-src 'self' data: https:",
      "font-src 'self' https:",
      "connect-src 'self' https:",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ');
  }
}

// Utility functions for common security tasks
export const SecurityUtils = {
  XSSPrevention,
  InputValidator,
  CSRFProtection,
  CSPHelpers,
  SecureRandom,
  SecurityHeaders,
  
  /**
   * Comprehensive input sanitization
   */
  sanitizeUserInput: (input: string, allowHTML: boolean = false): string => {
    return allowHTML 
      ? XSSPrevention.sanitizeHTML(input)
      : XSSPrevention.sanitizeText(input);
  },
  
  /**
   * Validate and sanitize form data
   */
  sanitizeFormData: (data: Record<string, any>): Record<string, any> => {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitized[key] = XSSPrevention.sanitizeText(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? XSSPrevention.sanitizeText(item) : item
        );
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  },
  
  /**
   * Safe JSON parse with error handling
   */
  safeJSONParse: <T>(json: string, fallback: T): T => {
    try {
      const parsed = JSON.parse(json);
      return parsed;
    } catch {
      return fallback;
    }
  },
  
  /**
   * Create secure request options
   */
  createSecureRequestOptions: (options: RequestInit = {}): RequestInit => {
    const nonce = CSPHelpers.generateNonce();
    const secureHeaders = SecurityHeaders.generateSecureHeaders(nonce);
    
    return {
      ...options,
      headers: {
        ...secureHeaders,
        ...options.headers,
      },
    };
  },
};