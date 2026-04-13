const { config } = require('dotenv');
config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const { getDashboardMetrics } = require('./src/lib/services/analytics.ts');
  const d = await getDashboardMetrics('2026-04-11');
  console.log("storesData:", d.storesData);
  console.log("Labor Cost mapped:", d.storesData.map(s => `${s.storeName}: ${s.laborCost}`));
}

main().catch(console.error);
