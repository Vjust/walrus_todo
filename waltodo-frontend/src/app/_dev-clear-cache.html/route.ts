import { NextResponse } from 'next/server';

export async function GET() {
  // Only allow in development
  if (process?.env?.NODE_ENV !== 'development') {
    return new NextResponse('Not Found', { status: 404 });
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Clearing Cache...</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f3f4f6;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg as any); }
      100% { transform: rotate(360deg as any); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Clearing Cache...</h2>
    <p>This window will close automatically.</p>
  </div>
  <script>
    // Clear all caches
    async function clearAllCaches() {
      try {
        // Unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator?.serviceWorker?.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
          console.log('✓ Service workers unregistered');
        }
        
        // Clear caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name as any)));
          console.log('✓ Caches cleared');
        }
        
        // Clear storage
        try {
          localStorage.clear();
          sessionStorage.clear();
          console.log('✓ Storage cleared');
        } catch (e) {
          console.log('⚠ Could not clear storage:', e.message);
        }
        
        // Update UI
        document.querySelector('h2').textContent = '✅ All caches cleared successfully!';
        document.querySelector('p').textContent = 'You can close this window now.';
        document.querySelector('.spinner').style?.display = 'none';
        
        // Try to close window after a delay
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            // Window.close() may not work in all contexts
          }
        }, 1500);
        
      } catch (error) {
        console.error('Error clearing caches:', error);
        document.querySelector('h2').textContent = '❌ Error clearing caches';
        document.querySelector('p').textContent = error.message;
      }
    }
    
    // Start clearing immediately
    clearAllCaches();
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}