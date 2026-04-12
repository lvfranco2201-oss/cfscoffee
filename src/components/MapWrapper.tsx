'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// CFSCoffee Logo Marker - Premium Style with Safe Hover Animation
const createCustomIcon = () => {
  return L.divIcon({
    className: 'leaflet-custom-container', // Leaflet uses inline transforms here
    html: `
      <div class="cfs-logo-marker">
        <img src="/logo-cuadrado.png" alt="CFS Node" style="width: 100%; height: 100%; border-radius: 50%; object-fit: contain; display: block;" />
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -20]
  });
};

interface LocalMapProps {
  storesData: {
    storeName: string;
    netSales: number;
    guests: number;
  }[];
  theme?: string;
}

// Seeded random coordinates near Orlando, FL (Center: 28.5383, -81.3792)
const getCoordinate = (str: string, index: number): [number, number] => {
  const baseLat = 28.5383;
  const baseLng = -81.3792;
  const spreadLat = (Math.sin(index * 45) * 0.15) + (str.length * 0.001);
  const spreadLng = (Math.cos(index * 45) * 0.15) + (str.length * 0.001);
  return [baseLat + spreadLat, baseLng + spreadLng];
};

export default function DashboardMap({ storesData, theme = 'dark' }: LocalMapProps) {
  const position: [number, number] = [28.5383, -81.3792];

  // Use only client-side to ensure no window mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Add custom styles for the Dark Radar Theme
    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-container { background: ${theme === 'dark' ? '#091321' : '#fdfbf7'}; font-family: 'Inter', sans-serif; }
      
      /* Secret Developer Trick: Invert a highly detailed light map to get a perfect premium Dark Map with full labels */
      .dark-map-tiles {
        filter: invert(95%) hue-rotate(180deg) brightness(95%) contrast(100%);
      }

      .leaflet-custom-container {
        /* No Background, Leaflet controls positioning here */
        background: transparent;
        border: none;
      }

      /* Premium Inner Logo Marker Container */
      .cfs-logo-marker { 
        background: var(--cfs-cream);
        border-radius: 50%;
        width: 100%;
        height: 100%;
        padding: 4px;
        box-sizing: border-box;
        box-shadow: 0 6px 16px rgba(0,0,0,0.6);
        border: 2px solid var(--cfs-gold);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
      }
      .cfs-logo-marker:hover {
        transform: scale(1.2);
        box-shadow: 0 10px 24px rgba(221, 167, 86, 0.4); /* Golden glow on hover */
      }

      /* Sleek dark mode tooltip */
      .leaflet-tooltip.cfs-tooltip { 
        background: rgba(16, 28, 46, 0.95); 
        color: #fff; 
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 12px 16px;
        backdrop-filter: blur(8px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      }
      .leaflet-tooltip-left.cfs-tooltip::before { border-left-color: var(--border-color); }
      .leaflet-tooltip-right.cfs-tooltip::before { border-right-color: var(--border-color); }
      .leaflet-tooltip-top.cfs-tooltip::before { border-top-color: var(--border-color); }
      .leaflet-tooltip-bottom.cfs-tooltip::before { border-bottom-color: var(--border-color); }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!mounted || typeof window === 'undefined') return null;

  return (
    <div style={{ minWidth: 0, minHeight: 0, height: '100%', width: '100%', borderRadius: '20px', overflow: 'hidden' }}>
      <MapContainer key={`cfs-radar-${theme}`} center={[28.58, -81.3792]} zoom={10.5} zoomControl={true} scrollWheelZoom={true} style={{ minWidth: 0, minHeight: 0, height: '100%', width: '100%', zIndex: 1 }}>
        <TileLayer
          className={theme === 'dark' ? 'dark-map-tiles' : ''}
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="&copy; <a href='https://carto.com/'>CARTO Voyager</a>"
        />
        
        {storesData.filter(s => s.netSales > 0).map((store, idx) => {
          // Proyección estimada del labor cost basada en el estándar del 21%
          // Luego lo inyectaremos del backend directamente
          const estimatedLabor = store.netSales * 0.21;
          
          return (
            <Marker key={store.storeName} position={getCoordinate(store.storeName, idx)} icon={createCustomIcon()}>
              {/* Tooltip triggers ON HOVER */}
              <Tooltip direction="right" offset={[15, 0]} opacity={1} className="cfs-tooltip">
                <div style={{ minWidth: '150px' }}>
                  <h4 style={{ color: 'var(--cfs-gold)', marginBottom: '8px', fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    {store.storeName.replace('CFS Coffee', '').replace('-', '').trim() || store.storeName}
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ventas:</span>
                    <strong>${store.netSales.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Labor (%):</span>
                    <strong style={{ color: 'var(--danger)' }}>${estimatedLabor.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Staff/Tickets:</span>
                    <strong>{store.guests}</strong>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
