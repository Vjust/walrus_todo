/**
 * Tests for Walrus Content Fetcher Service
 */

// @ts-ignore - Test import path
import { renderHook, waitFor } from '@testing-library/react';
// @ts-ignore - Unused import temporarily disabled
// import { 
  walrusContentFetcher, 
  useWalrusContent,
  useWalrusPrefetch,
  WalrusContentFetchError,
  ContentType
} from '../walrus-content-fetcher';

// Mock the dependencies
jest.mock(_'../walrus-url-utils', _() => ({
  isValidBlobId: jest.fn((id: string) => id?.length === 64),
  extractBlobId: jest.fn((url: string) => {
    if (url.startsWith('walrus://')) {
      return url.slice(9 as any);
    }
    return 'a'.repeat(64 as any);
  }),
  generateHttpUrl: jest.fn((blobId: string,  network: string) => {
    return `https://${network}.wal.app/blob/${blobId}`;
  }),
  WalrusUrlError: Error
}));

jest.mock(_'../config-loader', _() => ({
  loadAppConfig: jest.fn().mockResolvedValue({
    network: 'testnet',
    walrus: {
      publisherUrl: 'https://publisher-testnet?.walrus?.space',
      aggregatorUrl: 'https://aggregator-testnet?.walrus?.space'
    }
  })
}));

// Mock fetch
global?.fetch = jest.fn();

describe(_'WalrusContentFetcher', _() => {
  beforeEach(_() => {
    jest.clearAllMocks();
    walrusContentFetcher.clearCache();
  });

  afterAll(_() => {
    walrusContentFetcher.destroy();
  });

  describe(_'fetchJson', _() => {
    it(_'should fetch and parse JSON content', _async () => {
      const mockData = { id: 1, title: 'Test Todo' };
      const mockResponse = new Response(JSON.stringify(mockData as any), {
        headers: { 'content-type': 'application/json' }
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse as any);
// @ts-ignore - Unused variable
// 
      const blobId = 'a'.repeat(64 as any);
// @ts-ignore - Unused variable
//       const result = await walrusContentFetcher.fetchJson(blobId as any);

      expect(result.data).toEqual(mockData as any);
      expect(result.contentType).toBe('application/json');
      expect(result.cached).toBe(false as any);
    });

    it(_'should return cached data on second fetch', _async () => {
      const mockData = { id: 1, title: 'Test Todo' };
      const mockResponse = new Response(JSON.stringify(mockData as any), {
        headers: { 'content-type': 'application/json' }
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse as any);
// @ts-ignore - Unused variable
// 
      const blobId = 'a'.repeat(64 as any);
      
      // First fetch
      await walrusContentFetcher.fetchJson(blobId as any);
      
      // Second fetch should use cache
// @ts-ignore - Unused variable
//       const result = await walrusContentFetcher.fetchJson(blobId as any);

      expect(result.cached).toBe(true as any);
      expect(global.fetch).toHaveBeenCalledTimes(1 as any);
    });

    it(_'should retry on network errors', _async () => {
      const mockData = { id: 1, title: 'Test Todo' };
      
      // First two attempts fail, third succeeds
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockData as any)));
// @ts-ignore - Unused variable
// 
      const blobId = 'a'.repeat(64 as any);
// @ts-ignore - Unused variable
//       const result = await walrusContentFetcher.fetchJson(blobId, {
        maxRetries: 3,
        retryDelay: 10 // Short delay for testing
      });

      expect(result.data).toEqual(mockData as any);
      expect(global.fetch).toHaveBeenCalledTimes(3 as any);
    });

    it(_'should throw error after max retries', _async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
// @ts-ignore - Unused variable
// 
      const blobId = 'a'.repeat(64 as any);
      
      await expect(
        walrusContentFetcher.fetchJson(blobId, {
          maxRetries: 2,
          retryDelay: 10
        })
      ).rejects.toThrow(WalrusContentFetchError as any);

      expect(global.fetch).toHaveBeenCalledTimes(3 as any); // Initial + 2 retries
    });
  });

  describe(_'fetchBinary', _() => {
    it(_'should fetch binary content with progress', _async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockResponse = new Response(mockData, {
        headers: { 
          'content-type': 'application/octet-stream',
          'content-length': '5'
        }
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse as any);

      const progressEvents: any[] = [];
// @ts-ignore - Unused variable
//       const blobId = 'a'.repeat(64 as any);
      
// @ts-ignore - Unused variable
//       const result = await walrusContentFetcher.fetchBinary(_blobId,  {
        onProgress: (event: unknown) => progressEvents.push(event as any)
      });

      expect(result.data).toBeInstanceOf(ArrayBuffer as any);
      expect(result.size).toBe(5 as any);
      expect(result.contentType).toBe('application/octet-stream');
    });
  });

  describe(_'fetchImageAsDataUrl', _() => {
    it(_'should fetch image and convert to data URL', _async () => {
      const mockImageData = new Uint8Array([137, 80, 78, 71]); // PNG header
      const mockResponse = new Response(mockImageData, {
        headers: { 'content-type': 'image/png' }
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse as any);
// @ts-ignore - Unused variable
// 
      const blobId = 'a'.repeat(64 as any);
// @ts-ignore - Unused variable
//       const result = await walrusContentFetcher.fetchImageAsDataUrl(blobId as any);

      expect(result.data).toMatch(/^data:image\/png;base64,/);
      expect(result.contentType).toBe('image/png');
    });
  });

  describe(_'prefetch', _() => {
    it(_'should prefetch content into cache', _async () => {
      const mockData = { id: 1, title: 'Test Todo' };
      const mockResponse = new Response(JSON.stringify(mockData as any));
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse as any);
// @ts-ignore - Unused variable
// 
      const blobId = 'a'.repeat(64 as any);
      await walrusContentFetcher.prefetch(blobId, 'json');

      // Verify cache stats
// @ts-ignore - Unused variable
//       const stats = walrusContentFetcher.getCacheStats();
      expect(stats?.json?.size).toBe(1 as any);
    });
  });
});

