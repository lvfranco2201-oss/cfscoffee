'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Store, ChevronDown, Check, X, RefreshCw, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useFilter, DateRange, GlobalFilter } from '@/context/FilterContext';
import { useDateLocale } from '@/hooks/useDateLocale';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TopFiltersProps {
  availableStores?: { id: string; name: string }[];
  onApply?: (filter: GlobalFilter) => void;   // called when user commits any filter change
  loading?: boolean;
  onRefresh?: () => void;
}

// ── Custom Dropdown ────────────────────────────────────────────────────────────

function Dropdown({
  icon: Icon, value, options, onChange, labelPrefix,
}: {
  icon: any;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
  labelPrefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value) ?? options[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
          padding: '10px 14px', borderRadius: '12px',
          background: open ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)', 
          border: '1px solid rgba(255,255,255,0.05)',
          color: open ? '#FFFFFF' : '#94A3B8', 
          cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.color = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            e.currentTarget.style.color = '#94A3B8';
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} style={{ flexShrink: 0, color: 'inherit' }} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flexGrow: 1 }}>
          {labelPrefix && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginBottom: '-1px' }}>
              {labelPrefix}
            </span>
          )}
          <span style={{ textAlign: 'left', fontWeight: 600, fontSize: '0.9rem' }}>{selected?.label ?? '—'}</span>
        </div>

        <ChevronDown size={14} style={{
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          opacity: 0.5
        }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '12px', boxShadow: 'var(--shadow-card)',
          padding: '6px', minWidth: '200px', zIndex: 300,
          display: 'flex', flexDirection: 'column', gap: '2px',
        }}>
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: '8px', border: 'none',
                background: value === opt.id ? 'var(--cfs-gold-dim)' : 'transparent',
                color: value === opt.id ? 'var(--cfs-gold)' : 'var(--text-main)',
                fontSize: '0.82rem', fontWeight: value === opt.id ? 700 : 500,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              {opt.label}
              {value === opt.id && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Custom Date Modal ──────────────────────────────────────────────────────────

function CustomDateModal({
  from, to, onApply, onClose,
}: {
  from: string; to: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(from || '');
  const [t, setT] = useState(to || '');
  const { locale } = useTranslation();

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: '18px', padding: '1.75rem', width: '340px',
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1rem' }}>
            {locale === 'en' ? 'Custom Range' : 'Rango Personalizado'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { label: locale === 'en' ? 'From' : 'Desde', val: f, set: setF, min: undefined },
            { label: locale === 'en' ? 'To'   : 'Hasta', val: t, set: setT, min: f },
          ].map(({ label, val, set, min }) => (
            <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
              <input
                type="date" value={val} min={min}
                onChange={e => set(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', padding: '9px 12px', color: 'var(--text-main)',
                  fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none',
                  textTransform: 'none', letterSpacing: 'normal', fontWeight: 500,
                }}
              />
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
            background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {locale === 'en' ? 'Cancel' : 'Cancelar'}
          </button>
          <button
            disabled={!f || !t || f > t}
            onClick={() => { if (f && t && f <= t) onApply(f, t); }}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none',
              background: (!f || !t || f > t) ? 'rgba(221,167,86,0.3)' : 'var(--cfs-gold)',
              color: '#000', fontWeight: 700, fontSize: '0.82rem',
              cursor: (!f || !t || f > t) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {locale === 'en' ? 'Apply' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TopFilters({
  availableStores = [],
  onApply,
  loading = false,
  onRefresh,
}: TopFiltersProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const isEn = dateLocale === 'en-US';  // used for bilingual labels in this component
  const { filter, setStore, setRange, setCustom, resetFilter } = useFilter();
  const [showCustomModal, setShowCustomModal] = useState(false);
  // Track range before opening custom modal so we can revert on cancel
  const [prevRange, setPrevRange] = useState(filter.range);

  // Whether the filter is non-default (to show reset button)
  const isDirty = filter.range !== 'today' || filter.store !== 'all';

  const handleRangeChange = (v: string) => {
    if (v === 'custom') {
      setPrevRange(filter.range);  // remember current to revert on cancel
      setShowCustomModal(true);
      return;
    }
    setRange(v as DateRange);
    onApply?.({ ...filter, range: v as DateRange });
  };

  const handleStoreChange = (v: string) => {
    setStore(v);
    onApply?.({ ...filter, store: v });
  };

  const handleCustomApply = (from: string, to: string) => {
    setCustom(from, to);
    setShowCustomModal(false);
    onApply?.({ ...filter, range: 'custom', customFrom: from, customTo: to });
  };

  const handleCustomCancel = () => {
    setShowCustomModal(false);
    // Only revert if dates aren't already set (first time opening custom)
    if (!filter.customFrom || !filter.customTo) {
      setRange(prevRange);
    }
  };

  // ── Options ─────────────────────────────────────────────────────────────────

  const dateLabel = (r: DateRange, from?: string, to?: string) => {
    if (r === 'custom' && from && to) {
      const s = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
      return `${s(from)} → ${s(to)}`;
    }
    const labels: Record<DateRange, string> = {
      today:      t('dashboard.current_close'),
      yesterday:  t('dashboard.date_yesterday'),
      last_7:     t('dashboard.date_last_7'),
      last_30:    t('dashboard.date_last_30'),
      this_month: t('dashboard.date_this_month'),
      last_month: t('dashboard.date_last_month'),
      ytd:        'YTD',
      custom:     t('dashboard.date_custom'),
    };
    return labels[r];
  };

  // The display label for the date dropdown trigger button
  // When custom + dates set: show the range. Otherwise: normal label.
  const activeDateLabel =
    filter.range === 'custom' && filter.customFrom && filter.customTo
      ? dateLabel('custom', filter.customFrom, filter.customTo)
      : dateLabel(filter.range);

  const dateOptions = (
    ['today', 'yesterday', 'last_7', 'last_30', 'this_month', 'last_month', 'ytd', 'custom'] as DateRange[]
  ).map(r => ({ id: r, label: dateLabel(r) }));

  const storeOptions = [
    { id: 'all', label: t('dashboard.all_stores') },
    ...availableStores.map(s => ({ id: s.id, label: s.name })),
  ];

  // For the dropdown, override the 'custom' item label when a range is already set
  const dateDisplayOptions = dateOptions.map(o =>
    o.id === 'custom' && filter.range === 'custom' && filter.customFrom && filter.customTo
      ? { ...o, label: activeDateLabel }
      : o
  );

  // The value key to select in the dropdown
  const dateDisplayValue = filter.range;

  return (
    <>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%',
        marginBottom: '0.4rem'
      }}>
        {/* Store selector */}
        {storeOptions.length > 1 && (
          <>
            <Dropdown
              icon={Store}
              value={filter.store}
              options={storeOptions}
              onChange={handleStoreChange}
              labelPrefix={isEn ? 'Store' : 'Sucursal'}
            />
          </>
        )}

        {/* Date range selector */}
        <Dropdown
          icon={Calendar}
          value={dateDisplayValue}
          options={dateDisplayOptions}
          onChange={handleRangeChange}
          labelPrefix={isEn ? 'Period' : 'Período'}
        />

        {/* Custom date badge */}
        {filter.range === 'custom' && filter.customFrom && filter.customTo && (
          <div style={{ padding: '0 4px' }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, color: 'var(--cfs-gold)',
              padding: '2px 8px', borderRadius: '6px',
              background: 'var(--cfs-gold-dim)', border: '1px solid rgba(221,167,86,0.25)',
              whiteSpace: 'nowrap',
            }}>
              {dateLabel('custom', filter.customFrom, filter.customTo)}
            </span>
          </div>
        )}

        {/* Reset to default button — only shown when filter is non-default */}
        {isDirty && (
          <>
            <button
              onClick={() => { resetFilter(); onApply?.({ range: 'today', store: 'all', customFrom: '', customTo: '' }); }}
              title={isEn ? 'Reset filters' : 'Restablecer filtros'}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(221,167,86,0.9)', width: '100%',
                cursor: 'pointer', padding: '8px 12px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s', fontSize: '0.82rem', fontWeight: 500,
              }}
            >
              <RotateCcw size={15} />
              {isEn ? 'Reset filters' : 'Restablecer filtros'}
            </button>
          </>
        )}

        {/* Refresh */}
        {onRefresh && (
          <>
            <button
              onClick={onRefresh}
              disabled={loading}
              title={isEn ? 'Refresh' : 'Actualizar'}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                color: loading ? 'rgba(255,255,255,0.3)' : 'var(--cfs-slate)',
                cursor: loading ? 'default' : 'pointer', width: '100%',
                padding: '8px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                fontSize: '0.82rem', fontWeight: 500, transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {isEn ? 'Refresh' : 'Actualizar'}
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {showCustomModal && (
        <CustomDateModal
          from={filter.customFrom}
          to={filter.customTo}
          onApply={handleCustomApply}
          onClose={handleCustomCancel}
        />
      )}
    </>
  );
}
