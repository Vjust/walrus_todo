'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { ClientOnly } from '@/components/ClientOnly';
import { WebSocketIndicator } from '@/components/WebSocketStatus';
import { AuthIndicator } from '@/components/AuthStatus';

type NavbarProps = {
  currentPage: string;
};

export default function Navbar({ currentPage }: NavbarProps) {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  return (
    <header className='py-4 mb-8'>
      <nav className='ocean-card flex justify-between items-center'>
        <div className='flex items-center gap-2'>
          <div className='w-10 h-10 rounded-full bg-gradient-to-br from-ocean-light to-dream-teal shadow-dreamy flex items-center justify-center text-lg text-white font-bold'>
            WT
          </div>
          <Link
            href='/'
            className='text-xl font-bold text-ocean-deep dark:text-ocean-foam'
          >
            Walrus Todo
          </Link>
        </div>

        <div className='hidden md:flex items-center space-x-6'>
          <Link
            href='/'
            className={`transition-colors ${
              currentPage === 'home'
                ? 'text-ocean-deep dark:text-ocean-foam font-medium'
                : 'text-ocean-medium dark:text-ocean-light hover:text-ocean-deep dark:hover:text-ocean-foam'
            }`}
          >
            Home
          </Link>
          <Link
            href='/dashboard'
            className={`transition-colors ${
              currentPage === 'dashboard'
                ? 'text-ocean-deep dark:text-ocean-foam font-medium'
                : 'text-ocean-medium dark:text-ocean-light hover:text-ocean-deep dark:hover:text-ocean-foam'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href='/blockchain'
            className={`transition-colors ${
              currentPage === 'blockchain'
                ? 'text-ocean-deep dark:text-ocean-foam font-medium'
                : 'text-ocean-medium dark:text-ocean-light hover:text-ocean-deep dark:hover:text-ocean-foam'
            }`}
          >
            NFT Todos
          </Link>
          <Link
            href='/websocket-demo'
            className={`transition-colors ${
              currentPage === 'websocket-demo'
                ? 'text-ocean-deep dark:text-ocean-foam font-medium'
                : 'text-ocean-medium dark:text-ocean-light hover:text-ocean-deep dark:hover:text-ocean-foam'
            }`}
          >
            WebSocket
          </Link>
        </div>

        <div className='flex items-center space-x-4'>
          <ClientOnly>
            <div className="hidden md:flex items-center space-x-3">
              <WebSocketIndicator />
              <AuthIndicator />
            </div>
          </ClientOnly>
          <ClientOnly fallback={<div className="w-24 h-10 bg-gray-200 animate-pulse rounded"></div>}>
            <WalletConnectButton />
          </ClientOnly>
        </div>
      </nav>
    </header>
  );
}
