-- Le Point vendredi represente la semaine travaille du lundi au vendredi.
-- L'ancienne fonction calculait lundi minuit en UTC => dimanche en Europe/Paris.
-- Corriger uniquement les clefs de semaine du dimanche et conserver tous les IDs et contenus.
DO $m$
BEGIN
 IF EXISTS (
    SELECT 1 FROM public.friday_activity old
      JOIN public.friday_activity newer
        ON newer.user_id=old.user_id AND newer.week_start=old.week_start+1
      WHERE EXTRACT(ISODOW FROM old.week_start)::int=7
 ) THEN
   RAISE EXCEPTION 'Collision entre des semaines dimanche/lundi dans friday_activity : migration interrompue.';
 END IF;
END
$m$;
UPDATE public.friday_activity
   SET week_start=week_start+1
 WHERE EXTRACT(ISODOW FROM week_start)::int=7;
UPDATE public.friday_signed_deals
   SET week_start=week_start+1
 WHERE EXTRACT(ISODOW FROM week_start)::int=7;
UPDATE public.weekly_forecasts
   SET week_start=week_start+1
 WHERE EXTRACT(ISODOW FROM week_start)::int=7;

DO $m$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.monthly_forecasts'::regclass
                AND conname='monthly_signature_weekday_only') THEN
   ALTER TABLE public.monthly_forecasts
    ADD CONSTRAINT monthly_signature_weekday_only
    CHECK (signature_date IS NULL OR EXTRACT(ISODOW FROM signature_date)::int BETWEEN 1 AND 5);
 END IF;
END
$m$;

-- Retirer seulement une signature auto-generee si l'affaire mensuelle est supprimee.
-- Les signatures manuellement saisies ne sont jamais effacees par cette fonction.
CREATE OR REPLACE FUNCTION public.cleanup_monthly_generated_signature()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $cleanup$
BEGIN
 DELETE FROM public.friday_signed_deals
  WHERE monthly_forecast_id=OLD.id AND source_kind='monthly';
 RETURN OLD;
END
$cleanup$;
DROP TRIGGER IF EXISTS trg_cleanup_monthly_signature ON public.monthly_forecasts;
CREATE TRIGGER trg_cleanup_monthly_signature
BEFORE DELETE ON public.monthly_forecasts
FOR EACH ROW EXECUTE FUNCTION public.cleanup_monthly_generated_signature();
