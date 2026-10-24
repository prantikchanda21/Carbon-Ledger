'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Atom, Wallet, GitBranch, Leaf, Home, History, Cpu } from 'lucide-react';
const links = [
 { name: 'Overview', url: '/dashboard', icon: LayoutDashboard },
 { name: 'Quantum Lab', url: '/quantum-lab', icon: Atom },
 { name: 'Financial Impact', url: '/tools/treasury', icon: Wallet },
 { name: 'Quantum Scheduler', url: '/quantum-scheduler', icon: GitBranch },
 { name: 'Weather Optimizer', url: '/weather-optimizer', icon: Leaf },
 { name: 'IBM Hardware Testing', url: '/ibm-hardware', icon: Cpu },
 { name: 'Engine History & Reports', url: '/history', icon: History },
];
export default function DashboardSidebar() {
 const path = usePathname();
 return <nav aria-label="Main workspace navigation" className="terminal-navigation terminal-side-nav" >
  <Link className="side-brand" href="/"><Leaf className="h-5 w-5 text-emerald-300"/><span>CARBON LEDGER</span></Link>
  <p className="side-navigation-caption">WORKSPACE</p>
  <div className="side-nav-links">{links.map(({name,url,icon:Icon}) => <Link key={url} href={url} aria-current={path===url || path.startsWith(url+'/') ? 'page' : undefined} className={`terminal-navlink ${path===url || path.startsWith(url+'/') ? 'terminal-navlink-active' : ''}`}><Icon className="h-4 w-4 shrink-0"/><span>{name}</span></Link>)}</div>
  <div className="side-nav-footer"><Link href="/" className="side-tool-link"><Home className="h-4 w-4"/>Landing page</Link><span className="text-[10px] text-emerald-100/50">20-region carbon-aware research simulator</span></div>
 </nav>;
}
