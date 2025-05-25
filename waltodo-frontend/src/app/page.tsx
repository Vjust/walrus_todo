'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/navbar';

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Connection logic will be added later
    setTimeout(() => setIsConnecting(false), 1500);
  };

  return (
    <>
      <Navbar currentPage='home' />
      <div className='flex flex-col items-center justify-center min-h-[80vh] text-center'>
        <div className='floating-element mb-8'>
          <div className='relative w-32 h-32 md:w-48 md:h-48 mx-auto'>
            {/* Replace with your app logo */}
            <div className='w-full h-full rounded-full bg-gradient-to-br from-ocean-light to-dream-teal shadow-dreamy flex items-center justify-center text-4xl md:text-6xl text-white font-bold'>
              WT
            </div>
          </div>
        </div>

        <h1 className='text-4xl md:text-6xl font-bold mb-4 text-ocean-deep dark:text-ocean-foam'>
          <span className='inline-block animate-float'>Walrus</span>{' '}
          <span className='inline-block animate-float animation-delay-300'>
            Todo
          </span>
        </h1>

        <p className='text-xl mb-8 max-w-2xl text-ocean-medium dark:text-ocean-light'>
          A dreamy, oceanic Web3 task management experience powered by Sui
          blockchain and Walrus decentralized storage
        </p>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-12'>
          <div className='ocean-card max-w-sm transform transition-all hover:scale-105'>
            <h2 className='text-2xl font-semibold mb-3 text-ocean-deep dark:text-ocean-foam'>
              Decentralized Tasks
            </h2>
            <p className='text-ocean-medium dark:text-ocean-light mb-4'>
              Store your todos securely on the blockchain as NFTs that can be
              transferred and shared.
            </p>
          </div>

          <div className='ocean-card max-w-sm transform transition-all hover:scale-105'>
            <h2 className='text-2xl font-semibold mb-3 text-ocean-deep dark:text-ocean-foam'>
              AI-Powered
            </h2>
            <p className='text-ocean-medium dark:text-ocean-light mb-4'>
              Get intelligent suggestions, categorization, and prioritization
              for your tasks.
            </p>
          </div>
        </div>

        <button
          className='ocean-button group relative overflow-hidden'
          onClick={handleConnect}
          disabled={isConnecting}
        >
          <span className='relative z-10'>
            {isConnecting ? 'Connecting...' : 'Connect Wallet to Begin'}
          </span>
          <span className='absolute inset-0 bg-gradient-to-r from-dream-teal to-dream-purple opacity-0 group-hover:opacity-30 transition-opacity duration-300'></span>
        </button>

        <div className='mt-12 flex gap-6'>
          <Link
            href='/about'
            className='text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors'
          >
            Learn More
          </Link>
          <Link
            href='/dashboard'
            className='text-ocean-medium hover:text-ocean-deep dark:text-ocean-light dark:hover:text-ocean-foam transition-colors'
          >
            View Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
