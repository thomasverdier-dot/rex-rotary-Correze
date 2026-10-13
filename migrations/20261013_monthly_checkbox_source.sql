-- Mise en place de la liaison reversible d'une affaire de la semaine vers le mois.
-- Aucun enregistrement existant n'est modifie ou supprime.
ALTER TABLE public.monthly_forecasts ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE public.monthly_forecasts ADD COLUMN IF NOT EXISTS source_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS monthly_forecasts_source_unique ON public.monthly_forecasts (source_type,source_id) WHERE source_id IS NOT NULL;
