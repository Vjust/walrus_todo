'use client';

import { useEffect, useState } from 'react';

/**
 * Safe mounting hook that ensures consistent rendering between server and client
 * Prevents hydration mismatches by only returning true after client-side mount
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}