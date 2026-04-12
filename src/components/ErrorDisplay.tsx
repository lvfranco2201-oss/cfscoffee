'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface ErrorDisplayProps {
  error: Error & { digest?: string };
  reset: () => void;
  section: string;
  icon?: string;
}

/**
 * Shared error display used by per-route error.tsx files.
 * Shows the section name, a friendly message, and a retry button.
 * Logs the error to the console for debugging.
 */
export default function ErrorDisplay({ error, reset, section, icon }: ErrorDisplayProps) {
  useEffect(() => {
    console.error(`[${section}] Error:`, error);
  }, [error, section]);

  const isNetworkError = error.message?.toLowerCase().includes('connect') ||
    error.message?.toLowerCase().includes('timeout') ||
    error.message?.toLowerCase().includes('network');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1.5rem',
        textAlign: 'center',
        padding: '2rem',
        animation: 'fade-in-up 0.4s ease',
      }}
    >
      {/* Error icon */}
      <div style={{
        position: 'relative',
        width: '72px',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
        }} />
        {icon
          ? <span style={{ fontSize: '1.8rem', position: 'relative' }}>{icon}</span>
          : <AlertCircle size={32} style={{ color: 'var(--danger)', position: 'relative' }} />
        }
      </div>

      {/* Section badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '20px',
        padding: '3px 12px',
        fontSize: '0.72rem',
        fontWeight: 700,
        color: 'var(--danger)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        Error en {section}
      </div>

      {/* Message */}
      <div>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
          {isNetworkError ? 'Error de conexión' : 'Algo salió mal'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '400px', lineHeight: 1.6 }}>
          {isNetworkError
            ? 'No se pudo conectar con la base de datos operativa. Verifica tu conexión o intenta de nuevo en unos segundos.'
            : 'Ocurrió un error inesperado al cargar los datos de esta sección. El equipo técnico ha sido notificado.'}
        </p>
        {error.digest && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.5 }}>
            Código: {error.digest}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--cfs-gold)',
            color: '#000',
            border: 'none',
            padding: '11px 22px',
            borderRadius: '12px',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 14px rgba(221,167,86,0.4)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(221,167,86,0.6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(221,167,86,0.4)'; }}
        >
          <RefreshCw size={15} /> Reintentar
        </button>

        <Link
          href="/"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            padding: '11px 22px',
            borderRadius: '12px',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 600,
            fontSize: '0.9rem',
            textDecoration: 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <ChevronLeft size={15} /> Ir al Dashboard
        </Link>
      </div>
    </div>
  );
}
