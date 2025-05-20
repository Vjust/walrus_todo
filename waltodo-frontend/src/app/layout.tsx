import '@/styles/globals.css'
import type { Metadata } from 'next'
import { WalletContextProvider } from '@/lib/walletContext'
import { ContextWarning } from '@/components/context-warning'
import { ErrorBoundary } from '@/components/ErrorBoundary'

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
            <ContextWarning />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
            <footer className="mt-auto py-6 text-center text-sm text-ocean-deep dark:text-ocean-foam">
              <p>Powered by Sui Blockchain and Walrus Storage</p>
            </footer>
          </WalletContextProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}