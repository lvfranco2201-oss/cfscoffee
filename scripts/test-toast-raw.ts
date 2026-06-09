import { toastFetch, getToastToken } from '../src/lib/toast/toast-client';
import { env } from '../src/lib/env';

async function testRawAPI() {
  const dateStr = '20260607'; // YYYYMMDD (Yesterday)
  console.log("Requesting payments for", dateStr);

  const reportRequestGuid = await toastFetch(
    `${env.toast.analyticsBase}/metrics/day`,
    {
      method: 'POST',
      body: JSON.stringify({
        startBusinessDate: dateStr,
        restaurantIds: [],
        excludedRestaurantIds: [],
      })
    }
  );

  console.log("Job GUID:", reportRequestGuid);

  // Poll
  for (let i=0; i<10; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const token = await getToastToken();
    const url = `${env.toast.apiHostname}${env.toast.analyticsBase}/metrics/${reportRequestGuid}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 200) {
      const data = await res.json();
      if (Array.isArray(data)) {
        console.log("RAW FIRST ROW:", data[0]);
        break;
      } else {
        console.log("Still processing...");
      }
    } else {
      console.log("Error:", res.status, await res.text());
    }
  }
}

testRawAPI().catch(console.error);
