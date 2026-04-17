'use client';
import { Activity, BarChart2, WalletCards, Percent, Clock } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import styles from '../../app/Dashboard.module.css';
import { WoW } from './WoW';
import { fmt, fmtK as fmtShort } from '@/utils/formatters';
import { cleanStoreName as _clean } from '@/utils/formatters';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import type { PeakHour, PaymentMethod, StoreData, KpiSnapshot } from './types';
import dynamic from 'next/dynamic';

function MapLoader() {
  const { t } = useTranslation();
  return (
    <div style={{ minWidth: 0, minHeight: 0, height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      {t('dashboard.map_loading')}
    </div>
  );
}

const DashboardMap = dynamic(() => import('../MapWrapper'), {
  ssr: false,
  loading: () => <MapLoader />,
});


const cleanStoreName = (v: string) => _clean(v);

// ── Shared sub-components ─────────────────────────────────────────────────────

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
        <div style={{ position: 'absolute', top: '-4px', left: `${targetPct}%`, width: '2px', height: '14px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', transform: 'translateX(-50%)' }} />
      </div>
      {caption && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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

// ── A) Hourly flow chart ──────────────────────────────────────────────────────

interface HourlyFlowChartProps {
  peakHours: PeakHour[];
  bestHour: PeakHour | null;
  kpis: KpiSnapshot;
}

export function HourlyFlowChart({ peakHours, bestHour, kpis }: HourlyFlowChartProps) {
  const { t } = useTranslation();
  return (
    <div className={`glass-card ${styles.col12}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
        <div>
          <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--cfs-gold)' }} />
            {t('dashboard.hourly_flow_title')}
          </div>
          <div className={styles.cardSubtitle}>{t('dashboard.hourly_flow_subtitle')}</div>
        </div>
        {bestHour && (
          <div style={{ background: 'var(--cfs-gold-dim)', border: '1px solid rgba(221,167,86,0.2)', borderRadius: 10, padding: '5px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--cfs-gold)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('dashboard.peak_hour')}</div>
            <div style={{ fontFamily: 'Outfit', fontWeight: 800, color: 'var(--cfs-gold)', fontSize: '1rem' }}>{bestHour.time}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtShort(bestHour.ventas)}</div>
          </div>
        )}
      </div>

      <div style={{ width: '100%', height: '280px', minWidth: 0, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={peakHours} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                if (name === 'ventas')   return [`$${val.toLocaleString()}`, t('dashboard.tooltip_net_sales')];
                if (name === 'clientes') return [val.toLocaleString(), t('dashboard.tooltip_customers')];
                return [val, name];
              }}
            />
            <Area yAxisId="left"  type="monotone" dataKey="ventas"   stroke="#DDA756" strokeWidth={2.5} fill="url(#gradSales)"    name="ventas"   isAnimationActive animationDuration={1500} />
            <Line yAxisId="right" type="monotone" dataKey="clientes" stroke="#3b82f6" strokeWidth={2}   dot={false}                name="clientes" isAnimationActive animationDuration={1800} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.statRow} style={{ marginTop: '1rem', marginBottom: 0, paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        {[
          { label: t('dashboard.active_hours'),        value: peakHours.length.toString() },
          { label: t('dashboard.avg_per_hour'),        value: fmtShort(peakHours.length > 0 ? kpis.totalNetSales / peakHours.length : 0) },
          { label: t('dashboard.orders_per_hour'),     value: peakHours.length > 0 ? (kpis.totalOrders / peakHours.length).toFixed(0) : '—' },
          { label: t('dashboard.customers_per_hour'), value: peakHours.length > 0 ? (kpis.totalGuests / peakHours.length).toFixed(0) : '—' },
        ].map(s => (
          <div key={s.label} className={styles.statItem}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── B) Payment methods ────────────────────────────────────────────────────────

interface PaymentMethodsCardProps {
  paymentMethods: PaymentMethod[];
  totalPayments: number;
  totalTips: number;
  avgPerGuest: number;
  totalDiscounts: number;
  discountPct: number;
  currTotalVoids: number;
  tipPctChg?: number;
  guestPctChg?: number;
  discPctChg?: number;
  voidPctChg?: number;
}

export function PaymentMethodsCard({
  paymentMethods, totalPayments, totalTips, avgPerGuest,
  totalDiscounts, discountPct, currTotalVoids,
  tipPctChg, guestPctChg, discPctChg, voidPctChg,
}: PaymentMethodsCardProps) {
  const { t } = useTranslation();
  return (
    <div className={`glass-card ${styles.col4}`}>
      <div className={styles.cardTitle} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <WalletCards size={16} style={{ color: 'var(--cfs-gold)' }} />
        {t('dashboard.payment_methods_title')}
      </div>
      <div className={styles.cardSubtitle} style={{ marginBottom: '1.2rem' }}>{t('dashboard.payment_methods_subtitle')}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '160px', height: '160px', flexShrink: 0, minWidth: 0, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={paymentMethods.length > 0 ? paymentMethods : [{ name: 'Sin datos', value: 1, color: 'var(--border-color)' }]}
                cx="50%" cy="50%" innerRadius={46} outerRadius={64}
                paddingAngle={5} cornerRadius={8} dataKey="value" stroke="none"
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

      <div className={styles.scorecardGrid} style={{ marginTop: '1.2rem' }}>
        {[
          { value: fmt(totalTips),      label: t('dashboard.scorecard_tips'),         color: 'var(--cfs-gold)', wow: tipPctChg },
          { value: fmt(avgPerGuest),    label: t('dashboard.scorecard_per_customer'), color: undefined,          wow: guestPctChg },
          { value: fmt(totalDiscounts), label: `${t('dashboard.scorecard_discounts')} (${discountPct.toFixed(1)}%)`, color: totalDiscounts > 0 ? 'var(--warning)' : undefined, wow: discPctChg, wowInverted: true },
          { value: fmt(currTotalVoids), label: t('dashboard.scorecard_voids'),        color: currTotalVoids > 0 ? 'var(--danger)' : undefined, wow: voidPctChg, wowInverted: true },
        ].map(item => (
          <div key={item.label} className={styles.scorecardItem}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className={styles.scorecardValue} style={{ color: item.color, fontSize: '1.35rem' }}>{item.value}</div>
              {item.wow !== undefined && <WoW pct={item.wow} inverted={item.wowInverted} />}
            </div>
            <div className={styles.scorecardLabel}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── E) Store Leaderboard ──────────────────────────────────────────────────────

interface StoreLeaderboardProps {
  storesData: StoreData[];
  storeCount: number;
}

export function StoreLeaderboard({ storesData, storeCount }: StoreLeaderboardProps) {
  const { t } = useTranslation();

  const maxSales = Math.max(...storesData.map(s => s.netSales), 1);
  const medals = ['🥇', '🥈', '🥉'];
  const rankColors = [
    { bar: 'linear-gradient(90deg,#b8762a,#DDA756,#f0c070)', glow: 'rgba(221,167,86,0.35)', text: '#DDA756', border: 'rgba(221,167,86,0.3)' },
    { bar: 'linear-gradient(90deg,#7a8fa6,#b0c4d8,#d0dde8)', glow: 'rgba(176,196,222,0.25)', text: '#b0c4d8', border: 'rgba(176,196,222,0.2)' },
    { bar: 'linear-gradient(90deg,#8b5e3c,#cd8b56,#e8a878)', glow: 'rgba(205,139,86,0.25)', text: '#cd8b56', border: 'rgba(205,139,86,0.2)' },
  ];

  return (
    <div className={`glass-card ${styles.col8}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.4rem' }}>
        <div>
          <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} />
            {t('dashboard.store_comparison_title')}
          </div>
          <div className={styles.cardSubtitle}>{t('dashboard.store_comparison_subtitle')}</div>
        </div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: 'rgba(221,167,86,0.08)', color: 'var(--cfs-gold)', border: '1px solid rgba(221,167,86,0.18)' }}>
          {storeCount} {t('dashboard.stores_count')}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: 560, paddingRight: '4px' }}>
        {storesData.map((store, i) => {
          const pct = (store.netSales / maxSales) * 100;
          const prevVal = store.prevNetSales ?? 0;
          const diff = prevVal > 0 ? ((store.netSales - prevVal) / prevVal * 100) : undefined;
          const isPositive = diff !== undefined && diff >= 0;
          const isTop3 = i < 3;
          const rank = rankColors[i] ?? {
            bar: 'linear-gradient(90deg, rgba(221,167,86,0.3), rgba(221,167,86,0.55))',
            glow: 'transparent', text: 'var(--cfs-gold)', border: 'transparent',
          };

          return (
            <div key={store.storeName} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: isTop3 ? '10px 12px' : '8px 10px',
              borderRadius: '12px',
              background: isTop3 ? 'rgba(255,255,255,0.03)' : 'transparent',
              border: isTop3 ? `1px solid ${rank.border}` : '1px solid transparent',
              transition: 'background 0.2s ease',
              boxShadow: isTop3 ? `inset 0 0 30px ${rank.glow}` : 'none',
            }}>
              <div style={{ width: '28px', textAlign: 'center', flexShrink: 0, fontSize: isTop3 ? '1.1rem' : '0.72rem', fontWeight: 700, color: isTop3 ? undefined : 'var(--text-muted)', lineHeight: 1 }}>
                {isTop3 ? medals[i] : `#${i + 1}`}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: isTop3 ? 700 : 600, color: isTop3 ? rank.text : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                    {cleanStoreName(store.storeName)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: isTop3 ? '0.95rem' : '0.85rem', color: isTop3 ? rank.text : 'var(--cfs-cream)' }}>
                      ${store.netSales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                    {diff !== undefined && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '20px', background: isPositive ? 'rgba(46,202,127,0.12)' : 'rgba(239,68,68,0.12)', color: isPositive ? 'var(--success)' : 'var(--danger)', border: `1px solid ${isPositive ? 'rgba(46,202,127,0.2)' : 'rgba(239,68,68,0.2)'}`, whiteSpace: 'nowrap' }}>
                        {isPositive ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ height: isTop3 ? '7px' : '5px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: '6px', background: rank.bar, boxShadow: isTop3 ? `0 0 8px ${rank.glow}` : 'none', transition: 'width 1.2s cubic-bezier(0.25, 1, 0.5, 1)' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── F) Ops Map ────────────────────────────────────────────────────────────────

interface OpsMapCardProps {
  storesData: StoreData[];
  theme: string;
}

export function OpsMapCard({ storesData, theme }: OpsMapCardProps) {
  const { t } = useTranslation();
  return (
    <div className={`glass-card ${styles.col4}`} style={{ display: 'flex', flexDirection: 'column' }}>
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
      <div style={{ flex: 1, minHeight: '380px', borderRadius: '16px', overflow: 'visible', border: '1px solid var(--border-color)', position: 'relative' }}>
        <DashboardMap storesData={storesData} theme={theme} />
      </div>
    </div>
  );
}

// ── C) Store Performance Table ────────────────────────────────────────────────

interface StorePerformanceTableProps {
  currentStoresData: StoreData[];
  storesData: StoreData[];
  totalNetSales: number;
  selectedStore: string;
}

export function StorePerformanceTable({ currentStoresData, storesData, totalNetSales, selectedStore }: StorePerformanceTableProps) {
  const { t } = useTranslation();
  return (
    <div className={`glass-card ${styles.col8}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
        <div>
          <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} />
            {t('dashboard.store_performance_title')}
          </div>
          <div className={styles.cardSubtitle}>{t('dashboard.store_performance_subtitle')}</div>
        </div>
        <div className={styles.metricPill}>{storesData.length} {t('dashboard.stores_count')}</div>
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
              const pct = totalNetSales > 0 ? (store.netSales / totalNetSales) * 100 : 0;
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
                  <td><span style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--cfs-gold)' }}>{fmt(store.netSales, 0)}</span></td>
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
                      <div className={styles.miniBar} style={{ width: `${(pct / 100) * 100}px` }} />
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', minWidth: '38px' }}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── D) Operational Efficiency ─────────────────────────────────────────────────

interface OperationalEfficiencyProps {
  laborPct: number; totalLaborCost: number; totalLaborHours: number;
  discountPct: number; totalDiscounts: number;
  voidPct: number; totalVoids: number;
  salesPerLH: number; avgHourlyCost: number;
  topStore: StoreData | undefined;
  wowLaborPct?: number; wowDiscountPct?: number; wowVoidPct?: number; wowSalesPerLH?: number;
}

export function OperationalEfficiency({
  laborPct, totalLaborCost, totalLaborHours,
  discountPct, totalDiscounts,
  voidPct, totalVoids,
  salesPerLH, avgHourlyCost,
  topStore,
  wowLaborPct, wowDiscountPct, wowVoidPct, wowSalesPerLH,
}: OperationalEfficiencyProps) {
  const { t } = useTranslation();
  return (
    <div className={`glass-card ${styles.col4}`} style={{ height: 'max-content' }}>
      <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
        <Percent size={16} style={{ color: 'var(--cfs-gold)' }} />
        {t('dashboard.op_efficiency_title')}
      </div>
      <div className={styles.cardSubtitle} style={{ marginBottom: '1.4rem' }}>{t('dashboard.op_efficiency_subtitle')}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <EfficiencyBar
          label={t('dashboard.labor_cost_pct')}
          value={laborPct} max={50} target={30}
          color={laborPct > 30 ? 'var(--danger)' : 'var(--success)'}
          format={`${laborPct.toFixed(1)}%`}
          caption={`${fmt(totalLaborCost)} · ${totalLaborHours.toFixed(0)}h`}
          wow={wowLaborPct} wowInverted
          explanation={t('dashboard.explanation_labor_cost')}
        />
        <EfficiencyBar
          label={t('dashboard.discount_pct')}
          value={discountPct} max={5} target={1}
          color={discountPct > 1 ? 'var(--warning)' : 'var(--success)'}
          format={`${discountPct.toFixed(1)}%`}
          caption={fmt(totalDiscounts)}
          wow={wowDiscountPct} wowInverted
          explanation={t('dashboard.explanation_discount_pct')}
        />
        <EfficiencyBar
          label={t('dashboard.voids_pct')}
          value={voidPct} max={5} target={2}
          color={voidPct > 2 ? 'var(--danger)' : 'var(--success)'}
          format={`${voidPct.toFixed(2)}%`}
          caption={`${fmt(totalVoids)} ${t('dashboard.void_caption_suffix')}`}
          wow={wowVoidPct} wowInverted
          explanation={t('dashboard.explanation_voids_pct')}
        />

        {/* Sales per labor hour */}
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
            {totalLaborHours.toFixed(1)} {t('dashboard.total_labor_hours')} · {t('dashboard.avg_hourly_cost_prefix')}{' '}
            <span style={{ color: 'var(--cfs-gold)', fontWeight: 600 }}>{fmt(avgHourlyCost)}/h</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: '6px', lineHeight: '1.3' }}>
            {t('dashboard.explanation_sales_per_lh')}
          </div>
        </div>

        {/* Top store spotlight */}
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
  );
}
