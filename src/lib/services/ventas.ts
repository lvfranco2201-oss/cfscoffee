import { db } from '../db';
import { vwDailySalesMetrics, hourlySalesMetrics, paymentData } from '../db/schema';
import { sum, asc, desc, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Servicio de Análisis de Ventas — CFSCoffee BI
 * Módulo /ventas — Datos 100% reales, sin proyecciones.
 * Incluye: histórico 90d, por día de semana, diningOption, orderSource,
 *          revenueCenter, semana actual vs anterior, top días, pagos.
 */

export const getVentasMetrics = unstable_cache(
  async () => {

    // ── 0. Último businessDate ─────────────────────────────────────────────
    const latestRes = await db
      .select({ latestDate: sql<string>`MAX(${vwDailySalesMetrics.businessDate}::date)` })
      .from(vwDailySalesMetrics);

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

      // ── 1. KPIs del día actual ─────────────────────────────────────────
      db.select({
        netSales:   sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        grossSales: sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
        guests:     sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:     sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        discounts:  sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
        voids:      sum(vwDailySalesMetrics.totalVoids).mapWith(Number),
        refunds:    sum(vwDailySalesMetrics.totalRefunds).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date = ${lastDate}::date`),

      // ── 2. Tendencia diaria últimos 90 días ────────────────────────────
      db.select({
        date:       vwDailySalesMetrics.businessDate,
        netSales:   sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        grossSales: sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
        guests:     sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:     sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        discounts:  sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '89 days')`)
      .groupBy(vwDailySalesMetrics.businessDate)
      .orderBy(asc(vwDailySalesMetrics.businessDate)),

      // ── 3. Ventas por día de semana (avg, últimos 90 días) ─────────────
      // Raw SQL para evitar problemas de alias en Drizzle con subqueries
      db.execute(sql`
        SELECT
          dow,
          AVG(daily_sum)    AS "avgSales",
          AVG(daily_guests) AS "avgGuests",
          AVG(daily_orders) AS "avgOrders"
        FROM (
          SELECT
            EXTRACT(DOW FROM "BusinessDate"::date)::int AS dow,
            SUM("TotalNetSales")::float                 AS daily_sum,
            SUM("TotalGuests")::float                   AS daily_guests,
            SUM("TotalOrders")::float                   AS daily_orders
          FROM "vw_DailySalesMetrics"
          WHERE "BusinessDate"::date >= (${lastDate}::date - INTERVAL '89 days')
          GROUP BY "BusinessDate"::date, EXTRACT(DOW FROM "BusinessDate"::date)
        ) AS sub
        GROUP BY dow
        ORDER BY dow
      `),

      // ── 4. Ventas por DiningOption (últimos 30 días) ───────────────────
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

      // ── 5. Ventas por OrderSource (últimos 30 días) ────────────────────
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

      // ── 6. Ventas por RevenueCenter (últimos 30 días) ──────────────────
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

      // ── 7. Top 10 mejores días históricos ─────────────────────────────
      db.select({
        date:     vwDailySalesMetrics.businessDate,
        netSales: sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        guests:   sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:   sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .groupBy(vwDailySalesMetrics.businessDate)
      .orderBy(desc(sum(vwDailySalesMetrics.totalNetSales)))
      .limit(10),

      // ── 8. Semana actual (últimos 7 días) ──────────────────────────────
      db.select({
        netSales:  sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        guests:    sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:    sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        discounts: sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '6 days')`),

      // ── 9. Semana anterior (7–14 días atrás) ──────────────────────────
      db.select({
        netSales:  sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        guests:    sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders:    sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
        discounts: sum(vwDailySalesMetrics.totalDiscounts).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`
        ${vwDailySalesMetrics.businessDate}::date >= (${lastDate}::date - INTERVAL '13 days')
        AND ${vwDailySalesMetrics.businessDate}::date < (${lastDate}::date - INTERVAL '6 days')
      `),

      // ── 10. Métodos de pago (últimos 30 días) ─────────────────────────
      db.select({
        methodType:  paymentData.paymentCardType,
        totalAmount: sum(paymentData.paymentTotal).mapWith(Number),
        totalTips:   sum(paymentData.tipAmount).mapWith(Number),
        txCount:     sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(paymentData)
      .where(sql`TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') >= (${lastDate}::date - INTERVAL '29 days')`)
      .groupBy(paymentData.paymentCardType)
      .orderBy(desc(sum(paymentData.paymentTotal))),

      // ── 11. Tips acumulados 30 días ────────────────────────────────────
      db.select({ total: sum(paymentData.tipAmount).mapWith(Number) })
        .from(paymentData)
        .where(sql`TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') >= (${lastDate}::date - INTERVAL '29 days')`),

      // ── 12. Curva horaria del día actual ──────────────────────────────
      db.select({
        hour:     hourlySalesMetrics.businessHour,
        netSales: sum(hourlySalesMetrics.netSalesAmount).mapWith(Number),
        guests:   sum(hourlySalesMetrics.guestCount).mapWith(Number),
        orders:   sum(hourlySalesMetrics.ordersCount).mapWith(Number),
        discounts: sum(hourlySalesMetrics.discountAmount).mapWith(Number),
        laborCost: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date = ${lastDate}::date`)
      .groupBy(hourlySalesMetrics.businessHour)
      .orderBy(hourlySalesMetrics.businessHour),

      // ── 13. Tip rate trending diario 30 días ─────────────────────────
      db.execute(sql`
        SELECT
          TO_DATE(${paymentData.settledDate}, 'YYYYMMDD')                    AS date,
          SUM(${paymentData.tipAmount})::float                               AS total_tips,
          SUM(${paymentData.paymentTotal})::float                            AS total_payments,
          COUNT(*)::int                                                       AS tx_count
        FROM "PaymentData"
        WHERE ${paymentData.settledDate} IS NOT NULL
          AND TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') >= (${lastDate}::date - INTERVAL '29 days')
        GROUP BY TO_DATE(${paymentData.settledDate}, 'YYYYMMDD')
        ORDER BY date
      `),

      // ── 14. Tip rate por restaurante (30 días) ────────────────────────
      db.select({
        restaurantName: paymentData.restaurantName,
        totalTips:      sum(paymentData.tipAmount).mapWith(Number),
        totalPayments:  sum(paymentData.paymentTotal).mapWith(Number),
        txCount:        sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(paymentData)
      .where(sql`
        ${paymentData.settledDate} IS NOT NULL
        AND TO_DATE(${paymentData.settledDate}, 'YYYYMMDD') >= (${lastDate}::date - INTERVAL '29 days')
        AND ${paymentData.restaurantName} IS NOT NULL
      `)
      .groupBy(paymentData.restaurantName)
      .orderBy(desc(sum(paymentData.tipAmount))),

      // ── 15. Comparativa Mes Actual vs Mes Anterior ────────────────────
      db.execute(sql`
        SELECT
          CASE
            WHEN "BusinessDate"::date >= DATE_TRUNC('month', ${lastDate}::date)
            THEN 'current'
            ELSE 'previous'
          END AS period,
          SUM("TotalNetSales")::float   AS net_sales,
          SUM("TotalGuests")::float     AS guests,
          SUM("TotalOrders")::float     AS orders,
          SUM("TotalDiscounts")::float  AS discounts,
          COUNT(DISTINCT "BusinessDate") AS days
        FROM "vw_DailySalesMetrics"
        WHERE "BusinessDate"::date >= DATE_TRUNC('month', ${lastDate}::date - INTERVAL '1 month')
        GROUP BY period
      `),
    ]);

    // ── Post-process ───────────────────────────────────────────────────────

    // Curva horaria formateada
    const peakHours = hourlyToday.map(d => {
      const hrVal = d.hour ?? 0;
      const ampm = hrVal >= 12 ? 'PM' : 'AM';
      const hr = hrVal % 12 || 12;
      return { 
        time: `${hr.toString().padStart(2, '0')}:00 ${ampm}`, 
        ventas: d.netSales, 
        clientes: d.guests, 
        ordenes: d.orders, 
        labor: d.laborCost 
      };
    });

    // Días de semana con etiquetas
    // postgres-js: db.execute() devuelve las filas directamente como array (no .rows)
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

    // Tendencia 90d: calcular media móvil de 7 días
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
    const wowSales  = prevWeek.netSales > 0 ? ((currWeek.netSales  - prevWeek.netSales)  / prevWeek.netSales  * 100) : 0;
    const wowGuests = prevWeek.guests   > 0 ? ((currWeek.guests    - prevWeek.guests)    / prevWeek.guests    * 100) : 0;

    // Métodos de pago + propinas
    let totalCash = 0, totalCard = 0, totalTips30 = tipsRes[0]?.total ?? 0;
    const paymentBreakdown: { name: string; value: number; tips: number; txCount: number; color: string }[] = [];
    paymentRaw.forEach(p => {
      const type = p.methodType ? p.methodType.toUpperCase() : 'CASH';
      const isCash = type === 'CASH' || type.includes('CASH');
      if (isCash) {
        totalCash += p.totalAmount;
        paymentBreakdown.push({ name: 'Efectivo', value: p.totalAmount, tips: p.totalTips, txCount: p.txCount, color: '#3b82f6' });
      } else {
        totalCard += p.totalAmount;
        paymentBreakdown.push({ name: p.methodType ?? 'Otro', value: p.totalAmount, tips: p.totalTips, txCount: p.txCount, color: '#DDA756' });
      }
    });

    // ── Tip rate trending
    const toRows2 = (res: unknown) => Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
    const tipTrendFormatted = toRows2(tipTrend30).map((d: unknown) => {
      const row = d as Record<string, unknown>;
      const tips = Number(row.total_tips ?? 0);
      const payments = Number(row.total_payments ?? 0);
      return {
        date: String(row.date ?? '').slice(5, 10),
        totalTips: tips, totalPayments: payments,
        tipRate: payments > 0 ? (tips / payments * 100) : 0,
        txCount: Number(row.tx_count ?? 0),
      };
    });

    // Tip rate por restaurante (clean names)
    const cleanRestaurantName = (v: string | null | undefined) => {
      if (!v) return '—';
      let s = v.replace(/CFS Coffee/ig, '').trim();
      if (s.startsWith('-')) s = s.substring(1).trim();
      const parts = s.split('-').map((p: string) => p.trim()).filter(Boolean);
      return (parts.length > 1 && parts[0].length <= 4) ? parts[1] : parts[0] || v;
    };

    const tipByRestaurantFormatted = tipByRestaurant
      .filter(t => t.totalTips > 0)
      .map(t => ({
        name: cleanRestaurantName(t.restaurantName),
        totalTips: t.totalTips,
        totalPayments: t.totalPayments,
        tipRate: t.totalPayments > 0 ? (t.totalTips / t.totalPayments * 100) : 0,
        avgTipPerTx: t.txCount > 0 ? (t.totalTips / t.txCount) : 0,
        txCount: t.txCount,
      }))
      .sort((a, b) => b.tipRate - a.tipRate);

    // MoM comparison
    let momCurr = { netSales: 0, guests: 0, orders: 0, discounts: 0, days: 0 };
    let momPrev = { netSales: 0, guests: 0, orders: 0, discounts: 0, days: 0 };
    toRows2(momComparison).forEach((d: unknown) => {
      const row = d as Record<string, unknown>;
      const period = String(row.period ?? '');
      const obj = { netSales: Number(row.net_sales ?? 0), guests: Number(row.guests ?? 0), orders: Number(row.orders ?? 0), discounts: Number(row.discounts ?? 0), days: Number(row.days ?? 0) };
      if (period === 'current') momCurr = obj;
      else momPrev = obj;
    });
    const momSalesChg = momPrev.netSales > 0 ? ((momCurr.netSales - momPrev.netSales) / momPrev.netSales * 100) : 0;
    const momGuestsChg = momPrev.guests > 0 ? ((momCurr.guests - momPrev.guests) / momPrev.guests * 100) : 0;

    return {
      lastDate,
      kpisHoy:   kpisHoy[0]   ?? { netSales: 0, grossSales: 0, guests: 0, orders: 0, discounts: 0, voids: 0, refunds: 0 },
      trend90:   trend90Formatted,
      byDow,
      byDiningOption: byDiningOption.filter(d => d.diningOption),
      byOrderSource:  byOrderSource.filter(d => d.orderSource),
      byRevenueCenter: byRevenueCenter.filter(d => d.revenueCenter),
      topDias:   topDias.map(d => ({ date: d.date ?? '', netSales: d.netSales, guests: d.guests, orders: d.orders })),
      currWeek,  prevWeek,  wowSales, wowGuests,
      paymentBreakdown,
      totalCash, totalCard, totalTips30,
      peakHours,
      tipTrend: tipTrendFormatted,
      tipByRestaurant: tipByRestaurantFormatted,
      momCurr, momPrev, momSalesChg, momGuestsChg,
    };
  },
  ['ventas-metrics-v3'],
  { revalidate: 300, tags: ['ventas', 'dashboard'] }
);

