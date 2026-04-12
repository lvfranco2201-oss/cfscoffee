import ClientesUI from '@/components/ClientesUI';
import { getClientesMetrics } from '@/lib/services/clientes';

export const metadata = {
  title: 'Clientes | CFSCoffee BI',
  description: 'Análisis de comportamiento y tendencias de clientes CFSCoffee',
};

export default async function ClientesPage() {
  const data = await getClientesMetrics();
  if (!data) return (
    <div style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'Outfit' }}>Sin Datos de Clientes</h2>
    </div>
  );
  return <ClientesUI data={data} />;
}
