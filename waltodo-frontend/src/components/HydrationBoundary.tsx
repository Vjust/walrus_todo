'use client';

import { ReactNode, useEffect, useState } from 'react';

interface HydrationBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * HydrationBoundary prevents hydration mismatches by ensuring components
 * only render after hydration is complete
 */
export function HydrationBoundary({ children, fallback }: HydrationBoundaryProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // This ensures the component only renders after hydration
    setIsHydrated(true);
  }, []);

  // Prevent hydration mismatches by not rendering until client-side
  if (!isHydrated) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}