/**
 * Toast Analytics API — Funciones de negocio (v2 — endpoints corregidos)
 *
 * CORRECCIONES vs v1:
 *  - getRestaurants(): endpoint correcto → /era/v1/restaurants-information
 *    La respuesta es un array directo de objetos (NO { restaurants: [] })
 *    Filtra automáticamente restaurantes archived o en testMode
 *  - getSalesSummary(): endpoint correcto → POST /era/v1/metrics/day
 *    Formato de fecha: YYYYMMDD (SIN guiones), no YYYY-MM-DD
 *    Polling: GET /era/v1/metrics/{reportRequestGuid} (responde array directo)
 *    Campos reales de la respuesta: netSalesAmount, grossSalesAmount, etc.
 *    BONUS: agregamos todos los restaurantes en UNA sola llamada (management-group-wide)
 *  - getLaborData(): endpoint correcto → POST /era/v1/labor/day
 *    Polling: GET /era/v1/labor/{reportRequestGuid}
 *    Campos reales: regularHours, overtimeHours, wages, etc.
 *
 * Docs:
 *  https://doc.toasttab.com/doc/devguide/apiAnalyticsRestaurantInfoGetRestaurantList.html
 *  https://doc.toasttab.com/doc/devguide/apiAnalyticsMetricsReportingDataCreateRequest.html
 *  https://doc.toasttab.com/doc/devguide/apiAnalyticsLaborReportingDataCreateRequest.html
 */

import { toastFetch, getToastToken } from './toast-client';
import { env } from '@/lib/env';

const BASE = env.toast.analyticsBase; // /era/v1

// ── Utility: Convert YYYY-MM-DD → YYYYMMDD ───────────────────────────────────
function toastDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToastRestaurantInfo {
  restaurantGuid: string;
  restaurantName: string;
  active:         boolean;
  testMode:       boolean;
  archived:       boolean;
}

/** Datos de ventas agregadas por restaurante por día (desde la API real de Toast) */
export interface ToastSalesRecord {
  restaurantGuid:    string;
  businessDate:      string; // YYYYMMDD — tal como llega de Toast
  guestCount:        number;
  ordersCount:       number;
  openOrdersCount:   number;
  closedOrdersCount: number;
  netSalesAmount:    number;
  grossSalesAmount:  number;
  discountAmount:    number;
  voidOrdersAmount:  number;
  voidOrdersCount:   number;
  refundAmount:      number;
  avgOrderValue:     number;
  discountOrderCount: number;
  // ✅ Toast también incluye labor en las métricas de ventas (campo bonus)
  hourlyJobTotalHours:         number | null;
  hourlyJobTotalPay:           number | null;
  hourlyJobSalesPerLaborHour:  number | null;
}

/** Datos de labor agregados por restaurante por día */
export interface ToastLaborRecord {
  restaurantGuid:  string;
  businessDate:    string; // YYYYMMDD
  regularHours:    number;
  overtimeHours:   number;
  totalHours:      number;
  regularCost:     number; // Campo real de Toast: regularCost (NO regularWages)
  overtimeCost:    number; // Campo real de Toast: overtimeCost (NO overtimeWages)
  totalCost:       number; // Campo real de Toast: totalCost (NO totalWages)
}

// ── Polling helper ────────────────────────────────────────────────────────────

/**
 * Polling genérico para la Analytics API de Toast.
 *
 * Flujo REAL de la API (verificado 2026-05-27):
 *  POST /era/v1/{resource}/{timeRange}  → 200 OK + "reportRequestGuid" (string JSON)
 *  GET  /era/v1/{pollPath}/{guid}       → 200 (body = string/objeto = pendiente)
 *                                        → 200 (body = array = datos listos ✅)
 *
 * Importante: No pasa Toast-Restaurant-External-ID porque estas llamadas son
 * a nivel management-group (sin contexto de restaurante individual).
 */
