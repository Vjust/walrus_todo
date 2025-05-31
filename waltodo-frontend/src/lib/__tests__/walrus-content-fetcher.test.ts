/**
 * Tests for Walrus Content Fetcher Service
 */

import { renderHook, waitFor } from '@testing-library/react';
import { 
  walrusContentFetcher, 
  useWalrusContent,
  useWalrusPrefetch,
  WalrusContentFetchError,
  ContentType
} from '../walrus-content-fetcher';

// Mock the dependencies
jest.mock('../walrus-url-utils', () => ({
  isValidBlobId: jest.fn((id: string) => id.length === 64),
  extractBlobId: jest.fn((url: string) => {
    if (url.startsWith('walrus://')) {
      return url.slice(9);
    }
    return 'a'.repeat(64);
  }),
  generateHttpUrl: jest.fn((blobId: string, network: string) => {
    return `https://${network}.wal.app/blob/${blobId}`;
  }),
  WalrusUrlError: Error
}));

jest.mock('../config-loader', () => ({
  loadAppConfig: jest.fn().mockResolvedValue({
    network: 'testnet',
    walrus: {
      publisherUrl: 'https://publisher-testnet.walrus.space',
      aggregatorUrl: 'https://aggregator-testnet.walrus.space'
    }
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('WalrusContentFetcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    walrusContentFetcher.clearCache();
  });

  afterAll(() => {
    walrusContentFetcher.destroy();
  });

  describe('fetchJson', () => {
    it('should fetch and parse JSON content', async () => {
      const mockData = { id: 1, title: 'Test Todo' };
      const mockResponse = new Response(JSON.stringify(mockData), {
        headers: { 'content-type': 'application/json' }
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const blobId = 'a'.repeat(64);
      const result = await walrusContentFetcher.fetchJson(blobId);

      expect(result.data).toEqual(mockData);
      expect(result.contentType).toBe('application/json');
      expect(result.cached).toBe(false);
    });

    it('should return cached data on second fetch', async () => {
      const mockData = { id: 1, title: 'Test Todo' };
      const mockResponse = new Response(JSON.stringify(mockData), {
        headers: { 'content-type': 'application/json' }
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const blobId = 'a'.repeat(64);
      
      // First fetch
      await walrusContentFetcher.fetchJson(blobId);
      
      // Second fetch should use cache
      const result = await walrusContentFetcher.fetchJson(blobId);

      expect(result.cached).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const mockData = { id: 1, title: 'Test Todo' };
      
      // First two attempts fail, third succeeds
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockData)));

      const blobId = 'a'.repeat(64);
      const result = await walrusContentFetcher.fetchJson(blobId, {
        maxRetries: 3,
        retryDelay: 10 // Short delay for testing
      });

      expect(result.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const blobId = 'a'.repeat(64);
      
      await expect(
        walrusContentFetcher.fetchJson(blobId, {
          maxRetries: 2,
          retryDelay: 10
        })
      ).rejects.toThrow(WalrusContentFetchError);

      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('fetchBinary', () => {
    it('should fetch binary content with progress', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockResponse = new Response(mockData, {
        headers: { 
          'content-type': 'application/octet-stream',
          'content-length': '5'
        }
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const progressEvents: any[] = [];
      const blobId = 'a'.repeat(64);
      
      const result = await walrusContentFetcher.fetchBinary(blobId, {
        onProgress: (event) => progressEvents.push(event)
      });

      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect(result.size).toBe(5);
      expect(result.contentType).toBe('application/octet-stream');
    });
  });

  describe('fetchImageAsDataUrl', () => {
    it('should fetch image and convert to data URL', async () => {
      const mockImageData = new Uint8Array([137, 80, 78, 71]); // PNG header
      const mockResponse = new Response(mockImageData, {
        headers: { 'content-type': 'image/png' }
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const blobId = 'a'.repeat(64);
      const result = await walrusContentFetcher.fetchImageAsDataUrl(blobId);

      expect(result.data).toMatch(/^data:image\/png;base64,/);
      expect(result.contentType).toBe('image/png');
    });
  });

  describe('prefetch', () => {
    it('should prefetch content into cache', async () => {
      const mockData = { id: 1, title: 'Test Todo' };
      const mockResponse = new Response(JSON.stringify(mockData));
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const blobId = 'a'.repeat(64);
      await walrusContentFetcher.prefetch(blobId, 'json');

      // Verify cache stats
      const stats = walrusContentFetcher.getCacheStats();
      expect(stats.json.size).toBe(1);
    });
  });
});

describe('useWalrusContent hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    walrusContentFetcher.clearCache();
  });

  it('should fetch JSON content', async () => {
    const mockData = { id: 1, title: 'Test Todo' };
    const mockResponse = new Response(JSON.stringify(mockData));
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const blobId = 'a'.repeat(64);
    const { result } = renderHook(() => useWalrusContent(blobId, 'json'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle errors', async () => {
    const mockError = new Error('Network error');
    (global.fetch as jest.Mock).mockRejectedValue(mockError);

    const blobId = 'a'.repeat(64);
    const { result } = renderHook(() => useWalrusContent(blobId, 'json', {
      maxRetries: 0
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.data).toBeNull();
    });
  });

  it('should cancel request on unmount', async () => {
    const mockResponse = new Response('{}');
    let fetchPromiseResolve: any;
    const fetchPromise = new Promise((resolve) => {
      fetchPromiseResolve = resolve;
    });
    
    (global.fetch as jest.Mock).mockReturnValue(fetchPromise);

    const blobId = 'a'.repeat(64);
    const { unmount } = renderHook(() => useWalrusContent(blobId, 'json'));

    // Unmount before fetch completes
    unmount();

    // Resolve the fetch
    fetchPromiseResolve(mockResponse);

    // Should not throw or cause issues
  });

  it('should refetch on demand', async () => {
    const mockData1 = { id: 1, title: 'First' };
    const mockData2 = { id: 2, title: 'Second' };
    
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockData1)))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockData2)));

    const blobId = 'a'.repeat(64);
    const { result } = renderHook(() => useWalrusContent(blobId, 'json', {
      useCache: false // Disable cache for this test
    }));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData1);
    });

    // Refetch
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData2);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('useWalrusPrefetch hook', () => {
  it('should prefetch multiple items', async () => {
    const mockResponses = [
      new Response(JSON.stringify({ id: 1 })),
      new Response('Hello World'),
      new Response(new Uint8Array([1, 2, 3]))
    ];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponses[0])
      .mockResolvedValueOnce(mockResponses[1])
      .mockResolvedValueOnce(mockResponses[2]);

    const { result } = renderHook(() => useWalrusPrefetch());

    await result.current.prefetch([
      { blobIdOrUrl: 'a'.repeat(64), contentType: 'json' },
      { blobIdOrUrl: 'b'.repeat(64), contentType: 'text' },
      { blobIdOrUrl: 'c'.repeat(64), contentType: 'binary' }
    ]);

    const stats = walrusContentFetcher.getCacheStats();
    expect(stats.json.size).toBe(1);
    expect(stats.text.size).toBe(1);
    expect(stats.binary.size).toBe(1);
  });
});