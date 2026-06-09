import { getSalesForAllRestaurants } from './src/lib/toast/toast-analytics';

async function test() {
  const date = new Date().toISOString().split('T')[0];
  const sales = await getSalesForAllRestaurants(date);
  if (sales.length > 0) {
    console.log("Mapeado:", sales[0]);
  } else {
    console.log("No data for today");
  }
}

test().catch(console.error);
