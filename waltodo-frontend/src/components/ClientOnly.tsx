'use client';

import { ReactNode } from 'react';
import { useClientOnly } from '@/lib/ssr-utils';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that only renders its children on the client side to prevent hydration mismatches.
 * Uses the improved SSR-safe pattern that doesn't cause layout shifts.
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const { isClient, ClientOnlyWrapper } = useClientOnly(() => <>{fallback}</>);

  return (
    <ClientOnlyWrapper>
      {children}
    </ClientOnlyWrapper>
  );
}