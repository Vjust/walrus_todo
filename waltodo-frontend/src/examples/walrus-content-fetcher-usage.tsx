/**
 * Example usage of Walrus Content Fetcher Service
 * Demonstrates various use cases and patterns
 */

import React, { useState, useEffect } from 'react';
import { 
  walrusContentFetcher, 
  useWalrusContent, 
  useWalrusPrefetch,
  ContentType,
  FetchOptions 
} from '@/lib/walrus-content-fetcher';
import { Todo } from '@/types/todo';

/**
 * Example 1: Fetching and displaying a Todo from Walrus
 */
export function TodoViewer({ blobId }: { blobId: string }) {
  const { data, loading, error, refetch } = useWalrusContent<Todo>(
    blobId,
    'json',
    {
      useCache: true,
      cacheTTL: 300000, // 5 minutes
      maxRetries: 3
    }
  );

  if (loading) return <div>Loading todo...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No data</div>;

  return (
    <div className="todo-viewer">
      <h3>{data.title}</h3>
      <p>{data.description}</p>
      <p>Status: {data.status}</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}

/**
 * Example 2: Image gallery with progress tracking
 */
export function ImageGallery({ imageIds }: { imageIds: string[] }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="image-gallery">
      <div className="thumbnails">
        {imageIds.map(id => (
          <ImageThumbnail 
            key={id} 
            blobId={id} 
            onClick={() => setSelectedImage(id)}
          />
        ))}
      </div>
      {selectedImage && (
        <ImageViewer blobId={selectedImage} />
      )}
    </div>
  );
}

function ImageThumbnail({ 
  blobId, 
  onClick 
}: { 
  blobId: string; 
  onClick: () => void;
}) {
  const { data, loading, error } = useWalrusContent<string>(
    blobId,
    'image-url',
    {
      useCache: true,
      cacheTTL: 600000 // 10 minutes for images
    }
  );

  if (loading) return <div className="thumbnail-loading">⏳</div>;
  if (error) return <div className="thumbnail-error">❌</div>;

  return (
    <img 
      src={data || ''} 
      alt="Thumbnail"
      className="thumbnail"
      onClick={onClick}
    />
  );
}

