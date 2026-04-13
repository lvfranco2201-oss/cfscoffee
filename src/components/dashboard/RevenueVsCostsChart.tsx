'use client';
import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import styles from '../../app/Dashboard.module.css';

export interface DailyTrendPoint {
  date: string;
  netSales: number;
  grossSales: number;
  discounts: number;
  laborCost: number;
  grossProfit: number;
}

export interface PeakHour {
  time: string;
  ventas: number;
  clientes: number;
  ordenes: number;
  labor: number;
}

interface Props {
  dailyTrend: DailyTrendPoint[];
  peakHours: PeakHour[];
  numDays: number;
  activeDateLabel: string;
  activeStoreName: string | null;
  totalLaborCostAgg?: number;
  totalRevenueAgg?: number;
}

const fmtCurrency = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

const COLORS = {
  netSales:   '#DDA756',
  labor:      '#ef4444',
  profit:     '#2eca7f',
  gross:      '#4fafd8',
  discounts:  '#f59e0b',
};

export function RevenueVsCostsChart({ dailyTrend, peakHours, numDays, activeDateLabel, activeStoreName, totalLaborCostAgg, totalRevenueAgg }: Props) {
  const { t } = useTranslation();

  // ── Decide which dataset to use ─────────────────────────────────────────
  const isHourly = numDays <= 1;

  const data = useMemo(() => {
    if (isHourly) {
      return peakHours.map(h => ({
        label: h.time,
        netSales:   h.ventas,
        laborCost:  h.labor  ?? 0,
        grossProfit: h.ventas - (h.labor ?? 0),
      }));
    }
    return dailyTrend.map(d => {
      const date = new Date(d.date + 'T12:00:00');
      const label = numDays <= 14
        ? date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
        : date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
      return {
        label,
        netSales:    d.netSales,
        laborCost:   d.laborCost,
        grossProfit: d.grossProfit,
        discounts:   d.discounts,
      };
    });
  }, [isHourly, peakHours, dailyTrend, numDays]);

  // ── Summary stats ────────────────────────────────────────────────────────
  const sumRevenue = data.reduce((s, d) => s + (d.netSales ?? 0), 0);
  const sumLabor   = data.reduce((s, d) => s + (d.laborCost ?? 0), 0);
  
  const totalRevenue = totalRevenueAgg ?? sumRevenue;
  const totalLabor   = totalLaborCostAgg ?? sumLabor;
  
  const totalProfit  = totalRevenue - totalLabor;
  const laborPct     = totalRevenue > 0 ? (totalLabor / totalRevenue * 100) : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
  const peakPoint    = data.reduce((best, d) => d.netSales > best.netSales ? d : best, data[0] ?? { label: '—', netSales: 0 });

  // ── Custom tooltip ───────────────────────────────────────────────────────
  const CustomTT = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'rgba(8,18,35,0.97)', border: '1px solid rgba(221,167,86,0.2)',
        borderRadius: '12px', padding: '12px 16px', fontSize: '0.8rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', color: '#fff', minWidth: '180px',
      }}>
        <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--cfs-gold)', borderBottom: '1px solid rgba(221,167,86,0.15)', paddingBottom: '6px' }}>
          {label}
        </div>
        {payload && payload.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS.netSales, display: 'inline-block' }} />
                Ventas Netas
              </span>
              <strong style={{ color: COLORS.netSales }}>{fmtCurrency(payload[0].payload.netSales)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS.labor, display: 'inline-block' }} />
                Costo Laboral
              </span>
              <strong style={{ color: COLORS.labor }}>{fmtCurrency(payload[0].payload.laborCost)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS.profit, display: 'inline-block' }} />
                Utilidad Bruta
              </span>
              <strong style={{ color: COLORS.profit }}>{fmtCurrency(payload[0].payload.grossProfit)}</strong>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`glass-card ${styles.col8}`}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} style={{ color: 'var(--success)' }} />
            {t('dashboard.revenue_costs_title') || 'Ingresos vs Costos'}
          </div>
          <div className={styles.cardSubtitle} style={{ marginTop: '2px' }}>
            {isHourly
              ? (t('dashboard.revenue_costs_hourly') || 'Desglose por hora del día')
              : (t('dashboard.revenue_costs_daily') || 'Tendencia diaria del periodo')
            }
            {activeStoreName && (
              <span style={{ marginLeft: '8px', color: 'var(--cfs-gold)', fontWeight: 600 }}>· {activeStoreName}</span>
            )}
          </div>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Ventas Netas', value: fmtCurrency(totalRevenue), color: COLORS.netSales },
            { label: 'Costo Laboral', value: fmtCurrency(totalLabor), sub: `${laborPct.toFixed(1)}%`, color: COLORS.labor },
            { label: 'Utilidad Bruta', value: fmtCurrency(totalProfit), sub: `${profitMargin.toFixed(1)}%`, color: COLORS.profit },
          ].map(item => (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
              border: `1px solid ${item.color}30`, padding: '6px 12px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1rem', color: item.color }}>
                {item.value}
                {item.sub && <span style={{ fontSize: '0.68rem', marginLeft: '4px', opacity: 0.7 }}>{item.sub}</span>}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                {item.label}
              </div>
            </div>
          ))}
          {peakPoint && (
            <div style={{
              background: 'var(--cfs-gold-dim)', borderRadius: '10px',
              border: '1px solid rgba(221,167,86,0.2)', padding: '6px 12px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.88rem', color: 'var(--cfs-gold)' }}>
                {peakPoint.label}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--cfs-gold)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                {isHourly ? 'Hora pico' : 'Mejor día'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: '260px', minWidth: 0, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.netSales} stopOpacity={0.35} />
                <stop offset="95%" stopColor={COLORS.netSales} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="gradLabor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.labor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLORS.labor} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={true} horizontal={false} />

            <XAxis
              dataKey="label"
              stroke="var(--text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval={numDays > 20 ? Math.floor(data.length / 10) : 'preserveStartEnd'}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtCurrency}
              domain={[0, 'auto']}
              width={50}
            />

            <RTooltip content={<CustomTT />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />

            {/* Labor Cost = red area (bottom layer) */}
            <Area
              type="monotone"
              dataKey="laborCost"
              stroke={COLORS.labor}
              strokeWidth={2}
              fill="url(#gradLabor)"
              dot={false}
              isAnimationActive
              animationDuration={1200}
            />

            {/* Net Sales = gold area */}
            <Area
              type="monotone"
              dataKey="netSales"
              stroke={COLORS.netSales}
              strokeWidth={2.5}
              fill="url(#gradRevenue)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: COLORS.netSales }}
              isAnimationActive
              animationDuration={1400}
            />

            {/* Labor threshold reference (30%) */}
            {totalRevenue > 0 && (
              <ReferenceLine
                y={totalRevenue * 0.3 / Math.max(data.length, 1)}
                stroke="rgba(239,68,68,0.3)"
                strokeDasharray="6 3"
                label={{ value: '30% target', position: 'right', fontSize: 10, fill: 'rgba(239,68,68,0.5)' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom stat row */}
      <div className={styles.statRow} style={{ marginTop: '1rem', marginBottom: 0, paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
        {[
          { label: activeDateLabel,                                           value: isHourly ? `${data.length} horas` : `${numDays} días` },
          { label: 'Labor % promedio',                                        value: `${laborPct.toFixed(1)}%` },
          { label: 'Margen utilidad',                                         value: `${profitMargin.toFixed(1)}%` },
          { label: isHourly ? 'Ventas/hora pico' : 'Mejor día ventas',       value: fmtCurrency(peakPoint?.netSales ?? 0) },
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