async function pollAnalyticsJob<T>(
  reportRequestGuid: string,
  pollBasePath: string  // ej: '/era/v1/metrics' o '/era/v1/labor'
): Promise<T> {
  const maxAttempts = env.toast.maxPollingAttempts;
  const intervalMs  = env.toast.pollingIntervalMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    const token = await getToastToken();
    const url   = `${env.toast.apiHostname}${pollBasePath}/${reportRequestGuid}`;

    let rawResponse: Response;
    try {
      rawResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        cache: 'no-store',
      });
    } catch (err) {
      console.warn(`[Toast] Polling ${pollBasePath} — intento ${attempt}/${maxAttempts} — error de red:`, err);
      continue;
    }

    if (rawResponse.status === 200) {
      // HTTP 200 = puede ser "listo" (body es array con datos) o "pendiente" (body vacío/objeto)
      // Toast devuelve 200 tanto cuando el job está procesando como cuando terminó.
      // La diferencia es que cuando está listo el body ES el array de datos directamente.
      let body: unknown;
      try {
        body = await rawResponse.json();
      } catch {
        // Body no es JSON válido = aún procesando
        console.log(`[Toast] Job ${reportRequestGuid} procesando... (intento ${attempt}/${maxAttempts})`);
        continue;
      }

      if (Array.isArray(body)) {
        // ✅ Array = datos listos
        return body as T;
      }

      // Si es string (GUID) o objeto, aún está procesando
      console.log(`[Toast] Job ${reportRequestGuid} pendiente... (intento ${attempt}/${maxAttempts})`);
      continue;
    }

    // Cualquier otro código (4xx, 5xx) es un error real
    const errorBody = await rawResponse.text();
    throw new Error(
      `[Toast] Error en polling [${rawResponse.status}] ${pollBasePath}/${reportRequestGuid}: ${errorBody}`
    );
  }

  throw new Error(
    `[Toast] Job ${reportRequestGuid} no completó tras ${maxAttempts} intentos ` +
    `(${((maxAttempts * intervalMs) / 1000).toFixed(0)}s timeout)`
  );
}

// ── Public API functions ──────────────────────────────────────────────────────

/**
 * Obtiene todos los restaurantes del management group.
 * Endpoint: GET /era/v1/restaurants-information
 *
 * Retorna solo restaurantes activos, no en testMode y no archivados.
 */
export async function getRestaurants(): Promise<ToastRestaurantInfo[]> {
  // La respuesta es un array directo, NO { restaurants: [] }
  const data = await toastFetch<ToastRestaurantInfo[]>(`${BASE}/restaurants-information`);

  if (!Array.isArray(data)) {
    console.warn('[Toast] getRestaurants: respuesta inesperada (no es array):', JSON.stringify(data));
    return [];
  }

  // Filtrar solo restaurantes productivos activos
  const active = data.filter(r => r.active && !r.testMode && !r.archived);
  console.log(`[Toast] getRestaurants: ${data.length} total, ${active.length} activos/productivos`);
  return active;
}

/**
 * Obtiene ventas agregadas para TODOS los restaurantes del management group en una sola llamada.
 * Endpoint: POST /era/v1/metrics/day → polling GET /era/v1/metrics/{guid}
 *
 * NOTA: Es mucho más eficiente hacer UNA llamada para todos los restaurantes
 * que N llamadas individuales por restaurante.
 *
 * @param businessDate  Fecha en formato ISO YYYY-MM-DD
 * @returns Array de ToastSalesRecord, uno por restaurante (los sin datos se omiten)
 */
export async function getSalesForAllRestaurants(
  businessDate: string
): Promise<ToastSalesRecord[]> {
  const toastDateStr = toastDate(businessDate); // "20240526"

  // Step 1: Crear el job async
  // restaurantIds: [] = incluir TODOS los restaurantes del management group
  const reportRequestGuid = await toastFetch<string>(
    `${BASE}/metrics/day`,
    {
      method: 'POST',
      body: JSON.stringify({
        startBusinessDate:     toastDateStr,
        restaurantIds:         [],   // vacío = todos los restaurantes
        excludedRestaurantIds: [],
      }),
    }
    // Sin restaurantGuid → llamada a nivel de management group
  );

  if (!reportRequestGuid || typeof reportRequestGuid !== 'string') {
    console.warn('[Toast] getSalesForAllRestaurants: no se recibió reportRequestGuid');
    return [];
  }

  // Step 2: Polling hasta obtener el resultado
  // La respuesta es un array directo de objetos de venta
  const records = await pollAnalyticsJob<ToastSalesRecord[]>(reportRequestGuid, `${BASE}/metrics`);

  if (!Array.isArray(records)) {
    console.warn('[Toast] getSalesForAllRestaurants: resultado inesperado:', JSON.stringify(records).substring(0, 200));
    return [];
  }

  // Agregar por restaurante (puede haber múltiples filas por restaurante si hay revenue centers)
  const byRestaurant = new Map<string, ToastSalesRecord>();

  for (const row of records) {
    const existing = byRestaurant.get(row.restaurantGuid);
    if (!existing) {
      byRestaurant.set(row.restaurantGuid, { ...row });
    } else {
      // Si hay múltiples revenue centers, sumamos los totales
      existing.netSalesAmount    += row.netSalesAmount    ?? 0;
      existing.grossSalesAmount  += row.grossSalesAmount  ?? 0;
      existing.discountAmount    += row.discountAmount    ?? 0;
      existing.voidOrdersAmount  += row.voidOrdersAmount  ?? 0;
      existing.refundAmount      += row.refundAmount      ?? 0;
      existing.guestCount        += row.guestCount        ?? 0;
      existing.ordersCount       += row.ordersCount       ?? 0;
      existing.voidOrdersCount   += row.voidOrdersCount   ?? 0;
      existing.discountOrderCount += row.discountOrderCount ?? 0;
      // avgOrderValue se recalcula al final
      existing.avgOrderValue = existing.ordersCount > 0
        ? existing.netSalesAmount / existing.ordersCount
        : 0;
    }
  }

  return Array.from(byRestaurant.values());
}

