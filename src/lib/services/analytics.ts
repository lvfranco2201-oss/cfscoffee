import { db } from '../db';
import { dailyConsolidatedMetrics, hourlySalesMetrics, paymentData, stores } from '../db/schema';
import { sum, desc, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Módulo de Servicios Analíticos CFSCoffee — página principal (/)
 * Fuente principal: DailyConsolidatedMetrics
 * Fuente secundaria: HourlySalesMetrics (solo curva horaria)
 */

const dcm = dailyConsolidatedMetrics;

export const getDashboardMetrics = unstable_cache(
  async () => {
    // 1. Último businessDate disponible
    const latestDateQuery = await db
      .select({ latestDate: sql<string>`MAX(${dcm.businessDate}::date)` })
      .from(dcm);

    const lastBusinessDateStr = latestDateQuery[0]?.latestDate;
    if (!lastBusinessDateStr) return { kpis: null, storesPerformance: [] };

    // 2. KPIs + per-store + avg30 en paralelo
    const [consolidadoHoy, topSucursalesRaw, hourlyData, avg30Raw] = await Promise.all([

      // KPIs consolidados del último día (incluye tips y labor)
      db.select({
        totalNetSales:   sum(dcm.netSales).mapWith(Number),
        totalGrossSales: sum(dcm.grossSales).mapWith(Number),
        totalGuests:     sum(dcm.guests).mapWith(Number),
        totalOrders:     sum(dcm.orders).mapWith(Number),
        totalDiscounts:  sum(dcm.discounts).mapWith(Number),
        totalVoids:      sum(dcm.voids).mapWith(Number),
        totalRefunds:    sum(dcm.refunds).mapWith(Number),
        totalTips:       sum(dcm.tips).mapWith(Number),
        totalLaborCost:  sum(dcm.laborCost).mapWith(Number),
        totalLaborHours: sum(dcm.laborHours).mapWith(Number),
      })
      .from(dcm)
      .where(sql`${dcm.businessDate}::date = ${lastBusinessDateStr}::date`),

      // Desglose por sucursal — con labor y tips incluidos
      db.execute(sql`
        SELECT
          d."StoreId"                                  AS "storeId",
          s."Name"                                     AS "storeName",
          SUM(d."NetSales"::numeric)::float            AS "netSales",
          SUM(d."GrossSales"::numeric)::float          AS "grossSales",
          SUM(d."Guests")::float                       AS "guests",
          SUM(d."Orders")::float                       AS "orders",
          SUM(d."Discounts"::numeric)::float           AS "discounts",
          SUM(d."Voids"::numeric)::float               AS "voids",
          SUM(d."Refunds"::numeric)::float             AS "refunds",
          SUM(d."LaborCost"::numeric)::float           AS "laborCost",
          SUM(d."Tips"::numeric)::float                AS "tips",
          CASE WHEN SUM(d."LaborHours"::numeric) > 0
               THEN SUM(d."NetSales"::numeric) / SUM(d."LaborHours"::numeric)
               ELSE 0 END::float                      AS "salesPerLH"
        FROM "DailyConsolidatedMetrics" d
        JOIN "Stores" s ON s."Id" = d."StoreId"
        WHERE d."BusinessDate"::date = ${lastBusinessDateStr}::date
        GROUP BY d."StoreId", s."Name"
        ORDER BY "netSales" DESC
      `),

      // Curva horaria — sigue en HourlySalesMetrics (único lugar con datos horarios)
      db.select({
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

      // Promedio 30d (para anomalías) — desde DailyConsolidatedMetrics
      db.execute(sql`
        SELECT
          AVG(daily_net)::float    AS "avgNetSales",
          AVG(daily_guests)::float AS "avgGuests",
          AVG(daily_orders)::float AS "avgOrders"
        FROM (
          SELECT
            "BusinessDate"::date            AS d,
            SUM("NetSales"::numeric)::float AS daily_net,
            SUM("Guests")::float            AS daily_guests,
            SUM("Orders")::float            AS daily_orders
          FROM "DailyConsolidatedMetrics"
          WHERE "BusinessDate"::date >= (${lastBusinessDateStr}::date - INTERVAL '30 days')
            AND "BusinessDate"::date < ${lastBusinessDateStr}::date
          GROUP BY "BusinessDate"::date
        ) sub
      `),
    ]);

    const toRows = (res: unknown): Record<string, unknown>[] => {
      if (Array.isArray(res)) return res as Record<string, unknown>[];
      return ((res as { rows?: unknown[] }).rows ?? []) as Record<string, unknown>[];
    };

    const avg30Row = toRows(avg30Raw)[0] ?? {};
    const avg30 = {
      avgNetSales: Number(avg30Row.avgNetSales ?? 0),
      avgGuests:   Number(avg30Row.avgGuests   ?? 0),
      avgOrders:   Number(avg30Row.avgOrders   ?? 0),
    };

    // Sucursales enriquecidas
    const topSucursales = toRows(topSucursalesRaw).map(s => ({
      storeId:    Number(s.storeId   ?? 0),
      storeName:  String(s.storeName ?? 'Desconocida'),
      netSales:   Number(s.netSales   ?? 0),
      grossSales: Number(s.grossSales ?? 0),
      guests:     Number(s.guests     ?? 0),
      orders:     Number(s.orders     ?? 0),
      discounts:  Number(s.discounts  ?? 0),
      voids:      Number(s.voids      ?? 0),
      refunds:    Number(s.refunds    ?? 0),
      laborCost:  Number(s.laborCost  ?? 0),
      tips:       Number(s.tips       ?? 0),
      salesPerLH: Number(s.salesPerLH ?? 0),
    }));

    // Curva horaria formateada
    const totalLaborCost  = hourlyData.reduce((acc, d) => acc + (d.laborCost ?? 0), 0);
    const totalLaborHours = hourlyData.reduce((acc, d) => acc + (d.laborHrs  ?? 0), 0);
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

    // Métodos de pago: directo desde los KPIs de DailyConsolidatedMetrics (ya los tenemos)
    const kpiRow = consolidadoHoy[0];
    const totalTips = Number(kpiRow?.totalTips ?? 0);
    const netSales  = Number(kpiRow?.totalNetSales ?? 0);

    // Usamos labor de DailyConsolidatedMetrics (más preciso que suma de HourlySalesMetrics)
    const dcmLaborCost  = Number(kpiRow?.totalLaborCost  ?? 0);
    const dcmLaborHours = Number(kpiRow?.totalLaborHours ?? 0);

    // Para paymentMethods usamos el query de PaymentData del día (ya que DCM tiene totales por tipo)
    const settledDateKey = lastBusinessDateStr.replace(/-/g, '');
    const [paymentMethodsRaw, tipResDay] = await Promise.all([
      db.select({
        methodType:  paymentData.paymentCardType,
        totalAmount: sum(paymentData.paymentTotal).mapWith(Number),
      })
      .from(paymentData)
      .where(sql`${paymentData.settledDate} = ${settledDateKey}`)
      .groupBy(paymentData.paymentCardType),

      db.select({ totalTips: sum(paymentData.tipAmount).mapWith(Number) })
        .from(paymentData)
        .where(sql`${paymentData.settledDate} = ${settledDateKey}`),
    ]);

    const totalTipsPayment = tipResDay[0]?.totalTips ?? totalTips;
    let totalCash = 0, totalCard = 0;
    paymentMethodsRaw.forEach(p => {
      const type = p.methodType ? p.methodType.toUpperCase() : 'CASH';
      if (type === 'CASH' || type.includes('CASH') || type === 'EFECTIVO') totalCash += p.totalAmount;
      else totalCard += p.totalAmount;
    });
    const paymentMethods = [
      { name: 'Tarjeta / Digital', value: totalCard, color: 'var(--cfs-gold)' },
      { name: 'Efectivo',          value: totalCash, color: 'var(--info)' },
    ].filter(p => p.value > 0);
    const sumPayments = totalCard + totalCash;
    const estimatedExpected = netSales + totalTipsPayment;
    if (estimatedExpected > sumPayments && sumPayments > 0) {
      paymentMethods.push({ name: 'Plataformas / Otros', value: estimatedExpected - sumPayments, color: '#94A3B8' });
    }

    return {
      lastBusinessDateStr,
      kpis: kpiRow ?? null,
      storesPerformance: topSucursales,
      peakHours,
      paymentMethods,
      totalTips: totalTipsPayment,
      totalLaborCost:  dcmLaborCost  || totalLaborCost,
      totalLaborHours: dcmLaborHours || totalLaborHours,
      avg30,
    };
  },
  ['dashboard-metrics-v6'],
  { revalidate: 300, tags: ['dashboard'] }
);
