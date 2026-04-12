'use client';

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Cell,
} from 'recharts';
import {
  Users, TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  Clock, Calendar, Award, BarChart2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { cleanStoreName as _cleanName } from '@/utils/formatters';

interface ClientesData {
  lastDate: string;
  kpi: { guests: number; orders: number; netSales: number; avgGuestPerOrder: number; avgSpendPerGuest: number };
  trend90: { date: string; guests: number; orders: number; sales: number; ma7: number }[];
  hourly: { time: string; clientes: number; ordenes: number; ventas: number }[];
  byStore: { storeName: string | null; guests: number; orders: number; sales: number }[];
  byDow: { day: string; dow: number; avgGuests: number; avgOrders: number; avgSales: number }[];
  top30stores: { storeName: string | null; guests: number; orders: number; sales: number; days: number }[];
  guestTrend30: { date: string; guests: number; orders: number }[];
  total30guests: number;
  total30orders: number;
  avgDailyGuests30: number;
}

const fmt = (n: number, d = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0);
const COLORS = ['#DDA756', '#3b82f6', '#2eca7f', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

const cleanName = (v: string | null) => _cleanName(v);

const WoW = ({ curr, prev, label }: { curr: number; prev: number; label?: string }) => {
  const pct = prev > 0 ? ((curr - prev) / prev * 100) : 0;
  const up = pct >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.73rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: up ? 'rgba(46,202,127,0.12)' : 'rgba(239,68,68,0.12)', color: up ? 'var(--success)' : 'var(--danger)' }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct.toFixed(1)}% {label ?? 'WoW'}
    </span>
  );
};

