-- Lien entre ventes realisees du mois et signatures de la semaine du lundi au vendredi.
-- Migration additive : ne modifie aucune vente deja enregistree.
ALTER TABLE public.monthly_forecasts ADD COLUMN IF NOT EXISTS signature_date date;
ALTER TABLE public.friday_signed_deals ADD COLUMN IF NOT EXISTS monthly_forecast_id uuid;
ALTER TABLE public.friday_signed_deals ADD COLUMN IF NOT EXISTS signature_date date;
ALTER TABLE public.friday_signed_deals ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'manual';
CREATE UNIQUE INDEX IF NOT EXISTS friday_signed_monthly_unique_idx
 ON public.friday_signed_deals (monthly_forecast_id) WHERE monthly_forecast_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_completed_monthly_sale_to_friday()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $sync$
DECLARE v_monday date;
BEGIN
  -- Les signatures saisies en premier dans le point du vendredi y figurent deja.
  IF NEW.source_type = 'signed' AND NEW.source_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sale_completed IS NOT TRUE OR NEW.signature_date IS NULL THEN
    -- N'efface jamais une signature saisie manuellement dans le Point du vendredi.
    DELETE FROM public.friday_signed_deals
     WHERE monthly_forecast_id = NEW.id AND source_kind = 'monthly';
    RETURN NEW;
  END IF;

  IF EXTRACT(ISODOW FROM NEW.signature_date)::int NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'La date de signature doit etre un jour travaille, du lundi au vendredi.';
  END IF;

  v_monday := NEW.signature_date - (EXTRACT(ISODOW FROM NEW.signature_date)::int - 1);

  -- Une signature deja saisie manuellement avec la meme entreprise dans la meme
  -- semaine ne doit pas etre comptee une deuxieme fois.
  IF NOT EXISTS (SELECT 1 FROM public.friday_signed_deals
                 WHERE monthly_forecast_id = NEW.id)
     AND EXISTS (
       SELECT 1 FROM public.friday_signed_deals
        WHERE user_id = NEW.user_id
          AND week_start = v_monday
          AND lower(btrim(company_name)) = lower(btrim(NEW.company_name))
     ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.friday_signed_deals (
    user_id, week_start, company_name, amount, client_type, sale_type,
    monthly_forecast_id, signature_date, source_kind, updated_at
  ) VALUES (
    NEW.user_id, v_monday, NEW.company_name, NEW.amount,
    CASE WHEN NEW.client_type = 'nouveau' THEN 'nouveau' ELSE 'client' END,
    CASE WHEN NEW.client_type = 'nouveau' THEN 'classique'
         WHEN NEW.sale_type IN ('up_sell','cross_sell','up','cross') THEN 'up_sell'
         ELSE 'classique' END,
    NEW.id, NEW.signature_date, 'monthly', now()
  )
  ON CONFLICT (monthly_forecast_id) WHERE monthly_forecast_id IS NOT NULL
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    week_start = EXCLUDED.week_start,
    company_name = EXCLUDED.company_name,
    amount = EXCLUDED.amount,
    client_type = EXCLUDED.client_type,
    sale_type = EXCLUDED.sale_type,
    signature_date = EXCLUDED.signature_date,
    updated_at = now();

  RETURN NEW;
END
$sync$;

DROP TRIGGER IF EXISTS trg_completed_monthly_sale_to_friday ON public.monthly_forecasts;
CREATE TRIGGER trg_completed_monthly_sale_to_friday
AFTER INSERT OR UPDATE OF sale_completed, signature_date, company_name, amount, client_type, sale_type
ON public.monthly_forecasts
FOR EACH ROW EXECUTE FUNCTION public.sync_completed_monthly_sale_to_friday();
