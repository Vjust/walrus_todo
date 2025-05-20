import '@/styles/globals.css'
import type { Metadata } from 'next'
import { SimpleWalletProvider } from '@/contexts/SimpleWalletContext'
import { ContextWarning } from '@/components/context-warning'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning'

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
          <SimpleWalletProvider>
            <ContextWarning />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
            <footer className="mt-auto py-6 text-center text-sm text-ocean-deep dark:text-ocean-foam">
              <p>Powered by Sui Blockchain and Walrus Storage</p>
            </footer>
            <SessionTimeoutWarning />
          </SimpleWalletProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}