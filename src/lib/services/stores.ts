import { db } from '../db';
import { stores, dailyConsolidatedMetrics, hourlySalesMetrics } from '../db/schema';
import { sum, desc, asc, sql, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

/**
 * Servicio de Sucursales — CFSCoffee BI
 * Datos de rendimiento por tienda: catálogo + ventas históricas + métricas del último día.
 *
 * Fuentes:
 *  - DailyConsolidatedMetrics : ventas, labor, guests por sucursal (Toast API + histórico)
 *  - Stores                   : catálogo de tiendas (nombre, código, etc.)
 *  - HourlySalesMetrics       : curva horaria por tienda (solo para el día actual — Aurora ETL)
 */

const dcm = dailyConsolidatedMetrics;

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
  ['stores-catalog-v2'],
  { revalidate: 3600, tags: ['stores'] }
);

// ── 2. Métricas de rendimiento por sucursal ────────────────────────────────────
export const getStoresMetrics = unstable_cache(
  async () => {
    // Último businessDate disponible
    const latestDateQuery = await db
      .select({ latestDate: sql<string>`MAX(${dcm.businessDate}::date)` })
      .from(dcm);

    const lastBusinessDateStr = latestDateQuery[0]?.latestDate;
    if (!lastBusinessDateStr) return { lastBusinessDateStr: null, todayByStore: [], last30ByStore: [], dailyTrend30: [] };

    // ── Métricas del último día por tienda (DailyConsolidatedMetrics + JOIN Stores) ──
    const [todayRaw, last30ByStore, dailyTrend30] = await Promise.all([

      db.execute(sql`
        SELECT
          d."StoreId"                          AS "storeId",
          s."Name"                             AS "storeName",
          s."LocationCode"                     AS "locationCode",
          SUM(d."NetSales"::numeric)::float    AS "netSales",
          SUM(d."GrossSales"::numeric)::float  AS "grossSales",
          SUM(d."Guests")::float               AS "guests",
          SUM(d."Orders")::float               AS "orders",
          SUM(d."Discounts"::numeric)::float   AS "discounts",
          SUM(d."Voids"::numeric)::float       AS "voids",
          SUM(d."Refunds"::numeric)::float     AS "refunds",
          SUM(d."LaborCost"::numeric)::float   AS "laborCost",
          SUM(d."LaborHours"::numeric)::float  AS "laborHours",
          SUM(d."Tips"::numeric)::float        AS "tips",
          CASE WHEN SUM(d."LaborHours"::numeric) > 0
               THEN SUM(d."NetSales"::numeric) / SUM(d."LaborHours"::numeric)
               ELSE 0 END::float              AS "salesPerLH"
        FROM "DailyConsolidatedMetrics" d
        JOIN "Stores" s ON s."Id" = d."StoreId"
        WHERE d."BusinessDate"::date = ${lastBusinessDateStr}::date
        GROUP BY d."StoreId", s."Name", s."LocationCode"
        ORDER BY "netSales" DESC
      `),

      // ── Acumulado últimos 30 días por tienda ──────────────────────────────
      db.execute(sql`
        SELECT
          d."StoreId"                                      AS "storeId",
          s."Name"                                         AS "storeName",
          SUM(d."NetSales"::numeric)::float                AS "netSales",
          SUM(d."GrossSales"::numeric)::float              AS "grossSales",
          SUM(d."Guests")::float                           AS "guests",
          SUM(d."Orders")::float                           AS "orders",
          SUM(d."Discounts"::numeric)::float               AS "discounts",
          SUM(d."Voids"::numeric)::float                   AS "voids",
          SUM(d."LaborCost"::numeric)::float               AS "laborCost",
          SUM(d."Tips"::numeric)::float                    AS "tips",
          COUNT(DISTINCT d."BusinessDate")::int            AS "daysActive",
          CASE WHEN SUM(d."LaborHours"::numeric) > 0
               THEN SUM(d."NetSales"::numeric) / SUM(d."LaborHours"::numeric)
               ELSE 0 END::float                          AS "salesPerLH"
        FROM "DailyConsolidatedMetrics" d
        JOIN "Stores" s ON s."Id" = d."StoreId"
        WHERE d."BusinessDate"::date >= (${lastBusinessDateStr}::date - INTERVAL '29 days')
        GROUP BY d."StoreId", s."Name"
        ORDER BY "netSales" DESC
      `),

      // ── Tendencia diaria por tienda (últimos 30 días) para sparklines ─────
      db.execute(sql`
        SELECT
          d."BusinessDate"::date               AS "businessDate",
          d."StoreId"                          AS "storeId",
          SUM(d."NetSales"::numeric)::float    AS "netSales",
          SUM(d."Guests")::float               AS "guests"
        FROM "DailyConsolidatedMetrics" d
        WHERE d."BusinessDate"::date >= (${lastBusinessDateStr}::date - INTERVAL '29 days')
        GROUP BY d."BusinessDate"::date, d."StoreId"
        ORDER BY d."BusinessDate"::date
      `),
    ]);

    const toRows = (res: unknown): Record<string, unknown>[] => {
      if (Array.isArray(res)) return res as Record<string, unknown>[];
      return ((res as { rows?: unknown[] }).rows ?? []) as Record<string, unknown>[];
    };

    const todayByStore = toRows(todayRaw).map(r => ({
      storeId:      Number(r.storeId   ?? 0),
      storeName:    String(r.storeName ?? ''),
      locationCode: String(r.locationCode ?? ''),
      netSales:     Number(r.netSales   ?? 0),
      grossSales:   Number(r.grossSales ?? 0),
      guests:       Number(r.guests     ?? 0),
      orders:       Number(r.orders     ?? 0),
      discounts:    Number(r.discounts  ?? 0),
      voids:        Number(r.voids      ?? 0),
      refunds:      Number(r.refunds    ?? 0),
      laborCost:    Number(r.laborCost  ?? 0),
      laborHours:   Number(r.laborHours ?? 0),
      tips:         Number(r.tips       ?? 0),
      salesPerLH:   Number(r.salesPerLH ?? 0),
    }));

    const last30Formatted = toRows(last30ByStore).map(r => ({
      storeId:    Number(r.storeId    ?? 0),
      storeName:  String(r.storeName  ?? ''),
      netSales:   Number(r.netSales   ?? 0),
      grossSales: Number(r.grossSales ?? 0),
      guests:     Number(r.guests     ?? 0),
      orders:     Number(r.orders     ?? 0),
      discounts:  Number(r.discounts  ?? 0),
      voids:      Number(r.voids      ?? 0),
      laborCost:  Number(r.laborCost  ?? 0),
      tips:       Number(r.tips       ?? 0),
      daysActive: Number(r.daysActive ?? 0),
      salesPerLH: Number(r.salesPerLH ?? 0),
    }));

    const trendFormatted = toRows(dailyTrend30).map(r => ({
      businessDate: String(r.businessDate ?? '').slice(0, 10),
      storeId:      Number(r.storeId  ?? 0),
      netSales:     Number(r.netSales  ?? 0),
      guests:       Number(r.guests    ?? 0),
    }));

    return {
      lastBusinessDateStr,
      todayByStore,
      last30ByStore: last30Formatted,
      dailyTrend30: trendFormatted,
    };
  },
  ['stores-metrics-v2'],
  { revalidate: 300, tags: ['stores', 'dashboard'] }
);
