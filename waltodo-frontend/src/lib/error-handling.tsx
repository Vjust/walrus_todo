import toast from 'react-hot-toast';

/**
 * Error handling utilities for consistent error display across the app
 */

export interface ErrorDetails {
  title?: string;
  message: string;
  code?: string;
  duration?: number;
  showRetry?: boolean;
  onRetry?: () => void;
}

/**
 * Show an error notification with consistent styling
 */
export function showError(error: Error | string | ErrorDetails): void {
  let errorDetails: ErrorDetails;

  if (typeof error === 'string') {
    errorDetails = { message: error };
  } else if (error instanceof Error) {
    errorDetails = {
      message: error.message,
      code: (error as any).code,
    };
  } else {
    errorDetails = error;
  }

  // Error details available in errorDetails variable for debugging

  // Show toast notification
  toast.error(
    (t) => (
      <div className="flex flex-col">
        {errorDetails.title && (
          <div className="font-semibold text-sm mb-1">{errorDetails.title}</div>
        )}
        <div className="text-sm">{errorDetails.message}</div>
        {errorDetails.code && (
          <div className="text-xs text-red-400 mt-1">Code: {errorDetails.code}</div>
        )}
        {errorDetails.showRetry && errorDetails.onRetry && (
          <button
            onClick={() => {
              toast.dismiss(t.id);
              errorDetails.onRetry?.();
            }}
            className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
          >
            Retry
          </button>
        )}
      </div>
    ),
    {
      duration: errorDetails.duration || 5000,
      style: {
        background: '#FEF2F2',
        color: '#991B1B',
        border: '1px solid #FCA5A5',
      },
    }
  );
}

/**
 * Show a success notification
 */
export function showSuccess(message: string, options?: { duration?: number; icon?: string }): void {
  toast.success(message, {
    duration: options?.duration || 3000,
    icon: options?.icon,
  });
}

/**
 * Show an info notification
 */
export function showInfo(message: string, options?: { duration?: number; icon?: string }): void {
  toast(message, {
    duration: options?.duration || 4000,
    icon: options?.icon || 'ℹ️',
  });
}

/**
 * Show a loading notification that can be updated
 */
export function showLoading(message: string): string {
  return toast.loading(message);
}

/**
 * Update a loading notification to show success
 */
export function updateToSuccess(toastId: string, message: string): void {
  toast.success(message, { id: toastId });
}

/**
 * Update a loading notification to show error
 */
export function updateToError(toastId: string, message: string): void {
  toast.error(message, { id: toastId });
}

/**
 * Handle async operations with loading state and error handling
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  options: {
    loadingMessage?: string;
    successMessage?: string | ((result: T) => string);
    errorMessage?: string | ((error: Error) => string);
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<T | null> {
  const toastId = options.loadingMessage ? showLoading(options.loadingMessage) : null;

  try {
    const result = await operation();

    if (toastId) {
      const successMsg = typeof options.successMessage === 'function'
        ? options.successMessage(result)
        : options.successMessage || 'Operation completed successfully';
      updateToSuccess(toastId, successMsg);
    } else if (options.successMessage) {
      const successMsg = typeof options.successMessage === 'function'
        ? options.successMessage(result)
        : options.successMessage;
      showSuccess(successMsg);
    }

    options.onSuccess?.(result);
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (toastId) {
      const errorMsg = typeof options.errorMessage === 'function'
        ? options.errorMessage(err)
        : options.errorMessage || err.message;
      updateToError(toastId, errorMsg);
    } else {
      const errorMsg = typeof options.errorMessage === 'function'
        ? options.errorMessage(err)
        : options.errorMessage || err.message;
      showError(errorMsg);
    }

    options.onError?.(err);
    return null;
  }
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: Error): boolean {
  return (
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('fetch') ||
    error.message.toLowerCase().includes('connection') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT')
  );
}

/**
 * Check if an error is a blockchain error
 */
export function isBlockchainError(error: Error): boolean {
  return (
    error.message.toLowerCase().includes('blockchain') ||
    error.message.toLowerCase().includes('transaction') ||
    error.message.toLowerCase().includes('wallet') ||
    error.message.toLowerCase().includes('sui') ||
    error.message.toLowerCase().includes('gas')
  );
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: Error): string {
  // Network errors
  if (isNetworkError(error)) {
    return 'Network connection error. Please check your internet connection and try again.';
  }

  // Blockchain errors
  if (isBlockchainError(error)) {
    if (error.message.includes('insufficient funds') || error.message.includes('gas')) {
      return 'Insufficient funds to complete the transaction. Please add more SUI to your wallet.';
    }
    if (error.message.includes('rejected') || error.message.includes('denied')) {
      return 'Transaction was rejected. Please try again.';
    }
    return 'Blockchain operation failed. Please try again.';
  }

  // Wallet errors
  if (error.message.toLowerCase().includes('not connected')) {
    return 'Wallet is not connected. Please connect your wallet and try again.';
  }

  // Storage errors
  if (error.message.toLowerCase().includes('storage')) {
    return 'Storage operation failed. Please try again.';
  }

  // Default
  return error.message || 'An unexpected error occurred. Please try again.';
}