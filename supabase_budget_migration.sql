-- ============================================================
-- CFS Coffee BI — Módulo de Presupuestos
-- Ejecutar en: Supabase SQL Editor (proyecto lqcnojizwhscdsuotlct)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_budgets (
  id              bigserial PRIMARY KEY,
  store_id        integer       NOT NULL,   -- referencia a Stores.Id en Aurora
  store_name      varchar(255),             -- desnormalizado para consultas rápidas
  year            integer       NOT NULL,
  month           integer       NOT NULL CHECK (month BETWEEN 1 AND 12),
  sales_target    numeric(12,2) NOT NULL DEFAULT 0, -- ventas meta en $
  labor_cost_pct  numeric(5,2)  NOT NULL DEFAULT 30, -- % costo laboral meta
  notes           text,
  created_at      timestamptz   DEFAULT NOW(),
  updated_at      timestamptz   DEFAULT NOW(),

  CONSTRAINT uq_store_year_month UNIQUE (store_id, year, month)
);

-- RLS: habilitar y restringir acceso
ALTER TABLE public.store_budgets ENABLE ROW LEVEL SECURITY;

-- Política: permitir lectura a usuarios autenticados
CREATE POLICY "Allow read for authenticated users"
  ON public.store_budgets FOR SELECT
  TO authenticated
  USING (true);

-- Política: permitir escritura a usuarios autenticados
CREATE POLICY "Allow insert/update for authenticated users"
  ON public.store_budgets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_store_budgets_updated_at
  BEFORE UPDATE ON public.store_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index para consultas por periodo
CREATE INDEX IF NOT EXISTS idx_store_budgets_period ON public.store_budgets (year, month);
CREATE INDEX IF NOT EXISTS idx_store_budgets_store ON public.store_budgets (store_id);
