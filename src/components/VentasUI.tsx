'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line,
  ReferenceLine, LineChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
  AlertTriangle, Percent, Clock, BarChart2, Layers, Utensils,
  Smartphone, Calendar, Award, ArrowRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VentasData {
  lastDate: string;
  kpisHoy: {
    netSales: number; grossSales: number; guests: number;
    orders: number; discounts: number; voids: number; refunds: number;
  };
  trend90: { date: string; netSales: number; grossSales: number; guests: number; orders: number; discounts: number; ma7: number }[];
  byDow: { day: string; dow: number; avgSales: number; avgGuests: number; avgOrders: number }[];
  byDiningOption: { diningOption: string | null; netSales: number; guests: number; orders: number }[];
  byOrderSource: { orderSource: string | null; netSales: number; orders: number }[];
  byRevenueCenter: { revenueCenter: string | null; netSales: number; orders: number }[];
  topDias: { date: string; netSales: number; guests: number; orders: number }[];
  currWeek: { netSales: number; guests: number; orders: number; discounts: number };
  prevWeek: { netSales: number; guests: number; orders: number; discounts: number };
  wowSales: number;
  wowGuests: number;
  paymentBreakdown: { name: string; value: number; tips: number; txCount: number; color: string }[];
  totalCash: number;
  totalCard: number;
  totalTips30: number;
  peakHours: { time: string; ventas: number; clientes: number; ordenes: number; labor: number }[];
  tipTrend: { date: string; totalTips: number; totalPayments: number; tipRate: number; txCount: number }[];
  tipByRestaurant: { name: string; totalTips: number; totalPayments: number; tipRate: number; avgTipPerTx: number; txCount: number }[];
  momCurr: { netSales: number; guests: number; orders: number; discounts: number; days: number };
  momPrev: { netSales: number; guests: number; orders: number; discounts: number; days: number };
  momSalesChg: number;
  momGuestsChg: number;
}

