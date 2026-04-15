// ── Dashboard shared types ────────────────────────────────────────────────────

export interface StoreData {
  storeId?: number | null;
  storeName: string;
  netSales: number;
  prevNetSales?: number;
  grossSales: number;
  guests: number;
  orders: number;
  discounts: number;
  voids: number;
  refunds: number;
  laborCost?: number;
}

export interface KpiSnapshot {
  totalNetSales: number;
  totalGrossSales: number;
  totalGuests: number;
  totalOrders: number;
  totalDiscounts: number;
  totalVoids: number;
  totalRefunds: number;
}

export interface PeakHour {
  time: string;
  ventas: number;
  clientes: number;
  ordenes: number;
  labor: number;
}

export interface PaymentMethod {
  name: string;
  value: number;
  color: string;
}

export interface Avg30 {
  avgNetSales: number;
  avgGuests: number;
  avgOrders: number;
}

export interface DashboardUIProps {
  lastDateStr: string;
  totalTips: number;
  prevTotalTips?: number;
  totalLaborCost: number;
  prevTotalLaborCost?: number;
  totalLaborHours: number;
  prevTotalLaborHours?: number;
  kpis: KpiSnapshot;
  prevKpis?: KpiSnapshot;
  storesData: StoreData[];
  peakHours: PeakHour[];
  paymentMethods: PaymentMethod[];
  avg30: Avg30;
  dailyTrend?: { date: string; netSales: number; grossSales: number; discounts: number; laborCost: number; grossProfit: number }[];
  numDays?: number;
  availableStores?: { id: string; name: string }[];
  onRefresh?: () => void;
  loading?: boolean;
}
