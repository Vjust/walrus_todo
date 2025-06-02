import '@/styles/globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { ClientProviders } from '@/components/ClientProviders';

export const metadata: Metadata = {
  title: 'TodoNFT - Transform Tasks into Valuable NFTs on Sui',
  description: 'The first decentralized productivity platform where your completed tasks become tradeable digital assets on Sui blockchain, stored permanently on Walrus.',
  keywords: ['TodoNFT', 'Sui blockchain', 'Walrus storage', 'NFT productivity', 'Web3 tasks', 'decentralized todo'],
  authors: [{ name: 'TodoNFT Team' }],
  creator: 'TodoNFT',
  publisher: 'TodoNFT',
  metadataBase: new URL('https://todonft.walrus.site'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'TodoNFT - Transform Tasks into Valuable NFTs',
    description: 'Create, trade, and own your productivity achievements as NFTs on Sui blockchain with permanent Walrus storage.',
    url: 'https://todonft.walrus.site',
    siteName: 'TodoNFT',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TodoNFT - Productivity meets Web3',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TodoNFT - Transform Tasks into Valuable NFTs',
    description: 'The future of productivity on Sui blockchain',
    creator: '@todonft',
    images: ['/og-image.png'],
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
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='en'>
      <body className='font-sans min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 antialiased'>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}