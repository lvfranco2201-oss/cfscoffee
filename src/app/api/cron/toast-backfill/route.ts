import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, dailyConsolidatedMetrics, dailyConsolidatedMetricsRealtime } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { getSalesForAllRestaurants, getLaborForAllRestaurants, getRestaurants } from '@/lib/toast/toast-analytics';

/**
 * GET /api/cron/toast-backfill?days=7
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincroniza los últimos N días desde Toast hacia DailyConsolidatedMetrics.
 * Útil para:
 *  - Recuperar días en que el GitHub Action falló
 *  - Poblar la BD por primera vez
 *  - Verificar consistencia de datos históricos
 *
 * PARÁMETROS:
 *  ?days=N     → Número de días a sincronizar hacia atrás (default: 7, max: 30)
 *  ?date=YYYY-MM-DD → Sincronizar solo una fecha específica
 *
 * AUTENTICACIÓN:
 *  Mismo CRON_SECRET del toast-sync
 *
 * LÍMITE:
 *  Máximo 30 días (Toast Analytics tiene límites de rate)
 *  El proceso tarda ~3-5 segundos por día (tiempo de polling de Toast)
 */

export const maxDuration = 300;
export const dynamic     = 'force-dynamic';

function getDateET(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const isDev      = process.env.NODE_ENV === 'development';

  if (!isDev && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('No autorizado', { status: 401 });
  }

  const url         = new URL(request.url);
  const specificDate = url.searchParams.get('date');
  const daysParam    = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '7'), 1), 30);

  // Construir lista de fechas a sincronizar
  const datesToSync: string[] = specificDate
    ? [specificDate]
    : Array.from({ length: daysParam }, (_, i) => getDateET(i)).reverse(); // del más antiguo al más reciente

  console.log(`[toast-backfill] Fechas a sincronizar: ${datesToSync.join(', ')}`);

  const results: {
    date: string;
    status: 'ok' | 'sin_datos' | 'error';
    storesUpdated: number;
    netSales?: number;
    error?: string;
  }[] = [];

  try {
    // Cargar datos base (restaurantes + mapa GUID → storeId) — solo una vez
    const [toastRestaurants, dbStores] = await Promise.all([
      getRestaurants(),
      db.select({ id: stores.id, externalId: stores.externalId, name: stores.name })
        .from(stores)
        .where(sql`${stores.isActive} IS NOT FALSE`),
    ]);

    const guidToStore = new Map<string, { id: number; name: string }>(
      dbStores
        .filter(s => s.externalId)
        .map(s => [s.externalId!, { id: s.id, name: s.name ?? 'Desconocida' }])
    );

    // Procesar cada fecha secuencialmente (evitar rate limits de Toast)
    for (const date of datesToSync) {
      console.log(`[toast-backfill] Procesando ${date}...`);

      try {
        const [salesRecords, laborRecords] = await Promise.all([
          getSalesForAllRestaurants(date),
          getLaborForAllRestaurants(date),
        ]);

        if (!salesRecords.length) {
          results.push({ date, status: 'sin_datos', storesUpdated: 0 });
          continue;
        }

        const salesByGuid = new Map(salesRecords.map(r => [r.restaurantGuid, r]));
        const laborByGuid = new Map(laborRecords.map(r => [r.restaurantGuid, r]));

        let storesUpdated = 0;
        let totalNetSales = 0;

        for (const restaurant of toastRestaurants) {
          const store = guidToStore.get(restaurant.restaurantGuid);
          if (!store) continue;

          const sales = salesByGuid.get(restaurant.restaurantGuid);
          const labor = laborByGuid.get(restaurant.restaurantGuid);
          if (!sales) continue;

          const laborCost  = labor?.totalCost  ?? 0;
          const laborHours = labor?.totalHours ?? 0;

          await db
            .insert(dailyConsolidatedMetricsRealtime)
            .values({
              storeId:      store.id,
              businessDate: date,
              netSales:     sales.netSalesAmount.toFixed(4),
              grossSales:   sales.grossSalesAmount.toFixed(4),
              guests:       sales.guestCount,
              orders:       sales.ordersCount,
              laborCost:    laborCost.toFixed(4),
              laborHours:   laborHours.toFixed(4),
            })
            .onConflictDoUpdate({
              target: [dailyConsolidatedMetricsRealtime.storeId, dailyConsolidatedMetricsRealtime.businessDate],
              set: {
                netSales:   sales.netSalesAmount.toFixed(4),
                grossSales: sales.grossSalesAmount.toFixed(4),
                guests:     sales.guestCount,
                orders:     sales.ordersCount,
                laborCost:  laborCost.toFixed(4),
                laborHours: laborHours.toFixed(4),
              },
            });

          storesUpdated++;
          totalNetSales += sales.netSalesAmount;
        }

        results.push({ date, status: 'ok', storesUpdated, netSales: totalNetSales });

      } catch (dateErr) {
        console.error(`[toast-backfill] Error en ${date}:`, dateErr);
        results.push({ date, status: 'error', storesUpdated: 0, error: String(dateErr) });
      }
    }

    const ok      = results.filter(r => r.status === 'ok');
    const errors  = results.filter(r => r.status === 'error');
    const noData  = results.filter(r => r.status === 'sin_datos');

    return NextResponse.json({
      success:   errors.length === 0,
      dates:     datesToSync,
      summary: {
        total:      datesToSync.length,
        synced:     ok.length,
        noData:     noData.length,
        errors:     errors.length,
        totalNetSales: ok.reduce((a, r) => a + (r.netSales ?? 0), 0),
      },
      results: results.map(r => ({
        ...r,
        netSales: r.netSales != null ? `$${r.netSales.toFixed(2)}` : undefined,
      })),
      message: errors.length === 0
        ? `✅ Backfill completado. ${ok.length}/${datesToSync.length} días sincronizados.`
        : `⚠️ Backfill con ${errors.length} error(es). ${ok.length} días OK.`,
    });

  } catch (err) {
    console.error('[toast-backfill] Error crítico:', err);
    return NextResponse.json({
      success: false,
      error:   String(err),
      message: '❌ Error crítico en el backfill',
    }, { status: 500 });
  }
}
