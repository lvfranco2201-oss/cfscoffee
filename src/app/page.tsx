'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardUI from '@/components/DashboardUI';
import { useFilter, filterToParams } from '@/context/FilterContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ height: '200px', borderRadius: '20px', background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', border: '1px solid var(--border-color)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '1rem' }}>
        {[...Array(6)].map((_,i) => (
          <div key={i} style={{ height: '140px', borderRadius: '16px', background: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', border: '1px solid var(--border-color)' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        {[380, 380].map((h,i) => (
          <div key={i} style={{ height: `${h}px`, borderRadius: '16px', background: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', border: '1px solid var(--border-color)' }} />
        ))}
      </div>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { filter } = useFilter();
  const { locale } = useTranslation();
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Abort controller ref to cancel in-flight requests when filter changes fast
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (f = filter) => {
    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = filterToParams(f);
      const res = await fetch(`/api/dashboard?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      if (e.name === 'AbortError') return; // Stale request — ignore
      setError(e.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Debounced re-fetch: wait 300ms after filter stabilises before fetching
  useEffect(() => {
    const timer = setTimeout(() => fetchData(filter), 300);
    return () => clearTimeout(timer);
  }, [filter]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup abort controller on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  if (error) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}>
        <div style={{ fontFamily: 'Outfit', fontWeight: 700, marginBottom: '0.5rem' }}>
          {locale === 'en' ? 'Error loading dashboard' : 'Error al cargar el dashboard'}
        </div>
        <div style={{ fontSize: '0.82rem', opacity: 0.7, marginBottom: '1rem' }}>{error}</div>
        <button
          onClick={() => fetchData()}
          style={{ padding: '9px 20px', borderRadius: '8px', background: 'var(--cfs-gold)', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {locale === 'en' ? 'Retry' : 'Reintentar'}
        </button>
      </div>
    );
  }

  if (loading && !data) return <DashboardSkeleton />;

  if (!data?.kpis) {
    return (
      <div style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Outfit', marginBottom: '0.5rem' }}>Sin Datos Disponibles</h2>
        <p>No se encontraron registros para el período seleccionado.</p>
      </div>
    );
  }

  return (
    <div style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 0.25s', pointerEvents: loading ? 'none' : 'auto' }}>
      <DashboardUI
        lastDateStr={
          data.fromDate !== data.toDate
            ? `${data.fromDate} → ${data.toDate}`
            : (data.fromDate ?? data.lastDate)
        }
        kpis={data.kpis}
        prevKpis={data.prevKpis}
        storesData={data.storesPerformance}
        peakHours={data.peakHours}
        paymentMethods={data.paymentMethods}
        totalTips={data.totalTips}
        prevTotalTips={data.prevTotalTips}
        totalLaborCost={data.totalLaborCost}
        prevTotalLaborCost={data.prevTotalLaborCost}
        totalLaborHours={data.totalLaborHours}
        prevTotalLaborHours={data.prevTotalLaborHours}
        avg30={data.avg30}
        dailyTrend={data.dailyTrend}
        numDays={data.numDays}
        availableStores={data.availableStores}
        onRefresh={() => fetchData()}
        loading={loading}
      />
    </div>
  );
}
