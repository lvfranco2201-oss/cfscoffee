/**
 * sync-store-guids.mjs
 * Vincula los restaurantes de Toast con las sucursales de Aurora (ExternalId).
 * Ejecutar con: node scripts/sync-store-guids.mjs
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Aurora desde Windows: evita error de CA local

import pg from 'pg';

const { Client } = pg;

// ── Credenciales ──────────────────────────────────────────────────────────────
const DB_URL      = 'postgres://toastadmin:CfsC0ffee%23Pgr3s2026%21@toast-integration-prod-auroracluster-qaabdb1h9myw.cluster-caleie4cs1mx.us-east-1.rds.amazonaws.com:5432/ToastAnalytics?sslmode=require';
const TOAST_HOST  = 'https://ws-api.toasttab.com';
const CLIENT_ID   = 'HrXkKC1RvZnT99ikBZhTsycDq1D8Rgdn';
const CLIENT_SECRET = 'dRHdbn-vvt4EQ5R-uyIWSG_Y2hCNfPhrl-0UHhvruF2D2TIzsNRek84pGtyOOIbS';

// ── Toast Auth ────────────────────────────────────────────────────────────────
async function getToastToken() {
  const res = await fetch(`${TOAST_HOST}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId:       CLIENT_ID,
      clientSecret:   CLIENT_SECRET,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.status !== 'SUCCESS') throw new Error(`Auth error: ${JSON.stringify(data)}`);
  console.log(`✅ Token de Toast obtenido (expira en ${Math.round(data.token.expiresIn / 60)} min)`);
  return data.token.accessToken;
}

// ── Toast Restaurants ─────────────────────────────────────────────────────────
async function getToastRestaurants(token) {
  const res = await fetch(`${TOAST_HOST}/era/v1/restaurants-information`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Restaurants failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Respuesta inesperada: ${JSON.stringify(data).substring(0, 200)}`);
  return data.filter(r => r.active && !r.testMode && !r.archived);
}

// ── Name Matching ─────────────────────────────────────────────────────────────
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function tokenize(name) {
  const STOP = new Set(['cfs', 'coffee', 'cafe', 'the', 'de', 'la', 'el', 'los', 'las', 'store']);
  return new Set(normalizeName(name).split(' ').filter(t => t.length > 1 && !STOP.has(t)));
}

function scoreMatch(aName, tName) {
  const aN = normalizeName(aName);
  const tN = normalizeName(tName);
  if (aN === tN)               return 100;
  if (aN.includes(tN) || tN.includes(aN)) return 80;
  const aT = tokenize(aName), tT = tokenize(tName);
  const shared = [...aT].filter(t => tT.has(t));
  if (shared.length >= 2) {
    const union = new Set([...aT, ...tT]);
    return Math.round((shared.length / union.size) * 70);
  }
  return 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔄 Iniciando sincronización de GUIDs Toast → Aurora\n');

  // 1. Toast: obtener restaurantes
  console.log('📡 Conectando con Toast API...');
  const token        = await getToastToken();
  const toastList    = await getToastRestaurants(token);
  console.log(`   → ${toastList.length} restaurantes activos en Toast:\n`);
  toastList.forEach(r => console.log(`     • ${r.restaurantName}  [${r.restaurantGuid}]`));

  // 2. Aurora: obtener sucursales
  console.log('\n🗄️  Conectando con Aurora PostgreSQL...');
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('   → Conexión exitosa');

  const { rows: auroraStores } = await client.query(
    `SELECT "Id", "Name", "LocationName", "ExternalId", "IsActive" FROM "Stores" ORDER BY "Id"`
  );
  console.log(`   → ${auroraStores.length} sucursales en Aurora:\n`);
  auroraStores.forEach(s => {
    const status = s.ExternalId ? `✅ ya tiene GUID: ${s.ExternalId}` : '⬜ sin GUID';
    console.log(`     • [${s.Id}] ${s.Name}  — ${status}`);
  });

  // 3. Matching
  console.log('\n\n🔗 Análisis de matching:\n');
  const toApply   = [];
  const lowConf   = [];
  const noMatch   = [];
  const alreadyOk = [];

  for (const store of auroraStores) {
    const storeName = store.Name ?? '';

    if (store.ExternalId) {
      const stillExists = toastList.find(r => r.restaurantGuid === store.ExternalId);
      alreadyOk.push({ id: store.Id, name: storeName, guid: store.ExternalId, valid: !!stillExists });
      continue;
    }

    let best = null, bestScore = 0;
    for (const tr of toastList) {
      const s = scoreMatch(storeName, tr.restaurantName);
      if (s > bestScore) { bestScore = s; best = tr; }
    }

    if (bestScore >= 80) {
      toApply.push({ id: store.Id, name: storeName, toastName: best.restaurantName, guid: best.restaurantGuid, score: bestScore });
    } else if (bestScore >= 40) {
      lowConf.push({ id: store.Id, name: storeName, toastName: best?.restaurantName, guid: best?.restaurantGuid, score: bestScore });
    } else {
      noMatch.push({ id: store.Id, name: storeName });
    }
  }

  // 4. Mostrar resultados
  if (alreadyOk.length) {
    console.log(`✅ Ya tenían GUID asignado (${alreadyOk.length}):`);
    alreadyOk.forEach(r => console.log(`   [${r.id}] ${r.name} → ${r.guid} ${r.valid ? '' : '⚠️ GUID ya no existe en Toast!'}`));
  }

  if (toApply.length) {
    console.log(`\n🟢 Alta confianza — SE APLICARÁN (${toApply.length}):`);
    toApply.forEach(r => console.log(`   [${r.id}] "${r.name}"  ←→  "${r.toastName}"  (${r.score}%)\n       GUID: ${r.guid}`));
  }

  if (lowConf.length) {
    console.log(`\n🟡 Baja confianza — REQUIEREN REVISIÓN MANUAL (${lowConf.length}):`);
    lowConf.forEach(r => console.log(`   [${r.id}] "${r.name}"  ←→  "${r.toastName}"  (${r.score}%)\n       GUID: ${r.guid}`));
  }

  if (noMatch.length) {
    console.log(`\n🔴 Sin match (${noMatch.length}):`);
    noMatch.forEach(r => console.log(`   [${r.id}] "${r.name}"`));
  }

  // 5. Aplicar los de alta confianza
  if (toApply.length > 0) {
    console.log(`\n\n⚙️  Aplicando ${toApply.length} GUIDs en Aurora...`);
    for (const r of toApply) {
      await client.query(
        `UPDATE "Stores" SET "ExternalId" = $1 WHERE "Id" = $2`,
        [r.guid, r.id]
      );
      console.log(`   ✅ [${r.id}] ${r.name} → ${r.guid}`);
    }
  } else {
    console.log('\n⚠️  No hay matches de alta confianza para aplicar automáticamente.');
  }

  // 6. Verificación final
  console.log('\n\n📋 Estado final de la tabla Stores:\n');
  const { rows: finalState } = await client.query(
    `SELECT "Id", "Name", "ExternalId", "IsActive" FROM "Stores" ORDER BY "Id"`
  );
  let ready = 0;
  finalState.forEach(s => {
    const ok = !!s.ExternalId;
    if (ok) ready++;
    console.log(`   ${ok ? '✅' : '❌'} [${s.Id}] ${s.Name}  →  ${s.ExternalId ?? 'SIN GUID — asignar manualmente'}`);
  });

  console.log(`\n📊 Resumen final: ${ready}/${finalState.length} sucursales listas para sincronización con Toast`);

  if (lowConf.length > 0 || noMatch.length > 0) {
    console.log('\n🛠️  Para asignar GUIDs manualmente (ejecutar en Aurora):\n');
    const pendientes = [...lowConf, ...noMatch];
    pendientes.forEach(r => {
      console.log(`   -- [${r.id}] ${r.name}`);
      console.log(`   UPDATE "Stores" SET "ExternalId" = '<GUID>' WHERE "Id" = ${r.id};\n`);
    });
    console.log('   GUIDs disponibles de Toast:');
    toastList.forEach(tr => console.log(`   ${tr.restaurantName}  →  ${tr.restaurantGuid}`));
  }

  await client.end();
  console.log('\n✅ Script completado.\n');
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
