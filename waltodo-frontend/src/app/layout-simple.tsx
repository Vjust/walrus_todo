import '@/styles/globals.css';
import '@mysten/dapp-kit/dist/index.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { SuiWalletProvider } from '@/providers/SuiWalletProvider';
import { WalletContext } from '@/contexts/WalletContext';

export const metadata: Metadata = {
  title: 'Walrus Todo - Web3 Task Management',
  description: 'A blockchain-powered todo application with oceanic design',
};

/**
 * Simple Layout Example using SuiWalletProvider
 * 
 * This is a cleaner alternative to the current layout that shows
 * how to integrate the Sui wallet provider directly.
 * 
 * To use this layout instead of the default:
 * 1. Rename this file to layout.tsx (backup the current one first)
 * 2. The SuiWalletProvider handles all the wallet connection logic
 */
export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='font-sans' suppressHydrationWarning>
        <div className="min-h-screen bg-gray-50">
          <SuiWalletProvider defaultNetwork="testnet" autoConnect>
            {children}
          </SuiWalletProvider>
        </div>
      </body>
    </html>
  );
}