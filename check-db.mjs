import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkDb() {
  try {
    await client.connect();
    console.log('✅ Connected to ToastAnalytics DB successfully!');
    
    // Get all tables
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
      ORDER BY table_schema, table_name;
    `);
    
    const tables = res.rows.map(row => `${row.table_schema}.${row.table_name}`);
    console.log('\n📊 Available Tables (' + tables.length + '):');
    tables.forEach(t => console.log(' - ' + t));

    // Sample the primary schemas (if exist)
    const importantTables = ['public.HourlySalesMetrics', 'public.CheckData', 'public.PaymentData', 'public.Stores', 'public.vw_DailySalesMetrics'];
    
    for (const table of tables) {
      if (importantTables.includes(table)) {
        console.log(`\n🔍 Sampling structure of table: ${table}...`);
        const columns = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = $2;
        `, [table.split('.')[0], table.split('.')[1]]);
        console.log(columns.rows.map(c => `   ${c.column_name} (${c.data_type})`).join('\n'));
        
        try {
            const count = await client.query(`SELECT COUNT(*) as exact_count FROM "${table.split('.')[0]}"."${table.split('.')[1]}"`);
            console.log(`   --> Total Records: ${count.rows[0].exact_count}`);
            const sample = await client.query(`SELECT * FROM "${table.split('.')[0]}"."${table.split('.')[1]}" LIMIT 1`);
            console.log(`   --> Sample Row:`, sample.rows[0]);
        } catch(e) {
            console.log('   --> Count calculation skipped or failed: ' + e.message);
        }
      }
    }

  } catch (err) {
    console.error('❌ Connection error:', err.message);
  } finally {
    await client.end();
  }
}

checkDb();
