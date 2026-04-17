'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, DollarSign, Target, Activity, FileText } from 'lucide-react';
import { useFilter, filterToParams } from '@/context/FilterContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface StoreMetrics {
  storeId: number;
  storeName: string;
  netSales: number;
  grossSales: number;
  guests: number;
  orders: number;
  discounts: number;
  voids: number;
  refunds: number;
  laborCost: number;
  laborHrs: number;
  cashSales: number;
  cardSales: number;
  tips: number;
}

interface ApiData {
  from: string;
  to: string;
  data: StoreMetrics[];
}

function fmt$(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

function fmtInt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null | undefined, digits = 2) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export default function ControlUI() {
  const { filter } = useFilter();
  const { locale } = useTranslation();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/control?${filterToParams(filter).toString()}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
  }, [fetchData]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const stores = data?.data ?? [];
  
  // Calculate Totals
  const total: StoreMetrics = stores.reduce((acc, curr) => {
    return {
      storeId: 0,
      storeName: 'Total',
      netSales: acc.netSales + curr.netSales,
      grossSales: acc.grossSales + curr.grossSales,
      guests: acc.guests + curr.guests,
      orders: acc.orders + curr.orders,
      discounts: acc.discounts + curr.discounts,
      voids: acc.voids + curr.voids,
      refunds: acc.refunds + curr.refunds,
      laborCost: acc.laborCost + curr.laborCost,
      laborHrs: acc.laborHrs + curr.laborHrs,
      cashSales: acc.cashSales + curr.cashSales,
      cardSales: acc.cardSales + curr.cardSales,
      tips: acc.tips + curr.tips,
    };
  }, { storeId: 0, storeName: 'Total', netSales: 0, grossSales: 0, guests: 0, orders: 0, discounts: 0, voids: 0, refunds: 0, laborCost: 0, laborHrs: 0, cashSales: 0, cardSales: 0, tips: 0 });

  const columns = [...stores, total];

  const renderRow = (label: string, renderCell: (store: StoreMetrics) => React.ReactNode, isHeader = false, isSub = false) => (
    <tr style={{
      borderBottom: '1px solid var(--border-color)',
      background: isHeader ? 'rgba(221,167,86,0.1)' : 'transparent',
    }}>
      <td style={{
        padding: isHeader ? '12px 16px' : '10px 16px',
        fontWeight: isHeader ? 700 : 500,
        color: isHeader ? 'var(--text-main)' : isSub ? 'var(--text-muted)' : 'var(--text-main)',
        fontSize: isHeader ? '0.9rem' : '0.85rem',
        paddingLeft: isSub ? '24px' : '16px',
        position: 'sticky',
        left: 0,
        background: isHeader ? '#1a1f2e' : 'var(--bg-card)',
        zIndex: 10,
        borderRight: '1px solid var(--border-color)',
      }}>
        {label}
      </td>
      {columns.map(store => (
        <td key={store.storeId} style={{
          padding: '10px 16px',
          textAlign: 'right',
          fontWeight: store.storeName === 'Total' ? 700 : (isHeader ? 700 : 400),
          background: store.storeName === 'Total' ? 'rgba(255,255,255,0.02)' : 'transparent',
          borderLeft: store.storeName === 'Total' ? '1px solid var(--border-color)' : 'none',
          color: isHeader ? 'var(--text-main)' : 'inherit',
          fontSize: isHeader ? '0.9rem' : '0.85rem',
        }}>
          {renderCell(store)}
        </td>
      ))}
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="top-header" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.6rem', marginBottom: 4 }}>
            <span className="text-gradient">Control</span> Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            P&amp;L Operativo y Métricas Financieras (Basado en tablas actuales)
          </p>
        </div>
      </div>

      {/* ── Data Warning ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 18px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--warning)', fontSize: '0.85rem', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <FileText size={18} style={{ flexShrink: 0, marginTop: 2 }}/>
        <div>
          <strong style={{ display: 'block', marginBottom: 4 }}>Nota sobre la disponibilidad de datos:</strong>
          Faltan algunas tablas en la base de datos para completar el reporte exacto al Excel. Los campos de <strong>COGS (Food, Bakery, Coffee, etc.)</strong>, <strong>Mantenimiento</strong>, y <strong>Depósitos en Efectivo</strong> se muestran en <span style={{ fontFamily: 'monospace' }}>$0</span> como placeholders hasta que esas tablas sean migradas a Supabase.
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', opacity: loading ? 0.65 : 1, transition: 'opacity 0.25s' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: 'var(--cfs-gold)', color: '#000' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800, position: 'sticky', left: 0, background: 'var(--cfs-gold)', zIndex: 11, borderRight: '1px solid rgba(0,0,0,0.1)' }}>MÉTRICA</th>
                {columns.map(store => (
                  <th key={store.storeId} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, borderLeft: store.storeName === 'Total' ? '1px solid rgba(0,0,0,0.1)' : 'none' }}>
                    {store.storeName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* SALES */}
              {renderRow('SALES & TRANSACTIONS', () => null, true)}
              {renderRow('Net Sales', s => fmt$(s.netSales))}
              {renderRow('Gross Sales', s => fmt$(s.grossSales), false, true)}
              {renderRow('Transactions', s => fmtInt(s.orders))}
              {renderRow('Average Ticket', s => fmt$(s.orders > 0 ? s.netSales / s.orders : 0))}

              {/* COGS */}
              {renderRow('COGS', () => null, true)}
              {renderRow('Food Cost', () => fmt$(0), false, true)}
              {renderRow('Bakery Cost', () => fmt$(0), false, true)}
              {renderRow('Coffee Cost', () => fmt$(0), false, true)}
              {renderRow('Merchandise Cost', () => fmt$(0), false, true)}
              {renderRow('Paper Cost', () => fmt$(0), false, true)}
              {renderRow('Total COGS', () => fmt$(0))}
              {renderRow('Cost %', () => fmtPct(0))}

              {/* PAYROLL */}
              {renderRow('PAYROLL', () => null, true)}
              {renderRow('Store Labor', s => fmt$(s.laborCost))}
              {renderRow('Tips', s => fmt$(s.tips))}
              {renderRow('Payroll %', s => fmtPct(s.netSales > 0 ? s.laborCost / s.netSales : 0))}
              {renderRow('Sales per Labor Hour', s => fmt$(s.laborHrs > 0 ? s.netSales / s.laborHrs : 0))}

              {/* DISCOUNTS */}
              {renderRow('DISCOUNTS', () => null, true)}
              {renderRow('Total Discounts', s => fmt$(s.discounts))}
              {renderRow('Discounts %', s => fmtPct(s.grossSales > 0 ? s.discounts / s.grossSales : 0))}

              {/* VOIDS */}
              {renderRow('VOIDS', () => null, true)}
              {renderRow('Total Voids', s => fmt$(s.voids + s.refunds))}
              {renderRow('Voids %', s => fmtPct(s.grossSales > 0 ? (s.voids + s.refunds) / s.grossSales : 0))}

              {/* MAINTENANCE */}
              {renderRow('MAINTENANCE', () => null, true)}
              {renderRow('Repairs & maintenance', () => fmt$(0))}

              {/* SALES DEPOSIT CONTROL */}
              {renderRow('SALES DEPOSIT CONTROL', () => null, true)}
              {renderRow('Cash Sales', s => fmt$(s.cashSales))}
              {renderRow('Cash Deposits', () => fmt$(0), false, true)}
              {renderRow('Cash Balance', s => fmt$(s.cashSales - 0))}

            </tbody>
          </table>

          {stores.length === 0 && !loading && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {locale === 'en' ? 'No data found for this period.' : 'No se encontraron datos para este período.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
