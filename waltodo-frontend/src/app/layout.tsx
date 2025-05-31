import '@/styles/globals.css';
import '@mysten/dapp-kit/dist/index.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'WalTodo - NFT Task Manager',
  description: 'Decentralized task management with NFT creation on Sui blockchain',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WalTodo',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'WalTodo - NFT Task Manager',
    description: 'Decentralized task management with NFT creation on Sui blockchain',
    type: 'website',
    siteName: 'WalTodo',
    images: [
      {
        url: '/screenshots/desktop-home.png',
        width: 1920,
        height: 1080,
        alt: 'WalTodo Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WalTodo - NFT Task Manager',
    description: 'Decentralized task management with NFT creation on Sui blockchain',
    images: ['/screenshots/desktop-home.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0EA5E9' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <meta name="application-name" content="WalTodo" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="WalTodo" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#0EA5E9" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className='font-sans' suppressHydrationWarning>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1E293B',
              color: '#E2E8F0',
              borderRadius: '0.5rem',
              border: '1px solid rgba(148, 163, 184, 0.2)',
            },
          }}
        />
        
        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                  anonymize_ip: true,
                  cookie_flags: 'SameSite=None;Secure'
                });
              `}
            </Script>
          </>
        )}
        
        {/* Performance Monitoring */}
        <Script
          id="web-vitals"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'performance' in window) {
                // Report Web Vitals
                const reportWebVitals = (metric) => {
                  if (window.gtag) {
                    window.gtag('event', metric.name, {
                      event_category: 'Web Vitals',
                      event_label: metric.id,
                      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
                      non_interaction: true,
                    });
                  }
                };
                
                // Import web-vitals library dynamically
                import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
                  getCLS(reportWebVitals);
                  getFID(reportWebVitals);
                  getFCP(reportWebVitals);
                  getLCP(reportWebVitals);
                  getTTFB(reportWebVitals);
                });
              }
            `,
          }}
        />
        
        {/* Error Monitoring */}
        <Script
          id="error-monitoring"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize error monitoring
              window.addEventListener('error', function(event) {
                if (window.captureError) {
                  window.captureError(new Error(event.message), {
                    action: 'window_error',
                    metadata: {
                      filename: event.filename,
                      lineno: event.lineno,
                      colno: event.colno,
                    }
                  });
                }
              });
              
              window.addEventListener('unhandledrejection', function(event) {
                if (window.captureError) {
                  window.captureError(new Error('Unhandled promise rejection: ' + event.reason), {
                    action: 'unhandled_rejection',
                    metadata: { reason: event.reason }
                  });
                }
              });
            `,
          }}
        />
        
        {/* Register Service Worker */}
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js')
                    .then(function(registration) {
                      console.log('ServiceWorker registration successful');
                    })
                    .catch(function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}