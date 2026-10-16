-- Entrées en portefeuille au Point vendredi : projets détectés, PAS des signatures.
-- Null = ancienne semaine non qualifiée ; 0 = semaine explicitement renseignée sans projet.
-- Six métriques en catégorie distincte RNV / NC / UC ; ancien champ deals_created
-- reste alimenté automatiquement par leur somme après saisie.
ALTER TABLE public.friday_activity
  ADD COLUMN IF NOT EXISTS portfolio_rnv_count integer,
  ADD COLUMN IF NOT EXISTS portfolio_rnv_cents bigint,
  ADD COLUMN IF NOT EXISTS portfolio_nc_count integer,
  ADD COLUMN IF NOT EXISTS portfolio_nc_cents bigint,
  ADD COLUMN IF NOT EXISTS portfolio_uc_count integer,
  ADD COLUMN IF NOT EXISTS portfolio_uc_cents bigint;

ALTER TABLE public.friday_activity
  DROP CONSTRAINT IF EXISTS friday_portfolio_valid;
ALTER TABLE public.friday_activity
  ADD CONSTRAINT friday_portfolio_valid CHECK (
    (
      portfolio_rnv_count IS NULL AND portfolio_rnv_cents IS NULL AND
      portfolio_nc_count IS NULL AND portfolio_nc_cents IS NULL AND
      portfolio_uc_count IS NULL AND portfolio_uc_cents IS NULL
    )
    OR
    (
      portfolio_rnv_count BETWEEN 0 AND 100000 AND portfolio_rnv_cents >= 0 AND
      portfolio_nc_count BETWEEN 0 AND 100000 AND portfolio_nc_cents >= 0 AND
      portfolio_uc_count BETWEEN 0 AND 100000 AND portfolio_uc_cents >= 0
    )
  );
-- RLS et politiques existantes de friday_activity sont conservées :
-- chaque vendeur gère son propre Point vendredi, responsable peut le consulter.
