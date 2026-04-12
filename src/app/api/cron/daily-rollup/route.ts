import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vwDailySalesMetrics, hourlySalesMetrics, dailyConsolidatedMetrics } from '@/lib/db/schema';
import { sql, sum } from 'drizzle-orm';

// Esta ruta procesa el consolidado diario a las 4:00 AM.
// Puede demorar algunos segundos, por lo que deshabilitamos tiempos de respuesta dinámicos agresivos
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 1. Proteger la ruta usando el header inyectado automáticamente por Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
    return new NextResponse('No autorizado', { status: 401 });
  }

  try {
    // 2. Extraer y sumar ventas del día de AYER desde la vista original
    // Usamos '1 day' porque el cron corre en la madrugada del día siguiente
    const yesterdayMetrics = await db
      .select({
        storeId: vwDailySalesMetrics.storeId,
        businessDate: vwDailySalesMetrics.businessDate,
        netSales: sum(vwDailySalesMetrics.totalNetSales).mapWith(Number),
        grossSales: sum(vwDailySalesMetrics.totalGrossSales).mapWith(Number),
        guests: sum(vwDailySalesMetrics.totalGuests).mapWith(Number),
        orders: sum(vwDailySalesMetrics.totalOrders).mapWith(Number),
      })
      .from(vwDailySalesMetrics)
      .where(sql`${vwDailySalesMetrics.businessDate}::date = CURRENT_DATE - INTERVAL '1 day'`)
      .groupBy(vwDailySalesMetrics.storeId, vwDailySalesMetrics.businessDate);

    // Obtener también el Costo Laboral total por tienda del día de ayer
    const laborMetrics = await db
      .select({
        storeId: hourlySalesMetrics.storeId,
        laborCost: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalPay}), 0)`.mapWith(Number),
        laborHours: sql<number>`COALESCE(SUM(DISTINCT ${hourlySalesMetrics.hourlyJobTotalHours}), 0)`.mapWith(Number),
      })
      .from(hourlySalesMetrics)
      .where(sql`${hourlySalesMetrics.businessDate}::date = CURRENT_DATE - INTERVAL '1 day'`)
      .groupBy(hourlySalesMetrics.storeId);

    const laborMap = new Map(laborMetrics.map(l => [l.storeId, l]));

    // 3. Guardar en la nueva tabla (UPSERT: actualizar si ya existía para ese mismo día y tienda)
    let processed = 0;
    
    for (const row of yesterdayMetrics) {
        if (!row.storeId || !row.businessDate) continue;

        const labor = laborMap.get(row.storeId) || { laborCost: 0, laborHours: 0 };

        await db.insert(dailyConsolidatedMetrics)
          .values({
            storeId: row.storeId,
            businessDate: row.businessDate,
            netSales: row.netSales?.toString() || '0',
            grossSales: row.grossSales?.toString() || '0',
            guests: row.guests || 0,
            orders: row.orders || 0,
            laborCost: labor.laborCost.toString() || '0',
            laborHours: labor.laborHours.toString() || '0',
          })
          .onConflictDoUpdate({
            target: [dailyConsolidatedMetrics.storeId, dailyConsolidatedMetrics.businessDate],
            set: {
              netSales: row.netSales?.toString() || '0',
              grossSales: row.grossSales?.toString() || '0',
              guests: row.guests || 0,
              orders: row.orders || 0,
              laborCost: labor.laborCost.toString() || '0',
              laborHours: labor.laborHours.toString() || '0',
            }
          });
          
        processed++;
    }

    return NextResponse.json({ success: true, processedStores: processed, status: 'Completed Daily Rollup' });

  } catch (error) {
    console.error('Error en Daily Rollup:', error);
    return new NextResponse('Error interno procesando las métricas', { status: 500 });
  }
}
