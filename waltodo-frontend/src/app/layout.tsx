import '@/styles/globals.css';
import type { Metadata } from 'next';
import ClientOnlyRoot from './ClientOnlyRoot';

export const metadata: Metadata = {
  title: 'Walrus Todo - Web3 Task Management',
  description: 'A blockchain-powered todo application with oceanic design',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <body className='font-sans wave-animation'>
        {/* ClientOnlyRoot handles all client-side components */}
        <ClientOnlyRoot>{children}</ClientOnlyRoot>
      </body>
    </html>
  );
}
