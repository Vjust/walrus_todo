# Frontend Error Handling Guide

_Last updated: May 19, 2024_

This guide documents the comprehensive error handling mechanisms implemented in the frontend application to address common browser compatibility issues.

## Overview of Error Classes

The frontend handles four main classes of errors:

1. **Storage Access Failures** - Errors when accessing localStorage in restricted contexts
2. **Redundant Wallet Adapter Registrations** - Warnings from duplicate registration of wallet adapters
3. **Unhandled Wallet Selection Errors** - Errors when no wallet is selected
4. **Clipboard API Support Failures** - Errors in browsers with limited clipboard support

## Storage Access Implementation

### Context Detection

The `storage-utils.ts` module provides robust storage access with fallbacks:

```typescript
// Detect current execution context
export function detectContext(): StorageContext {
  // Check for server-side rendering
  if (typeof window === 'undefined') return 'server';
  
  // Check for extension context
  if (typeof chrome !== 'undefined' && chrome.storage) return 'extension';
  
  // Check for iframe
  if (window.top !== window.self) return 'iframe';
  
  // Check for insecure context
  if (!window.isSecureContext) return 'insecure';
  
  // Check for incognito/private mode
  try {
    localStorage.setItem('__storage_test__', '__storage_test__');
    // ... additional checks
    return 'browser';
  } catch (e) {
    return 'incognito';
  }
}
```

### In-Memory Fallback

When localStorage isn't available, the system automatically falls back to in-memory storage:

```typescript
// Safe getItem with fallback
export function safeGetItem(key: string): string | null {
  try {
    const storage = getStorage();
    
    if (storage === memoryStorage) {
      return memoryStorage[key] || null;
    }
    
    return (storage as Storage).getItem(key);
  } catch (e) {
    console.warn(`Safe storage getItem failed for key "${key}":`, e);
    return null;
  }
}
```

### User Notifications

The `StorageContextWarning` component proactively informs users when their data won't persist:

```jsx
<WarningMessage context={context} usingFallback={usingFallback} />
```

## Wallet Adapter Implementation

### Preventing Duplicate Registration

The wallet adapter initialization now prevents duplicate registration:

```typescript
const [phantomAdapter] = useState(() => {
  // Only create adapter when Phantom is available and not registered
  if (typeof window === 'undefined' || !window.solana?.isPhantom) {
    return null;
  }
  return new PhantomWalletAdapter();
});

// Safe wallets array
const wallets = phantomAdapter ? [phantomAdapter] : [];
```

## Wallet Selection Error Handling

### Custom Error Types

A comprehensive set of wallet error types enhances error handling:

```typescript
export class WalletNotSelectedError extends WalletError {
  constructor() {
    super('No wallet selected. Please select a wallet before connecting.');
    this.name = 'WalletNotSelectedError';
  }
}

export class WalletNotInstalledError extends WalletError {
  walletName: string;
  constructor(walletName: string) {
    super(`${walletName} wallet is not installed.`);
    this.name = 'WalletNotInstalledError';
    this.walletName = walletName;
  }
}
```

### Connect Flow Improvements

The wallet connection flow now has explicit error handling:

```typescript
const handleConnect = useCallback(async (type: WalletType) => {
  if (!type) {
    const error = new WalletNotSelectedError();
    setError(error);
    throw error;
  }
  
  // Additional error checking and handling...
}, []);
```

### User-Friendly Error UI

The `WalletErrorModal` component provides clear guidance when errors occur:

```jsx
<WalletErrorModal 
  error={error instanceof WalletError ? error : null} 
  onDismiss={() => setError(null)} 
/>
```

## Clipboard Support Implementation

### Feature Detection

Comprehensive clipboard capability detection:

```typescript
export function getClipboardCapabilities(): {
  hasModernApi: boolean;
  hasLegacySupport: boolean;
  isSecureContext: boolean;
  canPolyfill: boolean;
} {
  // Check for secure context
  const isSecureContext = window.isSecureContext === true;
  
  // Check for modern clipboard API
  const hasModernApi = 
    typeof navigator !== 'undefined' && 
    navigator.clipboard !== undefined &&
    typeof navigator.clipboard.writeText === 'function';
  
  // Check for legacy support
  const hasLegacySupport = 
    typeof document !== 'undefined' && 
    document.queryCommandSupported && 
    document.queryCommandSupported('copy');
  
  // ...additional checks
}
```

### Multi-Stage Fallbacks

The clipboard implementation tries multiple approaches in sequence:

