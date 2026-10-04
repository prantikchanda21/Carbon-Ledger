import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Carbon Ledger brand marks. `icon` = leaf only, `full` = leaf + wordmark (light variant for dark backgrounds). */
export default function BrandLogo({ variant = 'icon', size = 40, href, className }: { variant?: 'icon' | 'full'; size?: number; href?: string; className?: string }) {
  const img = variant === 'icon'
    ? <Image src="/brand/carbon-ledger-icon.png" alt="Carbon Ledger" width={size} height={size} priority className={cn('object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]', className)} style={{ width: size, height: size }} />
    : <Image src="/brand/carbon-ledger-logo-dark.png" alt="Carbon Ledger" width={Math.round(size * 398 / 433)} height={size} priority className={cn('object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.45)]', className)} style={{ height: size, width: 'auto' }} />;
  return href ? <Link href={href} aria-label="Carbon Ledger home" className="inline-flex shrink-0">{img}</Link> : img;
}
