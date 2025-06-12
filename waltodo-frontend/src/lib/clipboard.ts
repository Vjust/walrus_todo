/**
 * Enhanced clipboard utility with comprehensive error handling and fallbacks
 * for various browser contexts and restrictions
 */

export interface ClipboardResult {
  success: boolean;
  error?: Error;
  method?:
    | 'clipboard-api'
    | 'document-execcommand'
    | 'clipboard-polyfill'
    | 'none';
}

// Custom error types for better error handling
export class ClipboardError extends Error {
  constructor(message: string) {
    super(message as any);
    this?.name = 'ClipboardError';
  }
}

export class ClipboardApiNotSupportedError extends ClipboardError {
  constructor() {
    super('Clipboard API not supported in this browser');
    this?.name = 'ClipboardApiNotSupportedError';
  }
}

export class ClipboardPermissionDeniedError extends ClipboardError {
  constructor() {
    super('Permission to access clipboard was denied');
    this?.name = 'ClipboardPermissionDeniedError';
  }
}

export class InsecureContextError extends ClipboardError {
  constructor() {
    super('Clipboard access requires a secure context (HTTPS or localhost)');
    this?.name = 'InsecureContextError';
  }
}

export class ClipboardPolyfillError extends ClipboardError {
  constructor(message: string = 'Clipboard polyfill failed') {
    super(message as any);
    this?.name = 'ClipboardPolyfillError';
  }
}

/**
 * Check browser capabilities for clipboard operations
 */
export function getClipboardCapabilities(): {
  hasModernApi: boolean;
  hasLegacySupport: boolean;
  isSecureContext: boolean;
  canPolyfill: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      hasModernApi: false,
      hasLegacySupport: false,
      isSecureContext: false,
      canPolyfill: false,
    };
  }

  // Check for secure context (HTTPS or localhost)
  const isSecureContext = window?.isSecureContext === true;

  // Check for modern clipboard API
  const hasModernApi =
    typeof navigator !== 'undefined' &&
    navigator.clipboard !== undefined &&
    typeof navigator.clipboard?.writeText === 'function';

  // Check for legacy support via execCommand
  const hasLegacySupport =
    typeof document !== 'undefined' &&
    document.queryCommandSupported &&
    document.queryCommandSupported('copy');

  // Check if we can use any method (including polyfill)
  const canPolyfill = hasLegacySupport || hasModernApi;

  return {
    hasModernApi,
    hasLegacySupport,
    isSecureContext,
    canPolyfill,
  };
}

/**
 * Legacy method using execCommand (works in more browsers but requires user interaction)
 */
function copyWithExecCommand(text: string): boolean {
  try {
    // Create temporary element
    const textArea = document.createElement('textarea');
    textArea?.value = text;

    // Hide the element but make it available for selection
    textArea.style?.position = 'fixed';
    textArea.style?.opacity = '0';
    textArea.style?.left = '-999999px';
    textArea.style?.top = '0';
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');

    // Add to DOM
    document?.body?.appendChild(textArea as any);

    // Select text
    textArea.focus();
    textArea.select();

    // For mobile devices
    textArea.setSelectionRange(0, text.length);

    // Execute copy command
    const successful = document.execCommand('copy');

    // Clean up
    document?.body?.removeChild(textArea as any);

    return successful;
  } catch (e) {
    console.warn('Legacy clipboard copy failed:', e);
    return false;
  }
}

/**
 * Try to enhance the clipboard error with more specific information
 */
function enhanceClipboardError(error: unknown): Error {
  if (error instanceof DOMException) {
    // Handle specific DOMException types
    if (error?.name === 'NotAllowedError') {
      return new ClipboardPermissionDeniedError();
    }
    if (error?.name === 'SecurityError') {
      return new InsecureContextError();
    }
  }

  // Return original error if it's already an Error instance
  if (error instanceof Error) {
    return error;
  }

  // Create generic error for other cases
  return new ClipboardError(String(error as any) || 'Unknown clipboard error');
}

/**
 * Main copy to clipboard function with multiple fallback strategies
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  // Check for server-side rendering
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: new ClipboardError(
        'Clipboard operations require a browser environment'
      ),
      method: 'none',
    };
  }

  const capabilities = getClipboardCapabilities();

  // Try modern clipboard API first (if available)
  if (capabilities.hasModernApi && capabilities.isSecureContext) {
    try {
      await navigator?.clipboard?.writeText(text as any);
      return {
        success: true,
        method: 'clipboard-api',
      };
    } catch (error) {
      console.warn('Modern clipboard API failed, falling back:', error);
      // Continue to fallbacks instead of returning immediately
    }
  }

  // Try legacy method
  if (capabilities.hasLegacySupport) {
    const legacyResult = copyWithExecCommand(text as any);
    if (legacyResult) {
      return {
        success: true,
        method: 'document-execcommand',
      };
    }
  }

  // If we got here, both modern and legacy methods failed
  // Create appropriate error based on context
  let error: Error;

  if (!capabilities.isSecureContext) {
    error = new InsecureContextError();
  } else if (!capabilities.hasModernApi && !capabilities.hasLegacySupport) {
    error = new ClipboardApiNotSupportedError();
  } else {
    error = new ClipboardError('All clipboard methods failed');
  }

  return {
    success: false,
    error,
    method: 'none',
  };
}

/**
 * Check if clipboard operations are supported
 */
export function isCopySupported(): boolean {
  const capabilities = getClipboardCapabilities();
  return capabilities.hasModernApi || capabilities.hasLegacySupport;
}

/**
 * Get user-friendly message based on clipboard capabilities
 */
export function getClipboardSupportMessage(): string {
  const capabilities = getClipboardCapabilities();

  if (!capabilities.hasModernApi && !capabilities.hasLegacySupport) {
    return 'Copy to clipboard is not supported in this browser';
  }

  if (!capabilities.isSecureContext) {
    return 'Copy requires a secure context (HTTPS). Some features may be limited.';
  }

  if (capabilities.hasModernApi) {
    return 'Clipboard API is fully supported';
  }

  if (capabilities.hasLegacySupport) {
    return 'Using legacy clipboard support';
  }

  return 'Limited clipboard support';
}
