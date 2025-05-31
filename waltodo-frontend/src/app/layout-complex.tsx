import '@/styles/globals.css';
import '@mysten/dapp-kit/dist/index.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import ClientOnlyRoot from './ClientOnlyRoot';
import { HydrationBoundary } from '@/components/HydrationBoundary';

export const metadata: Metadata = {
  title: 'Walrus Todo - Web3 Task Management',
  description: 'A blockchain-powered todo application with oceanic design',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='font-sans wave-animation' suppressHydrationWarning>
        {/* ClientOnlyRoot handles all client-side components */}
        <HydrationBoundary>
          <ClientOnlyRoot>{children}</ClientOnlyRoot>
        </HydrationBoundary>
      </body>
    </html>
  );
}
