-- =====================================================================
-- JobExpress · Fase 5 «Admin e monitoraggio» (28/11/2026)
-- * admin_monitoraggio(): stato dei processi programmati (cron), errori recenti, notifiche inviate,
--   numeri di Business e recensioni. Solo amministratori.
-- * admin_imposta(): le funzioni vietate dalle regole del progetto non si possono accendere dal pannello
--   (biometria, penalità reputazionali automatiche, badge aziendali, SPID/CIE/eIDAS/provider finché non
--   c'è un'integrazione vera, Business Pro e Safe avanzato finché non c'è il via libera legale).
-- =====================================================================

create or replace function public.admin_monitoraggio() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return jsonb_build_object(
    'cron', coalesce((select jsonb_agg(jsonb_build_object('nome', j.jobname, 'pianificazione', j.schedule, 'attivo', j.active,
        'ultima', (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
        'ultimo_esito', (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
        'riusciti_24h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'succeeded' and d.start_time > now() - interval '24 hours'),
        'falliti_24h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '24 hours')) order by j.jobname)
      from cron.job j where j.jobname like 'jobexpress-%'), '[]'),
    'errori_recenti', coalesce((select jsonb_agg(jsonb_build_object('nome', r.nome, 'quando', r.eseguito_il, 'dettagli', r.dettagli) order by r.eseguito_il desc)
      from (select * from public.registro_processi where esito = 'errore' order by eseguito_il desc limit 10) r), '[]'),
    'ultime_esecuzioni', coalesce((select jsonb_agg(jsonb_build_object('nome', r.nome, 'quando', r.eseguito_il, 'dettagli', r.dettagli) order by r.eseguito_il desc)
      from (select * from public.registro_processi where esito = 'ok' order by eseguito_il desc limit 10) r), '[]'),
    'notifiche_24h', (select coalesce(jsonb_object_agg(tipo, n), '{}') from (select tipo, count(*) n from public.notifiche where creato_il > now() - interval '24 hours' group by 1 order by 2 desc limit 15) z),
    'notifiche_7g', (select count(*) from public.notifiche where creato_il > now() - interval '7 days'),
    'business', jsonb_build_object(
      'modelli', (select count(*) from public.modelli_annuncio),
      'ricorrenze_attive', (select count(*) from public.ricorrenze where attiva),
      'date_da_confermare', (select count(*) from public.occorrenze_ricorrenti where stato = 'da_confermare'),
      'date_pubblicate', (select count(*) from public.occorrenze_ricorrenti where stato = 'pubblicata'),
      'annunci_multi_posto', (select count(*) from public.annunci where posti > 1)),
    'recensioni', jsonb_build_object(
      'periodi_aperti', (select count(*) from public.periodi_recensione where stato = 'aperto'),
      'pubblicate', (select count(*) from public.recensioni where stato = 'pubblicata'),
      'in_attesa', (select count(*) from public.recensioni where stato = 'inviata'),
      'rimosse', (select count(*) from public.recensioni where stato = 'rimossa'),
      'con_risposta', (select count(*) from public.recensioni where stato = 'pubblicata' and risposta is not null),
      'media_generale', (select round(avg(media), 2) from public.recensioni where stato = 'pubblicata')),
    'contestazioni_aperte', (select count(*) from public.contestazioni where stato = 'aperta'));
end $$;
revoke execute on function public.admin_monitoraggio() from public, anon;
grant execute on function public.admin_monitoraggio() to authenticated;

-- Elenco recensioni pubblicate recenti, per la moderazione (solo admin)
create or replace function public.admin_recensioni() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'media', r.media, 'commento', r.commento, 'risposta', r.risposta, 'stato', r.stato,
      'ruolo_autore', r.ruolo_autore, 'pubblicata_il', r.pubblicata_il, 'rimossa_motivo', r.rimossa_motivo,
      'autore', coalesce((select nome from public.profili where id = r.autore_id), 'Utente'),
      'destinatario', coalesce((select nome from public.profili where id = r.destinatario_id), 'Utente'),
      'segnalata', exists (select 1 from public.segnalazioni_utenti s where s.recensione_id = r.id and s.stato not in ('risolta', 'archiviata'))) order by r.pubblicata_il desc nulls last)
    from (select * from public.recensioni where stato in ('pubblicata', 'rimossa') and commento is not null order by pubblicata_il desc nulls last limit 50) r), '[]');
end $$;
revoke execute on function public.admin_recensioni() from public, anon;
grant execute on function public.admin_recensioni() to authenticated;

create or replace function public.admin_imposta(p_chiave text, p_valore jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  vecchio jsonb;
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  select valore into vecchio from public.impostazioni where chiave = p_chiave for update;
  if vecchio is null then raise exception 'Impostazione sconosciuta'; end if;
  if jsonb_typeof(p_valore) <> jsonb_typeof(vecchio) then raise exception 'Tipo di valore non valido'; end if;
  -- funzioni bloccate: non si accendono dal pannello
  if p_valore = 'true'::jsonb and p_chiave in ('biometric_verification_enabled', 'automatic_reputation_penalties_enabled', 'employer_badge_enabled',
       'spid_enabled', 'cie_enabled', 'eidas_enabled', 'id_provider_enabled', 'minor_accounts_enabled', 'professional_passport_enabled',
       'business_pro_enabled', 'safe_trusted_contacts_enabled', 'safe_automatic_alerts_enabled') then
    raise exception 'Funzione bloccata: serve prima un''integrazione vera o una valutazione legale';
  end if;
  if p_chiave in ('free_monthly_job_limit', 'max_candidature_sovrapposte', 'ai_richieste_mensili')
     and ((p_valore)::numeric < 1 or (p_valore)::numeric > 100 or (p_valore)::numeric <> floor((p_valore)::numeric)) then
    raise exception 'Numero non valido';
  end if;
  if p_chiave = 'margine_spostamenti_minuti' and ((p_valore)::numeric < 0 or (p_valore)::numeric > 240) then
    raise exception 'Numero non valido';
  end if;
  if p_chiave = 'tempi_conferma' and (
       jsonb_array_length(p_valore) not between 1 and 8
       or exists (select 1 from jsonb_array_elements(p_valore) r
                  where (r ->> 'minuti') is null or (r ->> 'minuti')::numeric not between 1 and 1440)) then
    raise exception 'Tempi non validi';
  end if;
  update public.impostazioni set valore = p_valore, aggiornato_il = now(), aggiornato_da = auth.uid() where chiave = p_chiave;
  insert into public.registro_admin (user_id, azione, dettagli)
  values (auth.uid(), 'impostazione_modificata', jsonb_build_object('chiave', p_chiave, 'prima', vecchio, 'dopo', p_valore));
end $$;
