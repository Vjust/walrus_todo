'use client';

import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

function HomeContent() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Handle share target redirects
    const action = searchParams.get('action');
    const title = searchParams.get('title');
    const url = searchParams.get('url');
    const error = searchParams.get('error');
    
    if (error === 'share-failed') {
      toast.error('Failed to process shared content');
    } else if (action === 'add-task' && title) {
      toast.success(`Shared: ${title}`);
      // Here you would typically open the add task modal with pre-filled data
    }
  }, [searchParams]);
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">Walrus Todo</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/test" className="text-gray-600 hover:text-gray-900">Test</Link>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                Connect Wallet
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
              Walrus Todo
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              A Web3 task management experience powered by Sui blockchain and Walrus decentralized storage
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/test"
                className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Test Page
              </Link>
              <Link 
                href="/dashboard" 
                className="text-sm font-semibold leading-6 text-gray-900"
              >
                Dashboard <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <HomeContent />
    </Suspense>
  );
}
