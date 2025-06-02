import { ReactNode } from 'react';

// Disabled for static export: export const dynamic = 'force-dynamic';

export default function InitTestLayout({
  children,
}: {
  children: ReactNode
}) {
  return children;
}