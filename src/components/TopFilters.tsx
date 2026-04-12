import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Store, ChevronDown, Check } from 'lucide-react';

interface TopFiltersProps {
  onDateChange?: (range: string) => void;
  onStoreChange?: (storeId: string) => void;
  selectedStore?: string;
  selectedDate?: string;
  availableStores?: { id: string; name: string }[];
}

function CustomDropdown({ icon: Icon, value, options, onChange }: { 
  icon: any, value: string, options: { id: string, label: string, disabled?: boolean }[], onChange: (v: string) => void 
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);

  const selectedOption = options.find(o => o.id === value) || options[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button 
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'transparent', border: 'none', color: 'var(--text-main)',
          fontSize: '0.82rem', fontWeight: 600, padding: '4px 6px',
          borderRadius: '8px', cursor: 'pointer', outline: 'none'
        }}
      >
        <Icon size={14} style={{ color: 'var(--text-muted)' }} />
        {selectedOption.label}
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: '2px', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '12px', boxShadow: 'var(--shadow-card)',
          padding: '6px', minWidth: '180px', zIndex: 100,
          display: 'flex', flexDirection: 'column', gap: '2px'
        }}>
          {options.map(opt => (
            <button
              key={opt.id}
              disabled={opt.disabled}
              onClick={() => {
                if (!opt.disabled) {
                  onChange(opt.id);
                  setOpen(false);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: '8px',
                background: value === opt.id ? 'var(--cfs-gold-dim)' : 'transparent',
                color: opt.disabled ? 'var(--text-muted)' : (value === opt.id ? 'var(--cfs-gold)' : 'var(--text-main)'),
                fontSize: '0.8rem', fontWeight: value === opt.id ? 700 : 500,
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left', opacity: opt.disabled ? 0.5 : 1,
              }}
            >
              {opt.label}
              {value === opt.id && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopFilters({
  onDateChange = () => {},
  onStoreChange = () => {},
  selectedStore = 'all',
  selectedDate = 'today',
  availableStores = [],
}: TopFiltersProps) {
  
  const [store, setStore] = useState(selectedStore);
  const [date, setDate] = useState(selectedDate);

  const handleStore = (v: string) => { setStore(v); onStoreChange(v); }
  const handleDate = (v: string) => { setDate(v); onDateChange(v); }

  const storeOptions = [
    { id: 'all', label: 'Todas las Sucursales' },
    ...availableStores.map(s => ({ id: s.id, label: s.name }))
  ];

  const dateOptions = [
    { id: 'today', label: 'Cierre Actual' },
    { id: 'yesterday', label: 'Ayer' },
    { id: 'last_7', label: 'Últimos 7 Días' },
    { id: 'last_30', label: 'Últimos 30 Días' },
    { id: 'ytd', label: 'YTD' },
    { id: 'custom', label: 'Personalizado...' },
  ];

  return (
    <div style={{
      display: 'flex', gap: '12px', alignItems: 'center',
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.06)', padding: '6px 12px',
      borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    }}>
      <CustomDropdown icon={Store} value={store} options={storeOptions} onChange={handleStore} />
      <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
      <CustomDropdown icon={Calendar} value={date} options={dateOptions} onChange={handleDate} />
    </div>
  );
}
