-- Separation stricte des montants : forecasts.amount en k€, signed_amount_eur en € (centimes).
-- Anciennes valeurs k€ converties sans modifier amount ni le nombre de lignes.
ALTER TABLE public.monthly_forecasts
  ADD COLUMN IF NOT EXISTS signed_amount_eur numeric(14,2);
ALTER TABLE public.friday_signed_deals
  ADD COLUMN IF NOT EXISTS signed_amount_eur numeric(14,2);

UPDATE public.monthly_forecasts
 SET signed_amount_eur=round(amount*1000,2)
 WHERE sale_completed=true AND signed_amount_eur IS NULL;
UPDATE public.friday_signed_deals
 SET signed_amount_eur=round(amount*1000,2)
 WHERE signed_amount_eur IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_monthly_sale_euros()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
 IF NEW.sale_completed IS TRUE THEN
   IF NEW.signed_amount_eur IS NULL OR NEW.signed_amount_eur<=0 THEN
     RAISE EXCEPTION 'Montant signe requis en euros et centimes (signed_amount_eur).';
   END IF;
   IF TG_OP='UPDATE' AND NEW.amount IS DISTINCT FROM OLD.amount
      AND NEW.signed_amount_eur IS NOT DISTINCT FROM OLD.signed_amount_eur THEN
     RAISE EXCEPTION 'Un montant signe doit etre modifie en euros via signed_amount_eur, jamais en kEUR.';
   END IF;
   NEW.amount := NEW.signed_amount_eur / 1000;
 ELSE
   NEW.signed_amount_eur := NULL;
 END IF;
 RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS trg_enforce_monthly_sale_euros ON public.monthly_forecasts;
CREATE TRIGGER trg_enforce_monthly_sale_euros
BEFORE INSERT OR UPDATE ON public.monthly_forecasts
FOR EACH ROW EXECUTE FUNCTION public.enforce_monthly_sale_euros();

CREATE OR REPLACE FUNCTION public.enforce_friday_sale_euros()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
 IF NEW.signed_amount_eur IS NULL OR NEW.signed_amount_eur<=0 THEN
   RAISE EXCEPTION 'Montant signe requis en euros et centimes (signed_amount_eur).';
 END IF;
 IF TG_OP='UPDATE' AND NEW.amount IS DISTINCT FROM OLD.amount
    AND NEW.signed_amount_eur IS NOT DISTINCT FROM OLD.signed_amount_eur THEN
   RAISE EXCEPTION 'Une signature doit etre modifiee en euros via signed_amount_eur, jamais en kEUR.';
 END IF;
 NEW.amount := NEW.signed_amount_eur / 1000;
 RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS trg_enforce_friday_sale_euros ON public.friday_signed_deals;
CREATE TRIGGER trg_enforce_friday_sale_euros
BEFORE INSERT OR UPDATE ON public.friday_signed_deals
FOR EACH ROW EXECUTE FUNCTION public.enforce_friday_sale_euros();

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.monthly_forecasts'::regclass
   AND conname='monthly_sale_unit_check') THEN
   ALTER TABLE public.monthly_forecasts ADD CONSTRAINT monthly_sale_unit_check
   CHECK (sale_completed IS NOT TRUE OR
     (signed_amount_eur IS NOT NULL AND signed_amount_eur>0 AND amount=signed_amount_eur/1000));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.friday_signed_deals'::regclass
   AND conname='friday_sale_unit_check') THEN
   ALTER TABLE public.friday_signed_deals ADD CONSTRAINT friday_sale_unit_check
   CHECK (signed_amount_eur IS NOT NULL AND signed_amount_eur>0 AND amount=signed_amount_eur/1000);
 END IF;
END $$;

-- Preserve the pre-existing anti-duplicate logic: only the unit mapping changes.
CREATE OR REPLACE FUNCTION public.sync_completed_monthly_sale_to_friday()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $sync$
DECLARE v_monday date;
BEGIN
 IF NEW.source_type='signed' AND NEW.source_id IS NOT NULL THEN
   RETURN NEW;
 END IF;
 IF NEW.sale_completed IS NOT TRUE OR NEW.signature_date IS NULL THEN
   DELETE FROM public.friday_signed_deals
    WHERE monthly_forecast_id=NEW.id AND source_kind='monthly';
   RETURN NEW;
 END IF;
 IF EXTRACT(ISODOW FROM NEW.signature_date)::int NOT BETWEEN 1 AND 5 THEN
   RAISE EXCEPTION 'La date de signature doit etre un jour travaille, du lundi au vendredi.';
 END IF;
 v_monday:=NEW.signature_date - (EXTRACT(ISODOW FROM NEW.signature_date)::int - 1);
 IF NOT EXISTS (SELECT 1 FROM public.friday_signed_deals WHERE monthly_forecast_id=NEW.id)
    AND EXISTS (
      SELECT 1 FROM public.friday_signed_deals
       WHERE user_id=NEW.user_id AND week_start=v_monday
         AND lower(btrim(company_name))=lower(btrim(NEW.company_name))
    ) THEN
   RETURN NEW;
 END IF;
 INSERT INTO public.friday_signed_deals
   (user_id,week_start,company_name,amount,signed_amount_eur,client_type,sale_type,
    monthly_forecast_id,signature_date,source_kind,updated_at)
 VALUES
   (NEW.user_id,v_monday,NEW.company_name,NEW.amount,NEW.signed_amount_eur,
    CASE WHEN NEW.client_type='nouveau' THEN 'nouveau' ELSE 'client' END,
    CASE WHEN NEW.client_type='nouveau' THEN 'classique'
         WHEN NEW.sale_type IN ('up_sell','cross_sell','up','cross') THEN 'up_sell'
         ELSE 'classique' END,
    NEW.id,NEW.signature_date,'monthly',now())
 ON CONFLICT (monthly_forecast_id) WHERE monthly_forecast_id IS NOT NULL
 DO UPDATE SET
    user_id=EXCLUDED.user_id,
    week_start=EXCLUDED.week_start,
    company_name=EXCLUDED.company_name,
    signed_amount_eur=EXCLUDED.signed_amount_eur,
    client_type=EXCLUDED.client_type,
    sale_type=EXCLUDED.sale_type,
    signature_date=EXCLUDED.signature_date,
    updated_at=now();
 RETURN NEW;
END
$sync$;

-- Une modification des centimes est un evenement de synchronisation,
-- meme lorsque la colonne k€ n'apparait pas dans le UPDATE du client.
DROP TRIGGER IF EXISTS trg_completed_monthly_sale_to_friday ON public.monthly_forecasts;
CREATE TRIGGER trg_completed_monthly_sale_to_friday
AFTER INSERT OR UPDATE OF sale_completed, signature_date, company_name,
  amount, signed_amount_eur, client_type, sale_type
ON public.monthly_forecasts
FOR EACH ROW EXECUTE FUNCTION public.sync_completed_monthly_sale_to_friday();
