import { db } from '../db';
import { hourlySalesMetrics, vwDailySalesMetrics } from '../db/schema';
import { sum, asc, desc, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Servicio de Análisis de Canales / Productos — CFSCoffee BI
 * Módulo /productos — DiningOption, OrderSource, RevenueCenter, AOV, discount analysis.
 * Datos 100% reales de HourlySalesMetrics.
 */
export const getProductosMetrics = unstable_cache(
  async () => {
    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
      .from(vwDailySalesMetrics);
    const lastDate = latestRes[0]?.latestDate;
    if (!lastDate) return null;

    const [
      kpisHoy,
      byDiningOption30,
      byOrderSource30,
      byRevenueCenter30,
      aovByHour,
      discountAnalysis,
      diningTrend30,
      orderSourceByStore,
    ] = await Promise.all([

      // KPIs del día actual
      db.select({
        netSales:      sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        grossSales:    sum(hourlySalesMetrics.grossSalesAmount).mapWith(Number),
        orders:        sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        guests:        sum(hourlySalesMetrics.guestCount).mapWith(Number),
        discounts:     sum(hourlySalesMetrics.discountAmount).mapWith(Number),
        voids:         sum(hourlySalesMetrics.voidAmount).mapWith(Number),
        discountOrders: sum(hourlySalesMetrics.discountOrderCount).mapWith(Number),
        voidOrders:    sum(hourlySalesMetrics.voidOrdersCount).mapWith(Number),
        avgOrderValue: sql<number>`AVG(${hourlySalesMetrics.averageOrderValue})`.mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastDate}::date`),

      // DiningOption — últimos 30 días
      db.select({
        diningOption:   hourlySalesMetrics.diningOption,
        netSales:       sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        grossSales:     sum(hourlySalesMetrics.grossSalesAmount).mapWith(Number),
        orders:         sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        guests:         sum(hourlySalesMetrics.guestCount).mapWith(Number),
        discounts:      sum(hourlySalesMetrics.discountAmount).mapWith(Number),
        avgOrderValue:  sql<number>`AVG(${hourlySalesMetrics.averageOrderValue})`.mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`
        ${hourlySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')
        AND ${hourlySalesMetrics.diningOption} IS NOT NULL
        AND ${hourlySalesMetrics.diningOption} != ''
      `)
      .groupBy(hourlySalesMetrics.diningOption)
      .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

      // OrderSource — últimos 30 días
      db.select({
        orderSource:   hourlySalesMetrics.orderSource,
        netSales:      sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        orders:        sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        discounts:     sum(hourlySalesMetrics.discountAmount).mapWith(Number),
        avgOrderValue: sql<number>`AVG(${hourlySalesMetrics.averageOrderValue})`.mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`
        ${hourlySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')
        AND ${hourlySalesMetrics.orderSource} IS NOT NULL
        AND ${hourlySalesMetrics.orderSource} != ''
      `)
      .groupBy(hourlySalesMetrics.orderSource)
      .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

      // RevenueCenter — últimos 30 días
      db.select({
        revenueCenter: hourlySalesMetrics.revenueCenter,
        netSales:      sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        orders:        sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        avgOrderValue: sql<number>`AVG(${hourlySalesMetrics.averageOrderValue})`.mapWith(Number),
        discounts:     sum(hourlySalesMetrics.discountAmount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`
        ${hourlySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')
        AND ${hourlySalesMetrics.revenueCenter} IS NOT NULL
        AND ${hourlySalesMetrics.revenueCenter} != ''
      `)
      .groupBy(hourlySalesMetrics.revenueCenter)
      .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

      // Valor promedio de orden por hora — último día
      db.select({
        hour:          hourlySalesMetrics.businessHour,
        avgOrderValue: sql<number>`AVG(${hourlySalesMetrics.averageOrderValue})`.mapWith(Number),
        orders:        sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        discountOrders: sum(hourlySalesMetrics.discountOrderCount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastDate}::date`)
      .groupBy(hourlySalesMetrics.businessHour)
      .orderBy(hourlySalesMetrics.businessHour),

      // Análisis de descuentos por canal (30d)
      db.select({
        diningOption:   hourlySalesMetrics.diningOption,
        totalSales:     sum(hourlySalesMetrics.grossSalesAmount).mapWith(Number),
        totalDiscounts: sum(hourlySalesMetrics.discountAmount).mapWith(Number),
        discountOrders: sum(hourlySalesMetrics.discountOrderCount).mapWith(Number),
        totalOrders:    sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`
        ${hourlySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')
        AND ${hourlySalesMetrics.diningOption} IS NOT NULL
        AND ${hourlySalesMetrics.diningOption} != ''
      `)
      .groupBy(hourlySalesMetrics.diningOption)
      .orderBy(desc(sum(hourlySalesMetrics.discountAmount))),

      // Tendencia diaria por DiningOption (top 3) — 30 días
      db.select({
        date:         hourlySalesMetrics.businessDate,
        diningOption: hourlySalesMetrics.diningOption,
        netSales:     sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        orders:       sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`
        ${hourlySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')
        AND ${hourlySalesMetrics.diningOption} IS NOT NULL
        AND ${hourlySalesMetrics.diningOption} != ''
      `)
      .groupBy(hourlySalesMetrics.businessDate, hourlySalesMetrics.diningOption)
      .orderBy(asc(hourlySalesMetrics.businessDate)),

      // OrderSource por tienda — último día
      db.select({
        storeId:     hourlySalesMetrics.storeId,
        orderSource: hourlySalesMetrics.orderSource,
        netSales:    sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        orders:      sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`
        ${hourlySalesMetrics.businessDate}::date = ${lastDate}::date
        AND ${hourlySalesMetrics.orderSource} IS NOT NULL
      `)
      .groupBy(hourlySalesMetrics.storeId, hourlySalesMetrics.orderSource)
      .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),
    ]);

    const kpi = kpisHoy[0] ?? { netSales: 0, grossSales: 0, orders: 0, guests: 0, discounts: 0, voids: 0, discountOrders: 0, voidOrders: 0, avgOrderValue: 0 };

    // AOV horario formateado
    const aovHourly = aovByHour
      .filter(h => h.orders > 0)
      .map(h => {
        const hrVal = h.hour ?? 0;
        const ampm = hrVal >= 12 ? 'PM' : 'AM';
        const hr = hrVal % 12 || 12;
        return { time: `${hr.toString().padStart(2, '0')}:00 ${ampm}`, aov: h.avgOrderValue, orders: h.orders, discountOrders: h.discountOrders };
      });

    // Discount analysis enriched
    const discountEnriched = discountAnalysis.filter(d => d.diningOption).map(d => ({
      name: d.diningOption ?? '—',
      discountPct: d.totalSales > 0 ? (d.totalDiscounts / d.totalSales * 100) : 0,
      discountPerOrder: d.totalOrders > 0 ? (d.totalDiscounts / d.totalOrders) : 0,
      discountOrderPct: d.totalOrders > 0 ? (d.discountOrders / d.totalOrders * 100) : 0,
      totalDiscounts: d.totalDiscounts,
      totalOrders: d.totalOrders,
    })).sort((a, b) => b.discountPct - a.discountPct);

    return {
      lastDate,
      kpi,
      byDiningOption: byDiningOption30.filter(d => d.diningOption),
      byOrderSource:  byOrderSource30.filter(d => d.orderSource),
      byRevenueCenter: byRevenueCenter30.filter(d => d.revenueCenter),
      aovHourly,
      discountByChannel: discountEnriched,
      diningTrend30,
      orderSourceByStore,
    };
  },
  ['productos-metrics-v1'],
  { revalidate: 300, tags: ['productos', 'dashboard'] }
);
