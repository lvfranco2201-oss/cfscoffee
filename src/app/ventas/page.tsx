'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import VentasUI from '@/components/VentasUI';
import { useFilter, filterToParams } from '@/context/FilterContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';

// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ height: '160px', borderRadius: '20px', background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', border: '1px solid var(--border-color)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '1rem' }}>
        {[...Array(6)].map((_,i) => (<div key={i} style={{ height: '130px', borderRadius: '14px', background: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', border: '1px solid var(--border-color)' }} />))}
      </div>
      <div style={{ height: '360px', borderRadius: '16px', background: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', border: '1px solid var(--border-color)' }} />
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function VentasPage() {
  const { filter } = useFilter();   // shared global filter
  const { locale } = useTranslation();
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (f = filter) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = filterToParams(f);
      const res = await fetch(`/api/ventas?${params.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Debounced re-fetch when global filter changes
  useEffect(() => {
    const timer = setTimeout(() => fetchData(filter), 300);
    return () => clearTimeout(timer);
  }, [filter]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return (
    <div>
      {error && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)', background: 'rgba(239,68,68,0.06)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem' }}>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, marginBottom: '0.4rem' }}>
            {locale === 'en' ? 'Error loading data' : 'Error al cargar datos'}
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{error}</div>
          <button onClick={() => fetchData()} style={{ marginTop: '1rem', padding: '8px 18px', borderRadius: '8px', background: 'var(--cfs-gold)', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {locale === 'en' ? 'Retry' : 'Reintentar'}
          </button>
        </div>
      )}

      {loading && !data && <LoadingSkeleton />}

      {data && (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.3s', pointerEvents: loading ? 'none' : 'auto' }}>
          <VentasUI data={data} />
        </div>
      )}
    </div>
  );
}
