import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getRestaurants } from '@/lib/toast/toast-analytics';

/**
 * GET /api/admin/sync-store-guids
 * ─────────────────────────────────────────────────────────────────────────────
 * Vincula los restaurantes de Toast con las sucursales de Aurora
 * rellenando la columna ExternalId (= restaurantGuid de Toast).
 *
 * ¿POR QUÉ ES NECESARIO?
 *   El cron toast-sync mapea GUID de Toast → storeId de Aurora usando ExternalId.
 *   Si ExternalId está vacío, ningun restaurante se procesa (status: sin_match).
 *
 * MODOS DE USO:
 *   GET /api/admin/sync-store-guids           → Solo muestra el mapeo propuesto (DRY RUN)
 *   GET /api/admin/sync-store-guids?apply=true → Guarda los GUIDs en la BD
 *
 * AUTENTICACIÓN:
 *   Requiere header: x-admin-token: <CRON_SECRET>
 *   (Mismo secreto del cron job de Vercel)
 *
 * ALGORITMO DE MATCHING:
 *   1. Exact match por nombre (normalizado, sin mayúsculas/tildes)
 *   2. Subset match: si el nombre de Aurora está contenido en el de Toast o viceversa
 *   3. Token match: coincidencia de palabras clave (mínimo 2 tokens en común)
 *   Los NO matcheados se reportan para que los puedas asignar manualmente.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Utilidades de normalización de nombre ─────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')                         // descompone tildes
    .replace(/[\u0300-\u036f]/g, '')          // elimina diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')            // solo letras, números, espacios
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(name: string): Set<string> {
  // Palabras irrelevantes que no aportan al match
  const STOP_WORDS = new Set(['cfs', 'coffee', 'cafe', 'the', 'de', 'la', 'el', 'los', 'las', 'store', 'location', '-']);
  return new Set(
    normalizeName(name)
      .split(' ')
      .filter(t => t.length > 1 && !STOP_WORDS.has(t))
  );
}

function scoreMatch(auroraName: string, toastName: string): number {
  const aNorm = normalizeName(auroraName);
  const tNorm = normalizeName(toastName);

  // 1. Exact match → score 100
  if (aNorm === tNorm) return 100;

  // 2. Subset match → score 80
  if (aNorm.includes(tNorm) || tNorm.includes(aNorm)) return 80;

  // 3. Token overlap → score proporcional a tokens compartidos
  const aTokens = tokenize(auroraName);
  const tTokens = tokenize(toastName);
  const intersection = [...aTokens].filter(t => tTokens.has(t));
  if (intersection.length >= 2) {
    const union = new Set([...aTokens, ...tTokens]);
    return Math.round((intersection.length / union.size) * 70);
  }

  return 0; // Sin match
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {

  // Autenticación con el mismo CRON_SECRET para no exponer un endpoint público
  const adminToken = request.headers.get('x-admin-token');
  const isDev      = process.env.NODE_ENV === 'development';

  if (!isDev && adminToken !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'No autorizado. Envía x-admin-token: <CRON_SECRET> en el header.' },
      { status: 401 }
    );
  }

  const url    = new URL(request.url);
  const apply  = url.searchParams.get('apply') === 'true';

  try {
    // 1. Traer restaurantes de Toast y tiendas de Aurora en paralelo
    const [toastRestaurants, auroraStores] = await Promise.all([
      getRestaurants(),
      db.select({
        id:         stores.id,
        name:       stores.name,
        externalId: stores.externalId,
        isActive:   stores.isActive,
      }).from(stores),
    ]);

    if (!toastRestaurants.length) {
      return NextResponse.json({
        success: false,
        message: '⚠️ Toast API no devolvió restaurantes activos. Verifica las credenciales.',
      });
    }

    // 2. Hacer el matching por nombre
    type MatchResult = {
      auroraId:       number;
      auroraName:     string;
      currentGuid:    string | null;
      proposedGuid:   string | null;
      toastName:      string | null;
      score:          number;
      action:         'already_set' | 'new_match' | 'low_confidence' | 'no_match';
      confidence:     'alta' | 'media' | 'baja' | 'sin_match';
    };

    const results: MatchResult[] = [];

    for (const store of auroraStores) {
      const storeName = store.name ?? '';

      // Si ya tiene GUID asignado, verificar si sigue siendo válido
      if (store.externalId) {
        const stillExists = toastRestaurants.find(r => r.restaurantGuid === store.externalId);
        results.push({
          auroraId:     store.id,
          auroraName:   storeName,
          currentGuid:  store.externalId,
          proposedGuid: store.externalId,
          toastName:    stillExists?.restaurantName ?? '⚠️ GUID no encontrado en Toast',
          score:        100,
          action:       'already_set',
          confidence:   'alta',
        });
        continue;
      }

      // Buscar el mejor match de Toast para esta tienda de Aurora
      let bestScore  = 0;
      let bestToast  = null as (typeof toastRestaurants[0]) | null;

      for (const tr of toastRestaurants) {
        const score = scoreMatch(storeName, tr.restaurantName);
        if (score > bestScore) {
          bestScore = score;
          bestToast = tr;
        }
      }

      if (bestScore >= 80) {
        results.push({
          auroraId:     store.id,
          auroraName:   storeName,
          currentGuid:  null,
          proposedGuid: bestToast!.restaurantGuid,
          toastName:    bestToast!.restaurantName,
          score:        bestScore,
          action:       'new_match',
          confidence:   'alta',
        });
      } else if (bestScore >= 40) {
        results.push({
          auroraId:     store.id,
          auroraName:   storeName,
          currentGuid:  null,
          proposedGuid: bestToast?.restaurantGuid ?? null,
          toastName:    bestToast?.restaurantName ?? null,
          score:        bestScore,
          action:       'low_confidence',
          confidence:   'baja',
        });
      } else {
        results.push({
          auroraId:     store.id,
          auroraName:   storeName,
          currentGuid:  null,
          proposedGuid: null,
          toastName:    null,
          score:        0,
          action:       'no_match',
          confidence:   'sin_match',
        });
      }
    }

    // 3. Si apply=true, guardar los matches de alta confianza
    const applied: { storeId: number; storeName: string; guid: string }[] = [];
    const skipped: { storeId: number; storeName: string; reason: string }[] = [];

    if (apply) {
      for (const result of results) {
        if (result.action === 'already_set') {
          skipped.push({ storeId: result.auroraId, storeName: result.auroraName, reason: 'Ya tenía GUID asignado' });
          continue;
        }
        if (result.action === 'new_match' && result.proposedGuid) {
          await db
            .update(stores)
            .set({ externalId: result.proposedGuid })
            .where(eq(stores.id, result.auroraId));
          applied.push({ storeId: result.auroraId, storeName: result.auroraName, guid: result.proposedGuid });
        } else {
          skipped.push({
            storeId:   result.auroraId,
            storeName: result.auroraName,
            reason:    result.action === 'no_match'
              ? 'Sin match en Toast — asignar manualmente'
              : `Confianza baja (score ${result.score}) — revisar manualmente`,
          });
        }
      }
    }

    // 4. Respuesta clara y legible
    const toMatch   = results.filter(r => r.action === 'new_match');
    const lowConf   = results.filter(r => r.action === 'low_confidence');
    const noMatch   = results.filter(r => r.action === 'no_match');
    const alreadyOk = results.filter(r => r.action === 'already_set');

    return NextResponse.json({
      success: true,
      mode:    apply ? '✅ APLICADO — GUIDs guardados en Aurora' : '🔍 DRY RUN — Sin cambios. Agrega ?apply=true para guardar.',

      summary: {
        toastRestaurants:  toastRestaurants.length,
        auroraStores:      auroraStores.length,
        yaAsignados:       alreadyOk.length,
        matchAlta:         toMatch.length,
        matchBaja:         lowConf.length,
        sinMatch:          noMatch.length,
        ...(apply ? { aplicados: applied.length, saltados: skipped.length } : {}),
      },

      // Matches de alta confianza → se aplicarán (o ya se aplicaron)
      matches_alta_confianza: toMatch.map(r => ({
        aurora:   `[${r.auroraId}] ${r.auroraName}`,
        toast:    r.toastName,
        guid:     r.proposedGuid,
        score:    `${r.score}%`,
        estado:   apply ? '✅ GUARDADO' : '⏳ Pendiente (usa ?apply=true)',
      })),

      // Matches dudosos → requieren revisión manual
      matches_baja_confianza: lowConf.map(r => ({
        aurora:  `[${r.auroraId}] ${r.auroraName}`,
        toast:   r.toastName,
        guid:    r.proposedGuid,
        score:   `${r.score}%`,
        estado:  '⚠️ Revisar manualmente — NO se aplica automáticamente',
      })),

      // Sin match → necesitan asignación manual
      sin_match: noMatch.map(r => ({
        aurora:  `[${r.auroraId}] ${r.auroraName}`,
        estado:  '❌ Sin equivalente en Toast',
        accion:  'Actualiza ExternalId manualmente con el GUID correcto de Toast',
      })),

      // Ya tenían GUID
      ya_asignados: alreadyOk.map(r => ({
        aurora: `[${r.auroraId}] ${r.auroraName}`,
        guid:   r.currentGuid,
        toast:  r.toastName,
      })),

      // Catálogo completo de restaurantes Toast (para asignación manual si es necesario)
      toast_restaurants_disponibles: toastRestaurants.map(r => ({
        nombre: r.restaurantName,
        guid:   r.restaurantGuid,
      })),

      next_steps: apply
        ? [
            '1. Revisa los matches de baja confianza y asígnalos manualmente si aplica',
            '2. Para asignar manualmente: UPDATE "Stores" SET "ExternalId" = \'<guid>\' WHERE "Id" = <id>',
            '3. Ejecuta el cron: GET /api/cron/toast-sync para probar la sincronización',
          ]
        : [
            '1. Revisa los matches propuestos arriba',
            '2. Si se ven correctos → GET /api/admin/sync-store-guids?apply=true',
            '3. Para los de baja confianza, asigna el GUID manualmente en Aurora',
          ],
    });

  } catch (error) {
    console.error('[sync-store-guids] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error:   String(error),
        message: '❌ Error al sincronizar GUIDs. Revisa las credenciales de Toast y la conexión a Aurora.',
      },
      { status: 500 }
    );
  }
}
