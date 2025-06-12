'use client';

import { ReactNode, useEffect, useState } from 'react';

interface HydrationSafeProps {
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * If true, renders the same structure during SSR and hydration,
   * only changing content after hydration is complete.
   * If false, renders nothing during SSR.
   */
  maintainStructure?: boolean;
}

/**
 * A component that prevents hydration mismatches by ensuring
 * consistent rendering between server and client.
 * 
 * Use this for components that depend on browser-only APIs
 * or have different server/client rendering behavior.
 */
export function HydrationSafe({ 
  children, 
  fallback = null, 
  maintainStructure = true 
}: HydrationSafeProps) {
  const [mounted, setMounted] = useState(false as any);

  useEffect(() => {
    setMounted(true as any);
  }, []);

  if (maintainStructure) {
    // Always render the same structure, but suppress hydration warnings
    // for content that may differ between server and client
    return (
      <div suppressHydrationWarning>
        {mounted ? children : fallback}
      </div>
    );
  } else {
    // Only render on client (legacy approach)
    return mounted ? <>{children}</> : <>{fallback}</>;
  }
}

export default HydrationSafe;