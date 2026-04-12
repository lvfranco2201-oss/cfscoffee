'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Utensils, Smartphone, Layers, Percent, ShoppingCart, DollarSign, AlertTriangle, TrendingDown } from 'lucide-react';

interface ProductosData {
  lastDate: string;
  kpi: { netSales: number; grossSales: number; orders: number; guests: number; discounts: number; voids: number; discountOrders: number; voidOrders: number; avgOrderValue: number };
  byDiningOption: { diningOption: string | null; netSales: number; grossSales: number; orders: number; guests: number; discounts: number; avgOrderValue: number }[];
  byOrderSource: { orderSource: string | null; netSales: number; orders: number; discounts: number; avgOrderValue: number }[];
  byRevenueCenter: { revenueCenter: string | null; netSales: number; orders: number; avgOrderValue: number; discounts: number }[];
  aovHourly: { time: string; aov: number; orders: number; discountOrders: number }[];
  discountByChannel: { name: string; discountPct: number; discountPerOrder: number; discountOrderPct: number; totalDiscounts: number; totalOrders: number }[];
}

const fmt = (n: number, d = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const fmtK = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;
const COLORS = ['#DDA756', '#3b82f6', '#2eca7f', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

export default function ProductosUI({ data }: { data: ProductosData }) {
  const dateFmt = new Date(data.lastDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const discPct  = data.kpi.grossSales > 0 ? (data.kpi.discounts / data.kpi.grossSales * 100) : 0;
  const voidPct  = data.kpi.grossSales > 0 ? (data.kpi.voids / data.kpi.grossSales * 100) : 0;
  const discOrderPct = data.kpi.orders > 0 ? (data.kpi.discountOrders / data.kpi.orders * 100) : 0;

  const diningTotal = data.byDiningOption.reduce((a, d) => a + d.netSales, 0);
  const sourceTotal = data.byOrderSource.reduce((a, d) => a + d.netSales, 0);
  const rcTotal     = data.byRevenueCenter.reduce((a, d) => a + d.netSales, 0);

  return (
    <div className="animate-in">
      {/* BANNER */}
      <header style={{ position: 'relative', minHeight: '155px', borderRadius: '20px', overflow: 'hidden', marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-end', padding: '1.75rem 2.5rem', border: '1px solid var(--border-color)', backgroundImage: `url('/IMG_3221_edited.avif')`, backgroundSize: 'cover', backgroundPosition: 'center 55%' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg,rgba(7,11,20,0.97) 0%,rgba(7,11,20,0.65) 55%,rgba(7,11,20,0.1) 100%)', zIndex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <div style={{ minWidth: 0, minHeight: 0, background: 'var(--cfs-gold)', width: '4px', height: '26px', borderRadius: '4px' }} />
            <h1 style={{ fontSize: '1.75rem', color: '#FDFBF7', fontWeight: 800, fontFamily: 'Outfit', letterSpacing: '-0.03em' }}>Canales & Productos</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginLeft: '14px' }}>CFSCoffee · Último cierre: <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, textTransform: 'capitalize' }}>{dateFmt}</span></p>
        </div>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { l: 'Ventas Netas', v: fmtK(data.kpi.netSales) },
            { l: 'AOV Hoy', v: fmt(data.kpi.avgOrderValue) },
            { l: 'Desc. Total', v: fmtK(data.kpi.discounts) },
            { l: '% Desc/Bruto', v: `${discPct.toFixed(1)}%` },
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
      <div className="grid-cols-5" style={{ marginBottom: '1.75rem' }}>
        {[
          { icon: <DollarSign size={18}/>, WM: DollarSign, col: 'var(--cfs-gold)', bg: 'var(--cfs-gold-dim)', label: 'Ventas Netas Hoy', val: fmt(data.kpi.netSales), sub: `Bruto: ${fmt(data.kpi.grossSales)}` },
          { icon: <ShoppingCart size={18}/>, WM: ShoppingCart, col: 'var(--info)', bg: 'rgba(79,172,254,0.12)', label: 'AOV Promedio', val: fmt(data.kpi.avgOrderValue), sub: `${data.kpi.orders.toLocaleString()} órdenes totales` },
          { icon: <Percent size={18}/>, WM: Percent, col: discPct > 8 ? 'var(--warning)' : 'var(--success)', bg: discPct > 8 ? 'rgba(245,158,11,0.12)' : 'rgba(46,202,127,0.12)', label: 'Descuentos Hoy', val: fmt(data.kpi.discounts), sub: `${discPct.toFixed(1)}% del bruto · ${discOrderPct.toFixed(0)}% de órdenes` },
          { icon: <AlertTriangle size={18}/>, WM: AlertTriangle, col: voidPct > 2 ? 'var(--danger)' : 'var(--text-muted)', bg: 'rgba(239,68,68,0.08)', label: 'Voids Hoy', val: fmt(data.kpi.voids), sub: `${voidPct.toFixed(2)}% del bruto` },
          { icon: <TrendingDown size={18}/>, WM: TrendingDown, col: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', label: 'Órdenes con Descuento', val: data.kpi.discountOrders.toLocaleString(), sub: `${discOrderPct.toFixed(1)}% del total de órdenes` },
        ].map((c, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.3rem', position: 'relative', overflow: 'hidden' }}>
            <c.WM size={128} style={{ position: 'absolute', bottom: '-20px', right: '-20px', opacity: 0.04, transform: 'rotate(-10deg)', zIndex: 0, pointerEvents: 'none', color: 'var(--text-main)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ minWidth: 0, minHeight: 0, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, color: c.col, border: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.8rem' }}>{c.icon}</div>
              <div style={{ fontFamily: 'Outfit', fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '3px' }}>{c.val}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.6, marginTop: '2px' }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FILA 1: DiningOption + OrderSource */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* DiningOption donut + tabla */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Utensils size={16} style={{ color: 'var(--cfs-gold)' }} /> Por Tipo de Consumo — 30 Días
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>DiningOption · ventas netas por canal de consumo</div>
          {data.byDiningOption.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '2rem 0', textAlign: 'center' }}>Sin datos de tipo de consumo disponibles.</div>
          ) : (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, minHeight: 0, width: 160, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.byDiningOption} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={4} cornerRadius={5} dataKey="netSales" stroke="none">
                      {data.byDiningOption.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem' }} formatter={(v: any) => [`$${v.toLocaleString()}`, '']}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '0.78rem' }}>
                {data.byDiningOption.map((d, i) => {
                  const pct = diningTotal > 0 ? (d.netSales / diningTotal * 100) : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ minWidth: 0, minHeight: 0, width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                          <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{d.diningOption}</span>
                        </span>
                        <span style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ color: 'var(--cfs-gold)', fontFamily: 'Outfit', fontWeight: 700 }}>{fmtK(d.netSales)}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{pct.toFixed(0)}%</span>
                        </span>
                      </div>
                      <div style={{ minWidth: 0, minHeight: 0, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: '6px' }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  <span>Total 30d</span>
                  <span style={{ color: 'var(--cfs-gold)', fontWeight: 700, fontFamily: 'Outfit' }}>{fmtK(diningTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* OrderSource horizontal bars */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Smartphone size={16} style={{ color: 'var(--cfs-gold)' }} /> Por Fuente de Orden — 30 Días
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>OrderSource · canal de entrada de la orden</div>
          {data.byOrderSource.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '2rem 0', textAlign: 'center' }}>Sin datos de fuente de orden disponibles.</div>
          ) : (
            <div style={{ minWidth: 0, minHeight: 0, height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={data.byOrderSource.slice(0, 7).map(d => ({ name: d.orderSource ?? 'N/A', ventas: d.netSales, aov: d.avgOrderValue }))} layout="vertical" margin={{ top: 0, right: 70, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)"/>
                  <XAxis type="number" tickFormatter={v => `$${v}`} stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}/>
                  <YAxis dataKey="name" type="category" width={90} stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}/>
                  <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem' }} formatter={(v: any, n: any) => [n === 'ventas' ? `$${v.toLocaleString()}` : `$${v.toFixed(2)}`, n === 'ventas' ? 'Ventas' : 'AOV']}/>
                  <Bar dataKey="ventas" radius={[0, 8, 8, 0]} barSize={14}>
                    {data.byOrderSource.slice(0, 7).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* FILA 2: RevenueCenter + AOV por hora + Descuentos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>

        {/* Revenue Center */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Layers size={14} style={{ color: 'var(--cfs-gold)' }} /> Centro de Ingresos — 30d
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>RevenueCenter · área de venta</div>
          {data.byRevenueCenter.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0', textAlign: 'center' }}>Sin datos de centro de ingresos.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.byRevenueCenter.map((d, i) => {
                const pct = rcTotal > 0 ? (d.netSales / rcTotal * 100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.revenueCenter}</span>
                      <span style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ color: COLORS[i % COLORS.length], fontFamily: 'Outfit', fontWeight: 700 }}>{fmtK(d.netSales)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div style={{ minWidth: 0, minHeight: 0, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: '6px', opacity: 0.85 }} />
                    </div>
                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '10px' }}>
                      <span>{d.orders.toLocaleString()} órdenes</span>
                      <span>AOV: {fmt(d.avgOrderValue)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AOV por hora */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <DollarSign size={14} style={{ color: 'var(--cfs-gold)' }} /> Ticket Promedio por Hora — Hoy
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Average Order Value por franja horaria</div>
          {data.aovHourly.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0', textAlign: 'center' }}>Sin datos de AOV para hoy.</div>
          ) : (
            <div style={{ minWidth: 0, minHeight: 0, height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={data.aovHourly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} interval={2}/>
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/>
                  <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem' }} formatter={(v: any) => [`$${v.toFixed(2)}`, 'AOV']}/>
                  <Bar dataKey="aov" radius={[6, 6, 0, 0]} barSize={16}>
                    {data.aovHourly.map((h, i) => {
                      const maxAov = Math.max(...data.aovHourly.map(x => x.aov));
                      return <Cell key={i} fill={h.aov >= maxAov * 0.9 ? '#DDA756' : 'rgba(221,167,86,0.45)'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Descuentos por canal */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Percent size={14} style={{ color: discPct > 8 ? 'var(--warning)' : 'var(--cfs-gold)' }} /> Impacto de Descuentos — 30d
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>% descuento sobre ventas brutas por canal</div>
          {data.discountByChannel.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0', textAlign: 'center' }}>Sin datos de descuentos.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.discountByChannel.map((d, i) => {
                const isHigh = d.discountPct > 8;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
                      <span style={{ color: isHigh ? 'var(--warning)' : 'var(--success)', fontWeight: 700, fontFamily: 'Outfit' }}>{d.discountPct.toFixed(1)}%</span>
                    </div>
                    <div style={{ minWidth: 0, minHeight: 0, height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                      <div style={{ width: `${Math.min(d.discountPct * 5, 100)}%`, height: '100%', background: isHigh ? 'var(--warning)' : 'var(--success)', borderRadius: '6px', opacity: 0.8 }} />
                    </div>
                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '10px' }}>
                      <span>{fmt(d.totalDiscounts)}</span>
                      <span>{d.discountOrderPct.toFixed(0)}% de órdenes</span>
                      <span>{fmt(d.discountPerOrder)}/orden</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
