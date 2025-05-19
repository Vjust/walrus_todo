import '../styles/globals.css'
import { WalletProvider } from "@suiet/wallet-kit";

export const metadata = {
  title: 'Walrus Todo - Oceanic Web3 Experience',
  description: 'A blockchain-powered todo application with oceanic design',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <main className="container">
            {children}
          </main>
          <footer className="footer">
            Powered by Sui Blockchain and Walrus Decentralized Storage
          </footer>
        </WalletProvider>
      </body>
    </html>
  )
}