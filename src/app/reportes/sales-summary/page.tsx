import { Metadata } from 'next';
import SalesSummaryReport from '@/components/SalesSummaryReport';

export const metadata: Metadata = {
  title: 'Sales Summary | CFS Coffee BI',
  description: 'Reporte cronológico consolidado de ventas, pagos y costos',
};

export default function SalesSummaryPage() {
  return <SalesSummaryReport />;
}
