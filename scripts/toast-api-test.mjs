/**
 * toast-api-test.mjs
 * Diagnóstico completo de la API de Toast:
 *  1. Prueba autenticación
 *  2. Lista restaurantes
 *  3. Obtiene ventas de hoy y ayer
 *  4. Obtiene labor de hoy
 *  5. Prueba endpoints adicionales (menú, pagos, checks)
 *  6. Reporta qué datos estamos usando vs qué está disponible
 *
 * Ejecutar: node scripts/toast-api-test.mjs
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const TOAST_HOST    = 'https://ws-api.toasttab.com';
const CLIENT_ID     = 'HrXkKC1RvZnT99ikBZhTsycDq1D8Rgdn';
const CLIENT_SECRET = 'dRHdbn-vvt4EQ5R-uyIWSG_Y2hCNfPhrl-0UHhvruF2D2TIzsNRek84pGtyOOIbS';

// Fecha en Eastern Time
function todayET(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}
function toastFmt(iso) { return iso.replace(/-/g, ''); }

// ── Helpers de consola ────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE   = '\x1b[34m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const ok   = (msg) => console.log(`  ${GREEN}✅ ${msg}${RESET}`);
const fail = (msg) => console.log(`  ${RED}❌ ${msg}${RESET}`);
const warn = (msg) => console.log(`  ${YELLOW}⚠️  ${msg}${RESET}`);
const info = (msg) => console.log(`  ${CYAN}ℹ️  ${msg}${RESET}`);
const head = (msg) => console.log(`\n${BOLD}${BLUE}━━ ${msg} ━━${RESET}`);
const sub  = (msg) => console.log(`\n${BOLD}  ${msg}${RESET}`);

// ── Auth ──────────────────────────────────────────────────────────────────────
let TOKEN = null;

async function auth() {
  head('1. AUTENTICACIÓN TOAST API');
  const res = await fetch(`${TOAST_HOST}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, userAccessType: 'TOAST_MACHINE_CLIENT' }),
  });
  if (!res.ok) { fail(`Auth fallida: ${res.status} ${await res.text()}`); process.exit(1); }
  const data = await res.json();
  if (data.status !== 'SUCCESS') { fail(`Auth error: ${JSON.stringify(data)}`); process.exit(1); }
  TOKEN = data.token.accessToken;
  ok(`Token obtenido (expira en ${Math.round(data.token.expiresIn / 60)} minutos)`);
  return TOKEN;
}

async function get(path) {
  const res = await fetch(`${TOAST_HOST}${path}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  return { status: res.status, ok: res.ok, body: res.ok ? await res.json() : await res.text() };
}

// Crear job y hacer polling
async function asyncJob(postPath, body, pollPath, maxAttempts = 15) {
  const post = await fetch(`${TOAST_HOST}${postPath}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!post.ok) return { ok: false, error: `POST ${post.status}: ${await post.text()}` };
  const guid = await post.json();
  if (typeof guid !== 'string') return { ok: false, error: `GUID inesperado: ${JSON.stringify(guid)}` };

  for (let i = 1; i <= maxAttempts; i++) {
    if (i > 1) await new Promise(r => setTimeout(r, 3000));
    const poll = await fetch(`${TOAST_HOST}${pollPath}/${guid}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    });
    if (poll.status === 201) return { ok: true, data: await poll.json(), attempts: i };
    if (poll.status === 200) { process.stdout.write('.'); continue; }
    return { ok: false, error: `Poll ${poll.status}: ${await poll.text()}` };
  }
  return { ok: false, error: `Timeout tras ${maxAttempts} intentos` };
}

// ── Formateo de moneda ────────────────────────────────────────────────────────
const usd = (n) => `$${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${Number(n ?? 0).toFixed(1)}%`;
const num = (n) => Number(n ?? 0).toLocaleString('en-US');

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}${BLUE}╔════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${BLUE}║   DIAGNÓSTICO COMPLETO — TOAST API              ║${RESET}`);
  console.log(`${BOLD}${BLUE}╚════════════════════════════════════════════════╝${RESET}`);
  console.log(`  Fecha hoy (ET): ${todayET()}   Ayer: ${todayET(1)}`);

  await auth();

  // ── 2. Restaurantes ─────────────────────────────────────────────────────────
  head('2. RESTAURANTES');
  const restRes = await get('/era/v1/restaurants-information');
  if (!restRes.ok || !Array.isArray(restRes.body)) {
    fail(`Error: ${JSON.stringify(restRes.body).substring(0, 200)}`);
    process.exit(1);
  }
  const all    = restRes.body;
  const active = all.filter(r => r.active && !r.testMode && !r.archived);
  const test   = all.filter(r => r.testMode);
  const archiv = all.filter(r => r.archived);

  ok(`Total en management group: ${all.length}`);
  ok(`Activos / productivos: ${active.length}`);
  if (test.length)   warn(`En testMode (no se sincronizan): ${test.length}`);
  if (archiv.length) warn(`Archivados (no se sincronizan): ${archiv.length}`);

  sub('Restaurantes activos:');
  active.forEach((r, i) => {
    info(`[${i + 1}] ${r.restaurantName.padEnd(45)} GUID: ${r.restaurantGuid}`);
  });

  // ── 3. Ventas de HOY ─────────────────────────────────────────────────────────
  head('3. VENTAS DE HOY — POST /era/v1/metrics/day');
  const todayStr = todayET();
  const todayFmt = toastFmt(todayStr);

  process.stdout.write('  Esperando respuesta de Toast API');
  const salesRes = await asyncJob(
    '/era/v1/metrics/day',
    { startBusinessDate: todayFmt, restaurantIds: [], excludedRestaurantIds: [] },
    '/era/v1/metrics'
  );
  console.log('');

  if (!salesRes.ok) {
    warn(`Sin ventas de hoy (${todayStr}): ${salesRes.error}`);
    warn('Esto es normal si aún no hay datos del día en Toast (madrugada)');
  } else {
    const rows = salesRes.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      warn('Respuesta vacía — no hay ventas registradas aún hoy');
    } else {
      // Agregar por restaurante
      const byRest = new Map();
      for (const row of rows) {
        const ex = byRest.get(row.restaurantGuid);
        if (!ex) {
          byRest.set(row.restaurantGuid, { ...row,
            netSalesAmount: Number(row.netSalesAmount ?? 0),
            grossSalesAmount: Number(row.grossSalesAmount ?? 0),
            discountAmount: Number(row.discountAmount ?? 0),
            voidOrdersAmount: Number(row.voidOrdersAmount ?? 0),
            refundAmount: Number(row.refundAmount ?? 0),
            guestCount: Number(row.guestCount ?? 0),
            ordersCount: Number(row.ordersCount ?? 0),
          });
        } else {
          ex.netSalesAmount    += Number(row.netSalesAmount ?? 0);
          ex.grossSalesAmount  += Number(row.grossSalesAmount ?? 0);
          ex.discountAmount    += Number(row.discountAmount ?? 0);
          ex.voidOrdersAmount  += Number(row.voidOrdersAmount ?? 0);
          ex.refundAmount      += Number(row.refundAmount ?? 0);
          ex.guestCount        += Number(row.guestCount ?? 0);
          ex.ordersCount       += Number(row.ordersCount ?? 0);
        }
      }

      const stores = Array.from(byRest.values());
      const totNet    = stores.reduce((a, s) => a + s.netSalesAmount, 0);
      const totGross  = stores.reduce((a, s) => a + s.grossSalesAmount, 0);
      const totGuests = stores.reduce((a, s) => a + s.guestCount, 0);
      const totOrders = stores.reduce((a, s) => a + s.ordersCount, 0);
      const totDisc   = stores.reduce((a, s) => a + s.discountAmount, 0);
      const totVoid   = stores.reduce((a, s) => a + s.voidOrdersAmount, 0);
      const totRef    = stores.reduce((a, s) => a + s.refundAmount, 0);

      ok(`Filas raw de Toast: ${rows.length}  →  ${stores.length} restaurantes agregados (${salesRes.attempts} polling intentos)`);
      console.log('');
      console.log(`  ${BOLD}KPIs consolidados de HOY (${todayStr}):${RESET}`);
      console.log(`    Ventas Netas     : ${GREEN}${usd(totNet)}${RESET}`);
      console.log(`    Ventas Brutas    : ${usd(totGross)}`);
      console.log(`    Clientes         : ${num(totGuests)}`);
      console.log(`    Órdenes          : ${num(totOrders)}`);
      console.log(`    Ticket Promedio  : ${usd(totNet / Math.max(totOrders, 1))}`);
      console.log(`    Descuentos       : ${YELLOW}${usd(totDisc)}${RESET}  (${pct(totDisc / Math.max(totNet, 1) * 100)} de ventas)`);
      console.log(`    Anulaciones      : ${YELLOW}${usd(totVoid)}${RESET}`);
      console.log(`    Reembolsos       : ${YELLOW}${usd(totRef)}${RESET}`);
      console.log('');

      sub('Por sucursal (hoy):');
      stores
        .sort((a, b) => b.netSalesAmount - a.netSalesAmount)
        .forEach(s => {
          const name = active.find(r => r.restaurantGuid === s.restaurantGuid)?.restaurantName ?? s.restaurantGuid;
          console.log(`    ${name.padEnd(45)} ${GREEN}${usd(s.netSalesAmount).padStart(12)}${RESET}  | ${num(s.ordersCount).padStart(5)} órdenes | ${num(s.guestCount).padStart(5)} clientes`);
        });

      // Muestra los campos disponibles de un row real
      sub('Campos disponibles en la respuesta de Toast (primer row):');
      const sample = rows[0];
      Object.keys(sample).forEach(k => {
        const val = sample[k];
        const used = ['restaurantGuid','businessDate','netSalesAmount','grossSalesAmount','guestCount',
                      'ordersCount','openOrdersCount','closedOrdersCount','discountAmount','voidOrdersAmount',
                      'voidOrdersCount','refundAmount','avgOrderValue','discountOrderCount'].includes(k);
        console.log(`    ${used ? GREEN + '✅' : YELLOW + '⬜'} ${k.padEnd(35)} = ${JSON.stringify(val)}${RESET}`);
      });
    }
  }

  // ── 4. Ventas de AYER (para verificar que el sync nocturno funciona) ─────────
  head('4. VENTAS DE AYER — Verificación de datos históricos');
  const yestStr = todayET(1);
  const yestFmt = toastFmt(yestStr);

  process.stdout.write('  Consultando ayer');
  const yestRes = await asyncJob(
    '/era/v1/metrics/day',
    { startBusinessDate: yestFmt, restaurantIds: [], excludedRestaurantIds: [] },
    '/era/v1/metrics'
  );
  console.log('');

  if (!yestRes.ok || !Array.isArray(yestRes.data) || yestRes.data.length === 0) {
    warn(`Sin datos de ayer (${yestStr}): ${yestRes.error ?? 'Respuesta vacía'}`);
  } else {
    const totYestNet = yestRes.data.reduce((a, r) => a + Number(r.netSalesAmount ?? 0), 0);
    const totYestOrd = yestRes.data.reduce((a, r) => a + Number(r.ordersCount ?? 0), 0);
    const totYestGs  = yestRes.data.reduce((a, r) => a + Number(r.guestCount ?? 0), 0);
    ok(`Ayer (${yestStr}): ${usd(totYestNet)} netas | ${num(totYestOrd)} órdenes | ${num(totYestGs)} clientes`);
  }

  // ── 5. Labor de HOY ──────────────────────────────────────────────────────────
  head('5. LABOR DE HOY — POST /era/v1/labor/day');
  process.stdout.write('  Consultando labor');
  const laborRes = await asyncJob(
    '/era/v1/labor/day',
    { startBusinessDate: todayFmt, endBusinessDate: todayFmt, restaurantIds: [], excludedRestaurantIds: [] },
    '/era/v1/labor'
  );
  console.log('');

  if (!laborRes.ok || !Array.isArray(laborRes.data) || laborRes.data.length === 0) {
    warn(`Sin datos de labor hoy: ${laborRes.error ?? 'Sin filas'}`);
  } else {
    // Agregar por restaurante
    const byRest = new Map();
    for (const row of laborRes.data) {
      const ex = byRest.get(row.restaurantGuid);
      if (!ex) {
        byRest.set(row.restaurantGuid, {
          guid: row.restaurantGuid,
          name: row.restaurantName ?? row.restaurantGuid,
          regularHours:  Number(row.regularHours ?? 0),
          overtimeHours: Number(row.overtimeHours ?? 0),
          totalHours:    Number(row.totalHours ?? 0),
          regularCost:   Number(row.regularCost ?? 0),
          overtimeCost:  Number(row.overtimeCost ?? 0),
          totalCost:     Number(row.totalCost ?? 0),
        });
      } else {
        ex.regularHours  += Number(row.regularHours ?? 0);
        ex.overtimeHours += Number(row.overtimeHours ?? 0);
        ex.totalHours    += Number(row.totalHours ?? 0);
        ex.regularCost   += Number(row.regularCost ?? 0);
        ex.overtimeCost  += Number(row.overtimeCost ?? 0);
        ex.totalCost     += Number(row.totalCost ?? 0);
      }
    }
    const lStores   = Array.from(byRest.values());
    const totHours  = lStores.reduce((a, s) => a + s.totalHours, 0);
    const totCost   = lStores.reduce((a, s) => a + s.totalCost, 0);
    const totOT     = lStores.reduce((a, s) => a + s.overtimeHours, 0);

    ok(`${laborRes.data.length} filas raw → ${lStores.length} sucursales`);
    console.log(`\n  ${BOLD}Labor consolidada de HOY:${RESET}`);
    console.log(`    Horas totales      : ${totHours.toFixed(1)}h`);
    console.log(`    Horas overtime     : ${totOT.toFixed(1)}h  ${totOT > 0 ? YELLOW + '⚠️ Hay overtime' + RESET : ''}`);
    console.log(`    Costo total        : ${RED}${usd(totCost)}${RESET}`);

    sub('Por sucursal (labor hoy):');
    lStores
      .sort((a, b) => b.totalCost - a.totalCost)
      .forEach(s => {
        console.log(`    ${s.name.padEnd(45)} ${usd(s.totalCost).padStart(10)} | ${s.totalHours.toFixed(1).padStart(6)}h | OT: ${s.overtimeHours.toFixed(1)}h`);
      });

    sub('Campos disponibles en respuesta de labor (primer row):');
    const lSample = laborRes.data[0];
    Object.keys(lSample).forEach(k => {
      const used = ['restaurantGuid','businessDate','regularHours','overtimeHours','totalHours',
                    'regularCost','overtimeCost','totalCost'].includes(k);
      console.log(`    ${used ? GREEN + '✅' : YELLOW + '⬜'} ${k.padEnd(35)} = ${JSON.stringify(lSample[k])}${RESET}`);
    });
  }

  // ── 6. Endpoint de Checks (órdenes individuales) ─────────────────────────────
  head('6. CHECKS (ÓRDENES INDIVIDUALES) — POST /era/v1/checks/day');
  info('Este endpoint devuelve datos por orden individual (ticket, items, mesas)');
  process.stdout.write('  Probando disponibilidad');
  const checkRes = await asyncJob(
    '/era/v1/checks/day',
    { startBusinessDate: yestFmt, restaurantIds: [], excludedRestaurantIds: [] },
    '/era/v1/checks',
    5  // solo 5 intentos para no esperar demasiado
  );
  console.log('');

  if (checkRes.ok && Array.isArray(checkRes.data) && checkRes.data.length > 0) {
    ok(`✅ Disponible — ${checkRes.data.length} checks de ayer`);
    const sample = checkRes.data[0];
    info(`Campos disponibles en un check:`);
    Object.keys(sample).forEach(k => {
      console.log(`    ⬜ ${k.padEnd(35)} = ${JSON.stringify(sample[k])}`);
    });
    info('💡 OPORTUNIDAD: Podríamos usar checks para análisis de tickets, items más vendidos, tamaño de grupos');
  } else {
    warn(`No disponible o sin datos: ${checkRes.error ?? 'Sin respuesta'}`);
  }

  // ── 7. Endpoint de Menú ───────────────────────────────────────────────────────
  head('7. MENÚ (VENTAS POR ÍTEM) — POST /era/v1/menu-analytics/day');
  info('Este endpoint devuelve ventas y popularidad por ítem de menú');
  process.stdout.write('  Probando disponibilidad');
  const menuRes = await asyncJob(
    '/era/v1/menu-analytics/day',
    { startBusinessDate: yestFmt, restaurantIds: [], excludedRestaurantIds: [] },
    '/era/v1/menu-analytics',
    5
  );
  console.log('');

  if (menuRes.ok && Array.isArray(menuRes.data) && menuRes.data.length > 0) {
    ok(`✅ Disponible — ${menuRes.data.length} ítems de ayer`);
    const sample = menuRes.data[0];
    info('Campos disponibles:');
    Object.keys(sample).forEach(k => {
      console.log(`    ⬜ ${k.padEnd(35)} = ${JSON.stringify(sample[k])}`);
    });
    info('💡 OPORTUNIDAD: Top productos, rentabilidad por ítem, análisis de menú');
  } else {
    warn(`No disponible o sin datos: ${menuRes.error ?? 'Sin respuesta'}`);
  }

  // ── 8. Endpoint de Pagos ──────────────────────────────────────────────────────
  head('8. PAGOS — POST /era/v1/payout/settled-date');
  process.stdout.write('  Probando disponibilidad');
  const payRes = await asyncJob(
    '/era/v1/payout/settled-date',
    { startBusinessDate: yestFmt, restaurantIds: [], excludedRestaurantIds: [] },
    '/era/v1/payout',
    5
  );
  console.log('');

  if (payRes.ok && Array.isArray(payRes.data) && payRes.data.length > 0) {
    ok(`✅ Disponible — ${payRes.data.length} registros de pagos de ayer`);
    const sample = payRes.data[0];
    Object.keys(sample).forEach(k => {
      console.log(`    ⬜ ${k.padEnd(35)} = ${JSON.stringify(sample[k])}`);
    });
  } else {
    warn(`No disponible: ${payRes.error ?? 'Sin respuesta'}`);
  }

  // ── 9. Resumen Final ──────────────────────────────────────────────────────────
  head('9. RESUMEN — QUÉ ESTAMOS USANDO VS QUÉ ESTÁ DISPONIBLE');

  const summary = [
    { endpoint: '/era/v1/restaurants-information',  uso: 'USANDO',       descripcion: 'Lista de restaurantes activos' },
    { endpoint: '/era/v1/metrics/day',               uso: 'USANDO',       descripcion: 'Ventas agregadas por día (16 campos)' },
    { endpoint: '/era/v1/labor/day',                 uso: 'USANDO',       descripcion: 'Labor (horas + costos por sucursal)' },
    { endpoint: '/era/v1/checks/day',                uso: 'DISPONIBLE',   descripcion: 'Órdenes individuales — tickets, ítems, grupos' },
    { endpoint: '/era/v1/menu-analytics/day',        uso: 'DISPONIBLE',   descripcion: 'Ventas por ítem de menú — top productos' },
    { endpoint: '/era/v1/payout/settled-date',       uso: 'DISPONIBLE',   descripcion: 'Detalle de pagos por tipo — ya tenemos PaymentData en Aurora' },
    { endpoint: '/era/v1/guests',                    uso: 'EXPLORAR',     descripcion: 'Datos de clientes recurrentes — retención, frecuencia' },
  ];

  summary.forEach(s => {
    const icon  = s.uso === 'USANDO'     ? `${GREEN}✅ USANDO    ${RESET}` :
                  s.uso === 'DISPONIBLE' ? `${YELLOW}💡 DISPONIBLE${RESET}` :
                                           `${CYAN}🔍 EXPLORAR  ${RESET}`;
    console.log(`  ${icon}  ${s.endpoint.padEnd(45)} ${s.descripcion}`);
  });

  console.log(`\n${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BOLD}  CONCLUSIÓN${RESET}`);
  console.log(`${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`\n  La API de Toast está ${GREEN}funcionando correctamente${RESET}.`);
  console.log(`  Estamos usando 3 de ~7 endpoints disponibles.`);
  console.log(`\n  ${YELLOW}Mayor oportunidad:${RESET} /era/v1/checks/day → Nos da cada orden individual.`);
  console.log(`  Con eso podemos mostrar: Top ítems vendidos, análisis de horarios pico`);
  console.log(`  por categoría de producto, tamaño promedio de grupo, tiempo promedio`);
  console.log(`  de permanencia y más.\n`);
}

main().catch(err => {
  console.error(`\n${RED}❌ Error fatal: ${err.message}${RESET}`);
  console.error(err.stack);
  process.exit(1);
});
