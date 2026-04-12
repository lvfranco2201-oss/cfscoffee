'use client';

import { Activity } from 'lucide-react';

export default function Loading() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '60vh',
      gap: '1.5rem',
      color: 'var(--text-muted)'
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '64px',
        height: '64px'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '3px solid rgba(221, 167, 86, 0.2)',
          borderTopColor: 'var(--cfs-gold)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <Activity size={24} style={{ color: 'var(--cfs-gold)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.25rem', fontWeight: 600 }}>Procesando Métricas</h3>
        <p style={{ fontSize: '0.87rem', opacity: 0.8 }}>Sincronizando datos con la base de datos operativa...</p>
      </div>
    </div>
  );
}

