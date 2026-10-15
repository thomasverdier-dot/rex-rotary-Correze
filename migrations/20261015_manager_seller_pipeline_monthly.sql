-- Historique du tunnel de vente personnel, saisie responsable uniquement.
-- À partir d'octobre 2025; pas de remplacement du logiciel métier.
CREATE TABLE IF NOT EXISTS public.manager_seller_pipeline_monthly (
  manager_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_key text NOT NULL CHECK (length(seller_key) BETWEEN 2 AND 180),
  seller_name text NOT NULL CHECK (length(trim(seller_name)) BETWEEN 2 AND 180),
  month_start date NOT NULL CHECK (
    month_start >= DATE '2025-10-01' AND EXTRACT(DAY FROM month_start)=1
  ),
  raised_count integer NOT NULL DEFAULT 0 CHECK (raised_count >= 0),
  raised_cents bigint NOT NULL DEFAULT 0 CHECK (raised_cents >= 0),
  signed_count integer NOT NULL DEFAULT 0 CHECK (signed_count >= 0),
  signed_cents bigint NOT NULL DEFAULT 0 CHECK (signed_cents >= 0),
  lost_count integer NOT NULL DEFAULT 0 CHECK (lost_count >= 0),
  lost_cents bigint NOT NULL DEFAULT 0 CHECK (lost_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(manager_user_id,seller_key,month_start),
  CONSTRAINT manager_pipeline_counts_plausible CHECK (signed_count+lost_count<=raised_count)
);
ALTER TABLE public.manager_seller_pipeline_monthly ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manager_seller_pipeline_monthly FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.manager_seller_pipeline_monthly TO authenticated;
DROP POLICY IF EXISTS manager_seller_pipeline_read ON public.manager_seller_pipeline_monthly;
CREATE POLICY manager_seller_pipeline_read ON public.manager_seller_pipeline_monthly FOR SELECT TO authenticated
 USING (manager_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
 ));
DROP POLICY IF EXISTS manager_seller_pipeline_insert ON public.manager_seller_pipeline_monthly;
CREATE POLICY manager_seller_pipeline_insert ON public.manager_seller_pipeline_monthly FOR INSERT TO authenticated
 WITH CHECK (manager_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
 ));
DROP POLICY IF EXISTS manager_seller_pipeline_update ON public.manager_seller_pipeline_monthly;
CREATE POLICY manager_seller_pipeline_update ON public.manager_seller_pipeline_monthly FOR UPDATE TO authenticated
 USING (manager_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
 )) WITH CHECK (manager_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
 ));
