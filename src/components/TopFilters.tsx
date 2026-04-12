'use client';
import { Calendar, Store } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface TopFiltersProps {
  onDateChange?: (range: string) => void;
  onStoreChange?: (storeId: string) => void;
  selectedStore?: string;
  selectedDate?: string;
  availableStores?: { id: string; name: string }[];
}

export default function TopFilters({
  onDateChange,
  onStoreChange,
  selectedStore = 'all',
  selectedDate = 'last_30',
  availableStores = [
    { id: '1', name: 'Lake Nona' },
    { id: '2', name: 'Waitland' },
    { id: '3', name: 'Winter Park' },
  ],
}: TopFiltersProps) {
  const { theme } = useTheme();
  
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      background: 'rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border-color)',
      padding: '8px 12px',
      borderRadius: '12px',
    }}>
      {/* Store Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Store size={14} style={{ color: 'var(--text-muted)' }} />
        <select
          value={selectedStore}
          onChange={(e) => onStoreChange?.(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            fontSize: '0.82rem',
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            paddingRight: '12px',
          }}
        >
          <option value="all" style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>Todas las Sucursales</option>
          {availableStores.map(s => (
            <option key={s.id} value={s.id} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>{s.name}</option>
          ))}
        </select>
      </div>

      <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

      {/* Date Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
        <select
          value={selectedDate}
          onChange={(e) => onDateChange?.(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            fontSize: '0.82rem',
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            paddingRight: '12px',
          }}
        >
          <option value="today" style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>Hoy</option>
          <option value="yesterday" style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>Ayer</option>
          <option value="last_7" style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>Últimos 7 Días</option>
          <option value="last_30" style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>Últimos 30 Días</option>
          <option value="ytd" style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>YTD</option>
          <option value="custom" disabled style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>Personalizado...</option>
        </select>
      </div>
    </div>
  );
}
