import VentasUI from '@/components/VentasUI';
import { getVentasMetrics } from '@/lib/services/ventas';

export const metadata = {
  title: 'Ventas | CFSCoffee BI',
  description: 'Análisis profundo de ventas CFSCoffee — histórico, tendencias y segmentación',
};

export default async function VentasPage() {
  const data = await getVentasMetrics();

  if (!data) {
    return (
      <div style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Outfit', marginBottom: '0.5rem' }}>Sin Datos Disponibles</h2>
        <p>No se encontraron registros en <code>vw_DailySalesMetrics</code>.</p>
      </div>
    );
  }

  return <VentasUI data={data} />;
}
