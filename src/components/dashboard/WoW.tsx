'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';

/** Shared WoW badge — shown inline next to metrics */
export function WoW({ pct, label, inverted }: { pct: number; label?: string; inverted?: boolean }) {
  const sign = pct >= 0;
  const isGood = inverted ? !sign : sign;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '20px',
      background: isGood ? 'rgba(46,202,127,0.12)' : 'rgba(239,68,68,0.12)',
      color: isGood ? 'var(--success)' : 'var(--danger)',
    }}>
      {sign ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {sign ? '+' : ''}{pct.toFixed(1)}% {label || ''}
    </span>
  );
}
