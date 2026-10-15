-- Pilotage agence saisi directement par le responsable, sans dépendance aux commerciaux/secteurs.
CREATE TABLE IF NOT EXISTS public.manager_agency_monthly_results (
  manager_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  ca_cents bigint NOT NULL CHECK (ca_cents>=0),
  nc_cents bigint NOT NULL CHECK (nc_cents>=0),
  uc_cents bigint NOT NULL CHECK (uc_cents>=0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (manager_user_id,month_start),
  CONSTRAINT agency_results_calendar_month CHECK (EXTRACT(DAY FROM month_start)=1),
  CONSTRAINT agency_results_nc_not_exceed_ca CHECK (nc_cents<=ca_cents),
  CONSTRAINT agency_results_uc_not_exceed_ca CHECK (uc_cents<=ca_cents)
);
CREATE INDEX IF NOT EXISTS manager_agency_monthly_results_period_idx
 ON public.manager_agency_monthly_results (month_start);
ALTER TABLE public.manager_agency_monthly_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manager_agency_monthly_results FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.manager_agency_monthly_results TO authenticated;
DROP POLICY IF EXISTS agency_monthly_admin_select ON public.manager_agency_monthly_results;
CREATE POLICY agency_monthly_admin_select ON public.manager_agency_monthly_results
 FOR SELECT TO authenticated USING (
  manager_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
  )
 );
DROP POLICY IF EXISTS agency_monthly_admin_insert ON public.manager_agency_monthly_results;
CREATE POLICY agency_monthly_admin_insert ON public.manager_agency_monthly_results
 FOR INSERT TO authenticated WITH CHECK (
  manager_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
  )
 );
DROP POLICY IF EXISTS agency_monthly_admin_update ON public.manager_agency_monthly_results;
CREATE POLICY agency_monthly_admin_update ON public.manager_agency_monthly_results
 FOR UPDATE TO authenticated
 USING (
  manager_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
  )
 ) WITH CHECK (
  manager_user_id=auth.uid() AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.role='admin'
  )
 );
