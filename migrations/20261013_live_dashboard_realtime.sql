-- Les tableaux du CRM se rafraîchissent immédiatement entre comptes Supabase.
-- Publication des seules tables commerciales nécessaires (RLS existantes conservées).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
                   AND schemaname='public' AND tablename='monthly_forecasts') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_forecasts;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
                   AND schemaname='public' AND tablename='weekly_forecasts') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_forecasts;
    END IF;
  ELSE
    RAISE NOTICE 'supabase_realtime non disponible : actualisation automatique par relecture de 20 secondes.';
  END IF;
END $$;
