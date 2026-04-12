'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  Store, TrendingUp, Users, DollarSign, Clock, AlertTriangle,
  CheckCircle, XCircle, Search, ArrowUpDown, ChevronDown, ChevronUp,
  BarChart2, Percent, ShoppingCart, Wifi, WifiOff, RefreshCw, Download,
} from 'lucide-react';
import { cleanStoreName as _cleanName } from '@/utils/formatters';
import { exportToCSV } from '@/utils/exportCSV';

import dynamic from 'next/dynamic';

const DashboardMap = dynamic(() => import('./MapWrapper'), {
  ssr: false,
  loading: () => (
    <div style={{ minWidth: 0, minHeight: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
      Cargando mapa...
    </div>
  ),
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreCatalogItem {
  id: number | null;
  name: string | null;
  locationName: string | null;
  locationCode: string | null;
  address: string | null;
  timeZone: string | null;
  isActive: boolean | null;
  hasEntitlement: boolean | null;
  lastSyncedAt: Date | null;
  externalId: string | null;
}

interface StoreMetric {
  storeId: number | null;
  storeName: string | null;
  locationCode: string | null;
  netSales: number;
  grossSales: number;
  guests: number;
  orders: number;
  discounts: number;
  voids: number;
  refunds: number;
  laborCost: number;
  laborHours: number;
}

interface StoreMetric30 {
  storeId: number | null;
  storeName: string | null;
  netSales: number;
  grossSales: number;
  guests: number;
  orders: number;
  discounts: number;
  voids: number;
  daysActive: number;
}

interface DailyTrendPoint {
  businessDate: string | null;
  storeId: number | null;
  netSales: number;
  guests: number;
}

interface StoresUIProps {
  catalog: StoreCatalogItem[];
  todayByStore: StoreMetric[];
  last30ByStore: StoreMetric30[];
  dailyTrend30: DailyTrendPoint[];
  lastBusinessDateStr: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt  = (n: number, d = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;

const cleanName = (val: string | null): string => _cleanName(val);

const rankColors = ['#DDA756', '#94A3B8', '#b87333'];

// ── Main Component ────────────────────────────────────────────────────────────

export default function StoresUI({
  catalog, todayByStore, last30ByStore, dailyTrend30, lastBusinessDateStr,
}: StoresUIProps) {

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'netSales' | 'guests' | 'orders' | 'laborCost'>('netSales');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  // Date label
  const dateFmt = lastBusinessDateStr
    ? new Date(lastBusinessDateStr + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';

  // Totales del día
  const totalNetSales  = todayByStore.reduce((a, s) => a + s.netSales, 0);
  const totalGuests    = todayByStore.reduce((a, s) => a + s.guests, 0);
  const totalOrders    = todayByStore.reduce((a, s) => a + s.orders, 0);
  const totalLaborCost = todayByStore.reduce((a, s) => a + s.laborCost, 0);
  const totalLaborPct  = totalNetSales > 0 ? (totalLaborCost / totalNetSales) * 100 : 0;

  // Totales 30 días
  const total30Sales  = last30ByStore.reduce((a, s) => a + s.netSales, 0);
  const total30Orders = last30ByStore.reduce((a, s) => a + s.orders, 0);
  const total30Guests = last30ByStore.reduce((a, s) => a + s.guests, 0);

  // Stores activas / inactivas en catálogo
  const activeCount   = catalog.filter(s => s.isActive).length;
  const inactiveCount = catalog.length - activeCount;
  const entCount      = catalog.filter(s => s.hasEntitlement).length;

  // ── Datos de tienda seleccionada ──────────────────────────────────────────
  const selectedMetric = useMemo(
    () => todayByStore.find(s => s.storeId === selectedStoreId),
    [todayByStore, selectedStoreId]
  );

  const selected30 = useMemo(
    () => last30ByStore.find(s => s.storeId === selectedStoreId),
    [last30ByStore, selectedStoreId]
  );

  const selectedCatalog = useMemo(
    () => catalog.find(s => s.id === selectedStoreId),
    [catalog, selectedStoreId]
  );

  // Sparkline del store seleccionado (últimos 30 días)
  const selectedSparkline = useMemo(() => {
    if (!selectedStoreId) return [];
    return dailyTrend30
      .filter(d => d.storeId === selectedStoreId)
      .map(d => ({
        date: d.businessDate ? d.businessDate.slice(5) : '', // MM-DD
        ventas: d.netSales,
        clientes: d.guests,
      }));
  }, [dailyTrend30, selectedStoreId]);

  // Trend global 30 días (consolidado)
  const globalTrend30 = useMemo(() => {
    const map = new Map<string, { ventas: number; clientes: number }>();
    dailyTrend30.forEach(d => {
      if (!d.businessDate) return;
      const k = d.businessDate.slice(5);
      const existing = map.get(k) ?? { ventas: 0, clientes: 0 };
      map.set(k, { ventas: existing.ventas + d.netSales, clientes: existing.clientes + d.guests });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [dailyTrend30]);

  // Tabla filtrada + ordenada
  const tableData = useMemo(() => {
    const filtered = todayByStore.filter(s =>
      !search || cleanName(s.storeName).toLowerCase().includes(search.toLowerCase()) ||
      (s.locationCode ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [todayByStore, search, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'desc' ? <ChevronDown size={12} style={{ color: 'var(--cfs-gold)' }} /> : <ChevronUp size={12} style={{ color: 'var(--cfs-gold)' }} />;
  };

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="animate-in">

      {/* ── BANNER ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'relative', width: '100%', minHeight: '160px',
        borderRadius: '20px', overflow: 'hidden', marginBottom: '1.75rem',
        display: 'flex', alignItems: 'flex-end', padding: '1.75rem 2.5rem',
        border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)',
        backgroundImage: `url('/IMG_3221_edited.avif')`,
        backgroundSize: 'cover', backgroundPosition: 'center 50%',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(100deg, rgba(7,11,20,0.97) 0%, rgba(7,11,20,0.65) 55%, rgba(7,11,20,0.1) 100%)',
          zIndex: 1,
        }} />
        <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <div style={{ minWidth: 0, minHeight: 0, background: 'var(--cfs-gold)', width: '4px', height: '26px', borderRadius: '4px' }} />
            <h1 style={{ fontSize: '1.75rem', color: '#FDFBF7', fontWeight: 800, fontFamily: 'Outfit', letterSpacing: '-0.03em' }}>
              Sucursales
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginLeft: '14px' }}>
            CFSCoffee · Último cierre:&nbsp;
            <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, textTransform: 'capitalize' }}>{dateFmt}</span>
          </p>
        </div>
        {/* Quick KPI pills */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'Tiendas Activas', value: `${activeCount}` },
            { label: 'Con Analytics', value: `${entCount}` },
            { label: 'Ventas del Día', value: fmtK(totalNetSales) },
            { label: '30 Días', value: fmtK(total30Sales) },
          ].map(p => (
            <div key={p.label} style={{
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(221,167,86,0.2)', borderRadius: '10px',
              padding: '5px 12px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1rem', color: 'var(--cfs-gold)' }}>{p.value}</div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{p.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── KPI ROW ────────────────────────────────────────────────────────── */}
      <div className="grid-cols-5" style={{ marginBottom: '1.75rem' }}>
        {[
          { icon: <Store size={20} />, WM: Store, color: 'var(--cfs-gold)', bg: 'var(--cfs-gold-dim)', label: 'Sucursales Activas', value: activeCount, sub: `${inactiveCount} inactivas` },
          { icon: <Wifi size={20} />, WM: Wifi, color: 'var(--success)', bg: 'rgba(46,202,127,0.12)', label: 'Con Analytics', value: entCount, sub: `Sincronizadas con Toast` },
          { icon: <DollarSign size={20} />, WM: DollarSign, color: 'var(--cfs-gold)', bg: 'var(--cfs-gold-dim)', label: 'Ventas Netas Hoy', value: fmt(totalNetSales), sub: `Prom: ${fmt(totalNetSales / (todayByStore.length || 1))} / tienda` },
          { icon: <Users size={20} />, WM: Users, color: 'var(--info)', bg: 'rgba(79,172,254,0.12)', label: 'Clientes Hoy', value: totalGuests.toLocaleString(), sub: `Ticket: ${totalOrders > 0 ? fmt(totalNetSales / totalOrders) : '—'}` },
          { icon: <Clock size={20} />, WM: Clock, color: totalLaborPct > 30 ? 'var(--danger)' : 'var(--success)', bg: totalLaborPct > 30 ? 'rgba(239,68,68,0.1)' : 'rgba(46,202,127,0.12)', label: 'Labor Cost Hoy', value: fmt(totalLaborCost), sub: `${totalLaborPct.toFixed(1)}% de las ventas` },
        ].map((card, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.4rem', position: 'relative', overflow: 'hidden' }}>
            <card.WM size={128} style={{ position: 'absolute', bottom: '-20px', right: '-20px', opacity: 0.04, transform: 'rotate(-10deg)', zIndex: 0, pointerEvents: 'none', color: 'var(--text-main)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.9rem', position: 'relative', zIndex: 1 }}>
              <div style={{ minWidth: 0, minHeight: 0, width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: card.bg, color: card.color, border: '1px solid rgba(255,255,255,0.05)' }}>
                {card.icon}
              </div>
            </div>
            <div style={{ fontFamily: 'Outfit', fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '4px', position: 'relative', zIndex: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', position: 'relative', zIndex: 1 }}>{card.label}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.6, marginTop: '3px', position: 'relative', zIndex: 1 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── GRID PRINCIPAL ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* LEFT: Tabla de sucursales ─────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          {/* Header table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} /> Rendimiento por Sucursal — Día Actual
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Haz clic en una fila para ver el detalle de la sucursal
              </div>
            </div>
            {/* Search y Export */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  placeholder="Buscar sucursal..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                    borderRadius: '10px', padding: '7px 12px 7px 32px',
                    color: 'var(--text-main)', fontSize: '0.82rem', outline: 'none',
                    width: '200px', fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                onClick={() => {
                  const exportData = tableData.map(row => ({
                    Sucursal: row.storeName,
                    Ventas_Netas: row.netSales,
                    Clientes: row.guests,
                    Ordenes: row.orders,
                    Labor_Cost: row.laborCost,
                    Labor_Pct: row.netSales > 0 ? ((row.laborCost / row.netSales) * 100).toFixed(2) : 0,
                  }));
                  exportToCSV(exportData, 'CFS_Sucursales', { Ventas_Netas: 'Ventas Netas ($)', Labor_Cost: 'Costo Laboral ($)', Labor_Pct: 'Labor %' });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7.5px 12px', borderRadius: '10px',
                  background: 'rgba(221,167,86,0.1)', color: 'var(--cfs-gold)',
                  border: '1px solid rgba(221,167,86,0.2)',
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(221,167,86,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(221,167,86,0.1)' }}
                title="Exportar a Excel (CSV)"
              >
                <Download size={14} /> Exportar
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr>
                  {[
                    { label: 'Sucursal', key: null, align: 'left' },
                    { label: 'Estado', key: null, align: 'center' },
                    { label: 'Ventas Netas', key: 'netSales', align: 'right' },
                    { label: 'Clientes', key: 'guests', align: 'right' },
                    { label: 'Órdenes', key: 'orders', align: 'right' },
                    { label: '$/Orden', key: null, align: 'right' },
                    { label: 'Labor %', key: 'laborCost', align: 'right' },
                    { label: 'Participación', key: null, align: 'right' },
                  ].map((h, i) => (
                    <th
                      key={i}
                      onClick={() => h.key && toggleSort(h.key as typeof sortKey)}
                      style={{
                        padding: '8px 10px', textAlign: h.align as 'left' | 'right' | 'center',
                        fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: h.key ? 'pointer' : 'default', userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {h.label}
                        {h.key && <SortIcon k={h.key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((store, i) => {
                  const catEntry = catalog.find(c => c.id === store.storeId);
                  const isSelected = store.storeId === selectedStoreId;
                  const pct = totalNetSales > 0 ? (store.netSales / totalNetSales) * 100 : 0;
                  const avgTicket = store.orders > 0 ? store.netSales / store.orders : 0;
                  const labor =store.netSales > 0 ? (store.laborCost / store.netSales) * 100 : 0;
                  const barW = Math.round(pct * 1.2);

                  return (
                    <tr
                      key={store.storeId}
                      onClick={() => setSelectedStoreId(isSelected ? null : (store.storeId ?? null))}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(221,167,86,0.07)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '10px 10px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.72rem',
                            color: rankColors[i] ?? 'var(--text-muted)',
                            width: '22px', textAlign: 'center', flexShrink: 0,
                          }}>#{i + 1}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cleanName(store.storeName)}</div>
                            {store.locationCode && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>{store.locationCode}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        {catEntry?.isActive
                          ? <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                          : <XCircle size={14} style={{ color: 'var(--danger)' }} />}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--cfs-gold)', fontSize: '0.9rem' }}>
                          {fmt(store.netSales)}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 500 }}>{store.guests.toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 500 }}>{store.orders.toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{fmt(avgTicket)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 700, fontSize: '0.8rem',
                          color: labor > 30 ? 'var(--danger)' : labor > 0 ? 'var(--success)' : 'var(--text-muted)',
                        }}>
                          {labor > 0 ? `${labor.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <div style={{ width: `${Math.max(barW, 3)}px`, height: '5px', borderRadius: '6px', background: 'var(--cfs-gold)', opacity: 0.65, maxWidth: '70px' }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: '36px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Panel lateral de selección ──────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {selectedMetric && selectedStoreId ? (
            <>
              {/* Store detail card */}
              <div className="glass-card" style={{ padding: '1.4rem', borderColor: 'rgba(221,167,86,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--cfs-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
                      Sucursal Seleccionada
                    </div>
                    <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      {cleanName(selectedMetric.storeName)}
                    </div>
                    {selectedCatalog?.address && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>{selectedCatalog.address}</div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700,
                    color: selectedCatalog?.isActive ? 'var(--success)' : 'var(--danger)',
                    background: selectedCatalog?.isActive ? 'rgba(46,202,127,0.1)' : 'rgba(239,68,68,0.1)',
                    padding: '4px 10px', borderRadius: '20px',
                  }}>
                    {selectedCatalog?.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {selectedCatalog?.isActive ? 'Activa' : 'Inactiva'}
                  </div>
                </div>

                {/* Metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: 'Ventas Netas', value: fmt(selectedMetric.netSales), color: 'var(--cfs-gold)' },
                    { label: 'Clientes', value: selectedMetric.guests.toLocaleString(), color: 'var(--text-main)' },
                    { label: 'Órdenes', value: selectedMetric.orders.toLocaleString(), color: 'var(--text-main)' },
                    { label: '$/Orden', value: fmt(selectedMetric.orders > 0 ? selectedMetric.netSales / selectedMetric.orders : 0), color: 'var(--text-main)' },
                    { label: 'Labor Cost', value: selectedMetric.laborCost > 0 ? fmt(selectedMetric.laborCost) : '—', color: selectedMetric.netSales > 0 && (selectedMetric.laborCost / selectedMetric.netSales) > 0.3 ? 'var(--danger)' : 'var(--text-main)' },
                    { label: 'Labor %', value: selectedMetric.netSales > 0 && selectedMetric.laborCost > 0 ? `${((selectedMetric.laborCost / selectedMetric.netSales) * 100).toFixed(1)}%` : '—', color: selectedMetric.netSales > 0 && (selectedMetric.laborCost / selectedMetric.netSales) > 0.3 ? 'var(--danger)' : 'var(--success)' },
                    { label: 'Descuentos', value: selectedMetric.discounts > 0 ? `-${fmt(selectedMetric.discounts)}` : '—', color: selectedMetric.discounts > 0 ? 'var(--warning)' : 'var(--text-muted)' },
                    { label: 'Voids + Ref.', value: fmt((selectedMetric.voids ?? 0) + (selectedMetric.refunds ?? 0)), color: ((selectedMetric.voids ?? 0) + (selectedMetric.refunds ?? 0)) > 0 ? 'var(--danger)' : 'var(--text-muted)' },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '0.65rem 0.8rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.05rem', color: m.color, lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '3px' }}>{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Catalog info */}
                {selectedCatalog && (
                  <div style={{ marginTop: '0.9rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedCatalog.timeZone && <span>⏰ {selectedCatalog.timeZone}</span>}
                    {selectedCatalog.locationCode && <span>📍 {selectedCatalog.locationCode}</span>}
                    {selectedCatalog.lastSyncedAt && (
                      <span>🔄 {new Date(selectedCatalog.lastSyncedAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    {selectedCatalog.hasEntitlement
                      ? <span style={{ color: 'var(--success)' }}>✓ Analytics OK</span>
                      : <span style={{ color: 'var(--danger)' }}>✗ Sin entitlement</span>}
                  </div>
                )}
              </div>

              {/* 30-day summary */}
              {selected30 && (
                <div className="glass-card" style={{ padding: '1.4rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Outfit', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={14} style={{ color: 'var(--cfs-gold)' }} /> Últimos 30 Días
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                    {[
                      { label: 'Ventas Netas', value: fmt(selected30.netSales) },
                      { label: 'Clientes', value: selected30.guests.toLocaleString() },
                      { label: 'Órdenes', value: selected30.orders.toLocaleString() },
                      { label: 'Días Activos', value: `${selected30.daysActive} días` },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '8px', padding: '0.6rem 0.75rem', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{m.value}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Sparkline */}
                  {selectedSparkline.length > 0 && (
                    <div style={{ minWidth: 0, minHeight: 0, height: 90, width: '100%' }}>
                      <ResponsiveContainer>
                        <AreaChart data={selectedSparkline} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                          <defs>
                            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#DDA756" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#DDA756" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                          <YAxis tick={false} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '0.75rem', padding: '4px 10px' }}
                            formatter={(v: any) => [`$${v.toLocaleString()}`, 'Ventas']}
                          />
                          <Area type="monotone" dataKey="ventas" stroke="#DDA756" strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Placeholder cuando no hay selección */
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', minHeight: '300px', textAlign: 'center', border: '1px dashed var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
              <Store size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <div>
                <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Selecciona una Sucursal</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', opacity: 0.6 }}>Haz clic en cualquier fila de la tabla para ver el análisis detallado y la tendencia de 30 días.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FILA 2: Tendencia global 30 días + Comparativa barras ──────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Tendencia global consolidada */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <TrendingUp size={16} style={{ color: 'var(--cfs-gold)' }} /> Tendencia Global — Últimos 30 Días
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
            Ventas netas consolidadas de toda la cadena
          </div>
          <div style={{ minWidth: 0, minHeight: 0, height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={globalTrend30} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad30" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#DDA756" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#DDA756" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--cfs-gold)', borderRadius: '10px', fontSize: '0.8rem' }}
                  formatter={(v: any) => [`$${v.toLocaleString()}`, 'Ventas Netas']}
                />
                <Area type="monotone" dataKey="ventas" stroke="#DDA756" strokeWidth={2.5} fill="url(#grad30)" dot={false} isAnimationActive animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Footer summary */}
          <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '0.9rem', borderTop: '1px solid var(--border-color)', marginTop: '0.75rem' }}>
            {[
              { label: 'Total 30 días',      value: fmtK(total30Sales) },
              { label: 'Total Órdenes',      value: total30Orders.toLocaleString() },
              { label: 'Total Clientes',     value: total30Guests.toLocaleString() },
              { label: 'Prom. Diario',       value: globalTrend30.length > 0 ? fmtK(total30Sales / globalTrend30.length) : '—' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{s.value}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparativa ventas 30d por tienda */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <BarChart2 size={16} style={{ color: 'var(--cfs-gold)' }} /> Participación 30 Días por Sucursal
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
            Ventas netas — últimos 30 días
          </div>
          <div style={{ minWidth: 0, minHeight: 0, height: 240, overflowY: 'hidden' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={last30ByStore.slice(0, 10).map(s => ({ name: cleanName(s.storeName), ventas: s.netSales }))}
                layout="vertical"
                margin={{ top: 0, right: 70, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" tickFormatter={v => `$${v}`} stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis dataKey="name" type="category" width={90} stroke="var(--text-muted)" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px', fontSize: '0.8rem' }}
                  formatter={(v: any) => [`$${v.toLocaleString()}`, 'Ventas']}
                />
                <Bar dataKey="ventas" radius={[0, 8, 8, 0]} barSize={14}>
                  {last30ByStore.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#DDA756' : i === 1 ? '#b89040' : 'rgba(221,167,86,0.45)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── MAPA FULL-WIDTH ────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={16} style={{ color: 'var(--success)' }} /> Mapa de Sucursales
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>Ubicación geográfica de todos los nodos CFSCoffee</div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
            ● {activeCount} Nodos Activos
          </span>
        </div>
        <div style={{ minWidth: 0, minHeight: 0, height: '420px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <DashboardMap storesData={todayByStore.map(s => ({ storeName: s.storeName ?? '', netSales: s.netSales, guests: s.guests }))} theme="dark" />
        </div>
      </div>

    </div>
  );
}
