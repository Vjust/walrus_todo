# Walrus Content Fetcher

A robust content fetching service for Walrus blob storage with advanced features including retry logic, caching, progress tracking, and React hooks integration.

## Features

- **Robust Retry Logic**: Exponential backoff with jitter for transient failures
- **LRU Caching**: Separate caches for JSON, text, and binary content
- **Multiple Content Types**: Support for JSON, text, images, and binary data
- **Progress Tracking**: Real-time progress updates for large blob downloads
- **Abort/Cancel Support**: Full cancellation support for React cleanup
- **CORS Handling**: Graceful handling of CORS and network errors
- **React Hooks**: Both Promise-based and hook-based APIs
- **TypeScript**: Full type safety with generic support

## Installation

The service is already included in the project. Import it from the lib directory:

```typescript
import { 
  walrusContentFetcher, 
  useWalrusContent,
  useWalrusPrefetch 
} from '@/lib/walrus-content-fetcher';
```

## Basic Usage

### Promise-based API

```typescript
// Fetch JSON data
const result = await walrusContentFetcher.fetchJson<Todo>(blobId);
console.log(result.data); // Your todo data
console.log(result.cached); // Whether from cache
console.log(result.networkLatency); // Fetch time in ms

// Fetch with options
const result = await walrusContentFetcher.fetchJson<Todo>(blobId, {
  maxRetries: 5,
  timeout: 30000,
  useCache: true,
  cacheTTL: 300000 // 5 minutes
});

// Fetch image as data URL
const imageResult = await walrusContentFetcher.fetchImageAsDataUrl(blobId);
// imageResult.data is a base64 data URL ready for <img src>

// Fetch binary with progress
const binaryResult = await walrusContentFetcher.fetchBinary(blobId, {
  onProgress: (event) => {
    console.log(`Downloaded: ${event.percent}%`);
  }
});
```

### React Hooks API

```typescript
function MyComponent() {
  // Fetch JSON
  const { data, loading, error, refetch } = useWalrusContent<Todo>(
    blobId,
    'json',
    { useCache: true }
  );

  // Fetch image as data URL
  const { data: imageUrl } = useWalrusContent<string>(
    imageBlobId,
    'image-url'
  );

  // With progress tracking
  const { data, progress } = useWalrusContent<ArrayBuffer>(
    blobId,
    'binary'
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{/* Your content */}</div>;
}
```

### Prefetching

```typescript
function MyGallery({ imageIds }: { imageIds: string[] }) {
  const { prefetch } = useWalrusPrefetch();

  // Prefetch all images on mount
  useEffect(() => {
    prefetch(
      imageIds.map(id => ({
        blobIdOrUrl: id,
        contentType: 'binary',
        options: { useCache: true }
      }))
    );
  }, [imageIds]);

  return <div>{/* Gallery content */}</div>;
}
```

## API Reference

### `walrusContentFetcher` Methods

#### `fetchJson<T>(blobIdOrUrl: string, options?: FetchOptions): Promise<FetchResult<T>>`
Fetches and parses JSON content from Walrus.

#### `fetchText(blobIdOrUrl: string, options?: FetchOptions): Promise<FetchResult<string>>`
Fetches text content from Walrus.

#### `fetchBinary(blobIdOrUrl: string, options?: FetchOptions): Promise<FetchResult<ArrayBuffer>>`
Fetches binary content with optional progress tracking.

#### `fetchImageAsDataUrl(blobIdOrUrl: string, options?: FetchOptions): Promise<FetchResult<string>>`
Fetches an image and returns it as a base64 data URL.

#### `fetchImageAsBlob(blobIdOrUrl: string, options?: FetchOptions): Promise<FetchResult<Blob>>`
Fetches an image and returns it as a Blob.

#### `prefetch(blobIdOrUrl: string, contentType: 'json' | 'text' | 'binary', options?: FetchOptions): Promise<void>`
Prefetches content into cache for later use.

#### `clearCache(): void`
Clears all caches.

#### `getCacheStats(): CacheStats`
Returns current cache statistics.

### `FetchOptions`

```typescript
interface FetchOptions {
  network?: WalrusNetwork;        // 'testnet' | 'mainnet'
  contentType?: ContentType;      // Expected content type
  timeout?: number;               // Request timeout in ms
  maxRetries?: number;            // Max retry attempts (default: 3)
  retryDelay?: number;            // Initial retry delay in ms (default: 1000)
  maxRetryDelay?: number;         // Max retry delay in ms (default: 30000)
  useCache?: boolean;             // Whether to use cache (default: true)
  cacheTTL?: number;              // Cache time-to-live in ms
  onProgress?: (progress: ProgressEvent) => void; // Progress callback
  signal?: AbortSignal;           // Abort signal for cancellation
  useWalrusSpace?: boolean;       // Use walrus.space aggregator URL
  headers?: Record<string, string>; // Custom headers
}
```

### React Hooks

#### `useWalrusContent<T>(blobIdOrUrl: string | null, contentType: ContentType, options?: FetchOptions)`
React hook for fetching Walrus content with automatic cleanup and refetch support.

Returns:
- `data: T | null` - The fetched data
- `loading: boolean` - Loading state
- `error: Error | null` - Any error that occurred
- `progress: ProgressEvent | null` - Download progress
- `refetch: () => void` - Manual refetch function

#### `useWalrusPrefetch()`
React hook for prefetching multiple contents.

Returns:
- `prefetch: (items: PrefetchItem[]) => Promise<void>` - Prefetch function

## Error Handling

The service throws `WalrusContentFetchError` with specific error codes:

```typescript
try {
  const result = await walrusContentFetcher.fetchJson(blobId);
} catch (error) {
  if (error instanceof WalrusContentFetchError) {
    switch (error.code) {
      case 'CANCELLED':
        // Request was cancelled
        break;
      case 'HTTP_ERROR':
        // HTTP error (check error.statusCode)
        break;
      case 'MAX_RETRIES':
        // Max retries exceeded
        break;
      case 'FETCH_ERROR':
        // General fetch error
        break;
    }
  }
}
```

## Caching

The service uses three separate LRU caches:
- **JSON Cache**: 100 entries max
- **Text Cache**: 100 entries max  
- **Binary Cache**: 50 entries max (larger size)

Cache entries expire based on the `cacheTTL` option (default: 5 minutes for JSON/text, 10 minutes for binary).

## Performance Tips

1. **Use prefetching** for content you know will be needed soon
2. **Enable caching** for frequently accessed content
3. **Set appropriate timeouts** based on expected content size
4. **Use progress callbacks** for large files to show user feedback
5. **Cancel requests** in React cleanup to prevent memory leaks

## Examples

See `/src/examples/walrus-content-fetcher-usage.tsx` for comprehensive usage examples including:
- Todo viewer with caching
- Image gallery with progress tracking
- Prefetching for performance
- Cancellable operations
- Cache management
- Custom fetch options