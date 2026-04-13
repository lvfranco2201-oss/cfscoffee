'use client';
import { AlertTriangle } from 'lucide-react';
import { fmtK as fmtShort } from '@/utils/formatters';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface AnomalyAlertsProps {
  anomalies: { metric: string; current: number; avg: number; pctDrop: number }[];
  activeDateLabel: string;
  activeStoreName: string | null;
}

export function AnomalyAlerts({ anomalies, activeDateLabel, activeStoreName }: AnomalyAlertsProps) {
  const { t } = useTranslation();
  if (!anomalies.length) return null;

  return (
    <div style={{ marginBottom: '1rem' }}>
      {anomalies.map((a, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderLeft: '4px solid var(--danger)', borderRadius: '12px',
          padding: '12px 16px', marginBottom: '8px',
          animation: 'fade-in-up 0.4s ease',
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.88rem' }}>
                ⚠ {a.metric} {a.pctDrop.toFixed(0)}{t('dashboard.anomaly_below_avg')}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '8px' }}>
                {t('dashboard.anomaly_today')}{' '}
                {typeof a.current === 'number' && a.current < 1000 ? Math.round(a.current).toLocaleString() : fmtShort(a.current)}
                {' · '}{t('dashboard.anomaly_avg30')}{' '}
                {typeof a.avg === 'number' && a.avg < 1000 ? Math.round(a.avg).toLocaleString() : fmtShort(a.avg)}
              </span>
            </div>
            {/* Dynamic filter context badges */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                background: 'rgba(239,68,68,0.15)', color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                📅 {activeDateLabel}
              </span>
              {activeStoreName && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                  background: 'rgba(221,167,86,0.12)', color: 'var(--cfs-gold)',
                  border: '1px solid rgba(221,167,86,0.2)',
                }}>
                  🏪 {activeStoreName}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
