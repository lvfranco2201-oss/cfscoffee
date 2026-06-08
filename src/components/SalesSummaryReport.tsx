'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import { useFilter, filterToParams } from '@/context/FilterContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface DailySummary {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  netSales: number;
  tax: number;
  tips: number;
  creditDebit: number;
  cash: number;
  otherPayments: number;
  discounts: number;
  voids: number;
  laborHours: number;
  laborCost: number;
}

interface ApiData {
  from: string;
  to: string;
  data: DailySummary[];
}

function fmt$(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtInt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

export default function SalesSummaryReport() {
  const { filter } = useFilter();
  const { t } = useTranslation();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes/sales-summary?${filterToParams(filter).toString()}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      if (e.name === 'AbortError') return;
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleExportCSV = () => {
    if (!data || !data.data.length) return;
    
    const headers = [
      'Day', 'Date', 'Net sales', 'Tax', 'Tips', 'Credit/debit', 
      'Cash', 'Other Payments', 'Total discounts', 'Void amount', 'Hours', 'Labor Cost'
    ];
    
    const rows = data.data.map(r => [
      r.dayOfWeek,
      r.dayNumber,
      r.netSales,
      r.tax,
      r.tips,
      r.creditDebit,
      r.cash,
      r.otherPayments,
      r.discounts,
      r.voids,
      r.laborHours,
      r.laborCost
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_summary_${data.from}_to_${data.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rows = data?.data ?? [];
  const total = rows.reduce((acc, curr) => ({
    netSales: acc.netSales + curr.netSales,
    tax: acc.tax + curr.tax,
    tips: acc.tips + curr.tips,
    creditDebit: acc.creditDebit + curr.creditDebit,
    cash: acc.cash + curr.cash,
    otherPayments: acc.otherPayments + curr.otherPayments,
    discounts: acc.discounts + curr.discounts,
    voids: acc.voids + curr.voids,
    laborHours: acc.laborHours + curr.laborHours,
    laborCost: acc.laborCost + curr.laborCost,
  }), {
    netSales: 0, tax: 0, tips: 0, creditDebit: 0, cash: 0, 
    otherPayments: 0, discounts: 0, voids: 0, laborHours: 0, laborCost: 0
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div className="top-header" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.6rem', marginBottom: 4 }}>
            <span className="text-gradient">Sales</span> Summary
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Reporte diario consolidado de ventas, pagos y costos.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {loading && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
          
          <button 
            onClick={handleExportCSV}
            disabled={loading || rows.length === 0}
            className="action-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(221,167,86,0.1)', color: 'var(--cfs-gold)', border: '1px solid rgba(221,167,86,0.2)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, background: '#1c2030' }}>
          <Calendar size={14} style={{ color: 'var(--cfs-gold)' }} />
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.9rem' }}>Daily Breakdown</span>
        </div>
        
        <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#161925', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
              <tr>
                <th colSpan={2} style={{ borderBottom: '1px solid var(--border-color)', padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', borderRight: '1px solid var(--border-color)' }}>Date</th>
                <th colSpan={3} style={{ borderBottom: '1px solid var(--border-color)', padding: '8px', textAlign: 'center', color: 'var(--cfs-gold)', fontSize: '0.75rem', background: 'rgba(221,167,86,0.05)', borderRight: '1px solid var(--border-color)' }}>Sales</th>
                <th colSpan={3} style={{ borderBottom: '1px solid var(--border-color)', padding: '8px', textAlign: 'center', color: '#3b82f6', fontSize: '0.75rem', background: 'rgba(59,130,246,0.05)', borderRight: '1px solid var(--border-color)' }}>Payments</th>
                <th colSpan={2} style={{ borderBottom: '1px solid var(--border-color)', padding: '8px', textAlign: 'center', color: '#f59e0b', fontSize: '0.75rem', background: 'rgba(245,158,11,0.05)', borderRight: '1px solid var(--border-color)' }}>Discounts & Voids</th>
                <th colSpan={2} style={{ borderBottom: '1px solid var(--border-color)', padding: '8px', textAlign: 'center', color: '#2eca7f', fontSize: '0.75rem', background: 'rgba(46,202,127,0.05)' }}>Labor</th>
              </tr>
              <tr style={{ background: '#1c2030', borderBottom: '2px solid rgba(221,167,86,0.2)' }}>
                {['Day', 'Date', 'Net sales', 'Tax', 'Tips', 'Credit/debit', 'Cash', 'Other Payments', 'Total discounts', 'Void amount', 'Hours', 'Labor Cost'].map((col, i) => (
                  <th key={col} style={{
                    padding: '12px 14px', 
                    textAlign: i < 2 ? 'left' : 'right',
                    fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.78rem',
                    color: 'var(--text-main)',
                    borderRight: [1, 4, 7, 9].includes(i) ? '1px solid var(--border-color)' : 'none',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.date} style={{ 
                  borderBottom: '1px solid var(--border-color)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                }}>
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', color: 'var(--text-main)', borderRight: 'none' }}>{r.dayOfWeek}</td>
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)' }}>{r.dayNumber}</td>
                  
                  {/* Sales */}
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right', fontWeight: 600 }}>{fmt$(r.netSales)}</td>
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt$(r.tax)}</td>
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right', color: 'var(--cfs-gold)', borderRight: '1px solid var(--border-color)' }}>{fmt$(r.tips)}</td>

                  {/* Payments */}
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right' }}>{fmt$(r.creditDebit)}</td>
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt$(r.cash)}</td>
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)' }}>{fmt$(r.otherPayments)}</td>

                  {/* Discounts & Voids */}
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right', color: 'var(--warning)' }}>{fmt$(r.discounts)}</td>
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right', color: 'var(--danger)', borderRight: '1px solid var(--border-color)' }}>{fmt$(r.voids)}</td>

                  {/* Labor */}
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right' }}>{fmtInt(r.laborHours)}</td>
                  <td style={{ padding: '8px 14px', fontSize: '0.82rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt$(r.laborCost)}</td>
                </tr>
              ))}

              {/* Total Row */}
              {rows.length > 0 && (
                <tr style={{ 
                  background: 'rgba(221,167,86,0.1)', 
                  borderTop: '2px solid rgba(221,167,86,0.2)',
                  fontFamily: 'Outfit', fontWeight: 800
                }}>
                  <td colSpan={2} style={{ padding: '12px 14px', fontSize: '0.85rem', color: 'var(--cfs-gold)', borderRight: '1px solid var(--border-color)' }}>TOTAL</td>
                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--text-main)' }}>{fmt$(total.netSales)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt$(total.tax)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--cfs-gold)', borderRight: '1px solid var(--border-color)' }}>{fmt$(total.tips)}</td>

                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--text-main)' }}>{fmt$(total.creditDebit)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt$(total.cash)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)' }}>{fmt$(total.otherPayments)}</td>

                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--warning)' }}>{fmt$(total.discounts)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--danger)', borderRight: '1px solid var(--border-color)' }}>{fmt$(total.voids)}</td>

                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--text-main)' }}>{fmtInt(total.laborHours)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '0.85rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt$(total.laborCost)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {rows.length === 0 && !loading && (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay datos para las fechas y sucursal seleccionadas.
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .action-btn:hover { background: rgba(221,167,86,0.2) !important; }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
