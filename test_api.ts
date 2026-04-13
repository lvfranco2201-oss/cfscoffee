const { config } = require('dotenv');
config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const { GET } = require('./src/app/api/dashboard/route.ts');
  const req = {
    url: 'http://localhost/api/dashboard?range=today'
  };
  const res = await GET(req);
  const data = await res.json();
  console.log("Response:", data);
}

main().catch(console.error);
