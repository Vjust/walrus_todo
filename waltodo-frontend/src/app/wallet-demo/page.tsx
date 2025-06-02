'use client';

import React from 'react';
import WalletConnectButton from '@/components/WalletConnectButton';

export default function WalletDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Wallet Connect Button Showcase</h1>
        
        <div className="space-y-12">
          {/* Variants Section */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Button Variants</h2>
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center space-x-4">
                <WalletConnectButton variant="primary" />
                <span className="text-sm text-gray-600">Primary (Default)</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <WalletConnectButton variant="secondary" />
                <span className="text-sm text-gray-600">Secondary</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <WalletConnectButton variant="outline" />
                <span className="text-sm text-gray-600">Outline</span>
              </div>
            </div>
          </section>

          {/* Sizes Section */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Button Sizes</h2>
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center space-x-4">
                <WalletConnectButton size="sm" />
                <span className="text-sm text-gray-600">Small</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <WalletConnectButton size="md" />
                <span className="text-sm text-gray-600">Medium (Default)</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <WalletConnectButton size="lg" />
                <span className="text-sm text-gray-600">Large</span>
              </div>
            </div>
          </section>

          {/* Custom Styling Section */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Custom Styling</h2>
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center space-x-4">
                <WalletConnectButton className="rounded-full" />
                <span className="text-sm text-gray-600">Rounded Full</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <WalletConnectButton 
                  variant="primary" 
                  className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-500" 
                />
                <span className="text-sm text-gray-600">Custom Colors</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <WalletConnectButton 
                  variant="outline" 
                  size="lg"
                  className="font-bold uppercase tracking-wider" 
                />
                <span className="text-sm text-gray-600">Bold Uppercase</span>
              </div>
            </div>
          </section>

          {/* Integration Examples */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Integration Examples</h2>
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              {/* Navbar Example */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Navbar Integration</h3>
                <div className="bg-gray-900 px-6 py-4 rounded-lg flex justify-between items-center">
                  <div className="text-white font-semibold">WalTodo</div>
                  <WalletConnectButton variant="secondary" size="sm" />
                </div>
              </div>
              
              {/* Card Example */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Card Integration</h3>
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold mb-2">Connect Your Wallet</h4>
                  <p className="text-gray-600 mb-4">Connect your Sui wallet to start managing your todos on the blockchain.</p>
                  <WalletConnectButton variant="primary" className="w-full" />
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Features</h2>
            <div className="bg-white rounded-lg shadow p-6">
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Fully integrated with @mysten/dapp-kit for seamless Sui wallet connections</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Supports multiple wallet providers (Sui Wallet, Martian, etc.)</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Automatic wallet detection with install prompt</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Clean dropdown menu with copy address functionality</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Error handling with toast notifications</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>SSR-safe with proper hydration handling</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Fully accessible with keyboard navigation and focus states</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Customizable with variants, sizes, and className prop</span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}