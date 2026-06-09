import { toastFetch, getToastToken } from '../src/lib/toast/toast-client';
import { env } from '../src/lib/env';

async function testPaymentsAPI() {
  const dateStr = '2026-05-26'; // format for orders API is often ISO
  const restaurantGuid = '32b9bb21-ba31-4796-9908-11f8796ed655'; // Suppose this is Store 1. Wait, let me query the stores first.

  const token = await getToastToken();
  console.log("Got token.");
  
  // Let's get the list of restaurants first
  const rRes = await fetch(`${env.toast.apiHostname}${env.toast.analyticsBase}/restaurants-information`, {
      headers: { 'Authorization': `Bearer ${token}` }
  });
  const rests = await rRes.json();
  const r1 = rests.find((r: any) => r.restaurantName.includes('001') || r.restaurantName.includes('Oviedo') || true);
  const guid = r1.restaurantGuid;
  console.log("Using Restaurant GUID:", guid);

  // Try /orders/v2/orders?businessDate=20260526
  const ordersUrl = `${env.toast.apiHostname}/orders/v2/orders?businessDate=20260526`;
  console.log("Fetching orders:", ordersUrl);
  const oRes = await fetch(ordersUrl, {
      headers: { 
          'Authorization': `Bearer ${token}`,
          'Toast-Restaurant-External-ID': guid
      }
  });
  console.log("Orders status:", oRes.status);
  if (oRes.status === 200) {
      const orders = await oRes.json();
      console.log("Orders count:", orders.length);
      if (orders.length > 0) {
          console.log("Sample order payments:", JSON.stringify(orders[0].payments, null, 2));
      }
  } else {
      console.log("Orders error:", await oRes.text());
  }

  // Try /payments/v1/payments?businessDate=20260526
  const payUrl = `${env.toast.apiHostname}/payments/v1/payments?businessDate=20260526`;
  console.log("\nFetching payments directly:", payUrl);
  const pRes = await fetch(payUrl, {
      headers: { 
          'Authorization': `Bearer ${token}`,
          'Toast-Restaurant-External-ID': guid
      }
  });
  console.log("Payments status:", pRes.status);
  if (pRes.status === 200) {
      const payments = await pRes.json();
      console.log("Payments count:", payments.length);
      if (payments.length > 0) {
          console.log("Sample payments:", JSON.stringify(payments.slice(0, 2), null, 2));
          // count by type
          const types: Record<string, number> = {};
          for (const p of payments) {
              const t = p.type || 'UNKNOWN';
              types[t] = (types[t] || 0) + 1;
          }
          console.log("Payment types:", types);
      }
  } else {
      console.log("Payments error:", await pRes.text());
  }
}

testPaymentsAPI().catch(console.error);
