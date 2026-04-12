import ProductosUI from '@/components/ProductosUI';
import { getProductosMetrics } from '@/lib/services/productos';

export const metadata = {
  title: 'Canales de Venta | CFSCoffee BI',
  description: 'Análisis de canales, tipos de consumo y valor de orden promedio CFSCoffee',
};

export default async function ProductosPage() {
  const data = await getProductosMetrics();
  if (!data) return (
    <div style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'Outfit' }}>Sin Datos de Canales</h2>
    </div>
  );
  return <ProductosUI data={data} />;
}
