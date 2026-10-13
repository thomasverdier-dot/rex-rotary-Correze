-- Historique privé des prévisions annoncées par le responsable.
-- Ne modifie aucune prévision existante ni aucun écran commercial.
CREATE TABLE IF NOT EXISTS public.manager_forecast_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('month','week')),
  period_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  estimated_cents bigint NOT NULL CHECK (estimated_cents >= 0),
  gross_cents bigint NOT NULL CHECK (gross_cents >= 0),
  confirmed_cents bigint NOT NULL CHECK (confirmed_cents >= 0),
  deal_count integer NOT NULL CHECK (deal_count >= 0),
  seller_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  method text NOT NULL DEFAULT 'weighted_probabilities_v1'
);
CREATE INDEX IF NOT EXISTS idx_manager_forecast_snapshots_manager_period
ON public.manager_forecast_snapshots (manager_user_id, period_type, period_start, created_at DESC);
ALTER TABLE public.manager_forecast_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manager_forecast_snapshots FROM anon;
REVOKE ALL ON public.manager_forecast_snapshots FROM authenticated;
GRANT SELECT, INSERT ON public.manager_forecast_snapshots TO authenticated;
DROP POLICY IF EXISTS manager_forecast_snapshots_select ON public.manager_forecast_snapshots;
CREATE POLICY manager_forecast_snapshots_select ON public.manager_forecast_snapshots
FOR SELECT TO authenticated
USING (manager_user_id=auth.uid() AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
));
DROP POLICY IF EXISTS manager_forecast_snapshots_insert ON public.manager_forecast_snapshots;
CREATE POLICY manager_forecast_snapshots_insert ON public.manager_forecast_snapshots
FOR INSERT TO authenticated
WITH CHECK (manager_user_id=auth.uid() AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
));
