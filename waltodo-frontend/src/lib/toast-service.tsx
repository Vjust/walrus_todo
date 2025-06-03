/**
 * Standardized Toast Notification Service
 * Provides consistent toast messaging patterns with theming and accessibility
 */

import { toast, Toast, ToastOptions } from 'react-hot-toast';

// Toast type definitions
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading'
}

export enum ToastPosition {
  TOP_LEFT = 'top-left',
  TOP_CENTER = 'top-center',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_CENTER = 'bottom-center',
  BOTTOM_RIGHT = 'bottom-right'
}

export interface ToastConfig {
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  position?: ToastPosition;
  icon?: string | React.ComponentType;
  dismissible?: boolean;
  persistent?: boolean;
  actions?: ToastAction[];
  className?: string;
  style?: React.CSSProperties;
}

export interface ToastAction {
  label: string;
  action: () => void | Promise<void>;
  style?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export interface ToastTheme {
  success: {
    background: string;
    color: string;
    border: string;
    icon: string;
  };
  error: {
    background: string;
    color: string;
    border: string;
    icon: string;
  };
  warning: {
    background: string;
    color: string;
    border: string;
    icon: string;
  };
  info: {
    background: string;
    color: string;
    border: string;
    icon: string;
  };
  loading: {
    background: string;
    color: string;
    border: string;
    icon: string;
  };
}

// Default theme configuration
const DEFAULT_THEME: ToastTheme = {
  success: {
    background: '#F0FDF4',
    color: '#166534',
    border: '#BBF7D0',
    icon: '✅'
  },
  error: {
    background: '#FEF2F2',
    color: '#991B1B',
    border: '#FCA5A5',
    icon: '❌'
  },
  warning: {
    background: '#FFFBEB',
    color: '#92400E',
    border: '#FDE68A',
    icon: '⚠️'
  },
  info: {
    background: '#EFF6FF',
    color: '#1E40AF',
    border: '#BFDBFE',
    icon: 'ℹ️'
  },
  loading: {
    background: '#F9FAFB',
    color: '#374151',
    border: '#E5E7EB',
    icon: '⏳'
  }
};

/**
 * Toast Service Class
 * Manages consistent toast notifications across the application
 */
export class ToastService {
  private theme: ToastTheme;
  private defaultDuration: Record<ToastType, number>;
  private maxToasts: number;
  private activeToasts: Map<string, Toast>;

  constructor(
    theme: Partial<ToastTheme> = {},
    maxToasts: number = 5
  ) {
    this.theme = { ...DEFAULT_THEME, ...theme };
    this.maxToasts = maxToasts;
    this.activeToasts = new Map();

    // Default durations for different toast types
    this.defaultDuration = {
      [ToastType.SUCCESS]: 4000,
      [ToastType.ERROR]: 6000,
      [ToastType.WARNING]: 5000,
      [ToastType.INFO]: 4000,
      [ToastType.LOADING]: 0 // Loading toasts persist until manually dismissed
    };

    // Configure react-hot-toast defaults
    this.configureDefaults();
  }

  /**
   * Show a success toast
   */
  success(
    message: string,
    options: Partial<Omit<ToastConfig, 'type' | 'message'>> = {}
  ): string {
    return this.show({
      type: ToastType.SUCCESS,
      message,
      ...options
    });
  }

  /**
   * Show an error toast
   */
  error(
    message: string,
    options: Partial<Omit<ToastConfig, 'type' | 'message'>> = {}
  ): string {
    return this.show({
      type: ToastType.ERROR,
      message,
      ...options
    });
  }

  /**
   * Show a warning toast
   */
  warning(
    message: string,
    options: Partial<Omit<ToastConfig, 'type' | 'message'>> = {}
  ): string {
    return this.show({
      type: ToastType.WARNING,
      message,
      ...options
    });
  }