function ImageViewer({ blobId }: { blobId: string }) {
  const { data, loading, error, progress } = useWalrusContent<Blob>(
    blobId,
    'image-blob',
    {
      useCache: true,
      timeout: 60000 // 1 minute for large images
    }
  );

  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      const url = URL.createObjectURL(data);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="image-loading">
        <p>Loading image...</p>
        {progress && (
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress.percent}%` }}
            />
            <span>{Math.round(progress.percent)}%</span>
          </div>
        )}
      </div>
    );
  }

  if (error) return <div>Error loading image: {error.message}</div>;
  if (!imageUrl) return null;

  return (
    <img 
      src={imageUrl} 
      alt="Full size"
      className="full-image"
    />
  );
}

/**
 * Example 3: Prefetching for better performance
 */
export function TodoListWithPrefetch({ todoIds }: { todoIds: string[] }) {
  const { prefetch } = useWalrusPrefetch();
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  // Prefetch all todos when component mounts
  useEffect(() => {
    prefetch(
      todoIds.map(id => ({
        blobIdOrUrl: id,
        contentType: 'json',
        options: { useCache: true }
      }))
    );
  }, [todoIds, prefetch]);

  return (
    <div className="todo-list">
      <ul>
        {todoIds.map(id => (
          <li key={id}>
            <button onClick={() => setSelectedTodoId(id)}>
              View Todo {id.slice(0, 8)}...
            </button>
          </li>
        ))}
      </ul>
      {selectedTodoId && <TodoViewer blobId={selectedTodoId} />}
    </div>
  );
}

/**
 * Example 4: Direct API usage with error handling
 */
export async function downloadTodoData(blobId: string): Promise<Todo | null> {
  try {
    const result = await walrusContentFetcher.fetchJson<Todo>(blobId, {
      maxRetries: 5,
      retryDelay: 2000,
      timeout: 30000
    });
    
    console.log(`Downloaded todo in ${result.networkLatency}ms`);
    console.log(`From cache: ${result.cached}`);
    
    return result.data;
  } catch (error: any) {
    if (error.code === 'CANCELLED') {
      console.log('Download was cancelled');
    } else if (error.code === 'MAX_RETRIES') {
      console.error('Failed after maximum retries');
    } else {
      console.error('Download error:', error.message);
    }
    return null;
  }
}

/**
 * Example 5: Cancellable fetch operation
 */
export function CancellableTodoFetcher({ blobId }: { blobId: string }) {
  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  const fetchTodo = async () => {
    const abortController = new AbortController();
    setController(abortController);
    setLoading(true);
    setError(null);

    try {
      const result = await walrusContentFetcher.fetchJson<Todo>(blobId, {
        signal: abortController.signal
      });
      setTodo(result.data);
    } catch (err: any) {
      if (err.code !== 'CANCELLED') {
        setError(err);
      }
    } finally {
      setLoading(false);
      setController(null);
    }
  };

  const cancel = () => {
    controller?.abort();
    setLoading(false);
  };

  return (
    <div className="cancellable-fetcher">
      <button onClick={fetchTodo} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Todo'}
      </button>
      {loading && (
        <button onClick={cancel}>Cancel</button>
      )}
      {error && <div>Error: {error.message}</div>}
      {todo && (
        <div>
          <h3>{todo.title}</h3>
          <p>{todo.description}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 6: Different content types
 */
export function MultiContentTypeExample() {
  const blobId = 'example-blob-id';

  // Fetch as JSON
  const { data: jsonData } = useWalrusContent(blobId, 'json');
  
  // Fetch as text
  const { data: textData } = useWalrusContent(blobId, 'text');
  
  // Fetch as binary
  const { data: binaryData } = useWalrusContent<ArrayBuffer>(blobId, 'binary');

  return (
    <div>
      <h3>Content in different formats:</h3>
      <div>JSON: {JSON.stringify(jsonData)}</div>
      <div>Text: {textData}</div>
      <div>Binary size: {binaryData?.byteLength || 0} bytes</div>
    </div>
  );
}

/**
 * Example 7: Cache management
 */
export function CacheManagement() {
  const [stats, setStats] = useState(walrusContentFetcher.getCacheStats());

  const refreshStats = () => {
    setStats(walrusContentFetcher.getCacheStats());
  };

  const clearCache = () => {
    walrusContentFetcher.clearCache();
    refreshStats();
  };

  return (
    <div className="cache-management">
      <h3>Cache Statistics</h3>
      <ul>
        <li>JSON Cache: {stats.json.size}/{stats.json.maxSize}</li>
        <li>Text Cache: {stats.text.size}/{stats.text.maxSize}</li>
        <li>Binary Cache: {stats.binary.size}/{stats.binary.maxSize}</li>
      </ul>
      <button onClick={refreshStats}>Refresh Stats</button>
      <button onClick={clearCache}>Clear All Caches</button>
    </div>
  );
}

/**
 * Example 8: Custom fetch options
 */
export function CustomFetchExample({ blobId }: { blobId: string }) {
  const customOptions: FetchOptions = {
    network: 'testnet',
    useWalrusSpace: true, // Use aggregator URL
    maxRetries: 5,
    retryDelay: 1000,
    maxRetryDelay: 10000,
    timeout: 45000,
    useCache: true,
    cacheTTL: 600000, // 10 minutes
    headers: {
      'X-Custom-Header': 'value'
    }
  };

  const { data, loading, error } = useWalrusContent<Todo>(
    blobId,
    'json',
    customOptions
  );

  return (
    <div>
      {loading && <p>Loading with custom options...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}