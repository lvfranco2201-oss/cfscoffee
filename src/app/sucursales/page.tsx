import { getStoresCatalog, getStoresMetrics } from '@/lib/services/stores';
import StoresUI from '@/components/StoresUI';

export const metadata = {
  title: 'Sucursales | CFSCoffee BI',
  description: 'Rendimiento detallado por sucursal CFSCoffee',
};

export default async function SucursalesPage() {
  const [catalog, metrics] = await Promise.all([
    getStoresCatalog(),
    getStoresMetrics(),
  ]);

  return (
    <StoresUI
      catalog={catalog}
      todayByStore={metrics.todayByStore}
      last30ByStore={metrics.last30ByStore}
      dailyTrend30={metrics.dailyTrend30}
      lastBusinessDateStr={metrics.lastBusinessDateStr ?? ''}
    />
  );
}
