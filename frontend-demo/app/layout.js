import '../styles/globals.css'

export const metadata = {
  title: 'Walrus Todo - Oceanic Web3 Experience',
  description: 'A blockchain-powered todo application with oceanic design',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="container">
          {children}
        </main>
        <footer className="footer">
          Powered by Sui Blockchain and Walrus Decentralized Storage
        </footer>
      </body>
    </html>
  )
}