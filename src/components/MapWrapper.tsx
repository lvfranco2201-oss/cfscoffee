'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface LocalMapProps {
  storesData: {
    storeName: string;
    netSales: number;
    guests: number;
    orders?: number;
    laborCost?: number;
  }[];
  theme?: string;
}

const cleanName = (name: string) =>
  name.replace(/CFS\s*Coffee\s*/i, '').replace(/[-–]/g, '').trim() || name;

// ─── Real GPS coordinates ────────────────────────────────────────────────────
const STORE_COORDS: Record<string, [number, number]> = {
  'lake nona':      [28.3894, -81.2479],
  'dr. phillips':   [28.4507, -81.4850],
  'dr phillips':    [28.4507, -81.4850],
  'oviedo':         [28.6687, -81.1884],
  'winter garden':  [28.5352, -81.6010],
  'celebration':    [28.3270, -81.5439],
  'maitland':       [28.6278, -81.3762],
  'heathrow':       [28.7589, -81.3620],
  'moss park':      [28.4033, -81.2196],
  'autonation':     [28.6522, -81.3267],
  'casselberry':    [28.6522, -81.3267],
  'downtown':       [28.5383, -81.3785],
  'kirkman':        [28.4837, -81.4575],
  'the villages':   [28.9173, -81.9647],
  'coral gables':   [25.7480, -80.2580],
  'oakbrook':       [28.5100, -81.3500],
};

const getCoordinate = (storeName: string, index: number): [number, number] => {
  const key = cleanName(storeName).toLowerCase().replace(/\s+/g, ' ').trim();
  if (STORE_COORDS[key]) return STORE_COORDS[key];
  for (const [k, coords] of Object.entries(STORE_COORDS)) {
    if (key.includes(k) || k.includes(key)) return coords;
  }
  const baseLat = 28.5383;
  const baseLng = -81.3792;
  const gridRow = Math.floor(index / 4);
  const gridCol = index % 4;
  return [baseLat + (gridRow - 1) * 0.08, baseLng + (gridCol - 1.5) * 0.12];
};

// ─── Portal Tooltip (renders outside the map DOM entirely) ───────────────────
interface TooltipData {
  store: LocalMapProps['storesData'][0];
  color: string;
  salesRatio: number;
  laborPct: number;
  hasHighLabor: boolean;
  isTop: boolean;
  x: number;
  y: number;
}

