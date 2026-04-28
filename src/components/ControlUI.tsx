'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, DollarSign, Target, Activity, FileText, TrendingUp, TrendingDown, Users, Clock, BarChart2, PieChart, Award } from 'lucide-react';
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtInt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}
function cleanName(raw: string): string {
  return raw.replace(/^CFS Coffee\s*[-\u2013]\s*/i, '').replace(/^CFS\s+/i, '');
}

// ── Skeleton loader ─────────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 18, radius = 6 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s infinite',
    }} />
  );
}

// ── Color-coded metric cell ────────────────────────────────────────────────────
function ColorCell({ value, good, warn, bad, formatted }: {
  value: number; good: number; warn: number; bad: number; formatted: string;
}) {
  const color = value <= good ? 'var(--success)' : value <= warn ? 'var(--warning)' : 'var(--danger)';
  const bg    = value <= good ? 'rgba(46,202,127,0.08)' : value <= warn ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      background: bg, color, fontWeight: 700, fontSize: '0.82rem',
    }}>{formatted}</span>
  );
}

// ── Mini SVG Sparkline ─────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 80, h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  // area fill
  const first = values[0], last = values[values.length - 1];
  const y0 = h - ((first - min) / range) * h;
  const yn = h - ((last - min) / range) * h;
  const areaPath = `M 0,${y0} ${values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `L ${x},${y}`;
  }).join(' ')} L ${w},${h} L 0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`spk-${color.replace(/[^a-z0-9]/gi,'')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spk-${color.replace(/[^a-z0-9]/gi,'')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(values.length - 1) / (values.length - 1) * w} cy={yn} r={2.5} fill={color} />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, color, bg, trend, sparkValues,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; bg: string;
  trend?: 'up' | 'down' | null; sparkValues?: number[];
}) {
  return (
    <div className="glass-card" style={{ gap: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: bg, opacity: 0.35, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <span style={{ padding: 7, borderRadius: 10, background: bg, color }}>{icon}</span>
      </div>
      <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.02em', marginBottom: 2 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {sub && <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{sub}</span>}
        {trend && (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: trend === 'up' ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 2 }}>
            {trend === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          </span>
        )}
        {sparkValues && <Sparkline values={sparkValues} color={color} />}
      </div>
    </div>
  );
}

// ── Horizontal Bar Chart with rank badges ───────────────────────────────────
function HBar({ stores, metric, label, color, fmt }: {
  stores: StoreMetrics[]; metric: keyof StoreMetrics;
  label: string; color: string; fmt: (v: number) => string;
}) {
  const sorted = [...stores].sort((a, b) => (b[metric] as number) - (a[metric] as number)).slice(0, 8);
  const max = Math.max(...sorted.map(s => s[metric] as number), 1);
  const H = 28, GAP = 6, LW = 115, CW = 240;
  const medals = ['🥇','🥈','🥉'];
  return (
    <div style={{ flex: '1 1 300px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <BarChart2 size={13} style={{ color }} />
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.82rem' }}>{label}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${LW + CW + 80} ${sorted.length * (H + GAP)}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`hbar-${label.replace(/\s/g,'')}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>
        {sorted.map((s, i) => {
          const v = s[metric] as number;
          const bw = (v / max) * CW;
          const y = i * (H + GAP);
          const name = cleanName(s.storeName);
          const lbl = name.length > 15 ? name.slice(0, 14) + '\u2026' : name;
          return (
            <g key={s.storeId}>
              {/* Medal */}
              {i < 3 && <text x={8} y={y + H / 2 + 5} style={{ fontSize: 13 }}>{medals[i]}</text>}
              <text x={LW - 6} y={y + H / 2 + 4} textAnchor="end"
                style={{ fill: i === 0 ? 'var(--text-main)' : 'var(--text-muted)', fontSize: 9.5, fontFamily: 'Inter', fontWeight: i === 0 ? 700 : 400 }}>{lbl}</text>
              {/* Track */}
              <rect x={LW} y={y} width={CW} height={H} rx={6} fill="rgba(255,255,255,0.04)" />
              {/* Filled */}
              <rect x={LW} y={y} width={Math.max(bw, 4)} height={H} rx={6} fill={`url(#hbar-${label.replace(/\s/g,'')})`} />
              {/* Shine */}
              <rect x={LW} y={y + 2} width={Math.max(bw, 4)} height={H / 3} rx={4} fill="rgba(255,255,255,0.1)" />
              <text x={LW + bw + 6} y={y + H / 2 + 4}
                style={{ fill: color, fontSize: 9.5, fontFamily: 'Inter', fontWeight: 700 }}>{fmt(v)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Donut Chart ────────────────────────────────────────────────────────────────
function DonutChart({ cash, card, tips, total }: { cash: number; card: number; tips: number; total: number }) {
  const R = 52, cx = 70, cy = 70, sw = 18;
  const circ = 2 * Math.PI * R;
  const segments = [
    { val: cash, color: '#2eca7f', label: 'Cash' },
    { val: card, color: '#3b82f6', label: 'Card' },
    { val: tips, color: '#DDA756', label: 'Tips' },
  ].filter(s => s.val > 0);
  let off = -Math.PI / 2;
  const arcs = segments.map(s => {
    const angle = total > 0 ? (s.val / total) * 2 * Math.PI : 0;
    const da = (angle / (2 * Math.PI)) * circ;
    const rot = (off * 180) / Math.PI;
    off += angle;
    return { ...s, da, rot };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={140} height={140}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth={sw}
            strokeDasharray={`${a.da} ${circ - a.da}`}
            style={{ transform: `rotate(${a.rot}deg)`, transformOrigin: `${cx}px ${cy}px` }} />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" style={{ fill: 'var(--text-main)', fontSize: 15, fontWeight: 700, fontFamily: 'Outfit' }}>{fmt$(total)}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'Inter' }}>Total Sales</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)', minWidth: 34 }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: s.color }}>{fmt$(s.val)}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.71rem' }}>{total > 0 ? `(${((s.val / total) * 100).toFixed(0)}%)` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Labor Gauge ────────────────────────────────────────────────────────────────
function LaborGauge({ pct }: { pct: number }) {
  const R = 46, cx = 60, cy = 60;
  const angle = Math.min(pct, 1) * Math.PI;
  const x = cx + R * Math.cos(Math.PI + angle);
  const y = cy + R * Math.sin(Math.PI + angle);
  const color = pct <= 0.3 ? '#2eca7f' : pct <= 0.45 ? '#f59e0b' : '#ef4444';
  const d = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const fill = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${x} ${y}`;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={120} height={72}>
        <path d={d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} strokeLinecap="round" />
        {pct > 0 && <path d={fill} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" />}
        <text x={cx} y={cy - 2} textAnchor="middle" style={{ fill: color, fontSize: 16, fontWeight: 700, fontFamily: 'Outfit' }}>{(pct * 100).toFixed(1)}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'Inter' }}>Payroll</text>
      </svg>
    </div>
  );
}

export default function ControlUI() {
  const { filter } = useFilter();
  const { locale, t } = useTranslation();
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
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const stores = data?.data ?? [];
  const total: StoreMetrics = stores.reduce((acc, curr) => ({
    storeId: 0, storeName: 'Total',
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
  }), { storeId: 0, storeName: 'Total', netSales: 0, grossSales: 0, guests: 0, orders: 0, discounts: 0, voids: 0, refunds: 0, laborCost: 0, laborHrs: 0, cashSales: 0, cardSales: 0, tips: 0 });

  const columns = [...stores, total];
  const laborPct = total.netSales > 0 ? total.laborCost / total.netSales : 0;
  const avgTicket = total.orders > 0 ? total.netSales / total.orders : 0;
  const discountPct = total.grossSales > 0 ? total.discounts / total.grossSales : 0;

  const renderRow = (label: string, renderCell: (s: StoreMetrics) => React.ReactNode, isHeader = false, isSub = false) => (
    <tr key={label} style={{ borderBottom: '1px solid var(--border-color)', background: isHeader ? 'rgba(221,167,86,0.07)' : 'transparent' }}>
      <td style={{
        padding: isHeader ? '11px 16px' : '9px 16px',
        fontWeight: isHeader ? 700 : isSub ? 400 : 500,
        color: isHeader ? 'var(--cfs-gold)' : isSub ? 'var(--text-muted)' : 'var(--text-main)',
        fontSize: isHeader ? '0.72rem' : '0.83rem',
        paddingLeft: isSub ? '28px' : '16px',
        letterSpacing: isHeader ? '0.08em' : 'normal',
        textTransform: isHeader ? 'uppercase' : 'none',
        position: 'sticky', left: 0,
        background: isHeader ? '#1c2030' : 'var(--bg-card)',
        zIndex: 10, borderRight: '1px solid var(--border-color)',
        whiteSpace: 'nowrap',
      }}>
        {isSub && <span style={{ marginRight: 6, color: 'var(--border-color)' }}>└</span>}
        {label}
      </td>
      {columns.map(store => (
        <td key={store.storeId} style={{
          padding: '9px 14px', textAlign: 'right',
          fontWeight: store.storeName === 'Total' ? 700 : isHeader ? 700 : 400,
          background: store.storeName === 'Total' ? 'rgba(221,167,86,0.04)' : 'transparent',
          borderLeft: store.storeName === 'Total' ? '1px solid rgba(221,167,86,0.15)' : 'none',
          fontSize: '0.83rem',
          color: isHeader ? 'transparent' : store.storeName === 'Total' ? 'var(--cfs-gold)' : 'var(--text-main)',
        }}>
          {renderCell(store)}
        </td>
      ))}
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>

      {/* ── Header ── */}
      <div className="top-header" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.6rem', marginBottom: 4 }}>
            <span className="text-gradient">Control</span> Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {t('control.subtitle')}
          </p>
        </div>
        {loading && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
      </div>

      {/* ── Warning ── */}
      <div style={{ padding: '11px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: 'var(--warning)', fontSize: '0.8rem', display: 'flex', gap: 10, alignItems: 'center' }}>
        <FileText size={15} style={{ flexShrink: 0 }} />
        <div><strong>{t('control.data_warning_title')}</strong> — {t('control.data_warning_body')}</div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid-cols-4">
        {loading ? (
          [0,1,2,3].map(i => (
            <div key={i} className="glass-card" style={{ gap: 10 }}>
              <Skeleton w="60%" h={10} />
              <Skeleton w="80%" h={28} radius={8} />
              <Skeleton w="40%" h={8} />
            </div>
          ))
        ) : (
          <>
            <KpiCard label="Net Sales" value={fmt$(total.netSales)} sub={`${fmtInt(total.orders)} transactions`}
              icon={<DollarSign size={16} />} color="var(--cfs-gold)" bg="rgba(221,167,86,0.12)"
              sparkValues={stores.map(s => s.netSales)} />
            <KpiCard label="Avg Ticket" value={fmt$(avgTicket)} sub={`${fmtInt(total.orders)} orders`}
              icon={<Activity size={16} />} color="var(--success)" bg="rgba(46,202,127,0.12)"
              sparkValues={stores.map(s => s.orders > 0 ? s.netSales / s.orders : 0)} />
            <KpiCard label="Payroll %" value={fmtPct(laborPct)} sub={fmt$(total.laborCost) + ' labor'}
              icon={<Users size={16} />}
              color={laborPct <= 0.3 ? 'var(--success)' : laborPct <= 0.45 ? 'var(--warning)' : 'var(--danger)'}
              bg={laborPct <= 0.3 ? 'rgba(46,202,127,0.12)' : laborPct <= 0.45 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'}
              sparkValues={stores.map(s => s.netSales > 0 ? s.laborCost / s.netSales : 0)} />
            <KpiCard label="Discounts" value={fmt$(total.discounts)} sub={fmtPct(discountPct) + ' of gross'}
              icon={<Target size={16} />} color="var(--info)" bg="rgba(59,130,246,0.12)"
              sparkValues={stores.map(s => s.discounts)} />
          </>
        )}
      </div>

      {/* ── Visual Charts Row ── */}
      {stores.length > 0 && (
        <div className="glass-card" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Sales by store bar */}
          <HBar stores={stores} metric="netSales" label="Net Sales by Store" color="#DDA756"
            fmt={v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)} />

          {/* Payment Mix donut */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <PieChart size={13} style={{ color: 'var(--cfs-gold)' }} />
              <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.8rem' }}>Payment Mix</span>
            </div>
            <DonutChart cash={total.cashSales} card={total.cardSales} tips={total.tips} total={total.netSales} />
          </div>

          {/* Payroll gauge */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Clock size={13} style={{ color: 'var(--cfs-gold)' }} />
              <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.8rem' }}>Payroll Gauge</span>
            </div>
            <LaborGauge pct={laborPct} />
            <div style={{ textAlign: 'center', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {fmtInt(total.laborHrs)} hrs · {fmt$(total.laborHrs > 0 ? total.netSales / total.laborHrs : 0)}/hr
            </div>
          </div>
        </div>
      )}

      {/* ── Labor by Store bar ── */}
      {stores.length > 1 && (
        <div className="glass-card" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
          <HBar stores={stores} metric="laborCost" label="Labor Cost by Store" color="#3b82f6"
            fmt={v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)} />
          <HBar stores={stores} metric="discounts" label="Discounts by Store" color="#f59e0b"
            fmt={v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)} />
        </div>
      )}

      {/* ── Detail Table ── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={14} style={{ color: 'var(--cfs-gold)' }} />
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.9rem' }}>Detailed Metrics</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: 'rgba(221,167,86,0.1)', borderBottom: '2px solid rgba(221,167,86,0.2)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--cfs-gold)', position: 'sticky', left: 0, background: '#1c2030', zIndex: 11, borderRight: '1px solid var(--border-color)' }}>
                  {t('control.metric_col')}
                </th>
                {columns.map(store => (
                  <th key={store.storeId} style={{
                    padding: '12px 14px', textAlign: 'right',
                    fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.78rem',
                    color: store.storeName === 'Total' ? 'var(--cfs-gold)' : 'var(--text-main)',
                    borderLeft: store.storeName === 'Total' ? '1px solid rgba(221,167,86,0.15)' : 'none',
                    background: store.storeName === 'Total' ? 'rgba(221,167,86,0.04)' : 'transparent',
                  }}>
                    {store.storeName === 'Total' ? t('control.total_col') : cleanName(store.storeName)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderRow('SALES & TRANSACTIONS', () => null, true)}
              {renderRow('Net Sales', s => fmt$(s.netSales))}
              {renderRow('Gross Sales', s => fmt$(s.grossSales), false, true)}
              {renderRow('Transactions', s => fmtInt(s.orders))}
              {renderRow('Average Ticket', s => fmt$(s.orders > 0 ? s.netSales / s.orders : 0))}
              {renderRow('Cash Sales', s => fmt$(s.cashSales), false, true)}
              {renderRow('Card Sales', s => fmt$(s.cardSales), false, true)}

              {renderRow('PAYROLL', () => null, true)}
              {renderRow('Store Labor', s => fmt$(s.laborCost))}
              {renderRow('Labor Hours', s => fmtInt(s.laborHrs), false, true)}
              {renderRow('Tips', s => fmt$(s.tips), false, true)}
              {renderRow('Payroll %', s => {
                const p = s.netSales > 0 ? s.laborCost / s.netSales : 0;
                return <ColorCell value={p * 100} good={30} warn={40} bad={50} formatted={fmtPct(p)} />;
              })}
              {renderRow('Sales / Labor Hr', s => fmt$(s.laborHrs > 0 ? s.netSales / s.laborHrs : 0))}

              {renderRow('DISCOUNTS & VOIDS', () => null, true)}
              {renderRow('Total Discounts', s => fmt$(s.discounts))}
              {renderRow('Discount %', s => {
                const p = s.grossSales > 0 ? s.discounts / s.grossSales : 0;
                return <ColorCell value={p * 100} good={3} warn={6} bad={10} formatted={fmtPct(p)} />;
              }, false, true)}
              {renderRow('Total Voids', s => fmt$(s.voids + s.refunds))}
              {renderRow('Voids %', s => {
                const p = s.grossSales > 0 ? (s.voids + s.refunds) / s.grossSales : 0;
                return <ColorCell value={p * 100} good={1} warn={3} bad={5} formatted={fmtPct(p)} />;
              }, false, true)}

              {renderRow('COGS (Pending)', () => null, true)}
              {renderRow('Food Cost', () => fmt$(0), false, true)}
              {renderRow('Coffee Cost', () => fmt$(0), false, true)}
              {renderRow('Total COGS', () => fmt$(0))}
              {renderRow('COGS %', () => fmtPct(0))}

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
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes rowIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
