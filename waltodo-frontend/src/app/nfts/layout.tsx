import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NFT Gallery | WalTodo',
  description: 'View and manage your Todo NFTs stored on Walrus decentralized storage. Create, organize, and export your on-chain task collection.',
  keywords: 'NFT, Todo, Walrus, Sui, blockchain, decentralized storage, task management',
  openGraph: {
    title: 'NFT Gallery | WalTodo',
    description: 'View and manage your Todo NFTs stored on Walrus decentralized storage',
    type: 'website',
    url: '/nfts',
    images: [
      {
        url: '/images/nft-gallery-og.png',
        width: 1200,
        height: 630,
        alt: 'WalTodo NFT Gallery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NFT Gallery | WalTodo',
    description: 'View and manage your Todo NFTs stored on Walrus decentralized storage',
    images: ['/images/nft-gallery-og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/nfts',
  },
};

export default function NFTLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'WalTodo NFT Gallery',
            description: 'A collection of Todo NFTs stored on Walrus decentralized storage',
            url: 'https://waltodo.app/nfts',
            mainEntity: {
              '@type': 'ItemList',
              name: 'Todo NFT Collection',
              description: 'User-created Todo NFTs with images stored on Walrus',
              itemListElement: [],
            },
            isPartOf: {
              '@type': 'WebApplication',
              name: 'WalTodo',
              description: 'Decentralized todo list application powered by Sui blockchain and Walrus storage',
              applicationCategory: 'ProductivityApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
            },
          }),
        }}
      />
      {children}
    </>
  );
}