/**
 * Obtiene datos de labor para TODOS los restaurantes del management group en una sola llamada.
 * Endpoint: POST /era/v1/labor/day → polling GET /era/v1/labor/{guid}
 *
 * @param businessDate  Fecha en formato ISO YYYY-MM-DD
 * @returns Array de ToastLaborRecord, uno por restaurante
 */
export async function getLaborForAllRestaurants(
  businessDate: string
): Promise<ToastLaborRecord[]> {
  const toastDateStr = toastDate(businessDate);

  // Step 1: Crear el job
  const reportRequestGuid = await toastFetch<string>(
    `${BASE}/labor/day`,
    {
      method: 'POST',
      body: JSON.stringify({
        startBusinessDate:     toastDateStr,
        endBusinessDate:       toastDateStr,
        restaurantIds:         [],   // todos los restaurantes
        excludedRestaurantIds: [],
      }),
    }
  );

  if (!reportRequestGuid || typeof reportRequestGuid !== 'string') {
    console.warn('[Toast] getLaborForAllRestaurants: no se recibió reportRequestGuid');
    return [];
  }

  // Step 2: Polling
  const records = await pollAnalyticsJob<ToastLaborRecord[]>(reportRequestGuid, `${BASE}/labor`);

  if (!Array.isArray(records)) {
    console.warn('[Toast] getLaborForAllRestaurants: resultado inesperado');
    return [];
  }

  // Agregar por restaurante (puede haber múltiples filas por job/role)
  const byRestaurant = new Map<string, ToastLaborRecord>();

  for (const row of records) {
    const existing = byRestaurant.get(row.restaurantGuid);
    if (!existing) {
      byRestaurant.set(row.restaurantGuid, {
        restaurantGuid: row.restaurantGuid,
        businessDate:   row.businessDate,
        regularHours:   Number(row.regularHours  ?? 0),
        overtimeHours:  Number(row.overtimeHours ?? 0),
        totalHours:     Number(row.totalHours    ?? 0),
        regularCost:    Number(row.regularCost   ?? 0), // campo real de Toast
        overtimeCost:   Number(row.overtimeCost  ?? 0), // campo real de Toast
        totalCost:      Number(row.totalCost     ?? 0), // campo real de Toast
      });
    } else {
      existing.regularHours  += Number(row.regularHours  ?? 0);
      existing.overtimeHours += Number(row.overtimeHours ?? 0);
      existing.totalHours    += Number(row.totalHours    ?? 0);
      existing.regularCost   += Number(row.regularCost   ?? 0);
      existing.overtimeCost  += Number(row.overtimeCost  ?? 0);
      existing.totalCost     += Number(row.totalCost     ?? 0);
    }
  }

  return Array.from(byRestaurant.values());
}

// ── Funciones de compatibilidad (por restaurante individual) ─────────────────
// Mantenidas por si se necesitan llamadas individuales en el futuro

/** @deprecated Usa getSalesForAllRestaurants() para mejor eficiencia de rate limits */
export async function getSalesSummary(
  restaurantGuid: string,
  businessDate:   string
): Promise<ToastSalesRecord | null> {
  const all = await getSalesForAllRestaurants(businessDate);
  return all.find(r => r.restaurantGuid === restaurantGuid) ?? null;
}

/** @deprecated Usa getLaborForAllRestaurants() para mejor eficiencia de rate limits */
export async function getLaborShifts(
  restaurantGuid: string,
  businessDate:   string
): Promise<{ totalHours: number; totalPay: number }> {
  const all = await getLaborForAllRestaurants(businessDate);
  const record = all.find(r => r.restaurantGuid === restaurantGuid);
  return {
    totalHours: record?.totalHours ?? 0,
    totalPay:   record?.totalCost  ?? 0, // campo real: totalCost
  };
}
