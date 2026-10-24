import DashboardSidebar from '@/components/DashboardSidebar';
import IbmHardwareDashboard from '@/components/IbmHardwareDashboard';
export const metadata={title:'IBM Hardware Testing | Carbon Ledger',description:'Historical hardware experiment evidence and reproducible comparisons'};
export default function Page(){return <main className="ibm-evidence-page carbon-workspace mx-auto max-w-[1700px] p-3 text-slate-100 sm:p-5"><DashboardSidebar/><IbmHardwareDashboard/></main>;}
