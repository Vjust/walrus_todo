'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type NavbarProps = {
  currentPage: string
}

export default function Navbar({ currentPage }: NavbarProps) {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')

  const connectWallet = async () => {
    // Will implement actual wallet connection later
    setWalletAddress('0x123...abc')
    setWalletConnected(true)
    setIsWalletModalOpen(false)
  }

  return (
    <header className="py-4 mb-8">
      <nav className="ocean-card flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ocean-light to-dream-teal shadow-dreamy flex items-center justify-center text-lg text-white font-bold">
            WT
          </div>
          <Link href="/" className="text-xl font-bold text-ocean-deep dark:text-ocean-foam">
            Walrus Todo
          </Link>
        </div>

        <div className="hidden md:flex items-center space-x-6">
          <Link
            href="/"
            className={`transition-colors ${
              currentPage === 'home'
                ? 'text-ocean-deep dark:text-ocean-foam font-medium'
                : 'text-ocean-medium dark:text-ocean-light hover:text-ocean-deep dark:hover:text-ocean-foam'
            }`}
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className={`transition-colors ${
              currentPage === 'dashboard'
                ? 'text-ocean-deep dark:text-ocean-foam font-medium'
                : 'text-ocean-medium dark:text-ocean-light hover:text-ocean-deep dark:hover:text-ocean-foam'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/blockchain"
            className={`transition-colors ${
              currentPage === 'blockchain'
                ? 'text-ocean-deep dark:text-ocean-foam font-medium'
                : 'text-ocean-medium dark:text-ocean-light hover:text-ocean-deep dark:hover:text-ocean-foam'
            }`}
          >
            NFT Todos
          </Link>
        </div>

        <div>
          {walletConnected ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm text-ocean-medium dark:text-ocean-light">{walletAddress}</span>
            </div>
          ) : (
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="ocean-button text-sm py-1.5"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {isWalletModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="ocean-card max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4 text-ocean-deep dark:text-ocean-foam">
              Connect Wallet
            </h2>
            <p className="mb-6 text-ocean-medium dark:text-ocean-light">
              Choose a wallet to connect to Walrus Todo and manage your blockchain-powered tasks.
            </p>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={connectWallet}
                className="w-full ocean-button flex items-center justify-between"
              >
                <span>Sui Wallet</span>
                <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">Recommended</span>
              </button>
              
              <button
                onClick={connectWallet}
                className="w-full ocean-button bg-opacity-70 hover:bg-opacity-100"
              >
                Ethos Wallet
              </button>
              
              <button
                onClick={connectWallet}
                className="w-full ocean-button bg-opacity-70 hover:bg-opacity-100"
              >
                Suiet Wallet
              </button>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="text-ocean-medium dark:text-ocean-light hover:text-ocean-deep dark:hover:text-ocean-foam"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}