function MapTooltip({ data }: { data: TooltipData }) {
  const { store, color, salesRatio, laborPct, hasHighLabor, isTop, x, y } = data;

  // Smart positioning: flip horizontally if near right edge, vertically if near bottom
  const tooltipWidth = 200;
  const tooltipHeight = 180;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const flipX = x + tooltipWidth + 16 > vw;
  const flipY = y + tooltipHeight + 16 > vh;

  const left = flipX ? x - tooltipWidth - 12 : x + 12;
  const top  = flipY ? y - tooltipHeight - 12 : y + 12;

  return createPortal(
    <div style={{
      position: 'fixed',
      left,
      top,
      zIndex: 99999,
      background: 'rgba(8,18,35,0.97)',
      border: '1px solid rgba(221,167,86,0.25)',
      borderRadius: '14px',
      padding: '14px 18px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(221,167,86,0.08)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      minWidth: '170px',
      pointerEvents: 'none',
      fontFamily: "'Inter', sans-serif",
      fontSize: '0.82rem',
      transition: 'left 0.05s, top 0.05s',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '10px', paddingBottom: '8px',
        borderBottom: '1px solid rgba(221,167,86,0.15)',
      }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: color, boxShadow: `0 0 8px ${color}`,
          display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FDFBF7' }}>
          {cleanName(store.storeName)}
        </span>
        {isTop && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px',
            borderRadius: '20px', background: 'rgba(221,167,86,0.15)',
            color: '#DDA756', border: '1px solid rgba(221,167,86,0.3)',
          }}>#1</span>
        )}
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Ventas Netas</span>
          <strong style={{ color: '#DDA756', fontFamily: 'Outfit' }}>
            ${store.netSales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Clientes</span>
          <strong style={{ color: '#FDFBF7' }}>{store.guests.toLocaleString()}</strong>
        </div>
        {store.orders != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Órdenes</span>
            <strong style={{ color: '#FDFBF7' }}>{store.orders.toLocaleString()}</strong>
          </div>
        )}
        {laborPct > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Labor %</span>
            <strong style={{ color: hasHighLabor ? '#EF4444' : '#2eca7f' }}>
              {laborPct.toFixed(1)}%
            </strong>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{
            width: `${salesRatio * 100}%`, height: '100%', borderRadius: '4px',
            background: `linear-gradient(90deg, ${color}aa, ${color})`,
          }} />
        </div>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px', textAlign: 'right' }}>
          {(salesRatio * 100).toFixed(0)}% del máximo
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Map Component ───────────────────────────────────────────────────────
export default function DashboardMap({ storesData, theme = 'dark' }: LocalMapProps) {
  const [mounted, setMounted] = useState(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    setMounted(true);
    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-container {
        background: #060d18;
        font-family: 'Inter', 'Outfit', sans-serif;
      }
      .leaflet-control-attribution {
        background: rgba(6,13,24,0.75) !important;
        color: rgba(255,255,255,0.35) !important;
        font-size: 9px !important;
        border-radius: 6px 0 0 0 !important;
        padding: 2px 6px !important;
        backdrop-filter: blur(6px);
      }
      .leaflet-control-attribution a { color: rgba(221,167,86,0.6) !important; }
      .leaflet-control-zoom a {
        background: rgba(16,28,46,0.9) !important;
        color: rgba(255,255,255,0.75) !important;
        border: 1px solid rgba(221,167,86,0.2) !important;
        backdrop-filter: blur(8px);
        font-size: 16px !important;
        line-height: 26px !important;
        transition: all 0.2s ease;
      }
      .leaflet-control-zoom a:hover {
        background: rgba(221,167,86,0.15) !important;
        color: #DDA756 !important;
      }
      .leaflet-control-zoom {
        border: none !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        border-radius: 10px !important;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
    styleRef.current = style;
    return () => { if (styleRef.current) document.head.removeChild(styleRef.current); };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }, []);

  if (!mounted || typeof window === 'undefined') return null;

  const activeStores = storesData.filter(s => s.netSales > 0);
  const maxSales = Math.max(...activeStores.map(s => s.netSales), 1);

  const orlandoStores = activeStores.filter(s => {
    const coords = getCoordinate(s.storeName, 0);
    return coords[0] > 27 && coords[0] < 30;
  });

  const centerLat = orlandoStores.length > 0
    ? orlandoStores.reduce((sum, s, i) => sum + getCoordinate(s.storeName, i)[0], 0) / orlandoStores.length
    : 28.5383;
  const centerLng = orlandoStores.length > 0
    ? orlandoStores.reduce((sum, s, i) => sum + getCoordinate(s.storeName, i)[1], 0) / orlandoStores.length
    : -81.3792;

  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  return (
    <div
      style={{ minWidth: 0, minHeight: 0, height: '100%', width: '100%', position: 'relative' }}
      onMouseLeave={() => setTooltip(null)}
      onMouseMove={handleMouseMove}
    >
      <MapContainer
        key={`cfs-map-${theme}`}
        center={[centerLat, centerLng]}
        zoom={10}
        zoomControl={true}
        scrollWheelZoom={true}
        style={{ minWidth: 0, minHeight: 0, height: '100%', width: '100%', zIndex: 1, borderRadius: '16px' }}
      >
        <TileLayer url={tileUrl} attribution="&copy; <a href='https://carto.com/'>CARTO</a>" />

        {activeStores.map((store, idx) => {
          const pos = getCoordinate(store.storeName, idx);
          const salesRatio = store.netSales / maxSales;
          const radius = 7 + salesRatio * 14;
          const isTop = idx === 0;
          const laborPct = store.laborCost && store.netSales > 0
            ? (store.laborCost / store.netSales) * 100 : 0;
          const hasHighLabor = laborPct > 30;
          const color = isTop ? '#DDA756'
            : hasHighLabor ? '#EF4444'
            : salesRatio > 0.6 ? '#2eca7f'
            : '#4fafd8';

          return (
            <CircleMarker
              key={store.storeName}
              center={pos}
              radius={radius}
              pathOptions={{
                color,
                weight: isTop ? 2.5 : 1.8,
                opacity: 0.9,
                fillColor: color,
                fillOpacity: 0.18 + salesRatio * 0.22,
              }}
              eventHandlers={{
                mouseover: (e) => {
                  const nativeEvent = e.originalEvent as MouseEvent;
                  setTooltip({ store, color, salesRatio, laborPct, hasHighLabor, isTop, x: nativeEvent.clientX, y: nativeEvent.clientY });
                },
                mouseout: () => setTooltip(null),
              }}
            />
          );
        })}
      </MapContainer>

      {/* Portal tooltip — renders directly in document.body, no clipping possible */}
      {tooltip && <MapTooltip data={tooltip} />}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '28px', left: '12px', zIndex: 999,
        background: 'rgba(6,13,24,0.85)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(221,167,86,0.15)', borderRadius: '10px',
        padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '5px',
        fontSize: '0.68rem', fontWeight: 600,
      }}>
        {[
          { color: '#DDA756', label: 'Top Sucursal' },
          { color: '#2eca7f', label: 'Alto Rendimiento' },
          { color: '#4fafd8', label: 'Estándar' },
          { color: '#EF4444', label: 'Labor > 30%' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: color, boxShadow: `0 0 6px ${color}88`,
              display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
