'use client';

import { useEffect, useState } from 'react';

import { useSSRSafeMounted } from './useSSRSafe';

/**
 * Safe mounting hook that ensures consistent rendering between server and client
 * Prevents hydration mismatches by only returning true after client-side mount
 * 
 * @deprecated Use useSSRSafeMounted from useSSRSafe instead for better performance
 */
export function useMounted() {
  const { mounted } = useSSRSafeMounted();
  return mounted;
}

// Re-export the improved version
export { useSSRSafeMounted } from './useSSRSafe';