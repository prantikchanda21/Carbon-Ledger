import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Toaster } from 'sonner';
import SiteAskAI from '@/components/SiteAskAI';

export const metadata: Metadata = {
  title: 'Carbon Ledger',
  description: 'Carbon-aware compute planning.',
  icons: { icon: '/brand/carbon-ledger-icon.png', apple: '/brand/carbon-ledger-icon.png' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" className="dark"><body className="min-h-screen text-slate-100 antialiased"><div className="site-bg" aria-hidden="true"><span className="bg-orb o1"/><span className="bg-orb o2"/><span className="bg-orb o3"/><span className="bg-orb o4"/><span className="bg-grain"/></div><div className="relative z-10">{children}</div><SiteAskAI/><Toaster theme="dark" richColors position="top-right" /></body></html>;
}
