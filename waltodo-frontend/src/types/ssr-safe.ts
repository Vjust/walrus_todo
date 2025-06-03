/**
 * TypeScript types for SSR-safe patterns
 * These types ensure type safety when working with browser APIs and SSR compatibility
 */

// Browser API types with fallbacks
export interface SafeBrowserAPI {
  window?: Window & typeof globalThis;
  document?: Document;
  navigator?: Navigator;
  localStorage?: Storage;
  sessionStorage?: Storage;
  performance?: Performance;
  location?: Location;
}

// Mounting state types
export type MountingState = 'server' | 'mounting' | 'mounted';

// SSR-safe props interface
export interface SSRSafeProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

// NoSSR component props
export interface NoSSRProps extends SSRSafeProps {
  defer?: boolean;
}

// Conditional render props
export interface ConditionalRenderProps extends SSRSafeProps {
  condition: () => boolean;
  serverFallback?: React.ReactNode;
}

// Safe browser API props
export interface SafeBrowserAPIProps {
  onMount?: () => void;
  onUnmount?: () => void;
}

// Hook return types
export interface SafeBrowserAPIResult<T> {
  data: T;
  isLoaded: boolean;
  error: Error | null;
}

export interface SafeStorageResult<T> {
  value: T;
  setValue: (value: T) => void;
  isLoaded: boolean;
  error: Error | null;
}

export interface SafeWindowSizeResult {
  width: number;
  height: number;
  isLoaded: boolean;
}

export interface SafeMediaQueryResult {
  matches: boolean;
  isLoaded: boolean;
}

// Feature detection types
export interface FeatureDetectionResult {
  hasFeature: boolean;
  isLoaded: boolean;
}

// Safe API call types
export type SafeAPICall<T> = () => T;
export type SafeAPICallAsync<T> = () => Promise<T>;

// Storage types
export interface SafeStorageConfig {
  key: string;
  defaultValue: any;
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
}

// Component wrapper types
export interface SSRSafeWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
}

// HOC types
export type WithSSRSafetyOptions = {
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  error?: React.ReactNode;
};

export type WithSSRSafety = <P extends object>(
  Component: React.ComponentType<P>,
  options?: WithSSRSafetyOptions
) => React.ComponentType<P>;

// Event handler types
export interface SafeEventHandlers {
  onClick?: (event: React.MouseEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
}

// Media query types
export type MediaQueryString = 
  | '(min-width: 640px)'  // sm
  | '(min-width: 768px)'  // md
  | '(min-width: 1024px)' // lg
  | '(min-width: 1280px)' // xl
  | '(min-width: 1536px)' // 2xl
  | '(prefers-color-scheme: dark)'
  | '(prefers-reduced-motion: reduce)'
  | string;

// Validation types
export interface ValidationRule<T> {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: T) => boolean | string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Error boundary types
export interface SSRSafeErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

export interface SSRSafeErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: SSRSafeErrorInfo;
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingStateResult<T> {
  state: LoadingState;
  data?: T;
  error?: Error;
}

// Animation types for SSR-safe motion
export interface SSRSafeMotionProps {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  enableAnimation?: boolean;
}

// Clipboard types
export interface ClipboardResult {
  copy: (text: string) => Promise<boolean>;
  isSupported: boolean;
}

// Share API types
export interface ShareResult {
  share: (data: ShareData) => Promise<boolean>;
  isSupported: boolean;
}

// Geolocation types
export interface GeolocationResult {
  position?: GeolocationPosition;
  error?: GeolocationPositionError;
  isLoading: boolean;
  isSupported: boolean;
}

// Network types
export interface NetworkResult {
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  isSupported: boolean;
}

// Battery API types
export interface BatteryResult {
  level?: number;
  charging?: boolean;
  chargingTime?: number;
  dischargingTime?: number;
  isSupported: boolean;
}

// Device orientation types
export interface DeviceOrientationResult {
  alpha?: number;
  beta?: number;
  gamma?: number;
  absolute?: boolean;
  isSupported: boolean;
}

// Intersection Observer types
export interface IntersectionObserverResult {
  isIntersecting: boolean;
  intersectionRatio: number;
  isSupported: boolean;
}

// Resize Observer types
export interface ResizeObserverResult {
  width: number;
  height: number;
  isSupported: boolean;
}

// Mutation Observer types
export interface MutationObserverResult {
  mutations: MutationRecord[];
  isSupported: boolean;
}

// Performance Observer types
export interface PerformanceObserverResult {
  entries: PerformanceEntry[];
  isSupported: boolean;
}

// Web Workers types
export interface WebWorkerResult {
  worker?: Worker;
  isSupported: boolean;
  postMessage: (message: any) => void;
  terminate: () => void;
}

// Service Worker types
export interface ServiceWorkerResult {
  registration?: ServiceWorkerRegistration;
  isSupported: boolean;
  isInstalled: boolean;
  update: () => Promise<void>;
}

// Notification types
export interface NotificationResult {
  show: (title: string, options?: NotificationOptions) => Promise<boolean>;
  permission: NotificationPermission;
  isSupported: boolean;
}

// WebRTC types
export interface WebRTCResult {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  isSupported: boolean;
}

// Payment Request types
export interface PaymentRequestResult {
  canMakePayment: boolean;
  isSupported: boolean;
  show: (methodData: PaymentMethodData[], details: PaymentDetailsInit) => Promise<PaymentResponse>;
}

// Credential Management types
export interface CredentialResult {
  create: (options: CredentialCreationOptions) => Promise<Credential | null>;
  get: (options?: CredentialRequestOptions) => Promise<Credential | null>;
  isSupported: boolean;
}

// Web Assembly types
export interface WebAssemblyResult {
  compile: (bytes: BufferSource) => Promise<WebAssembly.Module>;
  instantiate: (module: WebAssembly.Module, imports?: WebAssembly.Imports) => Promise<WebAssembly.Instance>;
  isSupported: boolean;
}

// IndexedDB types
export interface IndexedDBResult {
  open: (name: string, version?: number) => Promise<IDBDatabase>;
  deleteDatabase: (name: string) => Promise<void>;
  isSupported: boolean;
}

// Cache API types
export interface CacheAPIResult {
  open: (cacheName: string) => Promise<Cache>;
  delete: (cacheName: string) => Promise<boolean>;
  keys: () => Promise<string[]>;
  isSupported: boolean;
}

// Broadcast Channel types
export interface BroadcastChannelResult {
  postMessage: (message: any) => void;
  close: () => void;
  isSupported: boolean;
}

// Screen types
export interface ScreenResult {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelDepth: number;
  orientation?: ScreenOrientation;
  isSupported: boolean;
}

// File System Access types
export interface FileSystemResult {
  showOpenFilePicker: (options?: any) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker: (options?: any) => Promise<FileSystemFileHandle>;
  showDirectoryPicker: (options?: any) => Promise<FileSystemDirectoryHandle>;
  isSupported: boolean;
}

// Eye Dropper types
export interface EyeDropperResult {
  open: () => Promise<{ sRGBHex: string }>;
  isSupported: boolean;
}

// All types are already exported above as individual exports