/**
 * toast-poll-debug.mjs
 * Diagnóstico del polling: muestra el HTTP status EXACTO en cada intento
 * para saber si usamos 200 o 201 como "listo".
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const TOAST_HOST    = 'https://ws-api.toasttab.com';
const CLIENT_ID     = 'HrXkKC1RvZnT99ikBZhTsycDq1D8Rgdn';
const CLIENT_SECRET = 'dRHdbn-vvt4EQ5R-uyIWSG_Y2hCNfPhrl-0UHhvruF2D2TIzsNRek84pGtyOOIbS';

function todayET(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

async function main() {
  // 1. Auth
  const authRes = await fetch(`${TOAST_HOST}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, userAccessType: 'TOAST_MACHINE_CLIENT' }),
  });
  const authData = await authRes.json();
  const TOKEN = authData.token.accessToken;
  console.log(`✅ Auth OK\n`);

  const yest    = todayET(1);
  const yestFmt = yest.replace(/-/g, '');

  console.log(`Creando job de métricas para ayer (${yest} → ${yestFmt})...`);

  // 2. POST para crear el job
  const postRes = await fetch(`${TOAST_HOST}/era/v1/metrics/day`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startBusinessDate: yestFmt, restaurantIds: [], excludedRestaurantIds: [] }),
  });

  console.log(`POST /era/v1/metrics/day → HTTP ${postRes.status}`);
  const postBody = await postRes.text();
  console.log(`Body: ${postBody}\n`);

  if (!postRes.ok) { console.error('POST falló, abortando'); process.exit(1); }

  const guid = JSON.parse(postBody);
  if (typeof guid !== 'string') { console.error('GUID inesperado:', guid); process.exit(1); }
  console.log(`GUID recibido: ${guid}\n`);

  // 3. Polling — mostrar CADA status con timestamp
  console.log('Iniciando polling cada 5 segundos (máx 40 intentos = 200s)...\n');

  for (let i = 1; i <= 40; i++) {
    if (i > 1) await new Promise(r => setTimeout(r, 5000));

    const t = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
    const pollRes = await fetch(`${TOAST_HOST}/era/v1/metrics/${guid}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    });

    // Leer los primeros 500 chars del body sin consumir el stream
    const bodyText = await pollRes.text();
    const preview = bodyText.length > 300 ? bodyText.substring(0, 300) + '...' : bodyText;

    console.log(`[${t}] Intento ${i.toString().padStart(2)}/40 → HTTP ${pollRes.status} | Body: ${preview}`);

    // Si es 2xx con datos, ya terminó
    if (pollRes.status === 200 || pollRes.status === 201) {
      let parsed;
      try { parsed = JSON.parse(bodyText); } catch { parsed = null; }

      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`\n✅ ¡DATOS RECIBIDOS con HTTP ${pollRes.status}!`);
        console.log(`   Filas: ${parsed.length}`);
        console.log(`   Primer registro:`, JSON.stringify(parsed[0], null, 2));
        break;
      }

      if (typeof parsed === 'string' || (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))) {
        console.log(`\n⚠️  HTTP ${pollRes.status} pero body no es array:`, typeof parsed, preview);
        // Sigue esperando — podría ser un objeto de estado
        continue;
      }
    }

    if (pollRes.status >= 400) {
      console.log(`\n❌ Error HTTP ${pollRes.status}. Abortando.`);
      break;
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
