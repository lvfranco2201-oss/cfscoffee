import { db } from '../db';
import { vwDailySalesMetrics, hourlySalesMetrics, paymentData } from '../db/schema';
import { sum, desc, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Módulo de Servicios Analíticos CFSCoffee
 * Protegido por capa ISR (Caché) — Revalidación: 300s (5 minutos)
 * IMPORTANTE: Sin proyecciones matemáticas. Solo datos reales de la DB.
 */

export const getDashboardMetrics = unstable_cache(
  async () => {
    // 1. Identificar el último 'businessDate' disponible con ventas reales.
    const latestDateQuery = await db
      .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
      .from(vwDailySalesMetrics);

    const lastBusinessDateStr = latestDateQuery[0]?.latestDate;
    if (!lastBusinessDateStr) return { kpis: null, storesPerformance: [] };

    // 2. KPIs consolidados del último día.
    const consolidadoHoy = await db
      .select({
        totalNetSales:   sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        totalGrossSales: sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
        totalGuests:     sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        totalOrders:     sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        totalDiscounts:  sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
        totalVoids:      sum(vwDailySalesMetrics.totalVoids).mapWith(Number),
        totalRefunds:    sum(vwDailySalesMetrics.totalRefunds).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date = ${lastBusinessDateStr}::date`);

    // 3. Desglose por sucursal — ventas, clientes, órdenes, descuentos, voids.
    const topSucursalesRaw = await db
      .select({
        storeName:      vwDailySalesMetrics.storeName,
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
      .groupBy(vwDailySalesMetrics.storeName)
      .orderBy(desc(sum(vwDailySalesMetrics.totalNetSales)));

    // Garantizamos que storeName sea siempre string (nunca null) para satisfacer StoreData[]
    const topSucursales = topSucursalesRaw.map(s => ({
      ...s,
      storeName: s.storeName ?? 'Desconocida',
    }));

    // 4. Curva horaria — ventas + clientes + labor (SUM DISTINCT para evitar duplicación por segmento)
    const [hourlyData, avg30Raw] = await Promise.all([
      db
        .select({
          hour:      hourlySalesMetrics.businessHour,
          netSales:  sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
          guests:    sum(hourlySalesMetrics.guestCount).mapWith(Number),
          orders:    sum(hourlySalesMetrics.ordersCount).mapWith(Number),
          laborCost: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
          laborHrs:  sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalHours}), 0)`.mapWith(Number),
        })
        .from(hourlySalesMetrics)
        .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastBusinessDateStr}::date`)
        .groupBy(hourlySalesMetrics.businessHour)
        .orderBy(hourlySalesMetrics.businessHour),

      // Promedio diario de los últimos 30 días (excluye el día actual) para detectar anomalías
      db.execute(sql`
        SELECT
          AVG(daily_net)::float     AS "avgNetSales",
          AVG(daily_guests)::float  AS "avgGuests",
          AVG(daily_orders)::float  AS "avgOrders"
        FROM (
          SELECT
            ${vwDailySalesMetrics.businessDate}::date          AS d,
            SUM(${vwDailySalesMetrics.totalNetSales})::float   AS daily_net,
            SUM(${vwDailySalesMetrics.totalGuests})::float     AS daily_guests,
            SUM(${vwDailySalesMetrics.totalOrders})::float     AS daily_orders
          FROM ${vwDailySalesMetrics}
          WHERE ${vwDailySalesMetrics.businessDate}::date >= (${lastBusinessDateStr}::date - INTERVAL '30 days')
            AND ${vwDailySalesMetrics.businessDate}::date < ${lastBusinessDateStr}::date
          GROUP BY ${vwDailySalesMetrics.businessDate}::date
        ) sub
      `),
    ]);

    // Parse 30-day averages
    const toRows = (res: unknown): Record<string, unknown>[] => {
      if (Array.isArray(res)) return res as Record<string, unknown>[];
      return ((res as { rows?: unknown[] }).rows ?? []) as Record<string, unknown>[];
    };
    const avg30Row = toRows(avg30Raw)[0] ?? {};
    const avg30 = {
      avgNetSales: Number(avg30Row.avgNetSales ?? 0),
      avgGuests:   Number(avg30Row.avgGuests ?? 0),
      avgOrders:   Number(avg30Row.avgOrders ?? 0),
    };

    const totalLaborCost = hourlyData.reduce((acc, d) => acc + (d.laborCost ?? 0), 0);
    const totalLaborHours = hourlyData.reduce((acc, d) => acc + (d.laborHrs ?? 0), 0);

    // Solo horas con ventas reales, formateadas a AM/PM
    const peakHours = hourlyData
      .filter(d => d.netSales > 0)
      .map(d => {
        const h = d.hour ?? 0;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hr = h % 12 || 12;
        return {
          time:     `${hr.toString().padStart(2, '0')}:00 ${ampm}`,
          ventas:   d.netSales,
          clientes: d.guests,
          ordenes:  d.orders,
          labor:    d.laborCost,
        };
      });

    // 5. Métodos de Pago y Propinas — usando settledDate (YYYYMMDD) sin error de TZ
    const settledDateKey = lastBusinessDateStr.replace(/-/g, '');

    const paymentMethodsRaw = await db
      .select({
        methodType:  paymentData.paymentCardType,
        totalAmount: sum(paymentData.paymentTotal).mapWith(Number),
      })
      .from(paymentData)
      .where(sql`${paymentData.settledDate} = ${settledDateKey}`)
      .groupBy(paymentData.paymentCardType);

    const tipRes = await db
      .select({ totalTips: sum(paymentData.tipAmount).mapWith(Number) })
      .from(paymentData)
      .where(sql`${paymentData.settledDate} = ${settledDateKey}`);

    const totalTips = tipRes[0]?.totalTips ?? 0;

    let totalCash = 0;
    let totalCard = 0;
    paymentMethodsRaw.forEach(p => {
      const type = p.methodType ? p.methodType.toUpperCase() : 'CASH';
      if (type === 'CASH' || type.includes('CASH') || type === 'EFECTIVO') {
        totalCash += p.totalAmount;
      } else {
        totalCard += p.totalAmount;
      }
    });

    const paymentMethods = [
      { name: 'Tarjeta / Digital', value: totalCard, color: 'var(--cfs-gold)' },
      { name: 'Efectivo',          value: totalCash, color: 'var(--info)' },
    ].filter(p => p.value > 0);

    return {
      lastBusinessDateStr,
      kpis: consolidadoHoy[0],
      storesPerformance: topSucursales,
      peakHours,
      paymentMethods,
      totalTips,
      totalLaborCost,
      totalLaborHours,
      avg30,
    };
  },
  ['dashboard-metrics-v3'],
  { revalidate: 300, tags: ['dashboard'] }
);
