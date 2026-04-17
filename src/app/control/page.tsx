import { Metadata } from 'next';
import ControlUI from '@/components/ControlUI';

export const metadata: Metadata = {
  title: 'Control & P&L | CFS Coffee BI',
  description: 'Control detallado de P&L: Ventas, COGS, Labor, y depósitos.',
};

export default function ControlPage() {
  return <ControlUI />;
}
