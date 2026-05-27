import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, dailyConsolidatedMetrics } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';


import { revalidatePath } from 'next/cache';
import {
  getRestaurants,
  getSalesForAllRestaurants,
  getLaborForAllRestaurants,
} from '@/lib/toast/toast-analytics';

/**
 * GET /api/cron/toast-sync
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincronización en tiempo real con Toast Analytics API.
 * Se ejecuta automáticamente cada 2 horas (configurado en vercel.json).
 *
 * QUÉ HACE:
 *  1. Llama a Toast API para obtener ventas y labor del día de HOY
 *  2. Guarda los datos en DailyConsolidatedMetrics (tabla de rollup diario)
 *  3. También actualiza HourlySalesMetrics con un registro "resumen del día"
 *     para que los gráficos del dashboard (que leen esa tabla) tengan datos frescos
 *  4. Invalida el caché de Next.js → el dashboard muestra datos actualizados
 *
 * CÓMO REVISAR SI FUNCIONÓ:
 *  - En desarrollo: GET http://localhost:3000/api/cron/toast-sync
 *  - En producción: Vercel Logs → Functions → /api/cron/toast-sync
 *  - Respuesta JSON explica qué hizo cada sucursal
 *
 * Schedule: cada 2 horas  (vercel.json: "0 *\/2 * * *")
 */

export const maxDuration = 300; // 5 minutos máximo (Vercel Pro)
export const dynamic     = 'force-dynamic';

// ── Tipos internos ────────────────────────────────────────────────────────────

