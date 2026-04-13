import { useMemo } from 'react';
import { useFilter } from '@/context/FilterContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { cleanStoreName as _clean } from '@/utils/formatters';
import type { DashboardUIProps, KpiSnapshot, StoreData } from '../dashboard/types';

const cleanStoreName = (val: string) => _clean(val);

// ── Return shape ──────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  // Filter state
  selectedStore: string;
  activeStoreName: string | null;
  activeDateLabel: string;

  // Filtered data
  currentKpis: KpiSnapshot;
  currentStoresData: StoreData[];
  topStore: StoreData | undefined;

  // Derived KPIs
  avgTicket: number;
  avgPerGuest: number;
  laborPct: number;
  discountPct: number;
  voidPct: number;
  salesPerLH: number;
  avgHourlyCost: number;
  totalPayments: number;
  currTotalVoids: number;

  // WoW deltas
  wowNetSales: number | undefined;
  wowGuests: number | undefined;
  wowOrders: number | undefined;
  tipPctChg: number | undefined;
  guestPctChg: number | undefined;
  discPctChg: number | undefined;
  voidPctChg: number | undefined;
  wowLaborPct: number | undefined;
  wowLabor: number | undefined;
  wowDiscountPct: number | undefined;
  wowVoidPct: number | undefined;
  wowSalesPerLH: number | undefined;

  // Anomalies
  anomalies: { metric: string; current: number; avg: number; pctDrop: number }[];

  // Date formatting
  dateFmt: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardMetrics(
  props: DashboardUIProps,
  dateLocale: string
): DashboardMetrics {
  const {
    kpis, prevKpis, storesData, lastDateStr,
    totalTips, prevTotalTips = 0,
    totalLaborCost, prevTotalLaborCost = 0,
    totalLaborHours, prevTotalLaborHours = 0,
    avg30, paymentMethods,
  } = props;

  const { t } = useTranslation();
  const { filter } = useFilter();
  const selectedStore = filter.store;

  // ── Filter labels ─────────────────────────────────────────────────────────

  const activeStoreName = useMemo(() => {
    if (selectedStore === 'all') return null;
    const found = storesData.find(
      s => s.storeName === selectedStore || String((s as any).storeId) === selectedStore
    );
    return found ? cleanStoreName(found.storeName) : null;
  }, [selectedStore, storesData]);

  const activeDateLabel = useMemo(() => {
    const labels: Record<string, string> = {
      today: t('dashboard.date_today') !== 'dashboard.date_today' ? t('dashboard.date_today') : 'Hoy',
      yesterday: t('dashboard.date_yesterday') !== 'dashboard.date_yesterday' ? t('dashboard.date_yesterday') : 'Ayer',
      last_7: t('dashboard.date_last_7') !== 'dashboard.date_last_7' ? t('dashboard.date_last_7') : 'Últimos 7 días',
      last_30: t('dashboard.date_last_30') !== 'dashboard.date_last_30' ? t('dashboard.date_last_30') : 'Últimos 30 días',
      this_month: t('dashboard.date_this_month') !== 'dashboard.date_this_month' ? t('dashboard.date_this_month') : 'Este mes',
      last_month: t('dashboard.date_last_month') !== 'dashboard.date_last_month' ? t('dashboard.date_last_month') : 'Mes anterior',
      ytd: t('dashboard.date_ytd') !== 'dashboard.date_ytd' ? t('dashboard.date_ytd') : 'Año hasta la fecha',
      custom: filter.customFrom && filter.customTo
        ? `${filter.customFrom} → ${filter.customTo}`
        : (t('dashboard.date_custom') !== 'dashboard.date_custom' ? t('dashboard.date_custom') : 'Personalizado'),
    };
    return labels[filter.range] ?? filter.range;
  }, [filter, t]);

  // ── Filtered data ─────────────────────────────────────────────────────────

  const currentStoresData = useMemo(() => {
    if (selectedStore === 'all') return storesData;
    return storesData.filter(s =>
      s.storeName === selectedStore || String((s as any).storeId) === selectedStore
    );
  }, [storesData, selectedStore]);

  const currentKpis = useMemo<KpiSnapshot>(() => {
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

  const topStore = currentStoresData[0];

  // ── Derived scalars ───────────────────────────────────────────────────────

  const avgTicket    = currentKpis.totalOrders > 0 ? currentKpis.totalNetSales / currentKpis.totalOrders : 0;
  const avgPerGuest  = currentKpis.totalGuests > 0 ? currentKpis.totalNetSales / currentKpis.totalGuests : 0;
  const laborPct     = currentKpis.totalNetSales > 0 ? (totalLaborCost / currentKpis.totalNetSales) * 100 : 0;
  const discountPct  = currentKpis.totalGrossSales > 0 ? (currentKpis.totalDiscounts / currentKpis.totalGrossSales) * 100 : 0;
  const voidPct      = currentKpis.totalGrossSales > 0 ? (currentKpis.totalVoids / currentKpis.totalGrossSales) * 100 : 0;
  const salesPerLH   = totalLaborHours > 0 ? currentKpis.totalNetSales / totalLaborHours : 0;
  const avgHourlyCost = totalLaborHours > 0 ? totalLaborCost / totalLaborHours : 0;
  const totalPayments = paymentMethods.reduce((a, p) => a + p.value, 0);
  const currTotalVoids = (currentKpis.totalVoids ?? 0) + (currentKpis.totalRefunds ?? 0);
  const prevTotalVoids = prevKpis ? (prevKpis.totalVoids ?? 0) + (prevKpis.totalRefunds ?? 0) : 0;

  // ── WoW deltas ────────────────────────────────────────────────────────────

  const prevAvgGuest   = prevKpis?.totalGuests && prevKpis.totalGuests > 0 ? prevKpis.totalNetSales / prevKpis.totalGuests : 0;
  const prevLaborPct   = prevKpis?.totalNetSales && prevKpis.totalNetSales > 0 ? (prevTotalLaborCost / prevKpis.totalNetSales) * 100 : 0;
  const prevDiscountPct = prevKpis?.totalGrossSales && prevKpis.totalGrossSales > 0 ? (prevKpis.totalDiscounts / prevKpis.totalGrossSales) * 100 : 0;
  const prevVoidPct    = prevKpis?.totalGrossSales && prevKpis.totalGrossSales > 0 ? (prevTotalVoids / prevKpis.totalGrossSales) * 100 : 0;
  const prevSalesPerLH = prevTotalLaborHours > 0 ? (prevKpis?.totalNetSales ?? 0) / prevTotalLaborHours : 0;

  const wowNetSales    = prevKpis?.totalNetSales && prevKpis.totalNetSales > 0 ? ((currentKpis.totalNetSales - prevKpis.totalNetSales) / prevKpis.totalNetSales * 100) : undefined;
  const wowGuests      = prevKpis?.totalGuests && prevKpis.totalGuests > 0 ? ((currentKpis.totalGuests - prevKpis.totalGuests) / prevKpis.totalGuests * 100) : undefined;
  const wowOrders      = prevKpis?.totalOrders && prevKpis.totalOrders > 0 ? ((currentKpis.totalOrders - prevKpis.totalOrders) / prevKpis.totalOrders * 100) : undefined;
  const tipPctChg      = prevTotalTips > 0 ? ((totalTips - prevTotalTips) / prevTotalTips * 100) : undefined;
  const guestPctChg    = prevAvgGuest > 0 ? ((avgPerGuest - prevAvgGuest) / prevAvgGuest * 100) : undefined;
  const discPctChg     = prevKpis?.totalDiscounts && prevKpis.totalDiscounts > 0 ? ((currentKpis.totalDiscounts - prevKpis.totalDiscounts) / prevKpis.totalDiscounts * 100) : undefined;
  const voidPctChg     = prevTotalVoids > 0 ? ((currTotalVoids - prevTotalVoids) / prevTotalVoids * 100) : undefined;
  const wowLaborPct    = prevLaborPct > 0 ? ((laborPct - prevLaborPct) / prevLaborPct * 100) : undefined;
  const wowLabor       = prevTotalLaborCost > 0 ? ((totalLaborCost - prevTotalLaborCost) / prevTotalLaborCost * 100) : undefined;
  const wowDiscountPct = prevDiscountPct > 0 ? ((discountPct - prevDiscountPct) / prevDiscountPct * 100) : undefined;
  const wowVoidPct     = prevVoidPct > 0 ? ((voidPct - prevVoidPct) / prevVoidPct * 100) : undefined;
  const wowSalesPerLH  = prevSalesPerLH > 0 ? ((salesPerLH - prevSalesPerLH) / prevSalesPerLH * 100) : undefined;

  // ── Anomaly detection ─────────────────────────────────────────────────────

  const anomalies: { metric: string; current: number; avg: number; pctDrop: number }[] = [];
  const THRESHOLD = 0.20;

  if (avg30.avgNetSales > 0) {
    const pct = (avg30.avgNetSales - currentKpis.totalNetSales) / avg30.avgNetSales;
    if (pct > THRESHOLD) anomalies.push({ metric: t('dashboard.anomaly_net_sales'), current: currentKpis.totalNetSales, avg: avg30.avgNetSales, pctDrop: pct * 100 });
  }
  if (avg30.avgGuests > 0) {
    const pct = (avg30.avgGuests - currentKpis.totalGuests) / avg30.avgGuests;
    if (pct > THRESHOLD) anomalies.push({ metric: t('dashboard.anomaly_customers'), current: currentKpis.totalGuests, avg: avg30.avgGuests, pctDrop: pct * 100 });
  }
  if (avg30.avgOrders > 0) {
    const pct = (avg30.avgOrders - currentKpis.totalOrders) / avg30.avgOrders;
    if (pct > THRESHOLD) anomalies.push({ metric: t('dashboard.anomaly_orders'), current: currentKpis.totalOrders, avg: avg30.avgOrders, pctDrop: pct * 100 });
  }

  // ── Date label ────────────────────────────────────────────────────────────

  const dateFmt = lastDateStr.includes('→')
    ? lastDateStr
    : new Date(lastDateStr + 'T12:00:00').toLocaleDateString(dateLocale, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

  return {
    selectedStore, activeStoreName, activeDateLabel,
    currentKpis, currentStoresData, topStore,
    avgTicket, avgPerGuest, laborPct, discountPct, voidPct,
    salesPerLH, avgHourlyCost, totalPayments, currTotalVoids,
    wowNetSales, wowGuests, wowOrders, tipPctChg, guestPctChg,
    discPctChg, voidPctChg, wowLaborPct, wowLabor, wowDiscountPct,
    wowVoidPct, wowSalesPerLH,
    anomalies, dateFmt,
  };
}
