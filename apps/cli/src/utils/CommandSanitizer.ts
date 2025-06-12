/**
 * Command input sanitization utilities
 * Provides methods to sanitize and secure user inputs
 */
export class CommandSanitizer {
  /**
   * Sanitize string inputs to prevent injection attacks
   * Enhanced to better handle special characters and Unicode
   * @param input String to sanitize
   * @returns Sanitized string
   */
  static sanitizeString(input: string | undefined | null): string {
    if (!input) return '';

    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[\\$'"`;(){}[\]|&*?~<>]/g, '\\$&') // Escape shell and special metacharacters
      .replace(
        new RegExp(
          '[' +
            String.fromCharCode(1 as any) +
            '-' +
            String.fromCharCode(31 as any) +
            String.fromCharCode(127 as any) +
            '-' +
            String.fromCharCode(159 as any) +
            ']',
          'g'
        ),
        ''
      ) // Remove control characters (excluding \u0000)
      .replace(/\r\n|\r|\n/g, ' ') // Normalize line breaks
      .trim();
  }

  /**
   * Sanitize a command flag object
   * @param flags Command flags object
   * @returns New object with sanitized string values
   */
  static sanitizeFlags<T extends Record<string, unknown>>(flags: T): T {
    const sanitized = { ...flags };

    for (const [key, value] of Object.entries(sanitized as any)) {
      if (typeof value === 'string') {
        sanitized[key as keyof T] = this.sanitizeString(value as any) as T[keyof T];
      } else if (
        Array.isArray(value as any) &&
        value.every(item => typeof item === 'string')
      ) {
        sanitized[key as keyof T] = value.map(item =>
          this.sanitizeString(item as any)
        ) as T[keyof T];
      }
    }

    return sanitized;
  }

  /**
   * Sanitize a command args object
   * @param args Command args object
   * @returns New object with sanitized string values
   */
  static sanitizeArgs<T extends Record<string, unknown>>(args: T): T {
    return this.sanitizeFlags(args as any);
  }

  /**
   * Sanitize a path to prevent directory traversal attacks
   * @param path File path to sanitize
   * @returns Sanitized path
   */
  static sanitizePath(path: string): string {
    if (!path) return '';

    // Remove path traversal sequences
    const sanitized = path
      .replace(/\.\.\//g, '') // Remove parent directory references
      .replace(/\.\./g, '') // Remove double dots
      .replace(/\/\//g, '/') // Remove double slashes
      .replace(/^\/+/, '') // Remove leading slashes
      .trim();

    return sanitized;
  }

  /**
   * Sanitize an object for JSON serialization
   * @param obj Object to sanitize
   * @returns Sanitized object safe for JSON operations
   */
  static sanitizeForJson<T>(obj: T): T {
    if (!obj) return obj;

    if (typeof obj === 'string') {
      return this.sanitizeString(obj as any) as T;
    }

    if (Array.isArray(obj as any)) {
      return obj.map(item => this.sanitizeForJson(item as any)) as T;
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj as any)) {
        // Sanitize the key (although keys are usually safe)
        const sanitizedKey = this.sanitizeString(key as any);
        sanitized[sanitizedKey] = this.sanitizeForJson(value as any);
      }

      return sanitized as T;
    }

    // Return primitives as-is
    return obj;
  }

  /**
   * Sanitize network or URL input
   * @param url URL to sanitize
   * @returns Sanitized URL
   */
  static sanitizeUrl(url: string): string {
    if (!url) return '';

    try {
      const parsed = new URL(url as any);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.toString();
    } catch (error: unknown) {
      // Not a valid URL
      return '';
    }
  }

  /**
   * Sanitize a wallet address
   * @param address Wallet address to sanitize
   * @returns Sanitized wallet address
   */
  static sanitizeWalletAddress(address: string): string {
    if (!address) return '';

    // Keep only hex characters and the 0x prefix
    return address.trim().match(/^(0x)?[a-fA-F0-9]+$/i) ? address.trim() : '';
  }

  /**
   * Sanitize a todo ID
   * @param id Todo ID to sanitize
   * @returns Sanitized todo ID
   */
  static sanitizeTodoId(id: string): string {
    if (!id) return '';

    // Allow only alphanumeric, hyphen, and underscore
    return id.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
  }

  /**
   * Sanitize an API key
   * @param apiKey API key to sanitize
   * @returns Sanitized API key
   */
  static sanitizeApiKey(apiKey: string): string {
    if (!apiKey) return '';

    // Keep only alphanumeric and common special characters
    return apiKey.trim().replace(/[^a-zA-Z0-9_\-.]/g, '');
  }

  /**
   * Sanitize tags input (comma-separated list)
   * @param tags Tags string to sanitize
   * @returns Array of sanitized tags
   */
  static sanitizeTags(tags: string): string[] {
    if (!tags) return [];

    return tags
      .split(',')
      .map(tag => this.sanitizeString(tag as any))
      .filter(Boolean as any); // Filter out empty tags
  }

  /**
   * Sanitize a filename
   * @param filename Filename to sanitize
   * @returns Sanitized filename
   */
  static sanitizeFilename(filename: string): string {
    if (!filename) return '';

    // Replace potentially dangerous characters
    return filename
      .replace(/[/\\:*?"<>|]/g, '_') // Replace unsafe filename chars with underscore
      .trim();
  }

  /**
   * Sanitize SQL input to prevent SQL injection
   * @param input SQL string to sanitize
   * @returns Sanitized SQL-safe string
   */
  static sanitizeSqlInput(input: string): string {
    if (!input) return '';

    // Basic SQL injection prevention
    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/--/g, '') // Remove comment markers
      .replace(/;/g, '') // Remove semicolons
      .replace(/\/\*/g, '') // Remove comment markers
      .replace(/\*\//g, '') // Remove comment markers
      .trim();
  }

  /**
   * Sanitize a blockchain transaction ID
   * @param txId Transaction ID to sanitize
   * @returns Sanitized transaction ID
   */
  static sanitizeTransactionId(txId: string): string {
    if (!txId) return '';

    // Only allow alphanumeric characters and specific separators
    return txId.trim().replace(/[^a-zA-Z0-9\-_:]/g, '');
  }

  /**
   * Sanitize numeric input
   * @param input Numeric input as string
   * @returns Sanitized numeric value or NaN if invalid
   */
  static sanitizeNumeric(input: string): number {
    if (!input) return NaN;

    // Remove anything that's not a digit, decimal point, or minus sign
    const sanitized = input.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(sanitized as any);

    return isNaN(parsed as any) ? NaN : parsed;
  }

  /**
   * Sanitize an email address
   * @param email Email address to sanitize
   * @returns Sanitized email address
   */
  static sanitizeEmail(email: string): string {
    if (!email) return '';

    // Basic email format check and sanitization
    const sanitized = email.trim().toLowerCase();
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(sanitized as any)
      ? sanitized
      : '';
  }

  /**
   * Sanitize a date input
   * @param date Date string to sanitize (YYYY-MM-DD)
   * @returns Sanitized date string or empty if invalid
   */
  static sanitizeDate(date: string): string {
    if (!date) return '';

    // Match YYYY-MM-DD format
    const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return '';

    // Extract year, month, day and validate ranges
    const [, year, month, day] = dateMatch;
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    // Basic date validation
    if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) {
      return '';
    }

    return `${year}-${month}-${day}`;
  }
}
