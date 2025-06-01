import { ReactNode } from 'react';

// Disabled for static export: export const dynamic = 'force-dynamic';

export default function ExamplesLayout({
  children,
}: {
  children: ReactNode
}) {
  return children;
}