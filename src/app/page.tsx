import DashboardUI from '@/components/DashboardUI';
import { getDashboardMetrics } from '@/lib/services/analytics';

export default async function DashboardPage() {

  const {
    lastBusinessDateStr,
    kpis,
    storesPerformance,
    peakHours,
    paymentMethods,
    totalTips,
    totalLaborCost,
    totalLaborHours,
    avg30,
  } = await getDashboardMetrics();

  if (!kpis) {
    return (
      <div style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Outfit', marginBottom: '0.5rem' }}>Sin Datos Disponibles</h2>
        <p>No se encontraron registros en <code>vw_DailySalesMetrics</code>.</p>
      </div>
    );
  }

  return (
    <DashboardUI
      lastDateStr={lastBusinessDateStr}
      kpis={kpis}
      storesData={storesPerformance}
      peakHours={peakHours}
      paymentMethods={paymentMethods}
      totalTips={totalTips}
      totalLaborCost={totalLaborCost}
      totalLaborHours={totalLaborHours}
      avg30={avg30}
    />
  );
}

