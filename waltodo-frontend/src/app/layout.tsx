import '@/styles/globals.css'
import type { Metadata } from 'next'
import { WalletContextProvider } from '@/lib/walletContext'
import { AppWalletProvider } from '@/contexts/WalletContext'
import { ContextWarning } from '@/components/context-warning'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning'
import { StorageContextWarning } from '@/components/StorageContextWarning'
import { ClientOnly } from '@/components/ClientOnly'

// Using system fonts to avoid network issues with Google Fonts

export const metadata: Metadata = {
  title: 'Walrus Todo - Web3 Task Management',
  description: 'A blockchain-powered todo application with oceanic design',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans wave-animation">
        <ErrorBoundary>
          <WalletContextProvider>
            <AppWalletProvider>
              <ClientOnly>
                <ContextWarning />
              </ClientOnly>
              <ClientOnly>
                <StorageContextWarning />
              </ClientOnly>
              <main className="container mx-auto px-4 py-8">
                {children}
              </main>
              <footer className="mt-auto py-6 text-center text-sm text-ocean-deep dark:text-ocean-foam">
                <p>Powered by Sui Blockchain and Walrus Storage</p>
              </footer>
              <SessionTimeoutWarning />
            </AppWalletProvider>
          </WalletContextProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}