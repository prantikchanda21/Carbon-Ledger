import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Carbon Ledger | Dual-Engine Carbon & Treasury Controller',
  description: 'Dynamic carbon-aware compute and treasury control plane.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" className="dark"><body className="min-h-screen text-slate-100 antialiased"><div className="site-bg" aria-hidden="true" /><div className="relative z-10">{children}</div><Toaster theme="dark" richColors position="top-right" /></body></html>;
}
