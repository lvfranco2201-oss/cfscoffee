'use client';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts';
import {
  TrendingUp, Users, DollarSign, WalletCards,
  ShoppingCart, AlertTriangle, Percent, Clock, Activity, BarChart2
} from 'lucide-react';
import styles from '../app/Dashboard.module.css';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTheme } from '@/context/ThemeContext';
import { cleanStoreName as _clean, fmt, fmtK as fmtShort } from '@/utils/formatters';
import TopFilters from './TopFilters';

const DashboardMap = dynamic(() => import('./MapWrapper'), {
  ssr: false,
  loading: () => (
    <div style={{ minWidth: 0, minHeight: 0, height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      Inicializando Radar de Operaciones...
    </div>
  ),
});

// ── Types ────────────────────────────────────────────────────────────────────

interface StoreData {
  storeName: string;
  netSales: number;
  grossSales: number;
  guests: number;
  orders: number;
  discounts: number;
  voids: number;
  refunds: number;
}

interface DashboardUIProps {
  lastDateStr: string;
  totalTips: number;
  totalLaborCost: number;
  totalLaborHours: number;
  kpis: {
    totalNetSales: number;
    totalGrossSales: number;
    totalGuests: number;
    totalOrders: number;
    totalDiscounts: number;
    totalVoids: number;
    totalRefunds: number;
  };
  storesData: StoreData[];
  peakHours: {
    time: string;
    ventas: number;
    clientes: number;
    ordenes: number;
    labor: number;
  }[];
  paymentMethods: {
    name: string;
    value: number;
    color: string;
  }[];
  avg30: {
    avgNetSales: number;
    avgGuests: number;
    avgOrders: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Re-export from shared utils so existing JSX references keep working
const cleanStoreName = (val: string) => _clean(val);

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardUI({
  kpis, storesData, lastDateStr, peakHours, paymentMethods,
  totalTips, totalLaborCost, totalLaborHours, avg30,
}: DashboardUIProps) {

  const { theme } = useTheme();

  const [selectedStore, setSelectedStore] = useState('all');

  const currentStoresData = useMemo(() => {
    if (selectedStore === 'all') return storesData;
    return storesData.filter(s => s.storeName === selectedStore);
  }, [storesData, selectedStore]);

  const currentKpis = useMemo(() => {
    if (selectedStore === 'all') return kpis;
    const st = currentStoresData.find(s => s.storeName === selectedStore);
    if (!st) return kpis;
    return {
      totalNetSales: st.netSales,
      totalGrossSales: st.grossSales,
      totalGuests: st.guests,
      totalOrders: st.orders,
      totalDiscounts: st.discounts,
      totalVoids: st.voids,
      totalRefunds: st.refunds,
    };
  }, [kpis, currentStoresData, selectedStore]);

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const avgTicket    = currentKpis.totalOrders  > 0 ? currentKpis.totalNetSales / currentKpis.totalOrders : 0;
  const avgPerGuest  = currentKpis.totalGuests  > 0 ? currentKpis.totalNetSales / currentKpis.totalGuests : 0;
  // labor costs and tips are total since we lack branch breakout in view currently
  const laborPct     = currentKpis.totalNetSales > 0 ? (totalLaborCost / currentKpis.totalNetSales) * 100 : 0;
  const discountPct  = currentKpis.totalGrossSales > 0 ? (currentKpis.totalDiscounts / currentKpis.totalGrossSales) * 100 : 0;
  const voidPct      = currentKpis.totalGrossSales > 0 ? (currentKpis.totalVoids / currentKpis.totalGrossSales) * 100 : 0;
  const salesPerLH   = totalLaborHours > 0 ? currentKpis.totalNetSales / totalLaborHours : 0;
  const totalPayments = paymentMethods.reduce((a, p) => a + p.value, 0);

  // ── Best hour ────────────────────────────────────────────────────────────
  const bestHour = useMemo(() => {
    if (!peakHours.length) return null;
    return peakHours.reduce((best, h) => h.ventas > best.ventas ? h : best, peakHours[0]);
  }, [peakHours]);

  // ── Top store ────────────────────────────────────────────────────────────
  const topStore = currentStoresData[0];

  // ── Date label ───────────────────────────────────────────────────────────
  const dateFmt = new Date(lastDateStr + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Anomaly detection — flag metrics >20% below 30-day average ─────────────
  const ANOMALY_THRESHOLD = 0.20; // 20% drop triggers warning
  const anomalies: { metric: string; current: number; avg: number; pctDrop: number }[] = [];

  if (avg30.avgNetSales > 0) {
    const pct = (avg30.avgNetSales - kpis.totalNetSales) / avg30.avgNetSales;
    if (pct > ANOMALY_THRESHOLD) anomalies.push({ metric: 'Ventas Netas', current: kpis.totalNetSales, avg: avg30.avgNetSales, pctDrop: pct * 100 });
  }
  if (avg30.avgGuests > 0) {
    const pct = (avg30.avgGuests - kpis.totalGuests) / avg30.avgGuests;
    if (pct > ANOMALY_THRESHOLD) anomalies.push({ metric: 'Clientes', current: kpis.totalGuests, avg: avg30.avgGuests, pctDrop: pct * 100 });
  }
  if (avg30.avgOrders > 0) {
    const pct = (avg30.avgOrders - kpis.totalOrders) / avg30.avgOrders;
    if (pct > ANOMALY_THRESHOLD) anomalies.push({ metric: 'Órdenes', current: kpis.totalOrders, avg: avg30.avgOrders, pctDrop: pct * 100 });
  }

  return (
    <div className="animate-in">

      {/* ── ANOMALY ALERTS ─────────────────────────────── */}
      {anomalies.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderLeft: '4px solid var(--danger)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '8px',
              animation: 'fade-in-up 0.4s ease',
            }}>
              <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.88rem' }}>
                  ⚠ {a.metric} {a.pctDrop.toFixed(0)}% por debajo del promedio de 30 días
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '8px' }}>
                  Hoy: {typeof a.current === 'number' && a.current < 1000 ? Math.round(a.current).toLocaleString() : fmtShort(a.current as number)} · Prom 30d: {typeof a.avg === 'number' && a.avg < 1000 ? Math.round(a.avg).toLocaleString() : fmtShort(a.avg as number)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <header
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '180px',
          borderRadius: '20px',
          overflow: 'visible',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '2rem 2.5rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
          backgroundImage: `url('/IMG_3221_edited.avif')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 35%',
        }}
      >
        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(100deg, rgba(7,11,20,0.96) 0%, rgba(7,11,20,0.7) 50%, rgba(7,11,20,0.15) 100%)',
          zIndex: 1, borderRadius: 'inherit'
        }} />

        {/* Left: Title */}
        <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ minWidth: 0, minHeight: 0, background: 'var(--cfs-gold)',
              width: '4px', height: '28px', borderRadius: '4px', }} />
            <h1 style={{
              fontSize: '1.9rem', color: '#FDFBF7', fontWeight: 800,
              fontFamily: 'Outfit', letterSpacing: '-0.03em',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}>
              Dashboard de Ventas
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', fontWeight: 400, marginLeft: '14px' }}>
            CFSCoffee · Último cierre:&nbsp;
            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, textTransform: 'capitalize' }}>
              {dateFmt}
            </span>
          </p>
        </div>

        {/* Right: Live indicator + theme toggle */}
        <div className={styles.headerActions} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 2, display: 'flex', gap: '12px' }}>
          <TopFilters 
            availableStores={storesData.map(s => ({ id: s.storeName, name: cleanStoreName(s.storeName) }))} 
            selectedStore={selectedStore}
            onStoreChange={(v) => setSelectedStore(v)}
          />
          {/* Live badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(46,202,127,0.25)', borderRadius: '10px',
            padding: '7px 14px', color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 600,
          }}>
            <span style={{ minWidth: 0, minHeight: 0, width: '7px', height: '7px', borderRadius: '50%', background: '#2eca7f', boxShadow: '0 0 8px #2eca7f', display: 'inline-block' }} />
            {currentStoresData.length} Tiendas Activas
          </div>

          {/* Theme toggle moved to Sidebar */}
        </div>

        {/* Bottom right: quick summary pills */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Ventas Netas', value: fmtShort(currentKpis.totalNetSales) },
            { label: 'Órdenes', value: currentKpis.totalOrders.toLocaleString() },
            { label: 'Clientes', value: currentKpis.totalGuests.toLocaleString() },
          ].map(item => (
            <div key={item.label} style={{
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(221,167,86,0.2)',
              borderRadius: '10px', padding: '6px 14px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.1rem', color: 'var(--cfs-gold)' }}>
                {item.value}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* ── KPI CARDS ROW ─────────────────────────────── */}
      <section className={styles.kpiGrid}>

        {/* 1. Ventas Netas */}
        <KpiCard
          href="/ventas"
          icon={<DollarSign size={22} />}
          iconStyle={{ background: 'var(--cfs-gold-dim)', color: 'var(--cfs-gold)' }}
          badge="Netas"
          badgeStyle={{ background: 'rgba(221,167,86,0.12)', color: 'var(--cfs-gold)', borderColor: 'rgba(221,167,86,0.25)' }}
          value={fmt(currentKpis.totalNetSales)}
          label="Ventas Netas"
          sub={`Bruto: ${fmt(currentKpis.totalGrossSales)}`}
          WatermarkIcon={DollarSign}
        />

        {/* 2. Clientes / Visitas */}
        <KpiCard
          href="/clientes"
          icon={<Users size={22} />}
          iconStyle={{ background: 'rgba(46,202,127,0.12)', color: 'var(--success)' }}
          badge={`${currentStoresData.length} tiendas`}
          badgeStyle={{}}
          value={currentKpis.totalGuests.toLocaleString()}
          label="Clientes / Visitas"
          sub={`Ticket promedio: ${fmt(avgPerGuest)}`}
          WatermarkIcon={Users}
        />

        {/* 3. Órdenes + Ticket */}
        <KpiCard
          href="/productos"
          icon={<ShoppingCart size={22} />}
          iconStyle={{ background: 'rgba(79,172,254,0.12)', color: 'var(--info)' }}
          value={currentKpis.totalOrders.toLocaleString()}
          label="Órdenes Cerradas"
          sub={`Ticket promedio: ${fmt(avgTicket)}`}
          WatermarkIcon={ShoppingCart}
        />

        {/* 4. Propinas */}
        <KpiCard
          href="/ventas"
          icon={<WalletCards size={22} />}
          iconStyle={{ background: 'rgba(253,251,247,0.08)', color: 'var(--cfs-cream)' }}
          value={fmt(totalTips)}
          label="Propinas"
          sub="Gratificaciones del día"
          WatermarkIcon={WalletCards}
        />

        {/* 5. Descuentos y Voids */}
        <KpiCard
          href="/ventas"
          icon={<AlertTriangle size={22} />}
          iconStyle={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}
          value={fmt(currentKpis.totalDiscounts)}
          label="Descuentos & Voids"
          sub={`Voids/Refunds: ${fmt(currentKpis.totalVoids + currentKpis.totalRefunds)}`}
          WatermarkIcon={AlertTriangle}
        />

        {/* 6. Costos Laborales */}
        <KpiCard
          href="/inventario"
          icon={<DollarSign size={22} />}
          iconStyle={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}
          badge={`${laborPct.toFixed(1)}% ventas`}
          badgeStyle={{
            background: laborPct > 30 ? 'rgba(239,68,68,0.15)' : 'rgba(46,202,127,0.12)',
            color: laborPct > 30 ? 'var(--danger)' : 'var(--success)',
            borderColor: 'transparent',
          }}
          value={fmt(totalLaborCost)}
          label="Costos Laborales"
          sub={`${totalLaborHours.toFixed(1)} horas trabajadas`}
          cardStyle={{ borderColor: laborPct > 30 ? 'rgba(239,68,68,0.3)' : 'var(--border-color)' }}
          WatermarkIcon={Users}
        />
      </section>

      {/* ── BENTO CHARTS GRID ─────────────────────────── */}
      <div className={styles.chartsGrid}>

        {/* A) Flujo de tráfico horario — col 8 */}
        <div className={`glass-card ${styles.col8}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
            <div>
              <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} style={{ color: 'var(--cfs-gold)' }} />
                Flujo de Ventas por Hora
              </div>
              <div className={styles.cardSubtitle}>Consolidado de todas las sucursales</div>
            </div>
            {bestHour && (
              <div style={{
                background: 'var(--cfs-gold-dim)',
                border: '1px solid rgba(221,167,86,0.2)',
                borderRadius: 10, padding: '5px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--cfs-gold)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Hora Pico</div>
                <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--cfs-gold)', fontSize: '1rem' }}>{bestHour.time}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtShort(bestHour.ventas)}</div>
              </div>
            )}
          </div>

          <div style={{ minWidth: 0, minHeight: 0, width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={peakHours} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#DDA756" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#DDA756" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradClientes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left"  stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={false}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--cfs-gold)', borderRadius: '12px', color: 'var(--text-main)', boxShadow: 'var(--shadow-card)', fontSize: '0.82rem' }}
                  formatter={(val: any, name: any) => {
                    if (name === 'ventas') return [`$${val.toLocaleString()}`, 'Ventas Netas'];
                    if (name === 'clientes') return [val.toLocaleString(), 'Clientes'];
                    return [val, name];
                  }}
                />
                <Area yAxisId="left"  type="monotone" dataKey="ventas"   stroke="#DDA756" strokeWidth={2.5} fill="url(#gradSales)"    name="ventas"   isAnimationActive animationDuration={1500} />
                <Line yAxisId="right" type="monotone" dataKey="clientes" stroke="#3b82f6" strokeWidth={2}   dot={false}                name="clientes" isAnimationActive animationDuration={1800} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Stat summary row */}
          <div className={styles.statRow} style={{ marginTop: '1rem', marginBottom: 0, paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            {[
              { label: 'Horas Activas', value: peakHours.length.toString() },
              { label: 'Prom. por Hora',  value: fmtShort(peakHours.length > 0 ? kpis.totalNetSales / peakHours.length : 0) },
              { label: 'Órdenes / Hora',  value: peakHours.length > 0 ? (kpis.totalOrders / peakHours.length).toFixed(0) : '—' },
              { label: 'Clientes / Hora', value: peakHours.length > 0 ? (kpis.totalGuests / peakHours.length).toFixed(0) : '—' },
            ].map(s => (
              <div key={s.label} className={styles.statItem}>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* B) Métodos de Pago + Propinas — col 4 */}
        <div className={`glass-card ${styles.col4}`}>
          <div className={styles.cardTitle} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WalletCards size={16} style={{ color: 'var(--cfs-gold)' }} />
            Métodos de Pago
          </div>
          <div className={styles.cardSubtitle} style={{ marginBottom: '1.2rem' }}>Distribución del ingreso</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Donut */}
            <div style={{ minWidth: 0, minHeight: 0, width: 140, height: 140, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods.length > 0 ? paymentMethods : [{ name: 'Sin datos', value: 1, color: 'var(--border-color)' }]}
                    cx="50%" cy="50%"
                    innerRadius={46} outerRadius={64}
                    paddingAngle={5} cornerRadius={8}
                    dataKey="value" stroke="none"
                  >
                    {(paymentMethods.length > 0 ? paymentMethods : [{ color: 'var(--border-color)' }]).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip cursor={false}
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '12px', fontSize: '0.8rem' }}
                    formatter={(v: any) => [`$${v.toLocaleString()}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className={styles.payLegend} style={{ flex: 1 }}>
              {paymentMethods.map(p => (
                <div key={p.name} className={styles.payLegendItem}>
                  <span className={styles.payDot} style={{ background: p.color }} />
                  <span className={styles.payName}>{p.name}</span>
                  <span className={styles.payAmount}>{fmtShort(p.value)}</span>
                  <span className={styles.payPct}>
                    {totalPayments > 0 ? `${((p.value / totalPayments) * 100).toFixed(0)}%` : '—'}
                  </span>
                </div>
              ))}
              {paymentMethods.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin datos de pagos para este día.</p>
              )}
            </div>
          </div>

          {/* Propinas + Scorecards */}
          <div className={styles.scorecardGrid} style={{ marginTop: '1.2rem' }}>
            <div className={styles.scorecardItem}>
              <div className={styles.scorecardValue} style={{ color: 'var(--cfs-gold)', fontSize: '1.35rem' }}>
                {fmt(totalTips)}
              </div>
              <div className={styles.scorecardLabel}>Propinas</div>
            </div>
            <div className={styles.scorecardItem}>
              <div className={styles.scorecardValue} style={{ fontSize: '1.35rem' }}>
                {fmt(avgPerGuest)}
              </div>
              <div className={styles.scorecardLabel}>$/Cliente</div>
            </div>
            <div className={styles.scorecardItem}>
              <div className={styles.scorecardValue} style={{ color: kpis.totalDiscounts > 0 ? 'var(--warning)' : 'var(--text-main)', fontSize: '1.35rem' }}>
                {fmt(kpis.totalDiscounts)}
              </div>
              <div className={styles.scorecardLabel}>Descuentos ({discountPct.toFixed(1)}%)</div>
            </div>
            <div className={styles.scorecardItem}>
              <div className={styles.scorecardValue} style={{ color: kpis.totalVoids > 0 ? 'var(--danger)' : 'var(--text-main)', fontSize: '1.35rem' }}>
                {fmt((kpis.totalVoids ?? 0) + (kpis.totalRefunds ?? 0))}
              </div>
              <div className={styles.scorecardLabel}>Voids + Refunds</div>
            </div>
          </div>
        </div>

        {/* C) Top Sucursales — tabla detallada — col 8 */}
        <div className={`glass-card ${styles.col8}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
            <div>
              <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} />
                Rendimiento por Sucursal
              </div>
              <div className={styles.cardSubtitle}>Ventas netas, clientes, ticket y eficiencia</div>
            </div>
            <div className={styles.metricPill}>
              {storesData.length} Sucursales
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className={styles.storeTable}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Sucursal</th>
                  <th>Ventas Netas</th>
                  <th>Clientes</th>
                  <th>Órdenes</th>
                  <th>$/Orden</th>
                  <th>Descuentos</th>
                  <th>Participación</th>
                </tr>
              </thead>
              <tbody>
                {currentStoresData.map((store, i) => {
                  const pct = kpis.totalNetSales > 0 ? (store.netSales / kpis.totalNetSales) * 100 : 0;
                  const barW = (pct / 100) * 100;

                  const avgTicketStore = store.orders > 0 ? store.netSales / store.orders : 0;

                  let rankStyle = '';
                  if (selectedStore === 'all') {
                    if (i === 0) rankStyle = styles.gold;
                    else if (i === 1) rankStyle = styles.silver;
                    else if (i === 2) rankStyle = styles.bronze;
                  }

                  return (
                    <tr key={store.storeName}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`${styles.storeRank} ${rankStyle}`}>#{i + 1}</span>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cleanStoreName(store.storeName)}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--cfs-gold)' }}>
                          {fmt(store.netSales, 0)}
                        </span>
                      </td>
                      <td>{store.guests.toLocaleString()}</td>
                      <td>{store.orders.toLocaleString()}</td>
                      <td>{fmt(avgTicketStore)}</td>
                      <td style={{ color: store.discounts > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {store.discounts > 0 ? `-${fmt(store.discounts, 0)}` : '—'}
                      </td>
                      <td>
                        <div className={styles.barCell}>
                          <div className={styles.miniBar} style={{ width: `${barW}px` }} />
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', minWidth: '38px' }}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* D) Eficiencia Operacional — col 4 */}
        <div className={`glass-card ${styles.col4}`} style={{ height: 'max-content' }}>
          <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <Percent size={16} style={{ color: 'var(--cfs-gold)' }} />
            Eficiencia Operacional
          </div>
          <div className={styles.cardSubtitle} style={{ marginBottom: '1.4rem' }}>Indicadores de control</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <EfficiencyBar
              label="Labor Cost %"
              value={laborPct}
              max={50}
              target={30}
              color={laborPct > 30 ? 'var(--danger)' : 'var(--success)'}
              format={`${laborPct.toFixed(1)}%`}
              caption={`${fmt(totalLaborCost)} · ${totalLaborHours.toFixed(0)}h`}
            />

            <EfficiencyBar
              label="Descuento %"
              value={discountPct}
              max={20}
              target={10}
              color={discountPct > 10 ? 'var(--warning)' : 'var(--success)'}
              format={`${discountPct.toFixed(1)}%`}
              caption={fmt(currentKpis.totalDiscounts)}
            />

            <EfficiencyBar
              label="Voids / Ventas %"
              value={voidPct}
              max={5}
              target={2}
              color={voidPct > 2 ? 'var(--danger)' : 'var(--success)'}
              format={`${voidPct.toFixed(2)}%`}
              caption={`${fmt(currentKpis.totalVoids ?? 0)} · Cancelaciones o anulaciones de caja`}
            />

            {/* Sales Per Labor Hour */}
            <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(255,255,255,0.025)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} style={{ color: 'var(--cfs-gold)' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Ventas / Hora Labor
                  </span>
                </div>
                <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.1rem', color: 'var(--cfs-gold)' }}>
                  {fmtShort(salesPerLH)}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {totalLaborHours.toFixed(1)} horas trabajadas totales
              </div>
            </div>

            {/* Quick store spotlight */}
            {topStore && (
              <div style={{ padding: '1rem', background: 'rgba(221,167,86,0.06)', borderRadius: '14px', border: '1px solid rgba(221,167,86,0.15)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--cfs-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
                  🏆 Mejor Sucursal
                </div>
                <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                  {cleanStoreName(topStore.storeName)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cfs-gold)', fontWeight: 600 }}>
                  {fmt(topStore.netSales, 0)}&nbsp;
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>
                    · {topStore.guests.toLocaleString()} clientes
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* E) Gráfica bar comparativa de tiendas — col 12 */}
        <div className={`glass-card ${styles.col12}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
            <div>
              <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} />
                Comparativa de Ventas por Sucursal
              </div>
              <div className={styles.cardSubtitle}>Ventas netas — barras horizontales ordenadas por monto</div>
            </div>
          </div>
          <div style={{ minWidth: 0, minHeight: 0, width: '100%', height: Math.max(240, storesData.length * 42), maxHeight: 600, overflowY: 'auto' }}>
            <ResponsiveContainer width="100%" height={Math.max(240, storesData.length * 42)}>
              <BarChart
                data={storesData.map(s => ({ ...s, shortName: cleanStoreName(s.storeName) }))}
                layout="vertical"
                margin={{ top: 0, right: 90, left: 12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" tickFormatter={v => `$${v}`} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis
                  dataKey="shortName"
                  type="category"
                  width={120}
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}
                />
                <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', boxShadow: 'var(--shadow-card)', fontSize: '0.82rem' }}
                  formatter={(val: any) => [`$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Ventas Netas']}
                />
                <Bar dataKey="netSales" radius={[0, 10, 10, 0]} barSize={18} fill="var(--cfs-gold)" activeBar={{ fill: '#E6C48F' }}>
                  {storesData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? '#DDA756' : i === 1 ? '#b89040' : 'rgba(221,167,86,0.5)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* F) Mapa — col 12 */}
        <div className={`glass-card ${styles.col12}`} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div>
              <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} style={{ color: 'var(--success)' }} />
                Radar de Operaciones
              </div>
              <div className={styles.cardSubtitle}>Mapa en vivo de todas las sucursales CFSCoffee</div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
              ● {storesData.length} Nodos Sincronizados
            </span>
          </div>
          <div style={{ flex: 1, minHeight: '380px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <DashboardMap storesData={storesData} theme={theme} />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-Components ────────────────────────────────────────────────────────────

function KpiCard({
  icon, iconStyle, badge, badgeStyle, value, label, sub, WatermarkIcon, cardStyle, href
}: {
  icon: React.ReactNode;
  iconStyle?: React.CSSProperties;
  badge?: string;
  badgeStyle?: React.CSSProperties;
  value: string;
  label: string;
  sub?: string;
  WatermarkIcon: React.ComponentType<{ size?: number; className?: string }>;
  cardStyle?: React.CSSProperties;
  href?: string;
}) {
  const content = (
    <div className={`glass-card ${styles.kpiCardWrapper}`} style={{ ...cardStyle, cursor: href ? 'pointer' : 'default', transition: 'all 0.2s', height: '100%' }}>
      <WatermarkIcon size={128} className={styles.watermarkIcon} />
      <div className={styles.kpiHeader}>
        <div className={styles.kpiIcon} style={iconStyle}>{icon}</div>
        {badge && (
          <div className={styles.kpiBadge} style={badgeStyle}>{badge}</div>
        )}
      </div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
      {sub && <div className={styles.kpiSubLabel}>{sub}</div>}
    </div>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>{content}</Link>;
  }
  return content;
}

function EfficiencyBar({
  label, value, max, target, color, format, caption,
}: {
  label: string; value: number; max: number; target: number;
  color: string; format: string; caption?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const targetPct = Math.min((target / max) * 100, 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'Outfit', fontWeight: 800, color, fontSize: '1rem' }}>{format}</span>
      </div>
      <div style={{ minWidth: 0, minHeight: 0, position: 'relative', height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'visible' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '10px', transition: 'width 1s ease', opacity: 0.85 }} />
        {/* Target marker */}
        <div style={{
          position: 'absolute', top: '-4px', left: `${targetPct}%`,
          width: '2px', height: '14px', background: 'rgba(255,255,255,0.3)',
          borderRadius: '2px', transform: 'translateX(-50%)',
        }} />
      </div>
      {caption && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={10} style={{ display: 'inline', marginRight: 3, opacity: value > target ? 1 : 0 }} />
          {caption}
        </div>
      )}
    </div>
  );
}
