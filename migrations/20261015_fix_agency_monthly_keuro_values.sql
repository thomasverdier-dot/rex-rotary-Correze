-- Unité demandée : les nombres saisis (ex. 102,68) représentaient des k€.
-- Le schéma stocke des centimes d'euros ; multiplier les 11 valeurs existantes
-- par 1 000 convertit les montants mal interprétés en leur valeur réelle.
-- Pas de somme sectorielle ni de remplacement des valeurs saisies.
-- Copie de sécurité non accessible à anon/authenticated avant toute conversion.
CREATE TABLE IF NOT EXISTS public.manager_agency_monthly_results_before_keuro_fix_20261015
 (LIKE public.manager_agency_monthly_results INCLUDING ALL);
ALTER TABLE public.manager_agency_monthly_results_before_keuro_fix_20261015 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manager_agency_monthly_results_before_keuro_fix_20261015 FROM PUBLIC, anon, authenticated;
DO $keuro$
DECLARE
 expected_count integer;
 actual_count integer;
 backup_count integer;
BEGIN
 SELECT COUNT(*) INTO actual_count FROM public.manager_agency_monthly_results;
 SELECT COUNT(*) INTO backup_count FROM public.manager_agency_monthly_results_before_keuro_fix_20261015;
 SELECT COUNT(*) INTO expected_count
 FROM public.manager_agency_monthly_results t
 JOIN (VALUES
    (DATE '2025-11-01',11410,4680,1057),
    (DATE '2025-12-01',14005,3613,0),
    (DATE '2026-01-01',5914,0,434),
    (DATE '2026-02-01',11271,3014,1391),
    (DATE '2026-03-01',6256,488,814),
    (DATE '2026-04-01',10268,1854,2820),
    (DATE '2026-05-01',6952,134,0),
    (DATE '2026-06-01',9419,973,1941),
    (DATE '2026-07-01',11717,1823,867),
    (DATE '2026-08-01',4366,2299,957),
    (DATE '2026-09-01',9097,2369,0)
 ) AS original(month_start,ca_cents,nc_cents,uc_cents)
 ON t.month_start=original.month_start AND t.ca_cents=original.ca_cents
   AND t.nc_cents=original.nc_cents AND t.uc_cents=original.uc_cents;
 IF actual_count <> 11 OR expected_count <> 11 OR backup_count <> 0 THEN
  RAISE EXCEPTION 'Conversion k€ annulée : données existantes différentes du contrôle initial (% lignes, % correspondent, % sauvegardées)',actual_count,expected_count,backup_count;
 END IF;
 INSERT INTO public.manager_agency_monthly_results_before_keuro_fix_20261015
 SELECT * FROM public.manager_agency_monthly_results;
 UPDATE public.manager_agency_monthly_results
 SET ca_cents=ca_cents*1000,
     nc_cents=nc_cents*1000,
     uc_cents=uc_cents*1000,
     updated_at=NOW();
 IF (SELECT COUNT(*) FROM public.manager_agency_monthly_results_before_keuro_fix_20261015) <> 11 THEN
  RAISE EXCEPTION 'Conversion k€ annulée : copie de sécurité incomplète';
 END IF;
END
$keuro$;
