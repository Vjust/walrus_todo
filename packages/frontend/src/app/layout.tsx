import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={`${inter.className} wave-animation`}>
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="mt-auto py-6 text-center text-sm text-ocean-deep dark:text-ocean-foam">
          <p>Powered by Sui Blockchain and Walrus Storage</p>
        </footer>
      </body>
    </html>
  )
}