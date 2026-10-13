-- Prévision mensuelle (k€) indépendante de la vente signée (euros exacts).
-- Ne modifie aucun montant ni aucune signature historique.
CREATE OR REPLACE FUNCTION public.enforce_monthly_sale_euros()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.sale_completed IS TRUE THEN
    IF NEW.signed_amount_eur IS NULL OR NEW.signed_amount_eur <= 0 THEN
      RAISE EXCEPTION 'Renseigne le montant exact signe en euros avant de valider la vente.';
    END IF;
    -- IMPORTANT : NEW.amount reste le prévisionnel initial en k€.
  ELSE
    NEW.signed_amount_eur := NULL;
  END IF;
  RETURN NEW;
END
$$;

ALTER TABLE public.monthly_forecasts
  DROP CONSTRAINT IF EXISTS monthly_sale_unit_check;
ALTER TABLE public.monthly_forecasts
  ADD CONSTRAINT monthly_sale_unit_check
  CHECK (
    sale_completed IS NOT TRUE
    OR (signed_amount_eur IS NOT NULL AND signed_amount_eur > 0)
  );

-- La signature du vendredi est calculée exclusivement depuis les euros réels ;
-- jamais à partir de la prévision mensuelle.
CREATE OR REPLACE FUNCTION public.sync_completed_monthly_sale_to_friday()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $sync$
DECLARE v_monday date;
BEGIN
  IF NEW.source_type = 'signed' AND NEW.source_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.sale_completed IS NOT TRUE OR NEW.signature_date IS NULL THEN
    DELETE FROM public.friday_signed_deals
      WHERE monthly_forecast_id = NEW.id AND source_kind = 'monthly';
    RETURN NEW;
  END IF;
  IF EXTRACT(ISODOW FROM NEW.signature_date)::int NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'La date de signature doit etre du lundi au vendredi.';
  END IF;
  v_monday := NEW.signature_date - (EXTRACT(ISODOW FROM NEW.signature_date)::int - 1);

  -- Conserver la règle de protection contre des signatures potentiellement dupliquées.
  IF NOT EXISTS (
      SELECT 1 FROM public.friday_signed_deals WHERE monthly_forecast_id = NEW.id
    ) AND EXISTS (
      SELECT 1 FROM public.friday_signed_deals
      WHERE user_id = NEW.user_id AND week_start = v_monday
        AND lower(btrim(company_name)) = lower(btrim(NEW.company_name))
    ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.friday_signed_deals
    (user_id, week_start, company_name, amount, signed_amount_eur,
     client_type, sale_type, monthly_forecast_id, signature_date, source_kind, updated_at)
  VALUES
    (NEW.user_id, v_monday, NEW.company_name, NEW.signed_amount_eur / 1000, NEW.signed_amount_eur,
     CASE WHEN NEW.client_type = 'nouveau' THEN 'nouveau' ELSE 'client' END,
     CASE WHEN NEW.client_type = 'nouveau' THEN 'classique'
          WHEN NEW.sale_type IN ('up_sell', 'cross_sell', 'up', 'cross') THEN 'up_sell'
          ELSE 'classique' END,
     NEW.id, NEW.signature_date, 'monthly', now())
  ON CONFLICT (monthly_forecast_id) WHERE monthly_forecast_id IS NOT NULL
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    week_start = EXCLUDED.week_start,
    company_name = EXCLUDED.company_name,
    signed_amount_eur = EXCLUDED.signed_amount_eur,
    client_type = EXCLUDED.client_type,
    sale_type = EXCLUDED.sale_type,
    signature_date = EXCLUDED.signature_date,
    updated_at = now();
  RETURN NEW;
END
$sync$;