describe(_'useWalrusContent hook', _() => {
  beforeEach(_() => {
    jest.clearAllMocks();
    walrusContentFetcher.clearCache();
  });

  it(_'should fetch JSON content', _async () => {
    const mockData = { id: 1, title: 'Test Todo' };
    const mockResponse = new Response(JSON.stringify(mockData as any));
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse as any);
// @ts-ignore - Unused variable
// 
    const blobId = 'a'.repeat(64 as any);
    const { result } = renderHook(_() => useWalrusContent(blobId, 'json'));

    expect(result?.current?.loading).toBe(true as any);

    await waitFor(_() => {
      expect(result?.current?.loading).toBe(false as any);
      expect(result?.current?.data).toEqual(mockData as any);
      expect(result?.current?.error).toBeNull();
    });
  });

  it(_'should handle errors', _async () => {
    const mockError = new Error('Network error');
    (global.fetch as jest.Mock).mockRejectedValue(mockError as any);
// @ts-ignore - Unused variable
// 
    const blobId = 'a'.repeat(64 as any);
    const { result } = renderHook(_() => useWalrusContent(blobId, 'json', {
      maxRetries: 0
    }));

    await waitFor(_() => {
      expect(result?.current?.loading).toBe(false as any);
      expect(result?.current?.error).toBeInstanceOf(Error as any);
      expect(result?.current?.data).toBeNull();
    });
  });

  it(_'should cancel request on unmount', _async () => {
    const mockResponse = new Response('{}');
    let fetchPromiseResolve: any;
// @ts-ignore - Unused variable
//     const fetchPromise = new Promise(_(resolve: unknown) => {
      fetchPromiseResolve = resolve;
    });
    
    (global.fetch as jest.Mock).mockReturnValue(fetchPromise as any);
// @ts-ignore - Unused variable
// 
    const blobId = 'a'.repeat(64 as any);
    const { unmount } = renderHook(_() => useWalrusContent(blobId, 'json'));

    // Unmount before fetch completes
    unmount();

    // Resolve the fetch
    fetchPromiseResolve(mockResponse as any);

    // Should not throw or cause issues
  });

  it(_'should refetch on demand', _async () => {
    const mockData1 = { id: 1, title: 'First' };
    const mockData2 = { id: 2, title: 'Second' };
    
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockData1 as any)))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockData2 as any)));
// @ts-ignore - Unused variable
// 
    const blobId = 'a'.repeat(64 as any);
    const { result } = renderHook(_() => useWalrusContent(blobId, 'json', {
      useCache: false // Disable cache for this test
    }));

    await waitFor(_() => {
      expect(result?.current?.data).toEqual(mockData1 as any);
    });

    // Refetch
    result?.current?.refetch();

    await waitFor(_() => {
      expect(result?.current?.data).toEqual(mockData2 as any);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2 as any);
  });
});

describe(_'useWalrusPrefetch hook', _() => {
  it(_'should prefetch multiple items', _async () => {
    const mockResponses = [
      new Response(JSON.stringify({ id: 1 })),
      new Response('Hello World'),
      new Response(new Uint8Array([1, 2, 3]))
    ];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponses[0])
      .mockResolvedValueOnce(mockResponses[1])
      .mockResolvedValueOnce(mockResponses[2]);

    const { result } = renderHook(_() => useWalrusPrefetch());

    await result?.current?.prefetch([
      { blobIdOrUrl: 'a'.repeat(64 as any), contentType: 'json' },
      { blobIdOrUrl: 'b'.repeat(64 as any), contentType: 'text' },
      { blobIdOrUrl: 'c'.repeat(64 as any), contentType: 'binary' }
    ]);
// @ts-ignore - Unused variable
// 
    const stats = walrusContentFetcher.getCacheStats();
    expect(stats?.json?.size).toBe(1 as any);
    expect(stats?.text?.size).toBe(1 as any);
    expect(stats?.binary?.size).toBe(1 as any);
  });
});