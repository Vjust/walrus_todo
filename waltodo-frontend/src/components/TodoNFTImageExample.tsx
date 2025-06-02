'use client';

import React from 'react';
import TodoNFTImage from './TodoNFTImage';

// Example usage of TodoNFTImage component
export function TodoNFTImageExample() {
  // Example Walrus URLs - replace with actual NFT image URLs
  const exampleImages = [
    {
      // walrus:// protocol URL
      url: 'walrus://blobId123456789',
      alt: 'Todo NFT Example 1',
    },
    {
      // HTTP URL from Walrus aggregator
      url: 'https://aggregator-testnet.walrus.site/v1/blobId987654321',
      alt: 'Todo NFT Example 2',
    },
    {
      // Just the blob ID
      url: 'blobId567890123456789012345',
      alt: 'Todo NFT Example 3',
    },
  ];

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold mb-4">Todo NFT Images</h2>
      
      {/* Thumbnail Gallery */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Thumbnail View</h3>
        <div className="flex gap-4 flex-wrap">
          {exampleImages.map((image, index) => (
            <TodoNFTImage
              key={index}
              url={image.url}
              alt={image.alt}
              displayMode="thumbnail"
              className="border-2 border-gray-200 rounded-lg"
            />
          ))}
        </div>
      </section>

      {/* Preview Gallery */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Preview View</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exampleImages.map((image, index) => (
            <TodoNFTImage
              key={index}
              url={image.url}
              alt={image.alt}
              displayMode="preview"
              className="shadow-lg"
              onLoad={() => console.log(`Image ${index + 1} loaded`)}
              onError={(error) => console.error(`Image ${index + 1} error:`, error)}
            />
          ))}
        </div>
      </section>

      {/* Full Width Example */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Full Width View</h3>
        <TodoNFTImage
          url={exampleImages[0].url}
          alt="Full width NFT image"
          displayMode="full"
          className="w-full max-w-4xl mx-auto"
          priority // Load this image immediately
        />
      </section>

      {/* Error State Example */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Error State</h3>
        <TodoNFTImage
          url="invalid-blob-id"
          alt="This will show error state"
          displayMode="preview"
        />
      </section>
    </div>
  );
}

export default TodoNFTImageExample;