export default function ClientesUI({ data }: { data: ClientesData }) {
  const [metric, setMetric] = useState<'guests' | 'orders' | 'sales'>('guests');
  const [range, setRange] = useState<30 | 60 | 90>(90);

  const dateFmt = new Date(data.lastDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const bestHour = data.hourly.length > 0 ? data.hourly.reduce((b, h) => h.clientes > b.clientes ? h : b, data.hourly[0]) : null;
  const bestDow = data.byDow.length > 0 ? data.byDow.reduce((b, d) => d.avgGuests > b.avgGuests ? d : b, data.byDow[0]) : null;
  const totalStores = data.byStore.filter(s => s.guests > 0).length;

  const trendSlice = useMemo(() => data.trend90.slice(-range), [data.trend90, range]);
  const totalGuests90 = trendSlice.reduce((a, d) => a + d.guests, 0);
  const best90 = trendSlice.length > 0 ? Math.max(...trendSlice.map(d => d.guests)) : 0;
  const avg90 = trendSlice.length > 0 ? totalGuests90 / trendSlice.length : 0;

  return (
    <div className="animate-in">
      {/* BANNER */}
      <header style={{ position: 'relative', minHeight: '155px', borderRadius: '20px', overflow: 'hidden', marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-end', padding: '1.75rem 2.5rem', border: '1px solid var(--border-color)', backgroundImage: `url('/IMG_3221_edited.avif')`, backgroundSize: 'cover', backgroundPosition: 'center 40%' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg,rgba(7,11,20,0.97) 0%,rgba(7,11,20,0.65) 55%,rgba(7,11,20,0.1) 100%)', zIndex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <div style={{ minWidth: 0, minHeight: 0, background: 'var(--cfs-gold)', width: '4px', height: '26px', borderRadius: '4px' }} />
            <h1 style={{ fontSize: '1.75rem', color: '#FDFBF7', fontWeight: 800, fontFamily: 'Outfit', letterSpacing: '-0.03em' }}>Análisis de Clientes</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginLeft: '14px' }}>CFSCoffee · Último cierre: <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, textTransform: 'capitalize' }}>{dateFmt}</span></p>
        </div>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { l: 'Clientes Hoy', v: data.kpi.guests.toLocaleString() },
            { l: 'Total 30 Días', v: fmtK(data.total30guests) },
            { l: 'Prom. Diario', v: Math.round(data.avgDailyGuests30).toLocaleString() },
            { l: 'Tiendas Activas', v: totalStores.toString() },
          ].map(p => (
            <div key={p.l} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(221,167,86,0.2)', borderRadius: '10px', padding: '5px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1rem', color: 'var(--cfs-gold)' }}>{p.v}</div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{p.l}</div>
            </div>
          ))}
        </div>
      </header>

      {/* KPI CARDS */}
      <div className="grid-cols-5" style={{ marginBottom: '1.75rem' }}>
        {[
          { icon: <Users size={18}/>, WM: Users, col: 'var(--cfs-gold)', bg: 'var(--cfs-gold-dim)', label: 'Clientes Hoy', val: data.kpi.guests.toLocaleString(), sub: `Prom. 30d: ${Math.round(data.avgDailyGuests30).toLocaleString()}/día` },
          { icon: <ShoppingCart size={18}/>, WM: ShoppingCart, col: 'var(--info)', bg: 'rgba(79,172,254,0.12)', label: 'Órdenes Hoy', val: data.kpi.orders.toLocaleString(), sub: `${data.kpi.avgGuestPerOrder.toFixed(2)} clientes/orden` },
          { icon: <DollarSign size={18}/>, WM: DollarSign, col: 'var(--success)', bg: 'rgba(46,202,127,0.12)', label: 'Gasto/Cliente', val: fmt(data.kpi.avgSpendPerGuest), sub: `Ventas totales: ${fmt(data.kpi.netSales)}` },
          { icon: <Clock size={18}/>, WM: Clock, col: 'var(--cfs-gold)', bg: 'var(--cfs-gold-dim)', label: 'Hora Pico', val: bestHour?.time ?? '—', sub: `${bestHour?.clientes ?? 0} clientes en esa hora` },
          { icon: <Calendar size={18}/>, WM: Calendar, col: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'Mejor Día Sem.', val: bestDow?.day ?? '—', sub: `Prom: ${bestDow ? Math.round(bestDow.avgGuests).toLocaleString() : '—'} clientes` },
        ].map((c, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.3rem', position: 'relative', overflow: 'hidden' }}>
            <c.WM size={128} style={{ position: 'absolute', bottom: '-20px', right: '-20px', opacity: 0.04, transform: 'rotate(-10deg)', zIndex: 0, pointerEvents: 'none', color: 'var(--text-main)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ minWidth: 0, minHeight: 0, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, color: c.col, border: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.8rem' }}>{c.icon}</div>
              <div style={{ fontFamily: 'Outfit', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '3px' }}>{c.val}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.6, marginTop: '2px' }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* TENDENCIA + HORA PICO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Tendencia 90 días */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={16} style={{ color: 'var(--cfs-gold)' }} /> Tendencia Histórica de Clientes</div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Línea punteada = media móvil 7 días</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['guests','orders','sales'] as const).map(k => (
                <button key={k} onClick={() => setMetric(k)} style={{ padding: '4px 11px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', borderColor: metric === k ? 'var(--cfs-gold)' : 'var(--border-color)', background: metric === k ? 'var(--cfs-gold-dim)' : 'transparent', color: metric === k ? 'var(--cfs-gold)' : 'var(--text-muted)', fontSize: '0.73rem', fontWeight: 600, fontFamily: 'inherit' }}>
                  {k === 'guests' ? 'Clientes' : k === 'orders' ? 'Órdenes' : 'Ventas'}
                </button>
              ))}
              <div style={{ minWidth: 0, minHeight: 0, width: '1px', height: '20px', background: 'var(--border-color)' }} />
              {([30, 60, 90] as const).map(r => (
                <button key={r} onClick={() => setRange(r)} style={{ padding: '4px 9px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', borderColor: range === r ? 'rgba(255,255,255,0.2)' : 'var(--border-color)', background: range === r ? 'rgba(255,255,255,0.06)' : 'transparent', color: range === r ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'inherit' }}>{r}d</button>
              ))}
            </div>
          </div>
          <div style={{ minWidth: 0, minHeight: 0, height: 240 }}>
            <ResponsiveContainer>
              <ComposedChart data={trendSlice} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="cliGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DDA756" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#DDA756" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} interval={Math.floor(trendSlice.length / 10)}/>
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => metric === 'sales' ? `$${v}` : v.toLocaleString()}/>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--cfs-gold)', borderRadius: '10px', fontSize: '0.78rem' }}
                  formatter={(v: any) => [metric === 'sales' ? `$${v.toLocaleString()}` : v.toLocaleString(), metric === 'guests' ? 'Clientes' : metric === 'orders' ? 'Órdenes' : 'Ventas']}/>
                <Area type="monotone" dataKey={metric} stroke="#DDA756" strokeWidth={2.5} fill="url(#cliGrad)" dot={false} isAnimationActive animationDuration={1200}/>
                {metric === 'guests' && <Line type="monotone" dataKey="ma7" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} dot={false} strokeDasharray="5 3"/>}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
            {[
              { l: `Total ${range}d`, v: trendSlice.reduce((a, d) => a + d.guests, 0).toLocaleString() },
              { l: 'Prom./día', v: Math.round(avg90).toLocaleString() },
              { l: 'Mejor día', v: best90.toLocaleString() },
              { l: 'Días con datos', v: trendSlice.filter(d => d.guests > 0).length.toString() },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{s.v}</div>
                <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: '2px' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Flujo horario + Día de semana */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Hora pico */}
          <div className="glass-card" style={{ padding: '1.4rem', flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Clock size={14} style={{ color: 'var(--cfs-gold)' }} /> Flujo por Hora — Hoy
            </div>
            <div style={{ minWidth: 0, minHeight: 0, height: 150 }}>
              <ResponsiveContainer>
                <BarChart data={data.hourly} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} interval={2}/>
                  <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem' }} formatter={(v: any) => [v, 'Clientes']}/>
                  <Bar dataKey="clientes" radius={[4, 4, 0, 0]} barSize={14}>
                    {data.hourly.map((h, i) => <Cell key={i} fill={h.time === bestHour?.time ? '#DDA756' : 'rgba(221,167,86,0.4)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Día de semana */}
          <div className="glass-card" style={{ padding: '1.4rem', flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Calendar size={14} style={{ color: 'var(--cfs-gold)' }} /> Prom. Clientes por Día Semana
            </div>
            <div style={{ minWidth: 0, minHeight: 0, height: 150 }}>
              <ResponsiveContainer>
                <BarChart data={data.byDow} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                  <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}/>
                  <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem' }} formatter={(v: any) => [Math.round(v).toLocaleString(), 'Prom. Clientes']}/>
                  <Bar dataKey="avgGuests" radius={[6, 6, 0, 0]} barSize={24}>
                    {data.byDow.map((d, i) => <Cell key={i} fill={d.day === bestDow?.day ? '#DDA756' : 'rgba(221,167,86,0.4)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* TABLA: Por Sucursal Hoy + 30 días */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

        {/* Sucursales hoy */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.2rem' }}>
            <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} /> Clientes por Sucursal — Hoy
          </div>
          {data.byStore.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin datos para hoy.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {data.byStore.map((s, i) => {
                const total = data.byStore.reduce((a, x) => a + x.guests, 0);
                const pct = total > 0 ? (s.guests / total * 100) : 0;
                const sph = s.guests > 0 ? s.sales / s.guests : 0;
                const rankCol = i === 0 ? '#DDA756' : i === 1 ? '#94A3B8' : i === 2 ? '#b87333' : 'var(--text-muted)';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.72rem', color: rankCol, width: '22px', textAlign: 'center', flexShrink: 0 }}>#{i + 1}</span>
                    <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600 }}>{cleanName(s.storeName)}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ width: `${Math.max(pct * 0.6, 3)}px`, height: '4px', borderRadius: '4px', background: COLORS[i % COLORS.length], opacity: 0.7, maxWidth: '50px' }} />
                      <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.88rem', color: 'var(--cfs-gold)', minWidth: '38px', textAlign: 'right' }}>{s.guests.toLocaleString()}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '34px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--success)', minWidth: '44px', textAlign: 'right' }}>{fmt(sph)}/cli</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 30d */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.3rem' }}>
            <Award size={16} style={{ color: 'var(--cfs-gold)' }} /> Ranking Clientes 30 Días
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '1.1rem' }}>
            Total: <span style={{ color: 'var(--cfs-gold)', fontWeight: 700 }}>{data.total30guests.toLocaleString()}</span> clientes · <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{data.total30orders.toLocaleString()}</span> órdenes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {data.top30stores.map((s, i) => {
              const total = data.top30stores.reduce((a, x) => a + x.guests, 0);
              const pct = total > 0 ? (s.guests / total * 100) : 0;
              const avgPerDay = s.days > 0 ? s.guests / s.days : 0;
              const rankCol = i === 0 ? '#DDA756' : i === 1 ? '#94A3B8' : i === 2 ? '#b87333' : 'var(--text-muted)';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.72rem', color: rankCol, width: '22px', textAlign: 'center', flexShrink: 0 }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600 }}>{cleanName(s.storeName)}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.88rem', color: 'var(--cfs-gold)', minWidth: '48px', textAlign: 'right' }}>{fmtK(s.guests)}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '34px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', minWidth: '52px', textAlign: 'right' }}>{Math.round(avgPerDay)}/día</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
