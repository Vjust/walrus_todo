# NFT Display Guide

A comprehensive guide for displaying and managing Todo NFTs in the WalTodo frontend application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Integration Examples](#integration-examples)
4. [API Endpoints & Hooks](#api-endpoints--hooks)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Performance Optimization](#performance-optimization)
7. [Walrus Integration Details](#walrus-integration-details)
8. [Migration Guide](#migration-guide)
9. [Best Practices](#best-practices)
10. [FAQ](#faq)

## Architecture Overview

The NFT display system in WalTodo is built on a layered architecture that seamlessly integrates with both Sui blockchain and Walrus decentralized storage:

```
┌─────────────────────────────────────────┐
│          React Components               │
│   (TodoNFTCard, TodoNFTGrid, etc.)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│            React Hooks                  │
│  (useSuiTodos, useWalrusStorage, etc.) │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Service Layer                   │
│  (WalrusClient, SuiClient, etc.)       │
└─────────────────┬───────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
┌────────┴────┐    ┌───────┴──────┐
│ Sui Network │    │ Walrus Store │
└─────────────┘    └──────────────┘
```

### Key Design Principles

1. **Lazy Loading**: Images are loaded only when visible in the viewport
2. **Progressive Enhancement**: Basic functionality works without JavaScript
3. **Error Resilience**: Graceful fallbacks for failed image loads
4. **Performance First**: Virtual scrolling for large NFT collections
5. **Accessibility**: Full keyboard navigation and screen reader support

## Core Components

### TodoNFTCard

The primary component for displaying individual Todo NFTs with rich metadata and interactive features.

```tsx
import { TodoNFTCard } from '@/components/TodoNFTCard';

// Basic usage
<TodoNFTCard 
  todo={nftTodo}
  displayMode="gallery"
  onComplete={handleComplete}
  onTransfer={handleTransfer}
/>

// Advanced usage with all props
<TodoNFTCard
  todo={nftTodo}
  displayMode="card"
  variant="default"
  onComplete={async (todoId) => {
    await completeTodo(todoId);
  }}
  onTransfer={async (todoId, recipient) => {
    await transferNFT(todoId, recipient);
  }}
  onClick={(todo) => console.log('Clicked:', todo)}
  showActions={true}
  enableFlip={true}
  className="custom-card-class"
  loading={false}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `todo` | `TodoNFTDisplay` | required | The NFT data to display |
| `displayMode` | `'gallery' \| 'thumbnail' \| 'full'` | `'gallery'` | Display size preset |
| `variant` | `'default' \| 'list'` | `'default'` | Card layout variant |
| `onComplete` | `(todoId: string) => Promise<void>` | - | Completion handler |
| `onTransfer` | `(todoId: string, recipient: string) => Promise<void>` | - | Transfer handler |
| `onClick` | `(todo: TodoNFTDisplay) => void` | - | Click handler |
| `showActions` | `boolean` | `true` | Show action buttons |
| `enableFlip` | `boolean` | `true` | Enable 3D flip animation |
| `loading` | `boolean` | `false` | Loading state |

### TodoNFTGrid

A high-performance virtualized grid for displaying large collections of NFTs.

```tsx
import { TodoNFTGrid } from '@/components/TodoNFTGrid';

// Basic usage
<TodoNFTGrid className="h-screen" />

// The component handles:
// - Infinite scrolling
// - Virtual rendering
// - Search and filtering
// - Sort options
// - View mode switching
```

#### Features

- **Virtual Scrolling**: Renders only visible items for performance
- **Infinite Loading**: Automatically loads more NFTs as you scroll
- **Advanced Filtering**: By status, priority, date range, and tags
- **Multiple View Modes**: Grid and list layouts
- **Real-time Search**: Instant filtering as you type

### TodoNFTImage

Intelligent image component with Walrus integration and lazy loading.

```tsx
import { TodoNFTImage } from '@/components/TodoNFTImage';

// Basic usage
<TodoNFTImage
  url={walrusImageUrl}
  alt="My Todo NFT"
  mode="preview"
/>

// Advanced usage
<TodoNFTImage
  url={walrusImageUrl}
  alt="My Todo NFT"
  mode="full"
  className="rounded-lg shadow-xl"
  onClick={() => console.log('Image clicked')}
  onLoad={() => console.log('Image loaded')}
  onError={(error) => console.error('Load failed:', error)}
  priority={true}
  placeholder="data:image/svg+xml..."
  blurDataURL="data:image/jpeg;base64..."
  quality={90}
  sizes="(max-width: 640px) 100vw, 50vw"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | required | Walrus blob URL or ID |
| `alt` | `string` | required | Alt text for accessibility |
| `displayMode` | `'thumbnail' \| 'preview' \| 'full'` | `'preview'` | Size preset |
| `priority` | `boolean` | `false` | Load immediately |
| `quality` | `number` | `75` | Image quality (1-100) |

### TodoNFTModal

Modal component for detailed NFT viewing with metadata display.

```tsx
import { TodoNFTModal } from '@/components/TodoNFTModal';

<TodoNFTModal
  isOpen={modalOpen}
  onClose={() => setModalOpen(false)}
  todo={selectedNFT}
  onTransfer={handleTransfer}
  onComplete={handleComplete}
/>
```

### TodoNFTFilters

Advanced filtering component for NFT collections.

```tsx
import { TodoNFTFilters } from '@/components/TodoNFTFilters';

<TodoNFTFilters
  onFilterChange={(filters) => {
    console.log('Active filters:', filters);
  }}
  defaultFilters={{
    status: 'all',
    priority: ['high', 'medium', 'low'],
    dateRange: { start: null, end: null }
  }}
/>
```

## Integration Examples

### Basic NFT Display Page

```tsx
import { useState, useEffect } from 'react';
import { useSuiTodos } from '@/hooks/useSuiTodos';
import { TodoNFTGrid } from '@/components/TodoNFTGrid';
import { CreateTodoNFTForm } from '@/components/CreateTodoNFTForm';

export default function NFTGalleryPage() {
  const { todos, loading, error, createTodo } = useSuiTodos();

  if (loading) return <div>Loading NFTs...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">My Todo NFTs</h1>
      
      <CreateTodoNFTForm 
        onSubmit={async (todoData) => {
          await createTodo(todoData);
        }}
      />
      
      <TodoNFTGrid className="mt-8 h-[600px]" />
    </div>
  );
}
```

### NFT Detail Page with Actions

```tsx
import { useRouter } from 'next/router';
import { useSuiTodos } from '@/hooks/useSuiTodos';
import { TodoNFTCard } from '@/components/TodoNFTCard';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function NFTDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { getTodoById, completeTodo, transferTodo } = useSuiTodos();
  
  const todo = getTodoById(id as string);
  
  if (!todo) return <div>NFT not found</div>;
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      <TodoNFTCard
        todo={todo}
        displayMode="full"
        onComplete={async () => {
          await completeTodo(todo.id);
          router.push('/nfts');
        }}
        onTransfer={async (_, recipient) => {
          await transferTodo(todo.id, recipient);
          router.push('/nfts');
        }}
      />
      
      <TransactionHistory 
        objectId={todo.objectId}
        className="mt-8"
      />
    </div>
  );
}
```

### Walrus Image Upload Integration

```tsx
import { useState } from 'react';
import { useWalrusStorage } from '@/hooks/useWalrusStorage';
import { toast } from 'react-hot-toast';

export function ImageUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const { uploadImage, uploading, progress } = useWalrusStorage();
  
  const handleUpload = async () => {
    if (!file) return;
    
    try {
      const result = await uploadImage(file, { epochs: 5 });
      toast.success(`Image uploaded! Blob ID: ${result.blobId}`);
    } catch (error) {
      toast.error('Upload failed');
    }
  };
  
  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {uploading ? `Uploading... ${progress}%` : 'Upload to Walrus'}
      </button>
    </div>
  );
}
```

### Custom NFT List with Batch Actions

```tsx
import { useState } from 'react';
import { useSuiTodos } from '@/hooks/useSuiTodos';
import { TodoNFTListView } from '@/components/TodoNFTListView';

export function BatchActionsExample() {
  const [selected, setSelected] = useState<string[]>([]);
  const { todos, batchComplete, batchTransfer } = useSuiTodos();
  
  const handleBatchComplete = async () => {
    await Promise.all(
      selected.map(id => batchComplete(id))
    );
    setSelected([]);
  };
  
  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          onClick={handleBatchComplete}
          disabled={selected.length === 0}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Complete Selected ({selected.length})
        </button>
      </div>
      
      <TodoNFTListView
        todos={todos}
        selectedIds={selected}
        onSelectionChange={setSelected}
        selectable={true}
      />
    </div>
  );
}
```

## API Endpoints & Hooks

### useSuiTodos Hook

Primary hook for interacting with Todo NFTs on the Sui blockchain.

```typescript
const {
  // Data
  todos,           // Array of Todo NFTs
  loading,         // Loading state
  error,           // Error state
  
  // Actions
  createTodo,      // Create new NFT
  updateTodo,      // Update existing NFT
  completeTodo,    // Mark as complete
  deleteTodo,      // Delete NFT
  transferTodo,    // Transfer ownership
  
  // Utilities
  getTodoById,     // Get single todo
  refreshTodos,    // Refresh list
} = useSuiTodos();
```

### useWalrusStorage Hook

Hook for Walrus storage operations.

```typescript
const {
  // State
  loading,
  uploading,
  downloading,
  progress,
  error,
  
  // Todo Operations
  createTodo,      // Store todo in Walrus
  retrieveTodo,    // Fetch from Walrus
  updateTodo,      // Update in Walrus
  deleteTodo,      // Delete from Walrus
  
  // Batch Operations
  createMultipleTodos,
  
  // Storage Info
  getTodoStorageInfo,
  estimateStorageCosts,
  
  // Utilities
  refreshWalBalance,
  refreshStorageUsage,
} = useWalrusStorage();
```

### useBlockchainEvents Hook

Real-time blockchain event monitoring.

```typescript
const {
  events,          // Recent events
  isConnected,     // WebSocket status
  subscribe,       // Subscribe to events
  unsubscribe,     // Unsubscribe
} = useBlockchainEvents({
  autoConnect: true,
  filters: {
    eventType: 'TodoCreated',
    sender: currentAddress,
  }
});
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Images Not Loading

**Problem**: NFT images show loading skeleton indefinitely

**Solutions**:
```tsx
// Check Walrus URL format
const isValidWalrusUrl = (url: string) => {
  return url.startsWith('walrus://') || 
         url.includes('/v1/') ||
         /^[a-zA-Z0-9_-]{43,}$/.test(url);
};

// Add error handling
<TodoNFTImage
  url={imageUrl}
  alt="NFT"
  onError={(error) => {
    console.error('Image load failed:', error);
    // Fallback to placeholder
  }}
/>

// Enable debug mode
const DEBUG_WALRUS = process.env.NEXT_PUBLIC_DEBUG_WALRUS === 'true';
if (DEBUG_WALRUS) {
  console.log('Walrus URL:', walrusClient.getBlobUrl(blobId));
}
```

#### 2. Wallet Connection Issues

**Problem**: "Wallet not connected" errors

**Solutions**:
```tsx
// Check wallet connection before operations
const { connected, currentAccount } = useWallet();

if (!connected) {
  return <WalletConnectButton />;
}

// Add connection guard
const guardedAction = async () => {
  if (!currentAccount) {
    toast.error('Please connect your wallet first');
    return;
  }
  
  // Proceed with action
};
```

#### 3. Transaction Failures

**Problem**: NFT creation/transfer fails

**Solutions**:
```tsx
// Add retry logic
const retryTransaction = async (fn: () => Promise<any>, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};

// Check gas before transaction
const estimateGas = async (tx: Transaction) => {
  try {
    const dryRun = await suiClient.dryRunTransactionBlock({
      transactionBlock: await tx.build(),
    });
    return dryRun.effects.gasUsed;
  } catch (error) {
    console.error('Gas estimation failed:', error);
  }
};
```

#### 4. Performance Issues

**Problem**: Grid becomes sluggish with many NFTs

**Solutions**:
```tsx
// Ensure virtualization is enabled
<TodoNFTGrid 
  className="h-screen" // Must have fixed height
/>

// Reduce image quality for thumbnails
<TodoNFTImage
  url={url}
  displayMode="thumbnail"
  quality={60} // Lower quality for thumbnails
/>

// Implement pagination
const ITEMS_PER_PAGE = 20;
const paginatedTodos = todos.slice(
  page * ITEMS_PER_PAGE,
  (page + 1) * ITEMS_PER_PAGE
);
```

## Performance Optimization

### 1. Image Optimization

```tsx
// Use responsive images
<TodoNFTImage
  url={walrusUrl}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  quality={85}
/>

// Preload critical images
<link
  rel="preload"
  as="image"
  href={walrusClient.getBlobUrl(featuredNFT.imageId)}
/>

// Use blur placeholders
const blurDataURL = await generateBlurPlaceholder(imageUrl);
<TodoNFTImage
  url={imageUrl}
  placeholder="blur"
  blurDataURL={blurDataURL}
/>
```

### 2. Bundle Size Optimization

```tsx
// Lazy load heavy components
const TodoNFTModal = dynamic(
  () => import('@/components/TodoNFTModal'),
  { 
    loading: () => <div>Loading...</div>,
    ssr: false 
  }
);

// Tree-shake unused features
import { TodoNFTCard } from '@/components/TodoNFTCard';
// Instead of: import * as NFTComponents from '@/components';
```

### 3. Caching Strategies

```tsx
// Implement query caching
const { data: todos } = useQuery({
  queryKey: ['todos', address],
  queryFn: fetchTodos,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});

// Cache Walrus images
const imageCache = new Map<string, string>();

const getCachedImage = async (blobId: string) => {
  if (imageCache.has(blobId)) {
    return imageCache.get(blobId);
  }
  
  const url = walrusClient.getBlobUrl(blobId);
  imageCache.set(blobId, url);
  return url;
};
```

### 4. Batch Operations

```tsx
// Batch multiple operations
const batchCreateTodos = async (todos: CreateTodoInput[]) => {
  const tx = new Transaction();
  
  todos.forEach(todo => {
    tx.moveCall({
      target: `${PACKAGE_ID}::todo_nft::create_todo`,
      arguments: [
        tx.pure(todo.title),
        tx.pure(todo.description),
        // ...
      ],
    });
  });
  
  return signAndExecuteTransaction({ transaction: tx });
};
```

## Walrus Integration Details

### Storage Architecture

```typescript
// Walrus storage structure for Todo NFTs
interface WalrusTodoData {
  // Core todo data
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  
  // Rich content
  imageData?: {
    blobId: string;
    mimeType: string;
    size: number;
  };
  
  // Additional data
  attachments?: Array<{
    name: string;
    blobId: string;
    size: number;
  }>;
}
```

### Upload Process

```tsx
// Complete upload flow
const uploadTodoWithImage = async (
  todo: CreateTodoInput,
  imageFile: File
) => {
  try {
    // 1. Upload image to Walrus
    const imageResult = await walrusClient.uploadImage(imageFile, {
      epochs: 5, // Store for 5 epochs
    });
    
    // 2. Create todo data with image reference
    const todoData: WalrusTodoData = {
      ...todo,
      imageData: {
        blobId: imageResult.blobId,
        mimeType: imageFile.type,
        size: imageFile.size,
      },
    };
    
    // 3. Upload todo data to Walrus
    const todoResult = await walrusClient.uploadJson(todoData, {
      epochs: 5,
    });
    
    // 4. Create NFT on Sui with Walrus references
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::todo_nft::create_todo`,
      arguments: [
        tx.pure(todo.title),
        tx.pure(todo.description),
        tx.pure(todoResult.blobId), // Walrus blob ID
        tx.pure(imageResult.blobId), // Image blob ID
      ],
    });
    
    return signAndExecuteTransaction({ transaction: tx });
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};
```

### Retrieval Process

```tsx
// Efficient retrieval with caching
const retrieveTodoWithImage = async (
  walrusBlobId: string,
  imageBlobId: string
) => {
  // Parallel fetch for better performance
  const [todoData, imageUrl] = await Promise.all([
    walrusClient.downloadJson<WalrusTodoData>(walrusBlobId),
    walrusClient.getBlobUrl(imageBlobId),
  ]);
  
  return {
    ...todoData,
    displayImageUrl: imageUrl,
  };
};
```

### Cost Estimation

```tsx
// Calculate storage costs before upload
const estimateNFTStorageCost = async (
  todo: CreateTodoInput,
  imageFile: File,
  epochs: number = 5
) => {
  const todoSize = new Blob([JSON.stringify(todo)]).size;
  const imageSize = imageFile.size;
  const totalSize = todoSize + imageSize;
  
  const costEstimate = await walrusClient.calculateStorageCost(
    totalSize,
    epochs
  );
  
  return {
    totalSize,
    todoSize,
    imageSize,
    epochs,
    estimatedCost: {
      wal: Number(costEstimate.totalCost) / 1e9,
      usd: (Number(costEstimate.totalCost) / 1e9) * WAL_USD_RATE,
    },
  };
};
```

## Migration Guide

### From Non-NFT to NFT Todos

#### Step 1: Update Data Models

```tsx
// Before: Simple todo
interface LegacyTodo {
  id: string;
  title: string;
  completed: boolean;
}

// After: NFT-enabled todo
interface NFTTodo extends Todo {
  objectId?: string;      // Sui object ID
  imageUrl?: string;      // Walrus image URL
  walrusBlobId?: string;  // Todo data blob ID
  isNFT?: boolean;        // NFT flag
}
```

#### Step 2: Update Components

```tsx
// Before
<div className="todo-item">
  <h3>{todo.title}</h3>
  <button onClick={() => completeTodo(todo.id)}>
    Complete
  </button>
</div>

// After
<TodoNFTCard
  todo={todoToNFTDisplay(todo)}
  onComplete={handleComplete}
  onTransfer={handleTransfer}
  variant={todo.isNFT ? 'default' : 'list'}
/>
```

#### Step 3: Add NFT Creation Flow

```tsx
// Add NFT minting option
const CreateTodoForm = () => {
  const [createAsNFT, setCreateAsNFT] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Existing fields */}
      
      <label>
        <input
          type="checkbox"
          checked={createAsNFT}
          onChange={(e) => setCreateAsNFT(e.target.checked)}
        />
        Create as NFT
      </label>
      
      {createAsNFT && (
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
        />
      )}
    </form>
  );
};
```

#### Step 4: Handle Mixed Collections

```tsx
// Support both NFT and regular todos
const TodoList = () => {
  const { todos } = useTodos();
  
  const nftTodos = todos.filter(todo => todo.isNFT);
  const regularTodos = todos.filter(todo => !todo.isNFT);
  
  return (
    <>
      {nftTodos.length > 0 && (
        <section>
          <h2>NFT Todos</h2>
          <TodoNFTGrid todos={nftTodos} />
        </section>
      )}
      
      {regularTodos.length > 0 && (
        <section>
          <h2>Regular Todos</h2>
          <TodoListView todos={regularTodos} />
        </section>
      )}
    </>
  );
};
```

## Best Practices

### 1. Error Handling

```tsx
// Comprehensive error handling
const NFTOperationWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <div className="error-state">
          <h3>Something went wrong</h3>
          <p>{error.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
};

// Graceful degradation
const SafeTodoNFTImage = ({ url, ...props }: TodoNFTImageProps) => {
  const [failed, setFailed] = useState(false);
  
  if (failed) {
    return <div className="placeholder-image">Image unavailable</div>;
  }
  
  return (
    <TodoNFTImage
      url={url}
      onError={() => setFailed(true)}
      {...props}
    />
  );
};
```

### 2. Accessibility

```tsx
// Ensure keyboard navigation
<TodoNFTCard
  todo={todo}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(todo);
    }
  }}
  tabIndex={0}
  role="article"
  aria-label={`Todo NFT: ${todo.title}`}
/>

// Provide alternative text
<TodoNFTImage
  url={imageUrl}
  alt={`Visual representation of todo: ${todo.title}`}
/>

// Announce dynamic changes
const [announcement, setAnnouncement] = useState('');

<div className="sr-only" aria-live="polite" aria-atomic="true">
  {announcement}
</div>
```

### 3. Security

```tsx
// Validate addresses before transfer
const isValidSuiAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
};

// Sanitize user input
const sanitizeMetadata = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

// Verify ownership before actions
const canModifyTodo = (todo: Todo, currentAddress: string): boolean => {
  return todo.owner === currentAddress;
};
```

### 4. Testing

```tsx
// Component testing
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('TodoNFTCard', () => {
  it('should display NFT information', () => {
    render(<TodoNFTCard todo={mockNFTTodo} />);
    
    expect(screen.getByText(mockNFTTodo.title)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('alt');
  });
  
  it('should handle transfer action', async () => {
    const onTransfer = jest.fn();
    render(
      <TodoNFTCard 
        todo={mockNFTTodo} 
        onTransfer={onTransfer}
      />
    );
    
    await userEvent.click(screen.getByText('Transfer'));
    await userEvent.type(
      screen.getByPlaceholderText('0x...'),
      '0x123...'
    );
    await userEvent.click(screen.getByText('Confirm'));
    
    await waitFor(() => {
      expect(onTransfer).toHaveBeenCalledWith(
        mockNFTTodo.id,
        '0x123...'
      );
    });
  });
});
```

## FAQ

### Q: How do I handle large image files?

A: Implement client-side compression before upload:

```tsx
const compressImage = async (file: File, maxWidth = 1200): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        let { width, height } = img;
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          resolve(new File([blob!], file.name, {
            type: 'image/jpeg',
          }));
        }, 'image/jpeg', 0.85);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
};
```

### Q: Can I display NFTs from other contracts?

A: Yes, by adjusting the structure type filter:

```tsx
const { data: externalNFTs } = await suiClient.getOwnedObjects({
  owner: address,
  filter: {
    StructType: 'OTHER_PACKAGE_ID::module::NFTType',
  },
  options: {
    showContent: true,
    showDisplay: true,
  },
});
```

### Q: How do I implement NFT rarity?

A: Add rarity calculation based on attributes:

```tsx
const calculateRarity = (todo: TodoNFTDisplay): 'common' | 'rare' | 'epic' | 'legendary' => {
  const score = 
    (todo.priority === 'high' ? 3 : 0) +
    (todo.tags?.length > 5 ? 2 : 0) +
    (todo.completedAt ? 1 : 0);
    
  if (score >= 5) return 'legendary';
  if (score >= 3) return 'epic';
  if (score >= 1) return 'rare';
  return 'common';
};
```

### Q: How do I optimize for mobile?

A: Use responsive design and touch-optimized interactions:

```tsx
// Responsive grid
<TodoNFTGrid
  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
/>

// Touch-friendly actions
<TodoNFTCard
  todo={todo}
  className="touch-manipulation" // Better touch handling
  onClick={(todo) => {
    // Use native share on mobile
    if (navigator.share) {
      navigator.share({
        title: todo.title,
        url: `${window.location.origin}/nft/${todo.id}`,
      });
    }
  }}
/>
```

### Q: How do I implement batch minting?

A: Use programmable transactions:

```tsx
const batchMintNFTs = async (todos: CreateTodoInput[]) => {
  const tx = new Transaction();
  
  const results = todos.map(todo => {
    return tx.moveCall({
      target: `${PACKAGE_ID}::todo_nft::create_todo`,
      arguments: [
        tx.pure(todo.title),
        tx.pure(todo.description),
        tx.pure(todo.priority),
      ],
    });
  });
  
  // Transfer all to recipient
  results.forEach(result => {
    tx.transferObjects([result], tx.pure(recipientAddress));
  });
  
  return signAndExecuteTransaction({ transaction: tx });
};
```

### Q: How do I add metadata standards compatibility?

A: Implement standard metadata format:

```tsx
const createStandardMetadata = (todo: Todo): NFTMetadata => {
  return {
    name: todo.title,
    description: todo.description,
    image: todo.imageUrl,
    attributes: [
      { trait_type: 'Status', value: todo.completed ? 'Completed' : 'Active' },
      { trait_type: 'Priority', value: todo.priority },
      { trait_type: 'Category', value: todo.category || 'General' },
    ],
    properties: {
      creators: [{ address: todo.owner, share: 100 }],
      files: todo.imageUrl ? [{ uri: todo.imageUrl, type: 'image' }] : [],
    },
  };
};
```

---

## Support & Resources

- **Documentation**: [WalTodo Docs](https://docs.waltodo.app)
- **GitHub**: [WalTodo Repository](https://github.com/waltodo/frontend)
- **Discord**: [Join our community](https://discord.gg/waltodo)
- **Examples**: [Live demos and code samples](https://examples.waltodo.app)

For additional help or feature requests, please open an issue on GitHub or reach out in our Discord community.