```typescript
// Try modern API first
if (capabilities.hasModernApi && capabilities.isSecureContext) {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true, method: 'clipboard-api' };
  } catch (error) {
    // Continue to fallbacks...
  }
}

// Try legacy method
if (capabilities.hasLegacySupport) {
  const legacyResult = copyWithExecCommand(text);
  if (legacyResult) {
    return { success: true, method: 'document-execcommand' };
  }
}
```

### Manual Fallback Option

When automatic methods fail, users are offered a manual option:

```typescript
const handleManualCopy = () => {
  const tempInput = document.createElement('textarea');
  tempInput.value = publicKey || '';
  // ...setup tempInput
  
  // Display instructions to user
  alert('Please use keyboard shortcut to copy:\n' + 
        '• Windows/Linux: Press Ctrl+C\n' + 
        '• Mac: Press Command+C');
  
  // ...cleanup
};
```

## Implementation Examples

### Storage Access Example

```jsx
// In todo-service.ts
function loadTodoLists(): void {
  try {
    const storedLists = safeGetItem('walrusTodoLists');
    if (storedLists) {
      const parsed = JSON.parse(storedLists);
      if (parsed && typeof parsed === 'object') {
        todoLists = parsed;
      }
    }
    
    if (isUsingFallbackStorage()) {
      console.info(`Using memory storage in ${detectContext()} context.`);
    }
  } catch (e) {
    console.warn('Failed to load todo lists from storage:', e);
  }
}
```

### Wallet Selection Example

```jsx
// In WalletConnectButton.tsx
const handleWalletSelection = (type: 'sui' | 'phantom') => {
  setWalletSelected(type);
  if (type === 'sui') {
    suiConnect().catch(() => setWalletSelected(null));
  } else {
    phantomConnect().catch(() => setWalletSelected(null));
  }
};

// Button UI with selection state
<button
  onClick={() => handleWalletSelection('sui')}
  disabled={connecting || walletSelected !== null}
  className={`... ${
    walletSelected === 'sui' ? 'bg-green-500' : 'bg-ocean-deep'
  } ...`}
>
  {walletSelected === 'sui' && connecting 
    ? 'Connecting...' 
    : 'Connect Sui Wallet'}
</button>
```

### Clipboard Example

```jsx
// In WalletConnectButton.tsx
const handleCopyAddress = async () => {
  try {
    const result = await copyToClipboard(publicKey);
    
    if (result.success) {
      setCopyStatus('success');
    } else {
      setCopyStatus('error');
      
      // Show modal for ClipboardErrors
      if (result.error instanceof ClipboardError) {
        setClipboardError(result.error);
      }
    }
  } catch (error) {
    // ...error handling
  }
};
```

## Testing & Validation

### Storage Testing

Test for storage access in various contexts:
- Regular browser (localStorage available)
- Incognito mode (localStorage limitations)
- iframes (cross-origin restrictions)
- Server-side rendering (no window object)

### Wallet Testing

Test wallet interactions with:
- No wallet installed
- Multiple wallets installed
- User rejecting connection
- Connection timeout scenarios

### Clipboard Testing

Test clipboard functionality in:
- Modern browsers (clipboard API available)
- Legacy browsers (execCommand fallback)
- Non-secure contexts (HTTP)
- Mobile browsers (varied support)

## Best Practices

1. **Always Use Feature Detection** - Never assume a feature is available
2. **Provide Graceful Degradation** - Have fallbacks for all critical features
3. **Keep Users Informed** - Display clear error messages and suggestions
4. **Maintain Type Safety** - Use TypeScript to catch errors at compile time
5. **Centralize Error Handling** - Use consistent patterns across the application

## Troubleshooting Common Issues

### Storage Issues

- **"Access to storage is not allowed in this context"**
  - Cause: Running in a restricted context (iframe, extension)
  - Solution: Use the in-memory fallback provided by storage-utils.ts

### Wallet Issues

- **"Phantom was registered as a Standard Wallet..."**
  - Cause: Multiple registration of the same wallet adapter
  - Solution: Check if wallet is already registered before creating adapter

- **"WalletNotSelectedError"**
  - Cause: No wallet selected before attempting connection
  - Solution: Pre-select wallet type in the UI and show clear error messages

### Clipboard Issues

- **"Copy to clipboard is not supported in this browser"**
  - Cause: Browser lacks clipboard API and execCommand support
  - Solution: Offer manual copy option with clear instructions

## Future Improvements

- Add metrics tracking for fallback usage
- Implement more sophisticated storage options (IndexedDB)
- Add comprehensive browser compatibility tests
- Create a global error boundary to catch unexpected errors