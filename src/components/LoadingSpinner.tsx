'use client';

import { Activity } from 'lucide-react';

interface LoadingSpinnerProps {
  section: string;
  subtitle?: string;
  icon?: string;
}

/**
 * Shared loading spinner used by per-route loading.tsx files.
 * Shows the section name and a contextual subtitle while Next.js
 * fetches server data via Suspense streaming.
 */
export default function LoadingSpinner({ section, subtitle, icon }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1.5rem',
        color: 'var(--text-muted)',
        animation: 'fade-in-up 0.4s ease',
      }}
    >
      {/* Spinning ring + icon */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '72px',
          height: '72px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: '3px solid rgba(221, 167, 86, 0.15)',
            borderTopColor: 'var(--cfs-gold)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        {icon ? (
          <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{icon}</span>
        ) : (
          <Activity size={26} style={{ color: 'var(--cfs-gold)', animation: 'pulse 2s ease-in-out infinite' }} />
        )}
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--cfs-gold-dim)',
            border: '1px solid rgba(221,167,86,0.2)',
            borderRadius: '20px',
            padding: '3px 12px',
            marginBottom: '0.75rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--cfs-gold)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {section}
        </div>
        <h3
          style={{
            fontFamily: 'Outfit',
            fontSize: '1.25rem',
            color: 'var(--text-main)',
            marginBottom: '0.25rem',
            fontWeight: 700,
          }}
        >
          Cargando métricas…
        </h3>
        {subtitle && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Bottom loading bar */}
      <div
        style={{
          width: '180px',
          height: '3px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, transparent, var(--cfs-gold), transparent)',
            borderRadius: '10px',
            animation: 'shimmer 1.8s ease-in-out infinite',
            width: '60%',
          }}
        />
      </div>
    </div>
  );
}
