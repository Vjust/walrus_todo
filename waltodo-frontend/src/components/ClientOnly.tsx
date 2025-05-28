'use client';

import { useState, useEffect, ReactNode } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that only renders its children on the client, never during SSR
 * This prevents hydration errors for components that use browser-only APIs
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  // State to track if we're mounted on the client
  const [mounted, setMounted] = useState(false);

  // Set mounted to true on client after hydration
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // If we're not mounted yet, render nothing or fallback
  if (!mounted) {
    return fallback ? <div>{fallback}</div> : null;
  }

  // Render children only on client
  return <div>{children}</div>;
}
