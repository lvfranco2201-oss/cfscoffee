'use client';
import Link from 'next/link';
import styles from '../../app/Dashboard.module.css';
import { WoW } from './WoW';

interface KpiCardProps {
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
}

export function KpiCard({
  icon, iconStyle, badge, badgeStyle, value, label, sub,
  WatermarkIcon, cardStyle, href, wow, wowInverted,
}: KpiCardProps) {
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
