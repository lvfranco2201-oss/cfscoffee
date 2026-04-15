'use client';
import { AlertCircle } from 'lucide-react';

export default function PresupuestoError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}>
      <AlertCircle size={32} style={{ margin: '0 auto 1rem' }} />
      <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
        Error al cargar Presupuesto
      </div>
      <div style={{ fontSize: '0.82rem', opacity: 0.7, marginBottom: '1.2rem' }}>
        {error.message}
      </div>
      <button
        onClick={reset}
        style={{
          padding: '9px 22px', borderRadius: 10,
          background: 'var(--cfs-gold)', color: '#000',
          fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
