'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { startFlameRing } from '@/lib/flameRing';

/** Wraps its children in a ring of animated purple flames; the ring fits the wrapper's size. */
export default function FlameHero({ children, className = '' }: { children: ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!wrap.current || !cv.current) return;
    return startFlameRing(wrap.current, cv.current);
  }, []);
  return (
    <div ref={wrap} className={`flame-hero relative ${className}`}>
      <canvas ref={cv} aria-hidden="true" className="pointer-events-none absolute" />
      <div className="flame-hero-inner relative z-10">{children}</div>
    </div>
  );
}
