'use client';

import React from 'react';
import { TodoNFTImage } from '@/components/TodoNFTImage';

/**
 * Example usage of the TodoNFTImage component
 * Demonstrates various configurations and use cases
 */
export default function TodoNFTImageUsageExample() {
  // Example Walrus URLs and blob IDs
  const exampleWalrusUrl = 'walrus://1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const exampleHttpUrl = 'https://testnet.wal.app/blob/1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const exampleBlobId = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">TodoNFTImage Component Examples</h1>

      {/* Thumbnail Mode Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Thumbnail Mode</h2>
        <div className="flex gap-4 flex-wrap">
          {/* Basic thumbnail */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Basic Thumbnail</p>
            <TodoNFTImage
              url={exampleWalrusUrl}
              alt="NFT Thumbnail"
              displayMode="thumbnail"
            />
          </div>

          {/* Thumbnail without hover effects */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">No Hover Effects</p>
            <TodoNFTImage
              url={exampleHttpUrl}
              alt="NFT Thumbnail"
              displayMode="thumbnail"
            />
          </div>

          {/* Non-expandable thumbnail */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Non-Expandable</p>
            <TodoNFTImage
              url={exampleBlobId}
              alt="NFT Thumbnail"
              displayMode="thumbnail"
            />
          </div>
        </div>
      </section>

      {/* Preview Mode Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Preview Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Standard preview */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Standard Preview</p>
            <TodoNFTImage
              url={exampleWalrusUrl}
              alt="NFT Preview"
              displayMode="preview"
            />
          </div>

          {/* Preview with custom styling */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Custom Styled Preview</p>
            <TodoNFTImage
              url={exampleHttpUrl}
              alt="Styled NFT Preview"
              displayMode="preview"
              className="shadow-xl border-4 border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Full Mode Example */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Full Mode</h2>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Full Size with Priority Loading</p>
          <TodoNFTImage
            url={exampleWalrusUrl}
            alt="Full Size NFT"
            displayMode="full"
            priority
            quality={100}
          />
        </div>
      </section>

      {/* Loading States */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Loading States</h2>
        <div className="flex gap-4 flex-wrap">
          {/* With skeleton */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">With Loading Skeleton</p>
            <TodoNFTImage
              url={exampleWalrusUrl}
              alt="Loading Example"
              displayMode="thumbnail"
            />
          </div>

          {/* Without skeleton */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Without Loading Skeleton</p>
            <TodoNFTImage
              url={exampleHttpUrl}
              alt="No Skeleton Example"
              displayMode="thumbnail"
            />
          </div>
        </div>
      </section>

      {/* Error States */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Error Handling</h2>
        <div className="flex gap-4 flex-wrap">
          {/* Invalid URL */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Invalid URL</p>
            <TodoNFTImage
              url="invalid-url"
              alt="Error Example"
              displayMode="thumbnail"
            />
          </div>

          {/* With custom fallback */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Custom Fallback Image</p>
            <TodoNFTImage
              url="invalid-url"
              alt="Custom Fallback Example"
              displayMode="thumbnail"
            />
          </div>
        </div>
      </section>

      {/* Interactive Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Interactive Features</h2>
        <div className="flex gap-4 flex-wrap">
          {/* With click handler */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">With Click Handler</p>
            <TodoNFTImage
              url={exampleWalrusUrl}
              alt="Clickable NFT"
              displayMode="thumbnail"
              onClick={() => alert('Image clicked!')}
            />
          </div>

          {/* Lazy loading disabled */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Eager Loading</p>
            <TodoNFTImage
              url={exampleHttpUrl}
              alt="Eager Loaded NFT"
              displayMode="thumbnail"
            />
          </div>
        </div>
      </section>

      {/* Accessibility Example */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Accessibility</h2>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">With Custom ARIA Label</p>
          <TodoNFTImage
            url={exampleWalrusUrl}
            alt="Accessible NFT Image"
            displayMode="preview"
          />
        </div>
      </section>

      {/* Grid Layout Example */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Grid Layout</h2>
        <p className="text-sm text-gray-600">NFT Gallery Grid</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
            <TodoNFTImage
              key={index}
              url={exampleWalrusUrl}
              alt={`NFT ${index}`}
              displayMode="thumbnail"
              className="w-full h-full"
            />
          ))}
        </div>
      </section>

      {/* Code Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Code Examples</h2>
        <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <pre className="text-sm">
            <code>{`// Basic usage
<TodoNFTImage
  url="walrus://blobId123..."
  alt="My NFT"
/>

// With all options
<TodoNFTImage
  url={nftUrl}
  alt="Detailed NFT Description"
  displayMode="preview"
  className="custom-class"
  onClick={handleClick}
  priority={false}
  quality={85}
/>

// Different URL formats supported
<TodoNFTImage url="walrus://blob123..." alt="Walrus URL" />
<TodoNFTImage url="https://testnet.wal.app/blob/123..." alt="HTTP URL" />
<TodoNFTImage url="1234567890abcdef..." alt="Direct Blob ID" />`}</code>
          </pre>
        </div>
      </section>
    </div>
  );
}