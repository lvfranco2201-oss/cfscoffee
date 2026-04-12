'use client';

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Cell, ReferenceLine, LineChart,
} from 'recharts';
import {
  Clock, DollarSign, TrendingUp, TrendingDown, Calendar,
  BarChart2, Zap, AlertTriangle, CheckCircle, Activity, Users, Download,
} from 'lucide-react';
import { exportToCSV } from '@/utils/exportCSV';

interface LaborData {
  lastDate: string;
  kpi?: { laborCost: number; laborHours: number; netSales: number; orders: number; guests: number; laborPct: number; salesPerLH: number; laborPerHour: number; openOrderRate: number; voidOrderRate: number; openOrders: number; voidOrders: number };
  hourly?: { time: string; laborCost: number; laborHours: number; ventas: number; laborPct: number; salesPerLH: number; openOrderRate: number; voidOrders: number }[];
  storeRows?: { storeId: number; storeName: string; laborCost: number; laborHours: number; storeSales: number; storeOrders: number; avgSalesPerLH: number; laborPct: number; costPerHour: number }[];
  trend30?: { date: string; laborCost: number; laborHours: number; netSales: number; laborPct: number; voidRate: number; discountRate: number }[];
  byDow?: { day: string; dow: number; avgLaborCost: number; avgLaborHours: number; avgSales: number; avgLaborPct: number }[];
  splhHourly?: { time: string; salesPerLH: number; netSales: number; laborHours: number }[];
  voidDiscTrend?: { date: string; voidRate: number; discountRate: number; refundRate: number; netSales: number }[];
  currWeek?: { laborCost: number; laborHours: number; netSales: number; laborPct: number; voidOrders?: number };
  prevWeek?: { laborCost: number; laborHours: number; netSales: number; laborPct: number };
  wowLaborCost?: number;
}


