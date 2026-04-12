import { db } from '../db';
import { stores, vwDailySalesMetrics, hourlySalesMetrics } from '../db/schema';
import { sum, desc, asc, sql, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Servicio de Sucursales — CFSCoffee BI
 * Datos de rendimiento por tienda: catálogo + ventas históricas + métricas del último día.
 * Sin proyecciones matemáticas. Solo datos reales de la DB.
 */

// ── 1. Catálogo de tiendas activas ────────────────────────────────────────────
export const getStoresCatalog = unstable_cache(
  async () => {
    const storeList = await db
      .select({
        id:              stores.id,
        name:            stores.name,
        locationName:    stores.locationName,
        locationCode:    stores.locationCode,
        address:         stores.address,
        timeZone:        stores.timeZone,
        isActive:        stores.isActive,
        hasEntitlement:  stores.hasAnalyticsEntitlement,
        lastSyncedAt:    stores.lastSyncedAt,
        externalId:      stores.externalId,
      })
      .from(stores)
      .orderBy(asc(stores.name));

    return storeList;
  },
  ['stores-catalog-v1'],
  { revalidate: 3600, tags: ['stores'] } // catálogo cambia poco → 1 hora
);

// ── 2. Métricas de rendimiento por sucursal (último día + acumulado 30 días) ──
export const getStoresMetrics = unstable_cache(
  async () => {
    // Último businessDate disponible
    const latestDateQuery = await db
      .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
      .from(vwDailySalesMetrics);

    const lastBusinessDateStr = latestDateQuery[0]?.latestDate;
    if (!lastBusinessDateStr) return { lastBusinessDateStr: null, todayByStore: [], last30ByStore: [], dailyTrend30: [] };

    // ── Métricas del último día por tienda ──────────────────────────────────
    const todayByStore = await db
      .select({
        storeId:        vwDailySalesMetrics.storeId,
        storeName:      vwDailySalesMetrics.storeName,
        locationCode:   vwDailySalesMetrics.locationCode,
        netSales:       sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        grossSales:     sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
        guests:         sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:         sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        discounts:      sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
        voids:          sum(vwDailySalesMetrics.totalVoids).mapWith(Number),
        refunds:        sum(vwDailySalesMetrics.totalRefunds).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date = ${lastBusinessDateStr}::date`)
      .groupBy(vwDailySalesMetrics.storeId, vwDailySalesMetrics.storeName, vwDailySalesMetrics.locationCode)
      .orderBy(desc(sum(vwDailySalesMetrics.totalNetSales)));

    // ── Acumulado últimos 30 días por tienda ────────────────────────────────
    const last30ByStore = await db
      .select({
        storeId:        vwDailySalesMetrics.storeId,
        storeName:      vwDailySalesMetrics.storeName,
        netSales:       sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        grossSales:     sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
        guests:         sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:         sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        discounts:      sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
        voids:          sum(vwDailySalesMetrics.totalVoids).mapWith(Number),
        daysActive:     sql<number>`COUNT(DISTINCT ${vwDailySalesMetrics.businessDate})`.mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date >= (${lastBusinessDateStr}::date - INTERVAL '29 days')`)
      .groupBy(vwDailySalesMetrics.storeId, vwDailySalesMetrics.storeName)
      .orderBy(desc(sum(vwDailySalesMetrics.totalNetSales)));

    // ── Labor cost del último día por tienda ────────────────────────────────
    const laborByStore = await db
      .select({
        storeId:    hourlySalesMetrics.storeId,
        laborCost:  sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
        laborHours: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalHours}), 0)`.mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastBusinessDateStr}::date`)
      .groupBy(hourlySalesMetrics.storeId);

    // ── Tendencia diaria global (últimos 30 días) para sparklines ───────────
    const dailyTrend30 = await db
      .select({
        businessDate: vwDailySalesMetrics.businessDate,
        storeId:      vwDailySalesMetrics.storeId,
        netSales:     sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        guests:       sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date >= (${lastBusinessDateStr}::date - INTERVAL '29 days')`)
      .groupBy(vwDailySalesMetrics.businessDate, vwDailySalesMetrics.storeId)
      .orderBy(asc(vwDailySalesMetrics.businessDate));

    // Fusionar labor en todayByStore
    const laborMap = new Map(laborByStore.map(l => [l.storeId, l]));
    const todayEnriched = todayByStore.map(s => ({
      ...s,
      laborCost:  laborMap.get(s.storeId ?? -1)?.laborCost ?? 0,
      laborHours: laborMap.get(s.storeId ?? -1)?.laborHours ?? 0,
    }));

    return {
      lastBusinessDateStr,
      todayByStore: todayEnriched,
      last30ByStore,
      dailyTrend30,
    };
  },
  ['stores-metrics-v1'],
  { revalidate: 300, tags: ['stores', 'dashboard'] }
);
