import { db } from '../db';
import { dailyConsolidatedMetrics, stores, hourlySalesMetrics, paymentData } from '../db/schema';
import { sum, asc, desc, sql, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Servicio de Análisis de Ventas — CFSCoffee BI
 * Módulo /ventas — Datos 100% reales desde DailyConsolidatedMetrics.
 *
 * Fuentes de datos:
 *  - DailyConsolidatedMetrics : KPIs, tendencias, top días, semanas (Toast API vía cron)
 *  - HourlySalesMetrics       : Curva horaria, DiningOption, OrderSource, RevenueCenter (ETL Aurora)
 *  - PaymentData              : Tips y métodos de pago detallados (ETL Aurora)
 */

const dcm = dailyConsolidatedMetrics; // alias corto

export const getVentasMetrics = unstable_cache(
  async () => {

    // ── 0. Último businessDate disponible ─────────────────────────────────
    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${dcm.businessDate}::date)` })
      .from(dcm);

    const lastDate = latestRes[0]?.latestDate;
    if (!lastDate) return null;

    // Ejecutar todas las queries en paralelo
    const [
      kpisHoy,
      trend90,
      byDayOfWeek,
      byDiningOption,
      byOrderSource,
      byRevenueCenter,
      topDias,
      weekCurrent,
      weekPrev,
      paymentRaw,
      tipsRes,
      hourlyToday,
      tipTrend30,
      tipByRestaurant,
      momComparison,
    ] = await Promise.all([

      // ── 1. KPIs del día más reciente ──────────────────────────────────────
      db.select({
        netSales:   sum(dcm.netSales).mapWith(Number),
        grossSales: sum(dcm.grossSales).mapWith(Number),
        guests:     sum(dcm.guests).mapWith(Number),
        orders:     sum(dcm.orders).mapWith(Number),
        discounts:  sum(dcm.discounts).mapWith(Number),
        voids:      sum(dcm.voids).mapWith(Number),
        refunds:    sum(dcm.refunds).mapWith(Number),
        tips:       sum(dcm.tips).mapWith(Number),
        laborCost:  sum(dcm.laborCost).mapWith(Number),
        laborHours: sum(dcm.laborHours).mapWith(Number),
      })
      .from(dcm)
      .where(sql`${dcm.businessDate}::date = ${lastDate}::date`),

      // ── 2. Tendencia diaria últimos 90 días ───────────────────────────────
      db.select({
        date:       dcm.businessDate,
        netSales:   sum(dcm.netSales).mapWith(Number),
        grossSales: sum(dcm.grossSales).mapWith(Number),
        guests:     sum(dcm.guests).mapWith(Number),
        orders:     sum(dcm.orders).mapWith(Number),
        discounts:  sum(dcm.discounts).mapWith(Number),
      })
      .from(dcm)
      .where(sql`${dcm.businessDate}::date >= (${lastDate}::date - INTERVAL '89 days')`)
      .groupBy(dcm.businessDate)
      .orderBy(asc(dcm.businessDate)),

      // ── 3. Ventas por día de semana (promedio, últimos 90 días) ───────────
      // Usamos DailyConsolidatedMetrics directamente (ya tiene datos por sucursal/día)
      db.execute(sql`
        SELECT
          dow,
          AVG(daily_sum)    AS "avgSales",
          AVG(daily_guests) AS "avgGuests",
          AVG(daily_orders) AS "avgOrders"
        FROM (
          SELECT
            EXTRACT(DOW FROM "BusinessDate"::date)::int AS dow,
            SUM("NetSales")::float                      AS daily_sum,
            SUM("Guests")::float                        AS daily_guests,
            SUM("Orders")::float                        AS daily_orders
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '89 days')
          GROUP BY "BusinessDate"::date, EXTRACT(DOW FROM "BusinessDate"::date)
        ) AS sub
        GROUP BY dow
        ORDER BY dow
      `),

      // ── 4. DiningOption (últimos 30 días) — sigue en HourlySalesMetrics ──
      db.select({
        diningOption: hourlySalesMetrics.diningOption,
        netSales:     sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        guests:       sum(hourlySalesMetrics.guestCount).mapWith(Number),
        orders:       sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')`)
      .groupBy(hourlySalesMetrics.diningOption)
      .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

      // ── 5. OrderSource (últimos 30 días) — sigue en HourlySalesMetrics ───
      db.select({
        orderSource: hourlySalesMetrics.orderSource,
        netSales:    sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        orders:      sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')
             AND ${hourlySalesMetrics.orderSource} IS NOT NULL
             AND ${hourlySalesMetrics.orderSource} != ''`)
      .groupBy(hourlySalesMetrics.orderSource)
      .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

      // ── 6. RevenueCenter (últimos 30 días) — sigue en HourlySalesMetrics ─
      db.select({
        revenueCenter: hourlySalesMetrics.revenueCenter,
        netSales:      sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        orders:        sum(hourlySalesMetrics.ordersCount).mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')
             AND ${hourlySalesMetrics.revenueCenter} IS NOT NULL
             AND ${hourlySalesMetrics.revenueCenter} != ''`)
      .groupBy(hourlySalesMetrics.revenueCenter)
      .orderBy(desc(sum(hourlySalesMetrics.netSalesAmount))),

      // ── 7. Top 10 mejores días históricos ─────────────────────────────────
      db.select({
        date:     dcm.businessDate,
        netSales: sum(dcm.netSales).mapWith(Number),
        guests:   sum(dcm.guests).mapWith(Number),
        orders:   sum(dcm.orders).mapWith(Number),
      })
      .from(dcm)
      .groupBy(dcm.businessDate)
      .orderBy(desc(sum(dcm.netSales)))
      .limit(10),

      // ── 8. Semana actual (últimos 7 días) ─────────────────────────────────
      db.select({
        netSales:  sum(dcm.netSales).mapWith(Number),
        guests:    sum(dcm.guests).mapWith(Number),
        orders:    sum(dcm.orders).mapWith(Number),
        discounts: sum(dcm.discounts).mapWith(Number),
      })
      .from(dcm)
      .where(sql`${dcm.businessDate}::date >= (${lastDate}::date - INTERVAL '6 days')`),

      // ── 9. Semana anterior (7–14 días atrás) ──────────────────────────────
      db.select({
        netSales:  sum(dcm.netSales).mapWith(Number),
        guests:    sum(dcm.guests).mapWith(Number),
        orders:    sum(dcm.orders).mapWith(Number),
        discounts: sum(dcm.discounts).mapWith(Number),
      })
      .from(dcm)
      .where(sql`
        ${dcm.businessDate}::date >= (${lastDate}::date - INTERVAL '13 days')
        AND ${dcm.businessDate}::date < (${lastDate}::date - INTERVAL '6 days')
      `),

      // ── 10. Métodos de pago (últimos 30 días) — desde DailyConsolidatedMetrics
      db.execute(sql`
        SELECT
          'Visa'       AS "methodType", SUM("VisaPayments")::float       AS "totalAmount", 0 AS "totalTips", COUNT(*) AS "txCount"
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
          AND "VisaPayments" > 0
        UNION ALL
        SELECT
          'Mastercard', SUM("MastercardPayments")::float, 0, COUNT(*)
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
          AND "MastercardPayments" > 0
        UNION ALL
        SELECT
          'Amex', SUM("AmexPayments")::float, 0, COUNT(*)
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
          AND "AmexPayments" > 0
        UNION ALL
        SELECT
          'Efectivo', SUM("CashPayments")::float, 0, COUNT(*)
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
          AND "CashPayments" > 0
        UNION ALL
        SELECT
          'Otro', SUM("OtherPayments")::float, 0, COUNT(*)
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
          AND "OtherPayments" > 0
      `),

      // ── 11. Tips acumulados 30 días — desde DailyConsolidatedMetrics ──────
      db.select({ total: sum(dcm.tips).mapWith(Number) })
        .from(dcm)
        .where(sql`${dcm.businessDate}::date >= (${lastDate}::date - INTERVAL '29 days')`),

      // ── 12. Curva horaria del día actual — sigue en HourlySalesMetrics ────
      db.select({
        hour:      hourlySalesMetrics.businessHour,
        netSales:  sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        guests:    sum(hourlySalesMetrics.guestCount).mapWith(Number),
        orders:    sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        discounts: sum(hourlySalesMetrics.discountAmount).mapWith(Number),
        laborCost: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastDate}::date`)
      .groupBy(hourlySalesMetrics.businessHour)
      .orderBy(hourlySalesMetrics.businessHour),

      // ── 13. Tip rate trending diario 30 días — desde DailyConsolidatedMetrics
      db.execute(sql`
        SELECT
          "BusinessDate"::date                                          AS date,
          SUM("Tips")::float                                            AS total_tips,
          SUM("NetSales")::float                                        AS total_payments,
          COUNT(*)::int                                                 AS tx_count
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
        GROUP BY "BusinessDate"::date
        ORDER BY date
      `),

      // ── 14. Tip rate por sucursal (30 días) — desde DailyConsolidatedMetrics + Stores
      db.execute(sql`
        SELECT
          s."Name"                                                 AS "restaurantName",
          SUM(d."Tips")::float                                     AS "totalTips",
          SUM(d."NetSales")::float                                 AS "totalPayments",
          COUNT(*)::int                                            AS "txCount"
        FROM "DailyConsolidatedMetrics" d
        JOIN "Stores" s ON s."Id" = d."StoreId"
        WHERE d."BusinessDate"::date >= (${lastDate}::date - INTERVAL '29 days')
          AND s."Name" IS NOT NULL
        GROUP BY s."Name"
        ORDER BY "totalTips" DESC
      `),

      // ── 15. Comparativa Mes Actual vs Mes Anterior — desde DailyConsolidatedMetrics
      db.execute(sql`
        SELECT
          CASE
            WHEN "BusinessDate"::date >= DATE_TRUNC('month', ${lastDate}::date)
            THEN 'current'
            ELSE 'previous'
          END AS period,
          SUM("NetSales")::float    AS net_sales,
          SUM("Guests")::float      AS guests,
          SUM("Orders")::float      AS orders,
          SUM("Discounts")::float   AS discounts,
          COUNT(DISTINCT "BusinessDate") AS days
        FROM "DailyConsolidatedMetrics"
        WHERE "BusinessDate"::date >= DATE_TRUNC('month', ${lastDate}::date - INTERVAL '1 month')
        GROUP BY period
      `),
    ]);

    // ── Post-process ──────────────────────────────────────────────────────────

    // Curva horaria formateada
    const peakHours = hourlyToday.map(d => {
      const hrVal = d.hour ?? 0;
      const ampm = hrVal >= 12 ? 'PM' : 'AM';
      const hr = hrVal % 12 || 12;
      return {
        time:     `${hr.toString().padStart(2, '0')}:00 ${ampm}`,
        ventas:   d.netSales,
        clientes: d.guests,
        ordenes:  d.orders,
        labor:    d.laborCost,
      };
    });

    // Días de semana con etiquetas
    const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const byDow = (Array.isArray(byDayOfWeek) ? byDayOfWeek : (byDayOfWeek as unknown as { rows: unknown[] }).rows ?? [])
      .map((d: unknown) => {
        const row = d as Record<string, unknown>;
        const dow = Number(row.dow ?? 0);
        return {
          day:       DOW_LABELS[dow] ?? `D${dow}`,
          dow,
          avgSales:  Number(row.avgSales  ?? 0),
          avgGuests: Number(row.avgGuests ?? 0),
          avgOrders: Number(row.avgOrders ?? 0),
        };
      }).sort((a, b) => a.dow - b.dow);

    // Tendencia 90d con media móvil 7 días
    const trend90Formatted = trend90.map((d, i) => {
      const window = trend90.slice(Math.max(0, i - 6), i + 1);
      const ma7 = window.reduce((a, x) => a + x.netSales, 0) / window.length;
      return {
        date:       (d.date ?? '').slice(5), // MM-DD
        netSales:   d.netSales,
        grossSales: d.grossSales,
        guests:     d.guests,
        orders:     d.orders,
        discounts:  d.discounts,
        ma7:        Math.round(ma7),
      };
    });

    // Variación semana actual vs anterior
    const currWeek = weekCurrent[0] ?? { netSales: 0, guests: 0, orders: 0, discounts: 0 };
    const prevWeek = weekPrev[0]    ?? { netSales: 0, guests: 0, orders: 0, discounts: 0 };
    const wowSales  = prevWeek.netSales > 0 ? ((currWeek.netSales - prevWeek.netSales) / prevWeek.netSales * 100) : 0;
    const wowGuests = prevWeek.guests > 0   ? ((currWeek.guests - prevWeek.guests)     / prevWeek.guests   * 100) : 0;

    // Métodos de pago
    const toRows = (res: unknown) => Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
    let totalCash = 0, totalCard = 0;
    const totalTips30 = tipsRes[0]?.total ?? 0;
    const paymentBreakdown: { name: string; value: number; tips: number; txCount: number; color: string }[] = [];
    const PAYMENT_COLORS: Record<string, string> = {
      Visa: '#1a56db', Mastercard: '#e3342f', Amex: '#2d6a4f', Efectivo: '#3b82f6', Otro: '#9ca3af',
    };
    toRows(paymentRaw).forEach((p: unknown) => {
      const row = p as Record<string, unknown>;
      const type = String(row.methodType ?? 'Otro');
      const amount = Number(row.totalAmount ?? 0);
      if (type === 'Efectivo') totalCash += amount;
      else totalCard += amount;
      paymentBreakdown.push({
        name:     type,
        value:    amount,
        tips:     Number(row.totalTips ?? 0),
        txCount:  Number(row.txCount   ?? 0),
        color:    PAYMENT_COLORS[type] ?? '#9ca3af',
      });
    });

    // Tip rate trending
    const tipTrendFormatted = toRows(tipTrend30).map((d: unknown) => {
      const row = d as Record<string, unknown>;
      const tips     = Number(row.total_tips     ?? 0);
      const payments = Number(row.total_payments ?? 0);
      return {
        date:          String(row.date ?? '').slice(5, 10),
        totalTips:     tips,
        totalPayments: payments,
        tipRate:       payments > 0 ? (tips / payments * 100) : 0,
        txCount:       Number(row.tx_count ?? 0),
      };
    });

    // Tip rate por restaurante
    const cleanRestaurantName = (v: string | null | undefined) => {
      if (!v) return '—';
      let s = v.replace(/CFS Coffee/ig, '').trim();
      if (s.startsWith('-')) s = s.substring(1).trim();
      const parts = s.split('-').map((p: string) => p.trim()).filter(Boolean);
      return (parts.length > 1 && parts[0].length <= 4) ? parts[1] : parts[0] || v;
    };

    const tipByRestaurantFormatted = toRows(tipByRestaurant)
      .filter((t: unknown) => Number((t as Record<string, unknown>).totalTips ?? 0) > 0)
      .map((t: unknown) => {
        const row = t as Record<string, unknown>;
        const totalTips = Number(row.totalTips ?? 0);
        const totalPayments = Number(row.totalPayments ?? 0);
        const txCount = Number(row.txCount ?? 0);
        return {
          name:          cleanRestaurantName(String(row.restaurantName ?? '')),
          totalTips,
          totalPayments,
          tipRate:       totalPayments > 0 ? (totalTips / totalPayments * 100) : 0,
          avgTipPerTx:   txCount > 0 ? (totalTips / txCount) : 0,
          txCount,
        };
      })
      .sort((a: { tipRate: number }, b: { tipRate: number }) => b.tipRate - a.tipRate);

    // MoM comparison
    let momCurr = { netSales: 0, guests: 0, orders: 0, discounts: 0, days: 0 };
    let momPrev = { netSales: 0, guests: 0, orders: 0, discounts: 0, days: 0 };
    toRows(momComparison).forEach((d: unknown) => {
      const row = d as Record<string, unknown>;
      const period = String(row.period ?? '');
      const obj = {
        netSales:  Number(row.net_sales  ?? 0),
        guests:    Number(row.guests     ?? 0),
        orders:    Number(row.orders     ?? 0),
        discounts: Number(row.discounts  ?? 0),
        days:      Number(row.days       ?? 0),
      };
      if (period === 'current') momCurr = obj;
      else momPrev = obj;
    });
    const momSalesChg  = momPrev.netSales > 0 ? ((momCurr.netSales - momPrev.netSales) / momPrev.netSales * 100) : 0;
    const momGuestsChg = momPrev.guests   > 0 ? ((momCurr.guests   - momPrev.guests)   / momPrev.guests   * 100) : 0;

    const kpiHoy = kpisHoy[0] ?? { netSales: 0, grossSales: 0, guests: 0, orders: 0, discounts: 0, voids: 0, refunds: 0, tips: 0, laborCost: 0, laborHours: 0 };

    return {
      lastDate,
      kpisHoy: kpiHoy,
      trend90: trend90Formatted,
      byDow,
      byDiningOption: byDiningOption.filter(d => d.diningOption),
      byOrderSource:  byOrderSource.filter(d => d.orderSource),
      byRevenueCenter: byRevenueCenter.filter(d => d.revenueCenter),
      topDias: topDias.map(d => ({ date: d.date ?? '', netSales: d.netSales, guests: d.guests, orders: d.orders })),
      currWeek, prevWeek, wowSales, wowGuests,
      paymentBreakdown,
      totalCash, totalCard, totalTips30,
      peakHours,
      tipTrend: tipTrendFormatted,
      tipByRestaurant: tipByRestaurantFormatted,
      momCurr, momPrev, momSalesChg, momGuestsChg,
    };
  },
  ['ventas-metrics-v4'],
  { revalidate: 300, tags: ['ventas', 'dashboard'] }
);
