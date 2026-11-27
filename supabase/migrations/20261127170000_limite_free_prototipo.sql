-- Limite dei 2 incarichi Free visibile nel PROTOTIPO (account di prova), su richiesta di Alessandra (27/11/2026).
-- Per gli account veri continua a decidere free_monthly_job_limit_enabled, che resta SPENTO
-- fino alla verifica con un avvocato del lavoro.
insert into public.impostazioni (chiave, valore, descrizione) values
  ('free_monthly_job_limit_demo', 'true', 'Mostra e applica il limite dei 2 incarichi Free nel prototipo (account di prova). Non vale per gli account veri: per quelli decide free_monthly_job_limit_enabled.')
on conflict (chiave) do nothing;
