import InventarioUI from '@/components/InventarioUI';
import { getLaborMetrics } from '@/lib/services/labor';

export const metadata = {
  title: 'Costos Laborales | CFSCoffee BI',
  description: 'Análisis de eficiencia laboral, costo por hora y sales per labor hour CFSCoffee',
};

export default async function InventarioPage() {
  let data: Awaited<ReturnType<typeof getLaborMetrics>> | null = null;
  try {
    data = await getLaborMetrics();
  } catch (err) {
    console.error('[InventarioPage] Service error:', err);
    data = null;
  }

  if (data == null) {
    return (
      <div style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Outfit' }}>Sin Datos Laborales</h2>
        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Por favor verifica la conexión a la base de datos.</p>
      </div>
    );
  }

  return <InventarioUI data={data} />;
}
