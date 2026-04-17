'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────

export type DateRange =
  | 'today'
  | 'yesterday'
  | 'last_7'
  | 'last_30'
  | 'this_month'
  | 'last_month'
  | 'ytd'
  | 'custom';

export interface GlobalFilter {
  range: DateRange;
  store: string;       // 'all' | numeric store ID as string
  customFrom: string;  // yyyy-mm-dd or ''
  customTo: string;    // yyyy-mm-dd or ''
}

interface FilterContextValue {
  filter: GlobalFilter;
  setRange:   (r: DateRange) => void;
  setStore:   (s: string) => void;
  setCustom:  (from: string, to: string) => void;
  setFilter:  (f: Partial<GlobalFilter>) => void;
  resetFilter: () => void;
  /** Global store list — loaded once, available to all pages and TopFilters */
  availableStores: { id: string; name: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cfs_filter';
const VALID_RANGES: DateRange[] = [
  'today','yesterday','last_7','last_30','this_month','last_month','ytd','custom'
];

const DEFAULT_FILTER: GlobalFilter = {
  range: 'today',
  store: 'all',
  customFrom: '',
  customTo: '',
};

function loadFromStorage(): GlobalFilter {
  if (typeof window === 'undefined') return DEFAULT_FILTER;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GlobalFilter;
      if (VALID_RANGES.includes(parsed.range)) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_FILTER;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<GlobalFilter>(loadFromStorage);
  const [availableStores, setAvailableStores] = useState<{ id: string; name: string }[]>([]);

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filter)); } catch { /* ignore */ }
  }, [filter]);

  // Fetch the store catalog once on app load — rarely changes
  useEffect(() => {
    fetch('/api/stores')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data?.stores)) setAvailableStores(data.stores); })
      .catch(() => { /* silent — pages can still pass their own list as fallback */ });
  }, []);

  const setRange    = (range: DateRange)   => setFilterState(f => ({ ...f, range }));
  const setStore    = (store: string)      => setFilterState(f => ({ ...f, store }));
  const setCustom   = (customFrom: string, customTo: string) =>
    setFilterState(f => ({ ...f, range: 'custom', customFrom, customTo }));
  const setFilter   = (partial: Partial<GlobalFilter>) =>
    setFilterState(f => ({ ...f, ...partial }));
  const resetFilter = () => {
    localStorage.removeItem(STORAGE_KEY);
    setFilterState(DEFAULT_FILTER);
  };

  return (
    <FilterContext.Provider value={{ filter, setRange, setStore, setCustom, setFilter, resetFilter, availableStores }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}

/** Build URLSearchParams from a GlobalFilter */
export function filterToParams(f: GlobalFilter): URLSearchParams {
  const p = new URLSearchParams({ range: f.range, store: f.store });
  if (f.range === 'custom' && f.customFrom) p.set('from', f.customFrom);
  if (f.range === 'custom' && f.customTo)   p.set('to',   f.customTo);
  return p;
}
