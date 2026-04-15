// migrate_supabase.mjs
// Conecta directamente al PostgreSQL de Supabase y crea la tabla store_budgets
// Ejecutar con: node migrate_supabase.mjs

import postgres from 'postgres';

const SUPABASE_DB_HOST = 'db.lqcnojizwhscdsuotlct.supabase.co';
const SUPABASE_DB_PORT = 5432;
const SUPABASE_DB_USER = 'postgres';
const SUPABASE_DB_PASS = 'CxfBpmnoj5gvSnSj';
const SUPABASE_DB_NAME = 'postgres';

const sql = postgres({
  host:     SUPABASE_DB_HOST,
  port:     SUPABASE_DB_PORT,
  user:     SUPABASE_DB_USER,
  password: SUPABASE_DB_PASS,
  database: SUPABASE_DB_NAME,
  ssl:      { rejectUnauthorized: false },
  max:      1,
});

async function run() {
  console.log('🔗 Connecting to Supabase PostgreSQL...');

  try {
    // 1. Create table
    await sql`
      CREATE TABLE IF NOT EXISTS public.store_budgets (
        id              bigserial PRIMARY KEY,
        store_id        integer       NOT NULL,
        store_name      varchar(255),
        year            integer       NOT NULL,
        month           integer       NOT NULL CHECK (month BETWEEN 1 AND 12),
        sales_target    numeric(12,2) NOT NULL DEFAULT 0,
        labor_cost_pct  numeric(5,2)  NOT NULL DEFAULT 30,
        notes           text,
        created_at      timestamptz   DEFAULT NOW(),
        updated_at      timestamptz   DEFAULT NOW(),
        CONSTRAINT uq_store_year_month UNIQUE (store_id, year, month)
      )
    `;
    console.log('✅ Table store_budgets created (or already exists)');

    // 2. Enable RLS
    await sql`ALTER TABLE public.store_budgets ENABLE ROW LEVEL SECURITY`;
    console.log('✅ RLS enabled');

    // 3. Create policies (ignore errors if they already exist)
    try {
      await sql`
        CREATE POLICY "Allow select for authenticated"
          ON public.store_budgets FOR SELECT TO authenticated USING (true)
      `;
      console.log('✅ SELECT policy created');
    } catch { console.log('ℹ️  SELECT policy already exists'); }

    try {
      await sql`
        CREATE POLICY "Allow all for authenticated"
          ON public.store_budgets FOR ALL TO authenticated
          USING (true) WITH CHECK (true)
      `;
      console.log('✅ ALL policy created');
    } catch { console.log('ℹ️  ALL policy already exists'); }

    // 4. service_role bypass policy (for our API)
    try {
      await sql`
        CREATE POLICY "Allow service_role full access"
          ON public.store_budgets FOR ALL TO service_role
          USING (true) WITH CHECK (true)
      `;
      console.log('✅ service_role policy created');
    } catch { console.log('ℹ️  service_role policy already exists'); }

    // 5. updated_at trigger function
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$
    `;
    console.log('✅ Trigger function created');

    // 6. Trigger (ignore if exists)
    try {
      await sql`
        CREATE TRIGGER trg_store_budgets_updated_at
          BEFORE UPDATE ON public.store_budgets
          FOR EACH ROW EXECUTE FUNCTION update_updated_at()
      `;
      console.log('✅ Trigger created');
    } catch { console.log('ℹ️  Trigger already exists'); }

    // 7. Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_store_budgets_period ON public.store_budgets (year, month)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_store_budgets_store  ON public.store_budgets (store_id)`;
    console.log('✅ Indexes created');

    // 8. Verify
    const rows = await sql`SELECT COUNT(*) as n FROM public.store_budgets`;
    console.log(`\n🎉 Migration complete! Table has ${rows[0].n} row(s).`);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