const fmt  = (n: number, d = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;
const COLOR_SAFE = '#2eca7f'; const COLOR_DANGER = '#ef4444'; const COLOR_WARN = '#f59e0b'; const COLOR_GOLD = '#DDA756';
const TARGET_LABOR_PCT = 28;

export default function InventarioUI({ data }: { data: LaborData }) {
  const dateFmt = new Date((data?.lastDate ?? '') + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Defensive guard: if data is incomplete, show empty state
  if (!data?.lastDate) {
    return (
      <div style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Outfit' }}>Sin Datos Laborales</h2>
      </div>
    );
  }

  const hourly      = data.hourly      ?? [];

  const storeRows   = data.storeRows   ?? [];
  const trend30     = data.trend30     ?? [];
  const byDow       = data.byDow       ?? [];
  const splhHourly  = data.splhHourly  ?? [];
  const voidDiscTrend = data.voidDiscTrend ?? [];
  const laborOk   = (data.kpi?.laborPct ?? 0) > 0 && (data.kpi?.laborPct ?? 0) <= TARGET_LABOR_PCT;
  const wowUp     = (data.wowLaborCost ?? 0) >= 0;
  const bestDow   = byDow.length > 0 ? byDow.filter(d => d.avgLaborPct > 0).reduce<typeof byDow[0] | null>((b, d) => (!b || d.avgLaborPct < b.avgLaborPct) ? d : b, null) : null;

  const totalLaborCost30 = trend30.reduce((a, d) => a + d.laborCost, 0);
  const totalLaborHrs30  = trend30.reduce((a, d) => a + d.laborHours, 0);
  const avgLaborPct30    = trend30.filter(d => d.laborPct > 0).length > 0
    ? trend30.filter(d => d.laborPct > 0).reduce((a, d) => a + d.laborPct, 0) / trend30.filter(d => d.laborPct > 0).length : 0;
  const minLaborPct30    = trend30.filter(d => d.laborPct > 0).length > 0 ? Math.min(...trend30.filter(d => d.laborPct > 0).map(d => d.laborPct)) : 0;
  const maxLaborPct30    = trend30.length > 0 ? Math.max(...trend30.map(d => d.laborPct)) : 0;

  // Safe KPI with defaults
  const kpi = data.kpi ?? { laborCost: 0, laborHours: 0, netSales: 0, orders: 0, guests: 0, laborPct: 0, salesPerLH: 0, laborPerHour: 0, openOrderRate: 0, voidOrderRate: 0, openOrders: 0, voidOrders: 0 };
  const currWeek = data.currWeek ?? { laborCost: 0, laborHours: 0, netSales: 0, laborPct: 0 };
  const prevWeek = data.prevWeek ?? { laborCost: 0, laborHours: 0, netSales: 0, laborPct: 0 };
  const wowLaborCost = data.wowLaborCost ?? 0;

  // Tabla stores sorted by laborPct descending (most costly first)
  const storeSorted = [...storeRows].sort((a, b) => b.laborPct - a.laborPct);
  const storesSortedByCost = [...storeRows].sort((a, b) => b.laborCost - a.laborCost);


  return (
    <div className="animate-in">
      {/* ── BANNER ─────────────────────────────────────────────────────────── */}
      <header style={{ position: 'relative', minHeight: '155px', borderRadius: '20px', overflow: 'hidden', marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-end', padding: '1.75rem 2.5rem', border: '1px solid var(--border-color)', backgroundImage: `url('/IMG_3221_edited.avif')`, backgroundSize: 'cover', backgroundPosition: 'center 35%' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg,rgba(7,11,20,0.97) 0%,rgba(7,11,20,0.65) 55%,rgba(7,11,20,0.1) 100%)', zIndex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <div style={{ minWidth: 0, minHeight: 0, background: COLOR_GOLD, width: '4px', height: '26px', borderRadius: '4px' }} />
            <h1 style={{ fontSize: '1.75rem', color: '#FDFBF7', fontWeight: 800, fontFamily: 'Outfit', letterSpacing: '-0.03em' }}>Eficiencia Operacional</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginLeft: '14px' }}>
            CFSCoffee · {dateFmt}
            <span style={{ marginLeft: '12px' }}>· Labor objetivo: <span style={{ color: laborOk ? '#2eca7f' : '#f59e0b', fontWeight: 700 }}>&lt;{TARGET_LABOR_PCT}%</span></span>
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { l: 'Labor Hoy', v: fmtK(kpi.laborCost) },
            { l: 'Labor%', v: `${kpi.laborPct.toFixed(1)}%`, hi: !laborOk && kpi.laborPct > 0 },
            { l: '$V/H Labor', v: fmtK(kpi.salesPerLH) },
            { l: 'Prom. 30d', v: `${avgLaborPct30.toFixed(1)}%` },
          ].map(p => (
            <div key={p.l} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: `1px solid ${(p as { hi?: boolean }).hi ? 'rgba(245,158,11,0.4)' : 'rgba(221,167,86,0.2)'}`, borderRadius: '10px', padding: '5px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1rem', color: (p as { hi?: boolean }).hi ? '#f59e0b' : COLOR_GOLD }}>{p.v}</div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{p.l}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div className="grid-cols-6" style={{ marginBottom: '1.75rem' }}>
        {[
          { icon: <DollarSign size={17}/>, WM: DollarSign, col: COLOR_GOLD, bg: 'var(--cfs-gold-dim)', label: 'Costo Laboral', val: fmt(kpi.laborCost), sub: `${kpi.laborHours.toFixed(1)}h trabajadas hoy` },
          { icon: laborOk ? <CheckCircle size={17}/> : <AlertTriangle size={17}/>, WM: laborOk ? CheckCircle : AlertTriangle, col: laborOk ? COLOR_SAFE : COLOR_WARN, bg: laborOk ? 'rgba(46,202,127,0.12)' : 'rgba(245,158,11,0.12)', label: 'Labor %', val: kpi.laborPct > 0 ? `${kpi.laborPct.toFixed(1)}%` : '—', sub: `Obj: <${TARGET_LABOR_PCT}% · 30d: ${avgLaborPct30.toFixed(1)}%` },
          { icon: <Zap size={17}/>, WM: Zap, col: 'var(--info)', bg: 'rgba(79,172,254,0.12)', label: '$Venta/Hora Lab.', val: fmt(kpi.salesPerLH), sub: 'Indicador de eficiencia' },
          { icon: <Clock size={17}/>, WM: Clock, col: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', label: 'Costo/Hora Lab.', val: fmt(kpi.laborPerHour), sub: 'Costo promedio hora trabajada' },
          { icon: <Activity size={17}/>, WM: Activity, col: kpi.openOrderRate > 15 ? COLOR_DANGER : COLOR_SAFE, bg: kpi.openOrderRate > 15 ? 'rgba(239,68,68,0.10)' : 'rgba(46,202,127,0.10)', label: 'Órdenes Abiertas', val: kpi.openOrders.toLocaleString(), sub: `${kpi.openOrderRate.toFixed(1)}% del total (congestión)` },
          { icon: wowUp ? <TrendingUp size={17}/> : <TrendingDown size={17}/>, WM: wowUp ? TrendingUp : TrendingDown, col: wowUp ? COLOR_DANGER : COLOR_SAFE, bg: wowUp ? 'rgba(239,68,68,0.10)' : 'rgba(46,202,127,0.10)', label: 'Variación WoW', val: `${wowUp ? '+' : ''}${wowLaborCost.toFixed(1)}%`, sub: `${fmtK(currWeek.laborCost)} vs ${fmtK(prevWeek.laborCost)}` },
        ].map((c, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
            <c.WM size={128} style={{ position: 'absolute', bottom: '-20px', right: '-20px', opacity: 0.04, transform: 'rotate(-10deg)', zIndex: 0, pointerEvents: 'none', color: 'var(--text-main)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ minWidth: 0, minHeight: 0, width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, color: c.col, marginBottom: '0.7rem' }}>{c.icon}</div>
              <div style={{ fontFamily: 'Outfit', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '2px' }}>{c.val}</div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', opacity: 0.6, marginTop: '2px' }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FILA 1: Tendencia Labor% 30d + Void/Discount Rate 30d ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Labor% 30 días con objetivo */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <TrendingUp size={15} style={{ color: COLOR_GOLD }} /> Tendencia Labor% — 30 Días
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>Prom: <strong style={{ color: 'var(--text-main)' }}>{avgLaborPct30.toFixed(1)}%</strong></span>
            <span>Mín: <strong style={{ color: COLOR_SAFE }}>{minLaborPct30.toFixed(1)}%</strong></span>
            <span>Máx: <strong style={{ color: COLOR_DANGER }}>{maxLaborPct30.toFixed(1)}%</strong></span>
            <span>Total labor: <strong style={{ color: COLOR_GOLD }}>{fmtK(totalLaborCost30)}</strong></span>
          </div>
          <div style={{ minWidth: 0, minHeight: 0, height: 220 }}>
            <ResponsiveContainer>
              <ComposedChart data={trend30} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="lGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_GOLD} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={COLOR_GOLD} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} domain={[0, Math.max(maxLaborPct30 * 1.15, TARGET_LABOR_PCT + 5)]}/>
                <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: COLOR_GOLD, borderRadius: '10px', fontSize: '0.78rem' }}
                  formatter={(v: any, n: any) => [n === 'laborPct' ? `${v.toFixed(1)}%` : fmtK(v), n === 'laborPct' ? 'Labor%' : 'Costo Labor']}/>
                <ReferenceLine y={TARGET_LABOR_PCT} stroke="rgba(239,68,68,0.45)" strokeDasharray="5 4"
                  label={{ value: `${TARGET_LABOR_PCT}% obj.`, fill: 'rgba(239,68,68,0.6)', fontSize: 10, position: 'insideTopRight' }}/>
                <ReferenceLine y={avgLaborPct30} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"
                  label={{ value: `Prom ${avgLaborPct30.toFixed(1)}%`, fill: 'var(--text-muted)', fontSize: 10, position: 'insideBottomRight' }}/>
                <Area type="monotone" dataKey="laborPct" stroke={COLOR_GOLD} strokeWidth={2.5} fill="url(#lGrad)" dot={false} isAnimationActive animationDuration={1200}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Void rate + Discount rate 30d duales */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <AlertTriangle size={15} style={{ color: COLOR_WARN }} /> Voids & Descuentos — 30 Días
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ minWidth: 0, minHeight: 0, width: '10px', height: '3px', background: COLOR_DANGER, display: 'inline-block', borderRadius: '2px' }}/> Void%</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ minWidth: 0, minHeight: 0, width: '10px', height: '3px', background: COLOR_WARN, display: 'inline-block', borderRadius: '2px' }}/> Descuento%</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ minWidth: 0, minHeight: 0, width: '10px', height: '3px', background: COLOR_GOLD, display: 'inline-block', borderRadius: '2px', borderTop: '1px dashed' }}/> Refund%</span>
          </div>
          <div style={{ minWidth: 0, minHeight: 0, height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={voidDiscTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`${v.toFixed(1)}%`}/>
                <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px', fontSize: '0.78rem' }}
                  formatter={(v: any, n: any) => [`${v.toFixed(2)}%`, n === 'voidRate' ? 'Void%' : n === 'discountRate' ? 'Descuento%' : 'Refund%']}/>
                <Line type="monotone" dataKey="voidRate" stroke={COLOR_DANGER} strokeWidth={2} dot={false} name="voidRate"/>
                <Line type="monotone" dataKey="discountRate" stroke={COLOR_WARN} strokeWidth={2} dot={false} name="discountRate"/>
                <Line type="monotone" dataKey="refundRate" stroke={COLOR_GOLD} strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="refundRate"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── FILA 2: Labor por Hora + SalesPerLH por Hora + DayOfWeek ─────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Labor% por hora hoy */}
        <div className="glass-card" style={{ padding: '1.4rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Clock size={14} style={{ color: COLOR_GOLD }} /> Labor% por Hora — Hoy
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Rojo = supera objetivo del {TARGET_LABOR_PCT}%</div>
          {hourly.length === 0
            ? <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin datos horarios.</div>
            : <div style={{ minWidth: 0, minHeight: 0, height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={hourly} margin={{ top: 0, right: 5, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                    <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} interval={2}/>
                    <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}/>
                    <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.73rem' }}
                      formatter={(v: any, n: any) => [n === 'laborPct' ? `${v.toFixed(1)}%` : v.toFixed(0), n === 'laborPct' ? 'Labor%' : 'Voids']}/>
                    <ReferenceLine y={TARGET_LABOR_PCT} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3"/>
                    <Bar dataKey="laborPct" radius={[4, 4, 0, 0]} barSize={14} name="laborPct">
                      {hourly.map((h, i) => <Cell key={i} fill={h.laborPct > TARGET_LABOR_PCT ? COLOR_DANGER : h.laborPct > TARGET_LABOR_PCT * 0.85 ? COLOR_WARN : COLOR_GOLD}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
          }
        </div>

        {/* $Ventas/Hora Laboral */}
        <div className="glass-card" style={{ padding: '1.4rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Zap size={14} style={{ color: 'var(--info)' }} /> $Ventas por Hora Laboral — Hoy
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>SalesPerLaborHour — eficiencia por franja</div>
          {splhHourly.length === 0
            ? <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '2rem 0', textAlign: 'center' }}>Sin datos de SalesPerLaborHour.</div>
            : <div style={{ minWidth: 0, minHeight: 0, height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={splhHourly} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                    <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} interval={2}/>
                    <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/>
                    <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.73rem' }} formatter={(v: any) => [`$${v.toFixed(0)}`, '$V/H Laboral']}/>
                    <Bar dataKey="salesPerLH" radius={[4, 4, 0, 0]} barSize={14}>
                      {(() => {
                        const maxSPLH = splhHourly.length > 0 ? Math.max(...splhHourly.map(h => h.salesPerLH)) : 0;
                        return splhHourly.map((h, i) => (<Cell key={i} fill={maxSPLH > 0 && h.salesPerLH >= maxSPLH * 0.85 ? 'var(--info)' : 'rgba(79,172,254,0.45)'}/>));
                      })()}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
          }
        </div>

        {/* Labor% por día de semana */}
        <div className="glass-card" style={{ padding: '1.4rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Calendar size={14} style={{ color: COLOR_GOLD }} /> Labor% Prom. por Día (90d)
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {bestDow ? <><span style={{ color: COLOR_SAFE, fontWeight: 700 }}>{bestDow.day}</span> es el día más eficiente</> : 'Eficiencia por día'}
          </div>
          {byDow.length === 0
            ? <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin datos.</div>
            : <div style={{ minWidth: 0, minHeight: 0, height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={byDow} margin={{ top: 0, right: 5, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}/>
                    <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}/>
                    <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.73rem' }} formatter={(v: any) => [`${v.toFixed(1)}%`, 'Labor% Prom.']}/>
                    <ReferenceLine y={TARGET_LABOR_PCT} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3"/>
                    <Bar dataKey="avgLaborPct" radius={[6, 6, 0, 0]} barSize={24}>
                      {byDow.map((d, i) => <Cell key={i} fill={
                        d.day === bestDow?.day ? COLOR_SAFE
                        : d.avgLaborPct > TARGET_LABOR_PCT ? COLOR_DANGER
                        : d.avgLaborPct > TARGET_LABOR_PCT * 0.9 ? COLOR_WARN
                        : COLOR_GOLD
                      }/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
          }
        </div>
      </div>

      {/* ── TABLA POR SUCURSAL ─────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.3rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={16} style={{ color: COLOR_GOLD }} /> Eficiencia Laboral por Sucursal — 30 Días
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Ordenado de mayor a menor costo laboral · Labor &gt;{TARGET_LABOR_PCT}% = área de atención</div>
          </div>
          <button
            onClick={() => {
              const exportData = storeSorted.map(row => ({
                Sucursal: row.storeName,
                Costo_Labor: row.laborCost,
                Horas_Trabajadas: row.laborHours,
                Costo_Por_Hora: row.costPerHour,
                Venta_Por_Hora_Lab: row.avgSalesPerLH,
                Ventas_30d: row.storeSales,
                Labor_Pct: row.laborPct,
                Estado: row.laborPct < TARGET_LABOR_PCT ? 'Eficiente' : 'Atención'
              }));
              exportToCSV(exportData, 'CFS_Labor_Sucursales', { Costo_Labor: 'Costo Laboral ($)', Horas_Trabajadas: 'Horas Trabajadas', Costo_Por_Hora: 'Costo por Hora ($)', Venta_Por_Hora_Lab: 'Ventas por Hora Lab ($)', Ventas_30d: 'Ventas Netas ($)', Labor_Pct: 'Labor %' });
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 12px', borderRadius: '10px',
              background: 'rgba(221,167,86,0.1)', color: 'var(--cfs-gold)',
              border: '1px solid rgba(221,167,86,0.2)',
              fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: 'inherit'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(221,167,86,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(221,167,86,0.1)' }}
            title="Exportar a Excel (CSV)"
          >
            <Download size={14} /> Exportar
          </button>
        </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ minWidth: 0, minHeight: 0, width: '8px', height: '8px', borderRadius: '50%', background: COLOR_SAFE, display: 'inline-block' }}/> &lt;{TARGET_LABOR_PCT}%</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ minWidth: 0, minHeight: 0, width: '8px', height: '8px', borderRadius: '50%', background: COLOR_WARN, display: 'inline-block' }}/> Cerca del límite</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ minWidth: 0, minHeight: 0, width: '8px', height: '8px', borderRadius: '50%', background: COLOR_DANGER, display: 'inline-block' }}/> &gt;{TARGET_LABOR_PCT}%</span>
          </div>
        {storeSorted.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin datos laborales por tienda en los últimos 30 días.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '750px' }}>
              <thead>
                <tr>
                  {['#', 'Sucursal', 'Costo Labor', 'Horas', '$C/Hora', '$V/H Lab.', 'Ventas 30d', 'Labor %', 'Estado'].map((h, i) => (
                    <th key={i} style={{ padding: '9px 10px', textAlign: i === 0 ? 'center' : i >= 2 ? 'right' : 'left', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storeSorted.map((s, i) => {
                  const isHigh = s.laborPct > TARGET_LABOR_PCT;
                  const isWarn = s.laborPct > TARGET_LABOR_PCT * 0.9 && !isHigh;
                  const statusColor = isHigh ? COLOR_DANGER : isWarn ? COLOR_WARN : s.laborPct > 0 ? COLOR_SAFE : 'var(--text-muted)';
                  const rankIdx = storesSortedByCost.findIndex(r => r.storeId === s.storeId);
                  const rankCol = rankIdx === 0 ? '#DDA756' : rankIdx === 1 ? '#94A3B8' : rankIdx === 2 ? '#b87333' : 'var(--text-muted)';
                  return (
                    <tr key={s.storeId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.72rem', color: rankCol }}>#{rankIdx + 1}</span>
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.storeName}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: COLOR_GOLD, fontFamily: 'Outfit', fontWeight: 700 }}>{fmt(s.laborCost)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)' }}>{s.laborHours.toFixed(0)}h</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{s.costPerHour > 0 ? fmt(s.costPerHour) : '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: 'var(--info)' }}>{s.avgSalesPerLH > 0 ? `$${s.avgSalesPerLH.toFixed(0)}` : '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{s.storeSales > 0 ? fmt(s.storeSales) : '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: statusColor }}>
                          {s.laborPct > 0 ? `${s.laborPct.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {s.laborPct > 0 ? (
                          isHigh
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', color: COLOR_DANGER }}>↑ Alto</span>
                            : isWarn
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(245,158,11,0.12)', color: COLOR_WARN }}>! Cuidado</span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(46,202,127,0.12)', color: COLOR_SAFE }}>✓ OK</span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