  /**
   * Show an info toast
   */
  info(
    message: string,
    options: Partial<Omit<ToastConfig, 'type' | 'message'>> = {}
  ): string {
    return this.show({
      type: ToastType.INFO,
      message,
      ...options
    });
  }

  /**
   * Show a loading toast
   */
  loading(
    message: string,
    options: Partial<Omit<ToastConfig, 'type' | 'message'>> = {}
  ): string {
    return this.show({
      type: ToastType.LOADING,
      message,
      persistent: true,
      ...options
    });
  }

  /**
   * Show a toast with full configuration
   */
  show(config: ToastConfig): string {
    // Enforce max toasts limit
    if (this.activeToasts.size >= this.maxToasts) {
      const oldestToast = Array.from(this.activeToasts.keys())[0];
      this.dismiss(oldestToast);
    }

    const toastTheme = this.theme[config.type];
    const duration = config.duration ?? this.defaultDuration[config.type];

    const toastOptions: ToastOptions = {
      duration: config.persistent ? Infinity : duration,
      position: config.position || 'top-right',
      style: {
        background: toastTheme.background,
        color: toastTheme.color,
        border: `1px solid ${toastTheme.border}`,
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '14px',
        maxWidth: '400px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        ...config.style
      },
      className: config.className,
      icon: config.icon || toastTheme.icon
    };

    let toastId: string;

    // Create toast content with actions if provided
    if (config.actions && config.actions.length > 0) {
      toastId = toast.custom(
        (t) => this.renderToastWithActions(t, config, toastTheme),
        toastOptions
      );
    } else {
      // Simple toast without actions
      const content = config.title 
        ? this.renderTitleMessage(config.title, config.message)
        : config.message;

      switch (config.type) {
        case ToastType.SUCCESS:
          toastId = toast.success(content, toastOptions);
          break;
        case ToastType.ERROR:
          toastId = toast.error(content, toastOptions);
          break;
        case ToastType.LOADING:
          toastId = toast.loading(content, toastOptions);
          break;
        default:
          toastId = toast(content, toastOptions);
      }
    }

    // Track active toast
    this.activeToasts.set(toastId, { id: toastId } as Toast);

    // Auto-cleanup when toast is dismissed
    setTimeout(() => {
      this.activeToasts.delete(toastId);
    }, duration + 1000);

    return toastId;
  }

  /**
   * Update an existing toast
   */
  update(
    toastId: string,
    config: Partial<ToastConfig>
  ): void {
    if (!this.activeToasts.has(toastId)) {
      console.warn(`Toast with ID ${toastId} not found`);
      return;
    }

    // For loading toasts, we can update to success/error
    if (config.type === ToastType.SUCCESS) {
      toast.success(config.message || 'Success', { id: toastId });
    } else if (config.type === ToastType.ERROR) {
      toast.error(config.message || 'Error', { id: toastId });
    } else {
      // For other updates, dismiss and create new toast
      this.dismiss(toastId);
      this.show(config as ToastConfig);
    }
  }

  /**
   * Dismiss a specific toast
   */
  dismiss(toastId: string): void {
    toast.dismiss(toastId);
    this.activeToasts.delete(toastId);
  }

  /**
   * Dismiss all active toasts
   */
  dismissAll(): void {
    toast.dismiss();
    this.activeToasts.clear();
  }

