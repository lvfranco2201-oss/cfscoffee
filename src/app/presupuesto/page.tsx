import { Metadata } from 'next';
import PresupuestoUI from '@/components/PresupuestoUI';

export const metadata: Metadata = {
  title: 'Presupuesto & Metas | CFS Coffee BI',
  description: 'Parametriza las ventas objetivo y el target de costo laboral por tienda y mes.',
};

export default function PresupuestoPage() {
  return <PresupuestoUI />;
}
