'use client';
import dynamic from 'next/dynamic';
import BrandLogo from '@/components/BrandLogo';
// The dashboard clock, local controls and telemetry are initialized from browser time.
// Keep its first render client-side so server build time cannot cause hydration errors.
const Dashboard = dynamic(() => import('@/components/ControllerDashboard'), {
  ssr: false,
  loading: () => <main className="grid min-h-screen place-items-center text-slate-300"><div role="status" className="glass flex flex-col items-center gap-4 rounded-2xl px-10 py-8"><BrandLogo variant="full" size={120} /><p className="text-sm">Loading carbon controller…</p></div></main>,
});
export default function Page() { return <Dashboard />; }