  /**
   * Show a promise-based toast that updates based on promise state
   */
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    },
    options: Partial<ToastConfig> = {}
  ): Promise<T> {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error
      },
      {
        style: {
          background: this.theme.loading.background,
          color: this.theme.loading.color,
          border: `1px solid ${this.theme.loading.border}`,
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '14px',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          ...options.style
        },
        success: {
          style: {
            background: this.theme.success.background,
            color: this.theme.success.color,
            border: `1px solid ${this.theme.success.border}`
          },
          icon: this.theme.success.icon
        },
        error: {
          style: {
            background: this.theme.error.background,
            color: this.theme.error.color,
            border: `1px solid ${this.theme.error.border}`
          },
          icon: this.theme.error.icon
        }
      }
    );
  }

  /**
   * Render toast content with title and message
   */
  private renderTitleMessage(title: string, message: string): JSX.Element {
    return (
      <div className="flex flex-col">
        <div className="font-semibold text-sm mb-1">{title}</div>
        <div className="text-sm">{message}</div>
      </div>
    );
  }

  /**
   * Render toast with action buttons
   */
  private renderToastWithActions(
    t: Toast,
    config: ToastConfig,
    toastTheme: typeof DEFAULT_THEME.success
  ): JSX.Element {
    return (
      <div
        className={`flex flex-col p-4 rounded-lg border shadow-lg ${config.className || ''}`}
        style={{
          background: toastTheme.background,
          color: toastTheme.color,
          borderColor: toastTheme.border,
          ...config.style
        }}
      >
        {/* Icon and content */}
        <div className="flex items-start space-x-3">
          <span className="text-lg">{config.icon || toastTheme.icon}</span>
          <div className="flex-1">
            {config.title && (
              <div className="font-semibold text-sm mb-1">{config.title}</div>
            )}
            <div className="text-sm">{config.message}</div>
          </div>
          
          {/* Dismiss button */}
          {config.dismissible !== false && (
            <button
              onClick={() => this.dismiss(t.id)}
              className="text-gray-400 hover:text-gray-600 ml-2"
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>

        {/* Action buttons */}
        {config.actions && config.actions.length > 0 && (
          <div className="flex space-x-2 mt-3">
            {config.actions.map((action, index) => (
              <button
                key={index}
                onClick={async () => {
                  try {
                    await action.action();
                    if (!config.persistent) {
                      this.dismiss(t.id);
                    }
                  } catch (error) {
                    console.error('Toast action failed:', error);
                  }
                }}
                className={`text-xs px-3 py-1 rounded transition-colors ${
                  action.style === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : action.style === 'primary'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
                disabled={action.loading}
              >
                {action.loading ? '...' : action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /**
   * Configure react-hot-toast defaults
   */
  private configureDefaults(): void {
    toast.setup({
      // Default position
      position: 'top-right',
      
      // Default toast options
      toastOptions: {
        duration: 4000,
        style: {
          background: '#FFFFFF',
          color: '#374151',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '14px',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }
      }
    });
  }

  /**
   * Get active toast count
   */
  getActiveCount(): number {
    return this.activeToasts.size;
  }

  /**
   * Check if a specific toast is active
   */
  isActive(toastId: string): boolean {
    return this.activeToasts.has(toastId);
  }

  /**
   * Update theme
   */
  updateTheme(theme: Partial<ToastTheme>): void {
    this.theme = { ...this.theme, ...theme };
  }

  /**
   * Get current theme
   */
  getTheme(): ToastTheme {
    return { ...this.theme };
  }
}

// Export singleton instance
export const toastService = new ToastService();

// Export convenience functions for direct usage
export const showSuccess = (message: string, options?: Partial<Omit<ToastConfig, 'type' | 'message'>>) =>
  toastService.success(message, options);

export const showError = (message: string, options?: Partial<Omit<ToastConfig, 'type' | 'message'>>) =>
  toastService.error(message, options);

export const showWarning = (message: string, options?: Partial<Omit<ToastConfig, 'type' | 'message'>>) =>
  toastService.warning(message, options);

export const showInfo = (message: string, options?: Partial<Omit<ToastConfig, 'type' | 'message'>>) =>
  toastService.info(message, options);

export const showLoading = (message: string, options?: Partial<Omit<ToastConfig, 'type' | 'message'>>) =>
  toastService.loading(message, options);

export const dismissToast = (toastId: string) => toastService.dismiss(toastId);

export const dismissAllToasts = () => toastService.dismissAll();