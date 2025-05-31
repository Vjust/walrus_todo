'use client';

import { useEffect, useState, ReactNode } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that only renders its children on the client side to prevent hydration mismatches.
 * Useful for components that rely on browser-specific APIs or have dynamic content.
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <div suppressHydrationWarning>{fallback}</div>;
  }

  return <div suppressHydrationWarning>{children}</div>;
}