import { cleanStoreName as _cleanRestaurantName } from '@/utils/formatters';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt  = (n: number, d = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const fmtK = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;

const PALETTE = ['#DDA756', '#3b82f6', '#2eca7f', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const WoW = ({ pct }: { pct: number }) => {
  const sign = pct >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
      background: sign ? 'rgba(46,202,127,0.12)' : 'rgba(239,68,68,0.12)',
      color: sign ? 'var(--success)' : 'var(--danger)',
    }}>
      {sign ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {sign ? '+' : ''}{pct.toFixed(1)}% WoW
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function VentasUI({ data }: { data: VentasData }) {
  const [trendRange, setTrendRange] = useState<30 | 60 | 90>(90);
  const [trendMetric, setTrendMetric] = useState<'netSales' | 'guests' | 'orders' | 'discounts'>('netSales');

  // Date label
  const dateFmt = new Date(data.lastDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Derived vals
  const avgTicket   = data.kpisHoy.orders  > 0 ? data.kpisHoy.netSales / data.kpisHoy.orders  : 0;
  const avgPerGuest = data.kpisHoy.guests  > 0 ? data.kpisHoy.netSales / data.kpisHoy.guests  : 0;
  const discPct     = data.kpisHoy.grossSales > 0 ? (data.kpisHoy.discounts / data.kpisHoy.grossSales) * 100 : 0;
  const voidPct     = data.kpisHoy.grossSales > 0 ? ((data.kpisHoy.voids + data.kpisHoy.refunds) / data.kpisHoy.grossSales) * 100 : 0;

  // Total 90d
  const total90 = useMemo(() => data.trend90.reduce((a, d) => a + d.netSales, 0), [data.trend90]);
  const avg90   = data.trend90.length > 0 ? total90 / data.trend90.length : 0;
  const best90  = data.trend90.length > 0 ? Math.max(...data.trend90.map(d => d.netSales)) : 0;

  // Filtered trend
  const trendSliced = useMemo(() => data.trend90.slice(-trendRange), [data.trend90, trendRange]);

  // Total payment pool
  const totalPayments30 = data.paymentBreakdown.reduce((a, p) => a + p.value, 0);

  // Best day of week
  const bestDow = useMemo(() => {
    if (!data.byDow.length) return null;
    return data.byDow.reduce((best, d) => d.avgSales > best.avgSales ? d : best, data.byDow[0]);
  }, [data.byDow]);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="animate-in">

      {/* ── BANNER ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'relative', minHeight: '160px', borderRadius: '20px', overflow: 'hidden',
        marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-end',
        padding: '1.75rem 2.5rem', border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-card)', backgroundImage: `url('/IMG_3221_edited.avif')`,
        backgroundSize: 'cover', backgroundPosition: 'center 45%',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg,rgba(7,11,20,0.97) 0%,rgba(7,11,20,0.65) 55%,rgba(7,11,20,0.1) 100%)', zIndex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <div style={{ minWidth: 0, minHeight: 0, background: 'var(--cfs-gold)', width: '4px', height: '26px', borderRadius: '4px' }} />
            <h1 style={{ fontSize: '1.75rem', color: '#FDFBF7', fontWeight: 800, fontFamily: 'Outfit', letterSpacing: '-0.03em' }}>
              Análisis de Ventas
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginLeft: '14px' }}>
            CFSCoffee · Último cierre:&nbsp;
            <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, textTransform: 'capitalize' }}>{dateFmt}</span>
          </p>
        </div>
        {/* Pills */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { l: 'Ventas Hoy',    v: fmtK(data.kpisHoy.netSales) },
            { l: 'Total 90 Días', v: fmtK(total90) },
            { l: 'Promedio/Día',  v: fmtK(avg90) },
            { l: 'Mejor Día',     v: fmtK(best90) },
          ].map(p => (
            <div key={p.l} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(221,167,86,0.2)', borderRadius: '10px', padding: '5px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1rem', color: 'var(--cfs-gold)' }}>{p.v}</div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{p.l}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── KPI ROW ────────────────────────────────────────────────────────── */}
      <div className="grid-cols-6" style={{ marginBottom: '1.75rem' }}>
        {[
          { icon: <DollarSign size={18}/>, WM: DollarSign, col: 'var(--cfs-gold)',  bg: 'var(--cfs-gold-dim)',        label: 'Ventas Netas Hoy',  val: fmt(data.kpisHoy.netSales),   sub: `Bruto: ${fmt(data.kpisHoy.grossSales)}`,           wow: data.wowSales },
          { icon: <Users size={18}/>,      WM: Users,      col: 'var(--success)',   bg: 'rgba(46,202,127,0.12)',      label: 'Clientes Hoy',      val: data.kpisHoy.guests.toLocaleString(),  sub: `$/visita: ${fmt(avgPerGuest)}`,             wow: data.wowGuests },
          { icon: <ShoppingCart size={18}/>, WM: ShoppingCart, col: 'var(--info)',    bg: 'rgba(79,172,254,0.12)',      label: 'Órdenes Cerradas',  val: data.kpisHoy.orders.toLocaleString(),  sub: `Ticket: ${fmt(avgTicket)}` },
          { icon: <Percent size={18}/>,    WM: Percent,    col: discPct > 8 ? 'var(--warning)' : 'var(--success)', bg: discPct > 8 ? 'rgba(245,158,11,0.12)' : 'rgba(46,202,127,0.12)', label: 'Descuentos',   val: fmt(data.kpisHoy.discounts), sub: `${discPct.toFixed(1)}% del bruto` },
          { icon: <AlertTriangle size={18}/>, WM: AlertTriangle, col: voidPct > 2 ? 'var(--danger)' : 'var(--text-muted)', bg: 'rgba(239,68,68,0.08)', label: 'Voids + Refunds', val: fmt(data.kpisHoy.voids + data.kpisHoy.refunds), sub: `${voidPct.toFixed(2)}% del bruto` },
          { icon: <Award size={18}/>,      WM: Award,      col: 'var(--cfs-gold)',  bg: 'var(--cfs-gold-dim)',        label: 'Mejor Día (90d)',    val: fmtK(best90),                 sub: data.topDias[0]?.date ? new Date(data.topDias[0].date + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : '—' },
        ].map((c, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.3rem', position: 'relative', overflow: 'hidden' }}>
            <c.WM size={128} style={{ position: 'absolute', bottom: '-20px', right: '-20px', opacity: 0.04, transform: 'rotate(-10deg)', zIndex: 0, pointerEvents: 'none', color: 'var(--text-main)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem', position: 'relative', zIndex: 1 }}>
              <div style={{ minWidth: 0, minHeight: 0, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, color: c.col, border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                {c.icon}
              </div>
              {c.wow !== undefined && <WoW pct={c.wow} />}
            </div>
            <div style={{ fontFamily: 'Outfit', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '3px', position: 'relative', zIndex: 1 }}>{c.val}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', position: 'relative', zIndex: 1 }}>{c.label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.6, marginTop: '2px', position: 'relative', zIndex: 1 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── SEMANA ACTUAL vs ANTERIOR ──────────────────────────────────────── */}
      <div className="grid-cols-4" style={{ marginBottom: '1.75rem' }}>
        {[
          { label: 'Ventas — 7 Días', curr: data.currWeek.netSales, prev: data.prevWeek.netSales, pct: data.wowSales, fmt: fmtK },
          { label: 'Clientes — 7 Días', curr: data.currWeek.guests, prev: data.prevWeek.guests, pct: data.prevWeek.guests > 0 ? ((data.currWeek.guests - data.prevWeek.guests) / data.prevWeek.guests * 100) : 0, fmt: (n: number) => n.toLocaleString() },
          { label: 'Órdenes — 7 Días', curr: data.currWeek.orders, prev: data.prevWeek.orders, pct: data.prevWeek.orders > 0 ? ((data.currWeek.orders - data.prevWeek.orders) / data.prevWeek.orders * 100) : 0, fmt: (n: number) => n.toLocaleString() },
          { label: 'Descuentos — 7 Días', curr: data.currWeek.discounts, prev: data.prevWeek.discounts, pct: data.prevWeek.discounts > 0 ? ((data.currWeek.discounts - data.prevWeek.discounts) / data.prevWeek.discounts * 100) : 0, fmt: fmtK },
        ].map((card, i) => {
          const sign = card.pct >= 0;
          const barCurr = card.curr + card.prev > 0 ? (card.curr / (card.curr + card.prev)) * 100 : 50;
          return (
            <div key={i} className="glass-card" style={{ padding: '1.3rem' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>{card.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.7rem' }}>
                <div>
                  <div style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, marginBottom: '2px' }}>{card.fmt(card.curr)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>vs {card.fmt(card.prev)} sem. ant.</div>
                </div>
                <WoW pct={card.pct} />
              </div>
              {/* Progress bar: actual vs anterior */}
              <div style={{ minWidth: 0, minHeight: 0, display: 'flex', gap: '3px', height: '5px', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ flex: barCurr, background: sign ? 'var(--cfs-gold)' : 'var(--danger)', borderRadius: '10px 0 0 10px', opacity: 0.85 }} />
                <div style={{ flex: 100 - barCurr, background: 'rgba(255,255,255,0.07)', borderRadius: '0 10px 10px 0' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--cfs-gold)', fontWeight: 600 }}>Esta semana</span>
                <span>Semana anterior</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── TENDENCIA 90 DÍAS (grande) ─────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} style={{ color: 'var(--cfs-gold)' }} /> Tendencia Histórica + Media Móvil 7 días
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Consolidado de toda la cadena · Línea punteada = media móvil
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Metric switcher */}
            {([['netSales','Ventas'],['guests','Clientes'],['orders','Órdenes'],['discounts','Descuentos']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTrendMetric(k)}
                style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid', cursor: 'pointer',
                  borderColor: trendMetric === k ? 'var(--cfs-gold)' : 'var(--border-color)',
                  background: trendMetric === k ? 'var(--cfs-gold-dim)' : 'transparent',
                  color: trendMetric === k ? 'var(--cfs-gold)' : 'var(--text-muted)',
                  fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit',
                }}>
                {l}
              </button>
            ))}
            {/* Range switcher */}
            <div style={{ minWidth: 0, minHeight: 0, width: '1px', height: '20px', background: 'var(--border-color)' }} />
            {([30, 60, 90] as const).map(r => (
              <button key={r} onClick={() => setTrendRange(r)}
                style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid', cursor: 'pointer',
                  borderColor: trendRange === r ? 'rgba(255,255,255,0.2)' : 'var(--border-color)',
                  background: trendRange === r ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: trendRange === r ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '0.72rem', fontWeight: 600, fontFamily: 'inherit',
                }}>
                {r}d
              </button>
            ))}
          </div>
        </div>

        <div style={{ minWidth: 0, minHeight: 0, height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={trendSliced} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#DDA756" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#DDA756" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} interval={Math.floor(trendSliced.length / 10)} />
              <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false}
                tickFormatter={v => trendMetric === 'netSales' || trendMetric === 'discounts' ? `$${v}` : v.toLocaleString()} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--cfs-gold)', borderRadius: '10px', fontSize: '0.8rem', boxShadow: 'var(--shadow-card)' }}
                formatter={(val: any, name: any) => {
                  const labels: Record<string, string> = { netSales: 'Ventas Netas', guests: 'Clientes', orders: 'Órdenes', discounts: 'Descuentos', ma7: 'Media Móvil 7d' };
                  const isMoney = name === 'netSales' || name === 'discounts';
                  return [isMoney ? `$${val.toLocaleString()}` : val.toLocaleString(), labels[name] ?? name];
                }}
              />
              {/* Reference line: avg */}
              {trendMetric === 'netSales' && (
                <ReferenceLine y={avg90} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"
                  label={{ value: `Prom: ${fmtK(avg90)}`, fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopRight' }} />
              )}
              <Area type="monotone" dataKey={trendMetric} stroke="#DDA756" strokeWidth={2} fill="url(#trendGrad)" dot={false} isAnimationActive animationDuration={1200} />
              {trendMetric === 'netSales' && (
                <Line type="monotone" dataKey="ma7" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: '2rem', paddingTop: '0.9rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { l: `Total ${trendRange}d`, v: trendSliced.length > 0 ? fmtK(trendSliced.reduce((a, d) => a + (d[trendMetric] ?? 0), 0)) : '—' },
            { l: 'Promedio/día', v: trendSliced.length > 0 ? fmtK(trendSliced.reduce((a, d) => a + (d[trendMetric] ?? 0), 0) / trendSliced.length) : '—' },
            { l: 'Días con datos', v: trendSliced.filter(d => d.netSales > 0).length.toString() },
            { l: 'Mejor día del periodo', v: trendSliced.length > 0 ? fmtK(Math.max(...trendSliced.map(d => d[trendMetric] ?? 0))) : '—' },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{s.v}</div>
              <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: '2px' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FILA: Horas Pico + Día de Semana ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Curva horaria hoy */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Clock size={16} style={{ color: 'var(--cfs-gold)' }} /> Flujo de Ventas por Hora — Hoy
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.1rem' }}>Consolidado de todas las sucursales</div>
          <div style={{ minWidth: 0, minHeight: 0, height: 220 }}>
            <ResponsiveContainer>
              <ComposedChart data={data.peakHours} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#DDA756" stopOpacity={0.45}/>
                    <stop offset="95%" stopColor="#DDA756" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false}/>
                <YAxis yAxisId="l" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/>
                <YAxis yAxisId="r" orientation="right" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false}/>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px', fontSize: '0.78rem' }}
                  formatter={(v: any, n: any) => {
                    if (n === 'ventas') return [`$${v.toLocaleString()}`, 'Ventas'];
                    if (n === 'clientes') return [v.toLocaleString(), 'Clientes'];
                    return [v, n];
                  }}
                />
                <Area yAxisId="l" type="monotone" dataKey="ventas" stroke="#DDA756" strokeWidth={2.5} fill="url(#hGrad)" dot={false}/>
                <Line yAxisId="r" type="monotone" dataKey="clientes" stroke="#3b82f6" strokeWidth={2} dot={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {data.peakHours.length > 0 && (() => {
            const best = data.peakHours.reduce((b, h) => h.ventas > b.ventas ? h : b, data.peakHours[0]);
            return (
              <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <div><div style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--cfs-gold)' }}>{best.time}</div><div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hora Pico</div></div>
                <div><div style={{ fontFamily: 'Outfit', fontWeight: 700 }}>{fmtK(best.ventas)}</div><div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Venta Máx/Hora</div></div>
                <div><div style={{ fontFamily: 'Outfit', fontWeight: 700 }}>{data.peakHours.length}</div><div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horas Activas</div></div>
              </div>
            );
          })()}
        </div>

        {/* Ventas promedio por día de semana */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Calendar size={16} style={{ color: 'var(--cfs-gold)' }} /> Promedio por Día de Semana (90d)
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.1rem' }}>
            Venta promedio diaria según el día · {bestDow ? <span style={{ color: 'var(--cfs-gold)', fontWeight: 600 }}>{bestDow.day} es el mejor día</span> : null}
          </div>
          <div style={{ minWidth: 0, minHeight: 0, height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data.byDow} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}/>
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px', fontSize: '0.78rem' }}
                  formatter={(v: any) => [`$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, 'Venta Promedio']}
                />
                <Bar dataKey="avgSales" radius={[8, 8, 0, 0]} barSize={28}>
                  {data.byDow.map((d, i) => (
                    <Cell key={i} fill={d.day === bestDow?.day ? '#DDA756' : 'rgba(221,167,86,0.4)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── FILA: DiningOption + OrderSource + RevenueCenter ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Dining Option */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Utensils size={14} style={{ color: 'var(--cfs-gold)' }} /> Por Tipo de Consumo (30d)
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>DiningOption — ventas netas</div>
          {data.byDiningOption.length > 0 ? (
            <>
              <div style={{ minWidth: 0, minHeight: 0, height: 160 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.byDiningOption} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={4} cornerRadius={6} dataKey="netSales" stroke="none">
                      {data.byDiningOption.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem' }}
                      formatter={(v: any) => [`$${v.toLocaleString()}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '0.5rem' }}>
                {data.byDiningOption.slice(0, 5).map((d, i) => {
                  const total = data.byDiningOption.reduce((a, x) => a + x.netSales, 0);
                  const pct = total > 0 ? (d.netSales / total * 100) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <div style={{ minWidth: 0, minHeight: 0, width: '8px', height: '8px', borderRadius: '50%', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.diningOption ?? 'Sin clasificar'}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{fmtK(d.netSales)}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', minWidth: '34px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin datos disponibles.</p>}
        </div>

        {/* Order Source */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Smartphone size={14} style={{ color: 'var(--cfs-gold)' }} /> Por Fuente de Orden (30d)
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>OrderSource — canales de venta</div>
          {data.byOrderSource.length > 0 ? (
            <div style={{ minWidth: 0, minHeight: 0, height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={data.byOrderSource.slice(0, 6).map(d => ({ name: d.orderSource ?? 'N/A', ventas: d.netSales, ordenes: d.orders }))}
                  layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)"/>
                  <XAxis type="number" tickFormatter={v=>`$${v}`} stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}/>
                  <YAxis dataKey="name" type="category" width={80} stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}/>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem' }}
                    formatter={(v: any) => [`$${v.toLocaleString()}`, 'Ventas']}/>
                  <Bar dataKey="ventas" radius={[0, 8, 8, 0]} barSize={14}>
                    {data.byOrderSource.slice(0, 6).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin datos de fuente de orden.</p>}
        </div>

        {/* Revenue Center */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Layers size={14} style={{ color: 'var(--cfs-gold)' }} /> Por Centro de Ingresos (30d)
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>RevenueCenter — áreas de venta</div>
          {data.byRevenueCenter.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {(() => {
                const total = data.byRevenueCenter.reduce((a, d) => a + d.netSales, 0);
                return data.byRevenueCenter.slice(0, 8).map((d, i) => {
                  const pct = total > 0 ? (d.netSales / total * 100) : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 600 }}>{d.revenueCenter ?? '—'}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontFamily: 'Outfit', fontWeight: 700, color: PALETTE[i % PALETTE.length] }}>{fmtK(d.netSales)}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div style={{ minWidth: 0, minHeight: 0, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: PALETTE[i % PALETTE.length], borderRadius: '6px', opacity: 0.8, transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin datos de centro de ingresos.</p>}
        </div>
      </div>

      {/* ── FILA: TOP 10 DÍAS + MÉTODOS DE PAGO 30D ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

        {/* Top 10 mejores días históricos */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Award size={16} style={{ color: 'var(--cfs-gold)' }} /> Top 10 Mejores Días Históricos
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>Días con mayor venta neta consolidada</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {data.topDias.map((d, i) => {
              const pct = data.topDias[0]?.netSales > 0 ? (d.netSales / data.topDias[0].netSales * 100) : 0;
              const rankCol = i === 0 ? '#DDA756' : i === 1 ? '#94A3B8' : i === 2 ? '#b87333' : 'var(--text-muted)';
              const dateStr = d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.8rem', color: rankCol, width: '22px', textAlign: 'center', flexShrink: 0 }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{dateStr}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: `${Math.max(pct * 0.7, 3)}px`, height: '4px', borderRadius: '4px', background: rankCol, opacity: 0.7, maxWidth: '60px' }} />
                    <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', minWidth: '70px', textAlign: 'right' }}>{fmt(d.netSales)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Métodos de Pago 30 días */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} /> Métodos de Pago — Últimos 30 Días
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
            Total recaudado: <span style={{ color: 'var(--cfs-gold)', fontWeight: 600 }}>{fmtK(totalPayments30)}</span>
            &nbsp;·&nbsp; Propinas: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{fmtK(data.totalTips30)}</span>
          </div>
          {data.paymentBreakdown.length > 0 ? (
            <>
              <div style={{ minWidth: 0, minHeight: 0, height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={data.paymentBreakdown.slice(0, 8).map(p => ({ name: p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name, value: p.value, tips: p.tips }))}
                    margin={{ top: 0, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false}/>
                    <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem' }}
                      formatter={(v: any, n: any) => [`$${v.toLocaleString()}`, n === 'value' ? 'Monto Total' : 'Propinas']}/>
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={22}>
                      {data.paymentBreakdown.slice(0, 8).map((p, i) => <Cell key={i} fill={p.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {data.paymentBreakdown.slice(0, 5).map((p, i) => {
                  const pct = totalPayments30 > 0 ? (p.value / totalPayments30 * 100) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ minWidth: 0, minHeight: 0, width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>{p.name}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{fmtK(p.value)}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', minWidth: '34px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--success)', minWidth: '60px', textAlign: 'right' }}>propinas: {fmtK(p.tips)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '2rem 0' }}>
              Sin datos de pagos para los últimos 30 días.
            </div>
          )}
        </div>
      </div>
      {/* ── MES ACTUAL vs MES ANTERIOR ─────────────────────────────── */}
      {(data.momCurr.netSales > 0 || data.momPrev.netSales > 0) && (
        <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1.25rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.2rem' }}>
            <Calendar size={16} style={{ color: 'var(--cfs-gold)' }} /> Comparativa Mes en Curso vs Mes Anterior
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
            {[
              { label: 'Ventas MTD', curr: data.momCurr.netSales, prev: data.momPrev.netSales, pct: data.momSalesChg, fmtFn: fmtK },
              { label: 'Clientes MTD', curr: data.momCurr.guests, prev: data.momPrev.guests, pct: data.momGuestsChg, fmtFn: (n: number) => n.toLocaleString() },
              { label: 'Órdenes MTD', curr: data.momCurr.orders, prev: data.momPrev.orders, pct: data.momPrev.orders > 0 ? ((data.momCurr.orders - data.momPrev.orders) / data.momPrev.orders * 100) : 0, fmtFn: (n: number) => n.toLocaleString() },
              { label: 'Descuentos MTD', curr: data.momCurr.discounts, prev: data.momPrev.discounts, pct: data.momPrev.discounts > 0 ? ((data.momCurr.discounts - data.momPrev.discounts) / data.momPrev.discounts * 100) : 0, fmtFn: fmtK },
            ].map((c, i) => {
              const up = c.pct >= 0;
              const barW = (c.curr + c.prev) > 0 ? Math.min((c.curr / (c.curr + c.prev)) * 100, 100) : 50;
              const isBad = i === 3 && up; // descuentos: subir es malo
              const goodColor = isBad ? 'var(--danger)' : up ? 'var(--cfs-gold)' : 'var(--danger)';
              return (
                <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>{c.label}</div>
                  <div style={{ fontFamily: 'Outfit', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, marginBottom: '4px' }}>{c.fmtFn(c.curr)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>vs {c.fmtFn(c.prev)} mes ant.</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: '12px', background: up ? 'rgba(46,202,127,0.12)' : 'rgba(239,68,68,0.12)', color: up ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}{up ? '+' : ''}{c.pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ minWidth: 0, minHeight: 0, height: '5px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.07)' }}>
                    <div style={{ width: `${barW}%`, height: '100%', background: goodColor, borderRadius: '8px', opacity: 0.8 }} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '5px' }}>{data.momCurr.days} días vs {data.momPrev.days} días</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PROPINAS ANALYTICS ──────────────────────────────────────────── */}
      {(data.tipTrend.length > 0 || data.tipByRestaurant.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>

          {/* Tip Rate Trending 30d */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
              <Award size={16} style={{ color: '#2eca7f' }} /> Tasa de Propinas — 30 Días
            </div>
            {data.tipTrend.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Prom: <strong style={{ color: '#2eca7f' }}>{(data.tipTrend.reduce((a, d) => a + d.tipRate, 0) / data.tipTrend.length).toFixed(1)}%</strong></span>
                  <span>Máx: <strong style={{ color: 'var(--cfs-gold)' }}>{Math.max(...data.tipTrend.map(d => d.tipRate)).toFixed(1)}%</strong></span>
                  <span>Total props: <strong style={{ color: '#2eca7f' }}>{fmtK(data.totalTips30)}</strong></span>
                </div>
                <div style={{ minWidth: 0, minHeight: 0, height: 200 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={data.tipTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tipGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2eca7f" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#2eca7f" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                      <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`${v.toFixed(0)}%`}/>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: '#2eca7f', borderRadius: '10px', fontSize: '0.78rem' }}
                        formatter={(v: any, n: any) => [n === 'tipRate' ? `${v.toFixed(2)}%` : `$${v.toLocaleString()}`, n === 'tipRate' ? 'Tip Rate' : 'Propinas']}/>
                      <Area type="monotone" dataKey="tipRate" stroke="#2eca7f" strokeWidth={2.5} fill="url(#tipGrad)" dot={false} isAnimationActive animationDuration={1200}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin datos de propinas en los últimos 30 días.</p>}
          </div>

          {/* Tip Rate por Restaurante */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
              <Users size={16} style={{ color: '#2eca7f' }} /> Propinas por Sucursal — 30 Días
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '1.1rem' }}>Tip Rate% = propinas / monto total pagado</div>
            {data.tipByRestaurant.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin datos por restaurante.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {data.tipByRestaurant.map((t, i) => {
                  const maxRate = Math.max(...data.tipByRestaurant.map(x => x.tipRate));
                  const barW = maxRate > 0 ? (t.tipRate / maxRate * 100) : 0;
                  const rankCol = i === 0 ? '#DDA756' : i === 1 ? '#94A3B8' : i === 2 ? '#b87333' : 'var(--text-muted)';
                  return (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.7rem', color: rankCol, width: '20px', flexShrink: 0 }}>#{i+1}</span>
                        <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                        <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.88rem', color: '#2eca7f' }}>{t.tipRate.toFixed(1)}%</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>${t.avgTipPerTx.toFixed(2)}/tx</span>
                        <span style={{ fontSize: '0.7rem', color: '#DDA756', minWidth: '52px', textAlign: 'right' }}>{fmtK(t.totalTips)}</span>
                      </div>
                      <div style={{ minWidth: 0, minHeight: 0, marginLeft: '28px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                        <div style={{ width: `${barW}%`, height: '100%', background: '#2eca7f', borderRadius: '4px', opacity: 0.75 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
