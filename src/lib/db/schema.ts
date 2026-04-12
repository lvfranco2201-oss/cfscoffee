import { pgTable, integer, varchar, boolean, timestamp, numeric, date, bigint, unique } from 'drizzle-orm/pg-core';
import { pgView } from 'drizzle-orm/pg-core';

// Stores Table
export const stores = pgTable('Stores', {
  id: integer('Id').primaryKey(),
  externalId: varchar('ExternalId'),
  name: varchar('Name'),
  locationName: varchar('LocationName'),
  locationCode: varchar('LocationCode'),
  timeZone: varchar('TimeZone'),
  isActive: boolean('IsActive'),
  address: varchar('Address'),
  managementGroupGuid: varchar('ManagementGroupGuid'),
  externalRestaurantRef: varchar('ExternalRestaurantRef'),
  createdAt: timestamp('CreatedAt', { withTimezone: true }),
  updatedAt: timestamp('UpdatedAt', { withTimezone: true }),
  lastSyncedAt: timestamp('LastSyncedAt', { withTimezone: true }),
  hasAnalyticsEntitlement: boolean('HasAnalyticsEntitlement'),
  entitlementVerifiedAt: timestamp('EntitlementVerifiedAt', { withTimezone: true }),
  entitlementErrorMessage: varchar('EntitlementErrorMessage'),
});

// Daily Sales Metrics View (Highly optimized for dashboards)
export const vwDailySalesMetrics = pgTable('vw_DailySalesMetrics', {
  storeId: integer('StoreId'),
  storeName: varchar('StoreName'),
  restaurantGuid: varchar('RestaurantGuid'),
  locationCode: varchar('LocationCode'),
  businessDate: date('BusinessDate'),
  totalGuests: bigint('TotalGuests', { mode: 'number' }),
  totalOrders: bigint('TotalOrders', { mode: 'number' }),
  totalGrossSales: numeric('TotalGrossSales'),
  totalNetSales: numeric('TotalNetSales'),
  totalDiscounts: numeric('TotalDiscounts'),
  totalVoids: numeric('TotalVoids'),
  totalRefunds: numeric('TotalRefunds'),
});

// Hourly Sales Metrics
export const hourlySalesMetrics = pgTable('HourlySalesMetrics', {
  id: integer('Id').primaryKey(),
  storeId: integer('StoreId'),
  businessDate: date('BusinessDate'),
  businessHour: integer('BusinessHour'),
  guestCount: integer('GuestCount'),
  ordersCount: integer('OrdersCount'),
  openOrderCount: integer('OpenOrderCount'),
  closedOrderCount: integer('ClosedOrderCount'),
  voidOrdersCount: integer('VoidOrdersCount'),
  discountOrderCount: integer('DiscountOrderCount'),
  grossSalesAmount: numeric('GrossSalesAmount'),
  netSalesAmount: numeric('NetSalesAmount'),
  discountAmount: numeric('DiscountAmount'),
  voidAmount: numeric('VoidAmount'),
  refundAmount: numeric('RefundAmount'),
  averageOrderValue: numeric('AverageOrderValue'),
  hourlyJobTotalHours: numeric('HourlyJobTotalHours'),
  hourlyJobTotalPay: numeric('HourlyJobTotalPay'),
  hourlyJobSalesPerLaborHour: numeric('HourlyJobSalesPerLaborHour'),
  revenueCenter: varchar('RevenueCenter'),
  diningOption: varchar('DiningOption'),
  orderSource: varchar('OrderSource'),
  extractedAt: timestamp('ExtractedAt', { withTimezone: true }),
});

// Payment Data Metrics
export const paymentData = pgTable('PaymentData', {
  id: bigint('Id', { mode: 'number' }).primaryKey(),
  settledDate: varchar('SettledDate'), // formato: YYYYMMDD
  paymentCardType: varchar('PaymentCardType'),
  tipAmount: numeric('TipAmount'),
  paymentTotal: numeric('PaymentTotal'),
  restaurantName: varchar('RestaurantName'),
  paidDateTime: timestamp('PaidDateTime', { withTimezone: true }),
});

// Nueva tabla RollUp para análisis histórico ultra-rápido
export const dailyConsolidatedMetrics = pgTable('DailyConsolidatedMetrics', {
  id: integer('Id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('StoreId').notNull(),
  businessDate: date('BusinessDate').notNull(),
  netSales: numeric('NetSales').default('0'),
  grossSales: numeric('GrossSales').default('0'),
  guests: bigint('Guests', { mode: 'number' }).default(0),
  orders: bigint('Orders', { mode: 'number' }).default(0),
  laborCost: numeric('LaborCost').default('0'),
  laborHours: numeric('LaborHours').default('0')
}, (t) => ({
  uniqueDailyStore: unique().on(t.storeId, t.businessDate)
}));
