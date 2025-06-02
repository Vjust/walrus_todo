import '@/styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import ClientOnlyRoot from './ClientOnlyRoot';
import ContentDeliveryMonitor from '@/components/ContentDeliveryMonitor';

export const metadata: Metadata = {
  title: 'WalTodo - NFT Task Manager',
  description: 'Decentralized task management with NFT creation on Sui blockchain',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e40af',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='en'>
      <body className='font-sans'>
        <ClientOnlyRoot>
          <div className="min-h-screen bg-gray-50">
            {children}
            <ContentDeliveryMonitor />
          </div>
        </ClientOnlyRoot>
      </body>
    </html>
  );
}