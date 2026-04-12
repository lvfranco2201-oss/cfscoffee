'use client';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, Coffee } from 'lucide-react';

const MODULES = [
  { icon: '🏪', name: 'Sucursales', eta: 'Q3 2026' },
  { icon: '⚙️', name: 'Costos Laborales', eta: 'Q3 2026' },
  { icon: '👥', name: 'Clientes', eta: 'Q4 2026' },
  { icon: '☕', name: 'Productos', eta: 'Q4 2026' },
];

export default function ComingSoonPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #070B14 0%, #0d1525 60%, #0a1020 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'Outfit, sans-serif',
        overflow: 'auto',
        padding: '2rem',
      }}
    >
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: '20%', left: '15%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(221,167,86,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '10%',
        width: '300px', height: '300px',
        background: 'radial-gradient(circle, rgba(46,202,127,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative',
        maxWidth: '560px',
        width: '100%',
        background: 'rgba(12,20,36,0.7)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(221,167,86,0.15)',
        borderRadius: '28px',
        padding: '3rem 2.5rem',
        boxShadow: '0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        textAlign: 'center',
        animation: 'fade-in-up 0.5s ease',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '80px', height: '80px',
            background: 'rgba(221,167,86,0.1)',
            borderRadius: '50%',
            border: '1px solid rgba(221,167,86,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            animation: 'float 5s ease-in-out infinite',
          }}>
            🚀
          </div>
        </div>

        {/* Header */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'rgba(221,167,86,0.1)',
          border: '1px solid rgba(221,167,86,0.2)',
          borderRadius: '20px', padding: '4px 14px',
          fontSize: '0.72rem', fontWeight: 700,
          color: 'var(--cfs-gold, #DDA756)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: '1.25rem',
        }}>
          <Clock size={12} />
          En Desarrollo
        </div>

        <h1 style={{
          fontSize: '2.2rem', fontWeight: 800,
          color: '#FDFBF7', letterSpacing: '-0.03em',
          marginBottom: '0.75rem',
          lineHeight: 1.1,
        }}>
          Próximamente
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.45)', fontSize: '0.92rem',
          lineHeight: 1.65, marginBottom: '2.5rem', maxWidth: '380px', margin: '0 auto 2.5rem',
        }}>
          Este módulo está actualmente en construcción. Estamos trabajando para traerte
          una experiencia analítica de primer nivel.
        </p>

        {/* Divider */}
        <div style={{
          width: '100%', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(221,167,86,0.25), transparent)',
          marginBottom: '1.75rem',
        }} />

        {/* Modules grid */}
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', fontWeight: 700 }}>
          Módulos en Pipeline
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem', marginBottom: '2.5rem',
        }}>
          {MODULES.map(m => (
            <div key={m.name} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px', padding: '1rem',
              display: 'flex', flexDirection: 'column', gap: '4px',
              textAlign: 'left',
            }}>
              <span style={{ fontSize: '1.3rem' }}>{m.icon}</span>
              <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{m.name}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--cfs-gold, #DDA756)', fontWeight: 600 }}>Est. {m.eta}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #DDA756 0%, #b8860b 100%)',
              color: '#070b14', fontWeight: 800, fontSize: '0.88rem',
              textDecoration: 'none', letterSpacing: '0.03em',
              boxShadow: '0 4px 20px rgba(221,167,86,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            <ArrowLeft size={16} />
            Ir al Dashboard
          </Link>
          <Link
            href="/ventas"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.88rem',
              textDecoration: 'none',
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
          >
            <Coffee size={16} />
            Ver Ventas
          </Link>
        </div>

        {/* Footer note */}
        <p style={{
          marginTop: '2rem', fontSize: '0.68rem',
          color: 'rgba(255,255,255,0.18)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          CFSCoffee BI · Analytics Platform
        </p>
      </div>
    </div>
  );
}
