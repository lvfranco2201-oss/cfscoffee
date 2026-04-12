import { db } from '../db';
import { vwDailySalesMetrics, hourlySalesMetrics } from '../db/schema';
import { sum, asc, desc, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Servicio de Análisis de Clientes (Guests) — CFSCoffee BI
 * Módulo /clientes — Datos 100% reales, sin proyecciones.
 */
export const getClientesMetrics = unstable_cache(
  async () => {
    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
      .from(vwDailySalesMetrics);
    const lastDate = latestRes[0]?.latestDate;
    if (!lastDate) return null;

    const [
      kpisHoy,
      trend90,
      byHour,
      byStore,
      byDow,
      top30stores,
      guestTrend30,
    ] = await Promise.all([

      // KPIs del día
      db.select({
        guests:    sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:    sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        netSales:  sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date = ${lastDate}::date`),

      // Tendencia diaria de clientes — 90 días
      db.select({
        date:    vwDailySalesMetrics.businessDate,
        guests:  sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:  sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        sales:   sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '89 days')`)
      .groupBy(vwDailySalesMetrics.businessDate)
      .orderBy(asc(vwDailySalesMetrics.businessDate)),

      // Flujo de clientes por hora — último día
      db.select({
        hour:   hourlySalesMetrics.businessHour,
        guests: sum(hourlySalesMetrics.guestCount).mapWith(Number),
        orders: sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        sales:  sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastDate}::date`)
      .groupBy(hourlySalesMetrics.businessHour)
      .orderBy(hourlySalesMetrics.businessHour),

      // Clientes por sucursal — último día
      db.select({
        storeName: vwDailySalesMetrics.storeName,
        guests:    sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:    sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        sales:     sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date = ${lastDate}::date`)
      .groupBy(vwDailySalesMetrics.storeName)
      .orderBy(desc(sum(vwDailySalesMetrics.totalGuests))),

      // Promedio de clientes por día de semana (90d)
      db.execute(sql`
        SELECT
          dow,
          AVG(daily_guests)::float AS "avgGuests",
          AVG(daily_orders)::float AS "avgOrders",
          AVG(daily_sales)::float  AS "avgSales"
        FROM (
          SELECT
            EXTRACT(DOW FROM "BusinessDate"::date)::int AS dow,
            SUM("TotalGuests")::float                   AS daily_guests,
            SUM("TotalOrders")::float                   AS daily_orders,
            SUM("TotalNetSales")::float                 AS daily_sales
          FROM "vw_DailySalesMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '89 days')
          GROUP BY "BusinessDate"::date, EXTRACT(DOW FROM "BusinessDate"::date)
        ) AS sub
        GROUP BY dow
        ORDER BY dow
      `),

      // Top sucursales por clientes acumulados 30 días
      db.select({
        storeName: vwDailySalesMetrics.storeName,
        guests:    sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:    sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        sales:     sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        days:      sql<number>`COUNT(DISTINCT ${vwDailySalesMetrics.businessDate})`.mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')`)
      .groupBy(vwDailySalesMetrics.storeName)
      .orderBy(desc(sum(vwDailySalesMetrics.totalGuests))),

      // Tendencia de clientes últimos 30 días (para sparkline global)
      db.select({
        date:   vwDailySalesMetrics.businessDate,
        guests: sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders: sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')`)
      .groupBy(vwDailySalesMetrics.businessDate)
      .orderBy(asc(vwDailySalesMetrics.businessDate)),
    ]);

    const kpi = kpisHoy[0] ?? { guests: 0, orders: 0, netSales: 0 };
    const avgGuestPerOrder = kpi.orders > 0 ? kpi.guests / kpi.orders : 0;
    const avgSpendPerGuest = kpi.guests > 0 ? kpi.netSales / kpi.guests : 0;

    // Formato horario
    const hourlyFormatted = byHour
      .filter(h => h.guests > 0)
      .map(h => {
        const hrVal = h.hour ?? 0;
        const ampm = hrVal >= 12 ? 'PM' : 'AM';
        const hr = hrVal % 12 || 12;
        return { time: `${hr.toString().padStart(2, '0')}:00 ${ampm}`, clientes: h.guests, ordenes: h.orders, ventas: h.sales };
      });

    // Day of week
    const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const byDowFormatted = (Array.isArray(byDow) ? byDow : (byDow as unknown as { rows: unknown[] }).rows ?? [])
      .map((d: unknown) => {
        const row = d as Record<string, unknown>;
        const dow = Number(row.dow ?? 0);
        return { day: DOW[dow] ?? `D${dow}`, dow, avgGuests: Number(row.avgGuests ?? 0), avgOrders: Number(row.avgOrders ?? 0), avgSales: Number(row.avgSales ?? 0) };
      }).sort((a, b) => a.dow - b.dow);

    // Trend 90d formatted
    const trend90Formatted = trend90.map((d, i) => {
      const win = trend90.slice(Math.max(0, i - 6), i + 1);
      const ma7 = win.reduce((a, x) => a + x.guests, 0) / win.length;
      return { date: (d.date ?? '').slice(5), guests: d.guests, orders: d.orders, sales: d.sales, ma7: Math.round(ma7) };
    });

    // Total 30d
    const total30guests = guestTrend30.reduce((a, d) => a + d.guests, 0);
    const total30orders = guestTrend30.reduce((a, d) => a + d.orders, 0);

    return {
      lastDate,
      kpi: { ...kpi, avgGuestPerOrder, avgSpendPerGuest },
      trend90: trend90Formatted,
      hourly: hourlyFormatted,
      byStore,
      byDow: byDowFormatted,
      top30stores,
      guestTrend30: guestTrend30.map(d => ({ date: (d.date ?? '').slice(5), guests: d.guests, orders: d.orders })),
      total30guests,
      total30orders,
      avgDailyGuests30: guestTrend30.length > 0 ? total30guests / guestTrend30.length : 0,
    };
  },
  ['clientes-metrics-v1'],
  { revalidate: 300, tags: ['clientes', 'dashboard'] }
);
