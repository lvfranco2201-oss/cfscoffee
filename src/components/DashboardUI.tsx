'use client';
import {
  Users, DollarSign, WalletCards,
  ShoppingCart, AlertTriangle,
} from 'lucide-react';
import styles from '../app/Dashboard.module.css';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useDateLocale } from '@/hooks/useDateLocale';
import { fmt, fmtK as fmtShort } from '@/utils/formatters';
import { cleanStoreName as _clean } from '@/utils/formatters';
import TopFilters from './TopFilters';

import { useDashboardMetrics } from './dashboard/useDashboardMetrics';
import { AnomalyAlerts } from './dashboard/AnomalyAlerts';
import { KpiCard } from './dashboard/KpiCard';
import { RevenueVsCostsChart } from './dashboard/RevenueVsCostsChart';
import {
  HourlyFlowChart,
  PaymentMethodsCard,
  StoreLeaderboard,
  OpsMapCard,
  StorePerformanceTable,
  OperationalEfficiency,
} from './dashboard/sections';

import type { DashboardUIProps } from './dashboard/types';

const cleanStoreName = (v: string) => _clean(v);

// ── Main Component (orchestrator only) ────────────────────────────────────────

export default function DashboardUI(props: DashboardUIProps) {
  const {
    kpis, storesData, peakHours, paymentMethods,
    totalTips, totalLaborCost, totalLaborHours,
    dailyTrend = [], numDays = 1,
    onRefresh, loading = false,
  } = props;

  const { theme } = useTheme();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const m = useDashboardMetrics(props, dateLocale);

  // ── Best hour ─────────────────────────────────────────────────────────────
  const bestHour = peakHours.length > 0
    ? peakHours.reduce((best, h) => h.ventas > best.ventas ? h : best, peakHours[0])
    : null;

  return (
    <div className="animate-in">

      {/* ── Anomaly Alerts ──────────────────────────────────────── */}
      <AnomalyAlerts
        anomalies={m.anomalies}
        activeDateLabel={m.activeDateLabel}
        activeStoreName={m.activeStoreName}
      />

      {/* ── Photo Banner / Header ────────────────────────────────── */}
      <header className={`${styles.photoBanner} glass-card`}
        style={{
          position: 'relative', zIndex: 50, width: '100%', minHeight: '160px',
          borderRadius: '16px', overflow: 'visible', marginBottom: '1rem',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '1.25rem 1.75rem', border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
          backgroundImage: `url('/IMG_3221_edited.avif')`,
          backgroundSize: 'cover', backgroundPosition: 'center 35%',
        }}
      >
        {/* Overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(7,11,20,0.96) 0%, rgba(7,11,20,0.7) 50%, rgba(7,11,20,0.15) 100%)', zIndex: 1, borderRadius: 'inherit' }} />

        {/* Top: Filters */}
        <div className={styles.headerActions} style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%', flexWrap: 'wrap' }}>
          <TopFilters
            availableStores={storesData
              .filter(s => s.storeId != null)
              .map(s => ({ id: String(s.storeId!), name: cleanStoreName(s.storeName) }))
            }
            onApply={() => {}}
            onRefresh={onRefresh}
            loading={loading}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', border: '1px solid rgba(46,202,127,0.25)', borderRadius: '10px', padding: '7px 14px', color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span style={{ minWidth: 0, minHeight: 0, width: '7px', height: '7px', borderRadius: '50%', background: '#2eca7f', boxShadow: '0 0 8px #2eca7f', display: 'inline-block' }} />
            {m.currentStoresData.length} {t('dashboard.active_stores')}
          </div>
        </div>

        {/* Bottom: Title + Pills */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ minWidth: 0, minHeight: 0, background: 'var(--cfs-gold)', width: '4px', height: '28px', borderRadius: '4px' }} />
              <h1 style={{ fontSize: '1.9rem', color: '#FDFBF7', fontWeight: 800, fontFamily: 'Outfit', letterSpacing: '-0.03em', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
                {t('dashboard.title')}
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', fontWeight: 400, marginLeft: '14px' }}>
              CFSCoffee · {t('dashboard.last_close')}&nbsp;
              <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, textTransform: 'capitalize' }}>{m.dateFmt}</span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: t('dashboard.net_sales'), value: fmtShort(m.currentKpis.totalNetSales) },
              { label: t('dashboard.orders'),    value: m.currentKpis.totalOrders.toLocaleString() },
              { label: t('dashboard.customers'), value: m.currentKpis.totalGuests.toLocaleString() },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(221,167,86,0.2)', borderRadius: '10px', padding: '6px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.1rem', color: 'var(--cfs-gold)' }}>{item.value}</div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <section className={styles.kpiGrid}>
        <KpiCard href="/ventas"
          icon={<DollarSign size={22} />}
          iconStyle={{ background: 'var(--cfs-gold-dim)', color: 'var(--cfs-gold)' }}
          badge={t('dashboard.badge_net')}
          badgeStyle={{ background: 'rgba(221,167,86,0.12)', color: 'var(--cfs-gold)', borderColor: 'rgba(221,167,86,0.25)' }}
          value={fmt(m.currentKpis.totalNetSales)}
          label={t('dashboard.net_sales')}
          sub={`${t('dashboard.gross_prefix')} ${fmt(m.currentKpis.totalGrossSales)}`}
          WatermarkIcon={DollarSign} wow={m.wowNetSales}
        />
        <KpiCard href="/clientes"
          icon={<Users size={22} />}
          iconStyle={{ background: 'rgba(46,202,127,0.12)', color: 'var(--success)' }}
          badge={`${m.currentStoresData.length} ${t('dashboard.badge_stores')}`}
          badgeStyle={{}}
          value={m.currentKpis.totalGuests.toLocaleString()}
          label={t('dashboard.customers')}
          sub={`${t('dashboard.avg_ticket')} ${fmt(m.avgPerGuest)}`}
          WatermarkIcon={Users} wow={m.wowGuests}
        />
        <KpiCard href="/productos"
          icon={<ShoppingCart size={22} />}
          iconStyle={{ background: 'rgba(79,172,254,0.12)', color: 'var(--info)' }}
          value={m.currentKpis.totalOrders.toLocaleString()}
          label={t('dashboard.orders')}
          sub={`${t('dashboard.avg_ticket')} ${fmt(m.avgTicket)}`}
          WatermarkIcon={ShoppingCart} wow={m.wowOrders}
        />
        <KpiCard href="/ventas"
          icon={<WalletCards size={22} />}
          iconStyle={{ background: 'rgba(253,251,247,0.08)', color: 'var(--cfs-cream)' }}
          value={fmt(totalTips)}
          label={t('dashboard.tips')}
          sub={t('dashboard.day_gratuities')}
          WatermarkIcon={WalletCards} wow={m.tipPctChg}
        />
        <KpiCard href="/ventas"
          icon={<AlertTriangle size={22} />}
          iconStyle={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}
          value={fmt(m.currentKpis.totalDiscounts)}
          label={t('dashboard.discounts')}
          sub={`${t('dashboard.voids_prefix')} ${fmt(m.currentKpis.totalVoids + m.currentKpis.totalRefunds)}`}
          WatermarkIcon={AlertTriangle} wow={m.discPctChg} wowInverted
        />
        <KpiCard href="/inventario"
          icon={<DollarSign size={22} />}
          iconStyle={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}
          badge={`${m.laborPct.toFixed(1)}${t('dashboard.badge_of_sales')}`}
          badgeStyle={{ background: m.laborPct > 30 ? 'rgba(239,68,68,0.15)' : 'rgba(46,202,127,0.12)', color: m.laborPct > 30 ? 'var(--danger)' : 'var(--success)', borderColor: 'transparent' }}
          value={fmt(totalLaborCost)}
          label={t('dashboard.labor_costs')}
          sub={`${totalLaborHours.toFixed(1)} ${t('dashboard.hours_worked')} · ${fmtShort(m.avgHourlyCost)}/h`}
          cardStyle={{ borderColor: m.laborPct > 30 ? 'rgba(239,68,68,0.3)' : 'var(--border-color)' }}
          WatermarkIcon={Users} wow={m.wowLabor} wowInverted
        />
      </section>

      {/* ── Bento Charts Grid ────────────────────────────────────── */}
      <div className={styles.chartsGrid}>

        <RevenueVsCostsChart
          dailyTrend={dailyTrend}
          peakHours={peakHours}
          numDays={numDays}
          activeDateLabel={m.activeDateLabel}
          activeStoreName={m.activeStoreName}
          totalLaborCostAgg={totalLaborCost}
          totalRevenueAgg={kpis.totalNetSales}
        />

        <PaymentMethodsCard
          paymentMethods={paymentMethods}
          totalPayments={m.totalPayments}
          totalTips={totalTips}
          avgPerGuest={m.avgPerGuest}
          totalDiscounts={m.currentKpis.totalDiscounts}
          discountPct={m.discountPct}
          currTotalVoids={m.currTotalVoids}
          tipPctChg={m.tipPctChg}
          guestPctChg={m.guestPctChg}
          discPctChg={m.discPctChg}
          voidPctChg={m.voidPctChg}
        />

        <StoreLeaderboard
          storesData={storesData}
          storeCount={storesData.length}
        />

        <OperationalEfficiency
          laborPct={m.laborPct}
          totalLaborCost={totalLaborCost}
          totalLaborHours={totalLaborHours}
          discountPct={m.discountPct}
          totalDiscounts={m.currentKpis.totalDiscounts}
          voidPct={m.voidPct}
          totalVoids={m.currentKpis.totalVoids ?? 0}
          salesPerLH={m.salesPerLH}
          avgHourlyCost={m.avgHourlyCost}
          topStore={m.topStore}
          wowLaborPct={m.wowLaborPct}
          wowDiscountPct={m.wowDiscountPct}
          wowVoidPct={m.wowVoidPct}
          wowSalesPerLH={m.wowSalesPerLH}
        />

        <StorePerformanceTable
          currentStoresData={m.currentStoresData}
          storesData={storesData}
          totalNetSales={kpis.totalNetSales}
          selectedStore={m.selectedStore}
        />

        <OpsMapCard
          storesData={storesData}
          theme={theme}
        />

        <HourlyFlowChart
          peakHours={peakHours}
          bestHour={bestHour}
          kpis={kpis}
        />

      </div>
    </div>
  );
}