type SyncResult = {
  storeId:       number;
  storeName:     string;
  restaurantGuid: string;
  status:        'ok' | 'sin_datos' | 'sin_match' | 'error';
  netSales?:     number;
  grossSales?:   number;
  guests?:       number;
  orders?:       number;
  laborHours?:   number;
  laborCost?:    number;
  error?:        string;
};

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(request: Request) {

  // 1. Seguridad: solo Vercel Cron o llamadas de desarrollo pueden ejecutar esto
  const authHeader = request.headers.get('authorization');
  const isDev      = process.env.NODE_ENV === 'development';

  if (!isDev && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('No autorizado', { status: 401 });
  }

  // 2. Fecha de hoy en Eastern Time (donde operan los restaurantes CFS Coffee)
  //    Usando UTC se obtiene la fecha incorrecta después de las 8PM ET (= mañana en UTC)
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(new Date()); // formato YYYY-MM-DD

  const storeResults: SyncResult[] = [];
  let totalProcessed = 0;
  let totalErrors    = 0;

  try {
    // ── PASO 1: Obtener lista de restaurantes Y datos de hoy en paralelo ────────
    //    Las llamadas de métricas son management-group-wide (restaurantIds: [])
    //    por lo que NO necesitamos los GUIDs antes de lanzarlas.
    //    getRestaurants() solo se necesita para el mapeo GUID → storeId.
    const [toastRestaurants, salesRecords, laborRecords] = await Promise.all([
      getRestaurants(),
      getSalesForAllRestaurants(today),
      getLaborForAllRestaurants(today),
    ]);

    if (!toastRestaurants.length) {
      return NextResponse.json({
        success:  true,
        date:     today,
        message:  '✅ Toast API conectada, pero no devolvió restaurantes activos.',
        results:  [],
        summary:  { processed: 0, errors: 0, total: 0 },
      });
    }

    // ── PASO 2: Cargar sucursales de Aurora → mapear restaurantGuid → storeId ─
    const dbStores = await db
      .select({
        id:         stores.id,
        externalId: stores.externalId,
        name:       stores.name,
      })
      .from(stores)
      .where(eq(stores.isActive, true));

    // Mapa: Toast GUID → { id, name }
    const guidToStore = new Map<string, { id: number; name: string }>(
      dbStores
        .filter(s => s.externalId)
        .map(s => [s.externalId!, { id: s.id, name: s.name ?? 'Sucursal desconocida' }])
    );

    // Mapa rápido de ventas y labor por restaurantGuid
    const salesByGuid = new Map(salesRecords.map(r => [r.restaurantGuid, r]));
    const laborByGuid = new Map(laborRecords.map(r => [r.restaurantGuid, r]));

    // ── PASO 3: Procesar cada restaurante ─────────────────────────────────────
    for (const restaurant of toastRestaurants) {
      const { restaurantGuid, restaurantName } = restaurant;

      const store = guidToStore.get(restaurantGuid);
      if (!store) {
        // Este restaurante de Toast no está en la BD de Aurora aún
        storeResults.push({
          storeId:        0,
          storeName:      restaurantName,
          restaurantGuid,
          status:         'sin_match',
          error:          `"${restaurantName}" no tiene ExternalId en la tabla Stores de Aurora.`,
        });
        continue;
      }

      const sales = salesByGuid.get(restaurantGuid);
      const labor = laborByGuid.get(restaurantGuid);

      if (!sales) {
        // Toast no tiene ventas todavía para este restaurante hoy (puede ser normal de madrugada)
        storeResults.push({
          storeId:        store.id,
          storeName:      store.name,
          restaurantGuid,
          status:         'sin_datos',
          error:          'Sin ventas reportadas aún para hoy.',
        });
        continue;
      }

      try {
        // ── 3a. UPSERT en DailyConsolidatedMetrics ─────────────────────────────
        //    Fuente principal del dashboard. Todos los campos que Toast nos da.
        //    Labor viene directo de las métricas de ventas (campos bonus de Toast).
        const laborHours = sales.hourlyJobTotalHours ?? labor?.totalHours ?? 0;
        const laborCost  = sales.hourlyJobTotalPay   ?? labor?.totalCost  ?? 0;
        const spLH       = laborHours > 0
          ? sales.netSalesAmount / laborHours
          : (sales.hourlyJobSalesPerLaborHour ?? 0);

        const upsertValues = {
          storeId:           store.id,
          businessDate:      today,
          netSales:          sales.netSalesAmount.toFixed(4),
          grossSales:        sales.grossSalesAmount.toFixed(4),
          discounts:         sales.discountAmount.toFixed(4),
          voids:             sales.voidOrdersAmount.toFixed(4),
          refunds:           sales.refundAmount.toFixed(4),
          avgOrderValue:     sales.avgOrderValue.toFixed(4),
          guests:            sales.guestCount,
          orders:            sales.ordersCount,
          openOrders:        sales.openOrdersCount,
          closedOrders:      sales.closedOrdersCount,
          voidCount:         sales.voidOrdersCount,
          discountCount:     sales.discountOrderCount,
          laborCost:         laborCost.toFixed(4),
          laborHours:        laborHours.toFixed(4),
          salesPerLaborHour: spLH.toFixed(4),
        };

        await db
          .insert(dailyConsolidatedMetrics)
          .values(upsertValues)
          .onConflictDoUpdate({
            target: [dailyConsolidatedMetrics.storeId, dailyConsolidatedMetrics.businessDate],
            set: upsertValues,
          });

        // ── 3b. NO escribimos en HourlySalesMetrics con businessHour=-1
        //    Motivo: el dashboard hace GROUP BY businessHour para las gráficas horarias
        //    y un registro con hora=-1 contaminaría los totales y las curvas horarias.
        //    DailyConsolidatedMetrics es la tabla correcta para el rollup diario de Toast.

        storeResults.push({
          storeId:        store.id,
          storeName:      store.name,
          restaurantGuid,
          status:         'ok',
          netSales:       sales.netSalesAmount,
          grossSales:     sales.grossSalesAmount,
          guests:         sales.guestCount,
          orders:         sales.ordersCount,
          laborHours,
          laborCost,
        });

        totalProcessed++;

      } catch (storeErr) {
        const errMsg = String(storeErr);
        console.error(`[toast-sync] ❌ Error en "${store.name}":`, storeErr);
        storeResults.push({
          storeId:        store.id,
          storeName:      store.name,
          restaurantGuid,
          status:         'error',
          error:          errMsg,
        });
        totalErrors++;
      }
    }

    // ── PASO 4: Invalidar caché de Next.js ────────────────────────────────────
    //    Fuerza que la próxima visita al dashboard re-ejecute las queries
    //    y muestre los datos frescos que acabamos de guardar de Toast.
    try {
      const paths = ['/', '/ventas', '/sucursales', '/inventario', '/clientes', '/productos'];
      for (const path of paths) revalidatePath(path);
      console.log('[toast-sync] ✅ Caché invalidado para todas las rutas del dashboard');
    } catch (cacheErr) {
      console.warn('[toast-sync] ⚠️ No se pudo invalidar caché:', cacheErr);
    }

    // ── PASO 5: Respuesta final amigable ──────────────────────────────────────
    const okResults    = storeResults.filter(r => r.status === 'ok');
    const errorResults = storeResults.filter(r => r.status === 'error');
    const skipResults  = storeResults.filter(r => r.status === 'sin_datos' || r.status === 'sin_match');

    return NextResponse.json({
      success:   totalErrors === 0,
      date:      today,
      timestamp: new Date().toISOString(),

      // Resumen ejecutivo — lo más importante de un vistazo
      summary: {
        total:     toastRestaurants.length,
        processed: totalProcessed,
        skipped:   skipResults.length,
        errors:    totalErrors,
      },

      // KPIs consolidados de la sincronización
      totals: {
        netSales:   okResults.reduce((a, r) => a + (r.netSales  ?? 0), 0),
        grossSales: okResults.reduce((a, r) => a + (r.grossSales ?? 0), 0),
        guests:     okResults.reduce((a, r) => a + (r.guests    ?? 0), 0),
        orders:     okResults.reduce((a, r) => a + (r.orders    ?? 0), 0),
        laborHours: okResults.reduce((a, r) => a + (r.laborHours ?? 0), 0),
        laborCost:  okResults.reduce((a, r) => a + (r.laborCost  ?? 0), 0),
      },

      // Detalle por sucursal
      stores: storeResults.map(r => ({
        ...r,
        // Formato legible de los montos
        netSales:   r.netSales   != null ? `$${r.netSales.toFixed(2)}`   : undefined,
        grossSales: r.grossSales != null ? `$${r.grossSales.toFixed(2)}` : undefined,
        laborCost:  r.laborCost  != null ? `$${r.laborCost.toFixed(2)}`  : undefined,
        laborHours: r.laborHours != null ? `${r.laborHours.toFixed(1)}h` : undefined,
      })),

      // Errores para diagnóstico rápido
      errors: errorResults.length > 0 ? errorResults.map(r => ({
        store: r.storeName,
        error: r.error,
      })) : undefined,

      message: totalErrors === 0
        ? `✅ Sincronización completa. ${totalProcessed} sucursal(es) actualizadas con datos de hoy (${today}).`
        : `⚠️ Sincronización con ${totalErrors} error(es). ${totalProcessed} sucursal(es) OK.`,
    });

  } catch (error) {
    console.error('[toast-sync] ❌ Error inesperado:', error);
    return NextResponse.json(
      {
        success:   false,
        date:      today,
        timestamp: new Date().toISOString(),
        message:   '❌ Error crítico en la sincronización con Toast',
        error:     String(error),
        stores:    storeResults,
        summary:   { total: 0, processed: 0, skipped: 0, errors: 1 },
      },
      { status: 500 }
    );
  }
}
