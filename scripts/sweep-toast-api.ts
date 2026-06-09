import { getToastToken } from '../src/lib/toast/toast-client';
import { env } from '../src/lib/env';

async function sweepToastAPI() {
  const token = await getToastToken();
  const guid = '0afe3ec3-9424-4571-a425-636f56193bd1'; // Store 1

  const endpoints = [
    { method: 'GET', url: '/config/v2/alternatePaymentTypes' },
    { method: 'GET', url: '/config/v2/revenueCenters' },
    { method: 'GET', url: '/config/v2/diningOptions' },
    { method: 'GET', url: '/cashMgmt/v1/entries?businessDate=20260526' },
    { method: 'GET', url: '/cashMgmt/v1/drawers?businessDate=20260526' },
    { method: 'GET', url: '/payments/v1/alternatePayments?businessDate=20260526' }, // Guessed endpoint
    { method: 'GET', url: '/orders/v2/orders?businessDate=20260526' }
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting ${ep.method} ${ep.url} ...`);
    try {
      const res = await fetch(`${env.toast.apiHostname}${ep.url}`, {
        method: ep.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Toast-Restaurant-External-ID': guid,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${res.status}`);
      if (res.status === 200) {
        const data = await res.json();
        console.log(`Success! Array length: ${Array.isArray(data) ? data.length : 'Not an array'}`);
        if (Array.isArray(data) && data.length > 0) {
            console.log("Sample:", JSON.stringify(data[0]).substring(0, 300));
        } else if (!Array.isArray(data)) {
            console.log("Response:", JSON.stringify(data).substring(0, 300));
        }
      } else {
        const text = await res.text();
        console.log(`Error: ${text.substring(0, 200)}`);
      }
    } catch (e: any) {
      console.log(`Request Failed: ${e.message}`);
    }
  }
}

sweepToastAPI().catch(console.error);
