'use client';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Line, LabelList
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, DollarSign, WalletCards,
  ShoppingCart, AlertTriangle, Percent, Clock, Activity, BarChart2
} from 'lucide-react';
import styles from '../app/Dashboard.module.css';
import { useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useFilter } from '@/context/FilterContext';
import { useDateLocale } from '@/hooks/useDateLocale';
import { cleanStoreName as _clean, fmt, fmtK as fmtShort } from '@/utils/formatters';
import TopFilters from './TopFilters';

const DashboardMap = dynamic(() => import('./MapWrapper'), {
  ssr: false,
  loading: () => (
    <div style={{ minWidth: 0, minHeight: 0, height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      {/* DashboardMap loads eagerly — static loading text uses a deferred ref via closure */}
      Initializing...
    </div>
  ),
});

// ── Types ────────────────────────────────────────────────────────────────────

interface StoreData {
  storeId?: number | null;   // numeric ID from API — used for context-based filtering
  storeName: string;
  netSales: number;
  prevNetSales?: number;
  grossSales: number;
  guests: number;
  orders: number;
  discounts: number;
  voids: number;
  refunds: number;
  laborCost?: number;
}

interface DashboardUIProps {
  lastDateStr: string;
  totalTips: number;
  totalLaborCost: number;
  prevTotalLaborCost?: number;
  totalLaborHours: number;
  prevTotalLaborHours?: number;
  kpis: {
    totalNetSales: number;
    totalGrossSales: number;
    totalGuests: number;
    totalOrders: number;
    totalDiscounts: number;
    totalVoids: number;
    totalRefunds: number;
  };
  prevKpis?: {
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
  onRefresh?: () => void;
  loading?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const cleanStoreName = (val: string) => _clean(val);

const WoW = ({ pct, label, inverted }: { pct: number, label?: string, inverted?: boolean }) => {
  const sign = pct >= 0;
  const isGood = inverted ? !sign : sign;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '20px',
      background: isGood ? 'rgba(46,202,127,0.12)' : 'rgba(239,68,68,0.12)',
      color: isGood ? 'var(--success)' : 'var(--danger)',
    }}>
      {sign ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {sign ? '+' : ''}{pct.toFixed(1)}% {label || ''}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardUI({
  kpis, prevKpis, storesData, lastDateStr, peakHours, paymentMethods,
  totalTips, prevTotalTips = 0, totalLaborCost, prevTotalLaborCost = 0, totalLaborHours, prevTotalLaborHours = 0, avg30,
  onRefresh, loading = false,
}: DashboardUIProps) {

  const { theme } = useTheme();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  // Read store filter from the global context (synced with TopFilters)
  const { filter } = useFilter();
  const selectedStore = filter.store;

  const currentStoresData = useMemo(() => {
    if (selectedStore === 'all') return storesData;
    // Context store value may be either a storeName or a numeric ID string
    return storesData.filter(s =>
      s.storeName === selectedStore ||
      String((s as any).storeId) === selectedStore
    );
  }, [storesData, selectedStore]);

  const currentKpis = useMemo(() => {
    if (selectedStore === 'all') return kpis;
    const st = currentStoresData[0];
    if (!st) return kpis;
    return {
      totalNetSales:   st.netSales,
      totalGrossSales: st.grossSales,
      totalGuests:     st.guests,
      totalOrders:     st.orders,
      totalDiscounts:  st.discounts,
      totalVoids:      st.voids,
      totalRefunds:    st.refunds,
    };
  }, [kpis, currentStoresData, selectedStore]);

  const avgTicket    = currentKpis.totalOrders  > 0 ? currentKpis.totalNetSales / currentKpis.totalOrders : 0;
  const avgPerGuest  = currentKpis.totalGuests  > 0 ? currentKpis.totalNetSales / currentKpis.totalGuests : 0;
  // labor costs and tips are total since we lack branch breakout in view currently
  const laborPct     = currentKpis.totalNetSales > 0 ? (totalLaborCost / currentKpis.totalNetSales) * 100 : 0;
  const discountPct  = currentKpis.totalGrossSales > 0 ? (currentKpis.totalDiscounts / currentKpis.totalGrossSales) * 100 : 0;
  const voidPct      = currentKpis.totalGrossSales > 0 ? (currentKpis.totalVoids / currentKpis.totalGrossSales) * 100 : 0;
  const salesPerLH   = totalLaborHours > 0 ? currentKpis.totalNetSales / totalLaborHours : 0;
  const totalPayments = paymentMethods.reduce((a, p) => a + p.value, 0);

  // Prev Comparisons
  const prevAvgGuest = prevKpis?.totalGuests && prevKpis.totalGuests > 0 ? prevKpis.totalNetSales / prevKpis.totalGuests : 0;
  
  const currTotalVoids = (currentKpis.totalVoids ?? 0) + (currentKpis.totalRefunds ?? 0);
  const prevTotalVoidsOp = prevKpis ? (prevKpis.totalVoids ?? 0) + (prevKpis.totalRefunds ?? 0) : 0;

  // Prev Comparisons for Eficiencia Operacional
  const prevLaborPct = prevKpis?.totalNetSales && prevKpis.totalNetSales > 0 ? (prevTotalLaborCost / prevKpis.totalNetSales) * 100 : 0;
  const wowLaborPct = prevLaborPct > 0 ? ((laborPct - prevLaborPct) / prevLaborPct * 100) : undefined;

  const prevDiscountPct = prevKpis?.totalGrossSales && prevKpis.totalGrossSales > 0 ? (prevKpis.totalDiscounts / prevKpis.totalGrossSales) * 100 : 0;
  const wowDiscountPct = prevDiscountPct > 0 ? ((discountPct - prevDiscountPct) / prevDiscountPct * 100) : undefined;

  const prevVoidPct = prevKpis?.totalGrossSales && prevKpis.totalGrossSales > 0 ? (prevTotalVoidsOp / prevKpis.totalGrossSales) * 100 : 0;
  const wowVoidPct = prevVoidPct > 0 ? ((voidPct - prevVoidPct) / prevVoidPct * 100) : undefined;

  const prevSalesPerLH = prevTotalLaborHours > 0 ? (prevKpis?.totalNetSales ?? 0) / prevTotalLaborHours : 0;
  const wowSalesPerLH = prevSalesPerLH > 0 ? ((salesPerLH - prevSalesPerLH) / prevSalesPerLH * 100) : undefined;
  
  const wowNetSales = prevKpis?.totalNetSales && prevKpis.totalNetSales > 0 ? ((currentKpis.totalNetSales - prevKpis.totalNetSales) / prevKpis.totalNetSales * 100) : undefined;
  const wowGuests = prevKpis?.totalGuests && prevKpis.totalGuests > 0 ? ((currentKpis.totalGuests - prevKpis.totalGuests) / prevKpis.totalGuests * 100) : undefined;
  const wowOrders = prevKpis?.totalOrders && prevKpis.totalOrders > 0 ? ((currentKpis.totalOrders - prevKpis.totalOrders) / prevKpis.totalOrders * 100) : undefined;
  const currTotalVoids = (currentKpis.totalVoids ?? 0) + (currentKpis.totalRefunds ?? 0);
  const prevTotalVoids = prevKpis ? (prevKpis.totalVoids ?? 0) + (prevKpis.totalRefunds ?? 0) : 0;
  const voidPctChg = prevTotalVoids > 0 ? ((currTotalVoids - prevTotalVoids) / prevTotalVoids * 100) : undefined;

  // ── Best hour ────────────────────────────────────────────────────────────
  const bestHour = useMemo(() => {
    if (!peakHours.length) return null;
    return peakHours.reduce((best, h) => h.ventas > best.ventas ? h : best, peakHours[0]);
  }, [peakHours]);

  // ── Top store ────────────────────────────────────────────────────────────
  const topStore = currentStoresData[0];

  // ── Date label ───────────────────────────────────────────────────────────
  // lastDateStr can be a single date or a range like "2026-04-01 → 2026-04-12"
  const dateFmt = lastDateStr.includes('→')
    ? lastDateStr  // Already formatted as range
    : new Date(lastDateStr + 'T12:00:00').toLocaleDateString(dateLocale, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

  // ── Anomaly detection — flag metrics >20% below 30-day average ─────────────
  const ANOMALY_THRESHOLD = 0.20; // 20% drop triggers warning
  const anomalies: { metric: string; current: number; avg: number; pctDrop: number }[] = [];

  if (avg30.avgNetSales > 0) {
    const pct = (avg30.avgNetSales - kpis.totalNetSales) / avg30.avgNetSales;
    if (pct > ANOMALY_THRESHOLD) anomalies.push({ metric: t('dashboard.anomaly_net_sales'), current: kpis.totalNetSales, avg: avg30.avgNetSales, pctDrop: pct * 100 });
  }
  if (avg30.avgGuests > 0) {
    const pct = (avg30.avgGuests - kpis.totalGuests) / avg30.avgGuests;
    if (pct > ANOMALY_THRESHOLD) anomalies.push({ metric: t('dashboard.anomaly_customers'), current: kpis.totalGuests, avg: avg30.avgGuests, pctDrop: pct * 100 });
  }
  if (avg30.avgOrders > 0) {
    const pct = (avg30.avgOrders - kpis.totalOrders) / avg30.avgOrders;
    if (pct > ANOMALY_THRESHOLD) anomalies.push({ metric: t('dashboard.anomaly_orders'), current: kpis.totalOrders, avg: avg30.avgOrders, pctDrop: pct * 100 });
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
                  ⚠ {a.metric} {a.pctDrop.toFixed(0)}{t('dashboard.anomaly_below_avg')}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '8px' }}>
                  {t('dashboard.anomaly_today')} {typeof a.current === 'number' && a.current < 1000 ? Math.round(a.current).toLocaleString() : fmtShort(a.current as number)} · {t('dashboard.anomaly_avg30')} {typeof a.avg === 'number' && a.avg < 1000 ? Math.round(a.avg).toLocaleString() : fmtShort(a.avg as number)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <header className={`${styles.photoBanner} glass-card`}
        style={{
          position: 'relative',
          zIndex: 50,
          width: '100%',
          minHeight: '200px',
          borderRadius: '20px',
          overflow: 'visible',
          marginBottom: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
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

        {/* Top: Filters & Live Badge */}
        <div className={styles.headerActions} style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%', flexWrap: 'wrap' }}>
          <TopFilters 
            availableStores={storesData
              .filter(s => s.storeId != null)
              .map(s => ({ id: String(s.storeId!), name: cleanStoreName(s.storeName) }))
            } 
            onApply={() => { /* context handles state — page re-fetches via useEffect */ }}
            onRefresh={onRefresh}
            loading={loading}
          />
          {/* Live badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(46,202,127,0.25)', borderRadius: '10px',
            padding: '7px 14px', color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 600,
          }}>
            <span style={{ minWidth: 0, minHeight: 0, width: '7px', height: '7px', borderRadius: '50%', background: '#2eca7f', boxShadow: '0 0 8px #2eca7f', display: 'inline-block' }} />
            {currentStoresData.length} {t('dashboard.active_stores')}
          </div>
        </div>

        {/* Bottom: Title & Pills */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.5rem' }}>
          {/* Left: Title */}
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ minWidth: 0, minHeight: 0, background: 'var(--cfs-gold)', width: '4px', height: '28px', borderRadius: '4px' }} />
              <h1 style={{
                fontSize: '1.9rem', color: '#FDFBF7', fontWeight: 800,
                fontFamily: 'Outfit', letterSpacing: '-0.03em',
                textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}>
                {t('dashboard.title')}
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', fontWeight: 400, marginLeft: '14px' }}>
              CFSCoffee · {t('dashboard.last_close')} &nbsp;
              <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, textTransform: 'capitalize' }}>{dateFmt}</span>
            </p>
          </div>

          {/* Right: quick summary pills */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: t('dashboard.net_sales'), value: fmtShort(currentKpis.totalNetSales) },
              { label: t('dashboard.orders'), value: currentKpis.totalOrders.toLocaleString() },
              { label: t('dashboard.customers'), value: currentKpis.totalGuests.toLocaleString() },
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
        </div>
      </header>

      {/* ── KPI CARDS ROW ─────────────────────────────── */}
      <section className={styles.kpiGrid}>

        {/* 1. Ventas Netas */}
        <KpiCard
          href="/ventas"
          icon={<DollarSign size={22} />}
          iconStyle={{ background: 'var(--cfs-gold-dim)', color: 'var(--cfs-gold)' }}
          badge={t('dashboard.badge_net')}
          badgeStyle={{ background: 'rgba(221,167,86,0.12)', color: 'var(--cfs-gold)', borderColor: 'rgba(221,167,86,0.25)' }}
          value={fmt(currentKpis.totalNetSales)}
          label={t('dashboard.net_sales')}
          sub={`${t('dashboard.gross_prefix')} ${fmt(currentKpis.totalGrossSales)}`}
          WatermarkIcon={DollarSign}
          wow={wowNetSales}
        />

        {/* 2. Clientes / Visitas */}
        <KpiCard
          href="/clientes"
          icon={<Users size={22} />}
          iconStyle={{ background: 'rgba(46,202,127,0.12)', color: 'var(--success)' }}
          badge={`${currentStoresData.length} ${t('dashboard.badge_stores')}`}
          badgeStyle={{}}
          value={currentKpis.totalGuests.toLocaleString()}
          label={t('dashboard.customers')}
          sub={`${t('dashboard.avg_ticket')} ${fmt(avgPerGuest)}`}
          WatermarkIcon={Users}
          wow={wowGuests}
        />

        {/* 3. Órdenes + Ticket */}
        <KpiCard
          href="/productos"
          icon={<ShoppingCart size={22} />}
          iconStyle={{ background: 'rgba(79,172,254,0.12)', color: 'var(--info)' }}
          value={currentKpis.totalOrders.toLocaleString()}
          label={t('dashboard.orders')}
          sub={`${t('dashboard.avg_ticket')} ${fmt(avgTicket)}`}
          WatermarkIcon={ShoppingCart}
          wow={wowOrders}
        />

        {/* 4. Propinas */}
        <KpiCard
          href="/ventas"
          icon={<WalletCards size={22} />}
          iconStyle={{ background: 'rgba(253,251,247,0.08)', color: 'var(--cfs-cream)' }}
          value={fmt(totalTips)}
          label={t('dashboard.tips')}
          sub={t('dashboard.day_gratuities')}
          WatermarkIcon={WalletCards}
          wow={tipPctChg}
        />

        {/* 5. Descuentos */}
        <KpiCard
          href="/ventas"
          icon={<AlertTriangle size={22} />}
          iconStyle={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}
          value={fmt(currentKpis.totalDiscounts)}
          label={t('dashboard.discounts')}
          sub={`${t('dashboard.voids_prefix')} ${fmt(currentKpis.totalVoids + currentKpis.totalRefunds)}`}
          WatermarkIcon={AlertTriangle}
          wow={discPctChg}
          wowInverted
        />

        {/* 6. Costos Laborales */}
        <KpiCard
          href="/inventario"
          icon={<DollarSign size={22} />}
          iconStyle={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}
          badge={`${laborPct.toFixed(1)}${t('dashboard.badge_of_sales')}`}
          badgeStyle={{
            background: laborPct > 30 ? 'rgba(239,68,68,0.15)' : 'rgba(46,202,127,0.12)',
            color: laborPct > 30 ? 'var(--danger)' : 'var(--success)',
            borderColor: 'transparent',
          }}
          value={fmt(totalLaborCost)}
          label={t('dashboard.labor_costs')}
          sub={`${totalLaborHours.toFixed(1)} ${t('dashboard.hours_worked')}`}
          cardStyle={{ borderColor: laborPct > 30 ? 'rgba(239,68,68,0.3)' : 'var(--border-color)' }}
          WatermarkIcon={Users}
          wow={wowLabor}
          wowInverted
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
                {t('dashboard.hourly_flow_title')}
              </div>
              <div className={styles.cardSubtitle}>{t('dashboard.hourly_flow_subtitle')}</div>
            </div>
            {bestHour && (
              <div style={{
                background: 'var(--cfs-gold-dim)',
                border: '1px solid rgba(221,167,86,0.2)',
                borderRadius: 10, padding: '5px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--cfs-gold)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('dashboard.peak_hour')}</div>
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
                    if (name === 'ventas') return [`$${val.toLocaleString()}`, t('dashboard.tooltip_net_sales')];
                    if (name === 'clientes') return [val.toLocaleString(), t('dashboard.tooltip_customers')];
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
              { label: t('dashboard.active_hours'), value: peakHours.length.toString() },
              { label: t('dashboard.avg_per_hour'),  value: fmtShort(peakHours.length > 0 ? kpis.totalNetSales / peakHours.length : 0) },
              { label: t('dashboard.orders_per_hour'),  value: peakHours.length > 0 ? (kpis.totalOrders / peakHours.length).toFixed(0) : '—' },
              { label: t('dashboard.customers_per_hour'), value: peakHours.length > 0 ? (kpis.totalGuests / peakHours.length).toFixed(0) : '—' },
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
            {t('dashboard.payment_methods_title')}
          </div>
          <div className={styles.cardSubtitle} style={{ marginBottom: '1.2rem' }}>{t('dashboard.payment_methods_subtitle')}</div>

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
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('dashboard.no_payment_data')}</p>
              )}
            </div>
          </div>

          {/* Propinas + Scorecards */}
          <div className={styles.scorecardGrid} style={{ marginTop: '1.2rem' }}>
            <div className={styles.scorecardItem}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className={styles.scorecardValue} style={{ color: 'var(--cfs-gold)', fontSize: '1.35rem' }}>
                  {fmt(totalTips)}
                </div>
                {tipPctChg !== undefined && <WoW pct={tipPctChg} />}
              </div>
              <div className={styles.scorecardLabel}>{t('dashboard.scorecard_tips')}</div>
            </div>
            <div className={styles.scorecardItem}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className={styles.scorecardValue} style={{ fontSize: '1.35rem' }}>
                  {fmt(avgPerGuest)}
                </div>
                {guestPctChg !== undefined && <WoW pct={guestPctChg} />}
              </div>
              <div className={styles.scorecardLabel}>{t('dashboard.scorecard_per_customer')}</div>
            </div>
            <div className={styles.scorecardItem}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className={styles.scorecardValue} style={{ color: currentKpis.totalDiscounts > 0 ? 'var(--warning)' : 'var(--text-main)', fontSize: '1.35rem' }}>
                  {fmt(currentKpis.totalDiscounts)}
                </div>
                {discPctChg !== undefined && <WoW pct={discPctChg} inverted />}
              </div>
              <div className={styles.scorecardLabel}>{t('dashboard.scorecard_discounts')} ({discountPct.toFixed(1)}%)</div>
            </div>
            <div className={styles.scorecardItem}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className={styles.scorecardValue} style={{ color: currTotalVoids > 0 ? 'var(--danger)' : 'var(--text-main)', fontSize: '1.35rem' }}>
                  {fmt(currTotalVoids)}
                </div>
                {voidPctChg !== undefined && <WoW pct={voidPctChg} inverted />}
              </div>
              <div className={styles.scorecardLabel}>{t('dashboard.scorecard_voids')}</div>
            </div>
          </div>
        </div>

        {/* C) Top Sucursales — tabla detallada — col 8 */}
        <div className={`glass-card ${styles.col8}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
            <div>
              <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} />
                {t('dashboard.store_performance_title')}
              </div>
              <div className={styles.cardSubtitle}>{t('dashboard.store_performance_subtitle')}</div>
            </div>
            <div className={styles.metricPill}>
              {storesData.length} {t('dashboard.stores_count')}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className={styles.storeTable}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{t('dashboard.table_store')}</th>
                  <th>{t('dashboard.table_net_sales')}</th>
                  <th>{t('dashboard.table_customers')}</th>
                  <th>{t('dashboard.table_orders')}</th>
                  <th>{t('dashboard.table_avg_order')}</th>
                  <th>{t('dashboard.table_discounts')}</th>
                  <th>{t('dashboard.table_labor') ?? 'Costo Laboral'}</th>
                  <th>{t('dashboard.table_share')}</th>
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
                        {store.laborCost !== undefined && store.laborCost > 0 && store.netSales > 0 ? (
                          <span style={{ color: (store.laborCost / store.netSales) > 0.3 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                            {((store.laborCost / store.netSales) * 100).toFixed(1)}%
                          </span>
                        ) : '—'}
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
            {t('dashboard.op_efficiency_title')}
          </div>
          <div className={styles.cardSubtitle} style={{ marginBottom: '1.4rem' }}>{t('dashboard.op_efficiency_subtitle')}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

            <EfficiencyBar
              label="Labor Cost %"
              value={laborPct}
              max={50}
              target={30}
              color={laborPct > 30 ? 'var(--danger)' : 'var(--success)'}
              format={`${laborPct.toFixed(1)}%`}
              caption={`${fmt(totalLaborCost)} · ${totalLaborHours.toFixed(0)}h`}
              wow={wowLaborPct}
              wowInverted
              explanation={t('dashboard.explanation_labor_cost')}
            />

            <EfficiencyBar
              label={t('dashboard.discount_pct')}
              value={discountPct}
              max={20}
              target={10}
              color={discountPct > 10 ? 'var(--warning)' : 'var(--success)'}
              format={`${discountPct.toFixed(1)}%`}
              caption={fmt(currentKpis.totalDiscounts)}
              wow={wowDiscountPct}
              wowInverted
              explanation={t('dashboard.explanation_discount_pct')}
            />

            <EfficiencyBar
              label={t('dashboard.voids_pct')}
              value={voidPct}
              max={5}
              target={2}
              color={voidPct > 2 ? 'var(--danger)' : 'var(--success)'}
              format={`${voidPct.toFixed(2)}%`}
              caption={`${fmt(currentKpis.totalVoids ?? 0)} ${t('dashboard.void_caption_suffix')}`}
              wow={wowVoidPct}
              wowInverted
              explanation={t('dashboard.explanation_voids_pct')}
            />

            {/* Sales Per Labor Hour */}
            <div style={{ marginTop: '0.2rem', padding: '1rem', background: 'rgba(255,255,255,0.025)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={13} style={{ color: 'var(--cfs-gold)' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('dashboard.sales_per_labor_hour')}
                  </span>
                  {wowSalesPerLH !== undefined && <WoW pct={wowSalesPerLH} />}
                </div>
                <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.2rem', color: 'var(--cfs-gold)' }}>
                  {fmtShort(salesPerLH)}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {totalLaborHours.toFixed(1)} {t('dashboard.total_labor_hours')}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: '6px', lineHeight: '1.3' }}>
                {t('dashboard.explanation_sales_per_lh')}
              </div>
            </div>

            {/* Quick store spotlight */}
            {topStore && (
              <div style={{ padding: '1rem', background: 'rgba(221,167,86,0.06)', borderRadius: '14px', border: '1px solid rgba(221,167,86,0.15)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--cfs-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
                  {t('dashboard.top_store_label')}
                </div>
                <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                  {cleanStoreName(topStore.storeName)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cfs-gold)', fontWeight: 600 }}>
                  {fmt(topStore.netSales, 0)}&nbsp;
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>
                    · {topStore.guests.toLocaleString()} {t('dashboard.customers_label')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* E) Gráfica bar comparativa de tiendas — col 6 */}
        <div className={`glass-card ${styles.col6}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
            <div>
              <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} />
                {t('dashboard.store_comparison_title')}
              </div>
              <div className={styles.cardSubtitle}>{t('dashboard.store_comparison_subtitle')}</div>
            </div>
          </div>
          <div style={{ minWidth: 0, minHeight: 0, width: '100%', height: Math.max(240, storesData.length * 42), maxHeight: 600, overflowY: 'auto' }}>
            <ResponsiveContainer width="100%" height={Math.max(240, storesData.length * 42)}>
              <BarChart
                data={storesData.map(s => ({ ...s, shortName: cleanStoreName(s.storeName) }))}
                layout="vertical"
                margin={{ top: 0, right: 110, left: 12, bottom: 0 }}
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
                  formatter={(val: any) => [`$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, t('dashboard.tooltip_net_sales')]}
                />
                <Bar dataKey="netSales" radius={[0, 10, 10, 0]} barSize={18} fill="var(--cfs-gold)" activeBar={{ fill: '#E6C48F' }}>
                  {storesData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? '#DDA756' : i === 1 ? '#b89040' : 'rgba(221,167,86,0.5)'}
                    />
                  ))}
                  <LabelList
                    dataKey="netSales"
                    position="right"
                    content={(props: any) => {
                      const { x, y, width, height, value, index } = props;
                      const payload = storesData[index];
                      const prevVal = payload?.prevNetSales || 0;
                      const diff = prevVal > 0 ? ((value - prevVal) / prevVal * 100) : 0;
                      const sign = diff >= 0;
                      const fill = sign ? 'var(--success)' : 'var(--danger)';
                      const diffStr = prevVal > 0 ? `${sign ? '+' : ''}${diff.toFixed(1)}%` : '';

                      // Avoid rendering labels if the bar has practically zero width or data is missing
                      if (value == null || value === 0) return null;

                      // Approximate width of text to position % label
                      const valStr = `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                      const textWidth = valStr.length * 7; 

                      return (
                        <g>
                          <text x={x + width + 8} y={y + height / 2 + 4} fill="var(--cfs-cream)" fontSize={12} fontWeight={600} fontFamily="Outfit">
                            {valStr}
                          </text>
                          {diffStr && (
                            <text x={x + width + 14 + textWidth} y={y + height / 2 + 4} fill={fill} fontSize={11} fontWeight={700}>
                              {diffStr}
                            </text>
                          )}
                        </g>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* F) Mapa — col 6 */}
        <div className={`glass-card ${styles.col6}`} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div>
              <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} style={{ color: 'var(--success)' }} />
                {t('dashboard.ops_radar_title')}
              </div>
              <div className={styles.cardSubtitle}>{t('dashboard.ops_radar_subtitle')}</div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
              ● {storesData.length} {t('dashboard.synced_nodes')}
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
  icon, iconStyle, badge, badgeStyle, value, label, sub, WatermarkIcon, cardStyle, href, wow, wowInverted
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
  wow?: number;
  wowInverted?: boolean;
}) {
  const content = (
    <div className={`glass-card ${styles.kpiCardWrapper}`} style={{ ...cardStyle, cursor: href ? 'pointer' : 'default', transition: 'all 0.2s', height: '100%' }}>
      <WatermarkIcon size={128} className={styles.watermarkIcon} />
      <div className={styles.kpiHeader}>
        <div className={styles.kpiIcon} style={iconStyle}>{icon}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {badge && <div className={styles.kpiBadge} style={badgeStyle}>{badge}</div>}
          {wow !== undefined && <WoW pct={wow} label="" inverted={wowInverted} />}
        </div>
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
  label, value, max, target, color, format, caption, wow, wowInverted, explanation
}: {
  label: string; value: number; max: number; target: number;
  color: string; format: string; caption?: string;
  wow?: number; wowInverted?: boolean; explanation?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const targetPct = Math.min((target / max) * 100, 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
          {wow !== undefined && <WoW pct={wow} inverted={wowInverted} />}
        </div>
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
      {explanation && (
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px', lineHeight: '1.3' }}>
          {explanation}
        </div>
      )}
    </div>
  );
}
