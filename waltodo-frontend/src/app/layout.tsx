import '@/styles/globals.css';
import '@/lib/polyfills';
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

/**
 * Root error boundary component for catastrophic failures
 */
function RootErrorFallback() {
  return (
    <html lang='en'>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Application Error
            </h1>
            <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
              Something went wrong. Please refresh the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        {/* Preload critical resources */}
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link rel='dns-prefetch' href='https://fonts.googleapis.com' />
      </head>
      <body 
        className='font-sans min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 antialiased'
        suppressHydrationWarning
      >
        {/* Minimal wrapper to ensure fast initial render */}
        <div id='root' suppressHydrationWarning>
          <ClientProviders>
            {children}
          </ClientProviders>
        </div>
        
        {/* Non-blocking scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent FOUC (Flash of Unstyled Content)
              if (typeof window !== 'undefined') {
                document.documentElement.classList.add('js');
              }
            `,
          }}
        />
      </body>
    </html>
  );
}