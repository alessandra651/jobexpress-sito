-- JobExpress Trust: le liste candidature/annunci riportano anche se il CV è condiviso
-- e l'id del candidato (serve al committente per aprire il profilo pubblico, segnalare o bloccare).
create or replace function public.mie_candidature() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'candidatura_id', c.id, 'cv_condiviso', c.cv_condiviso, 'stato', c.stato, 'motivo', c.motivo, 'creato_il', c.creato_il,
    'annuncio', jsonb_build_object('id', a.id, 'titolo', a.titolo, 'nome', a.nome_pubblico, 'categoria', a.categoria, 'citta', a.citta, 'zona', a.zona,
      'compenso_ora', a.compenso_ora, 'compenso_tipo', a.compenso_tipo, 'condizioni', a.condizioni, 'stato', a.stato),
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id),
    'proposta', (select jsonb_build_object('id', p.id, 'scade_il', p.scade_il, 'stato', p.stato) from public.proposte p
                 where p.candidatura_id = c.id and p.stato = 'attesa' and p.scade_il > now() limit 1),
    'incarico', (select jsonb_build_object('id', i.id, 'stato', i.stato, 'annullato_da', i.annullato_da) from public.incarichi i where i.candidatura_id = c.id),
    'modifica', (select jsonb_build_object('id', m.id, 'turni', m.turni) from public.modifiche_orari m
                 join public.incarichi i on i.annuncio_id = m.annuncio_id and i.candidatura_id = c.id and i.stato = 'programmato'
                 where m.annuncio_id = a.id and m.stato = 'attesa'
                   and not exists (select 1 from public.risposte_orari r where r.modifica_id = m.id and r.incarico_id = i.id) limit 1)
  ) order by c.creato_il desc), '[]'::jsonb)
  from public.candidature c join public.annunci a on a.id = c.annuncio_id
  where c.lavoratore_id = auth.uid();
$$;

create or replace function public.miei_annunci() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'titolo', a.titolo, 'categoria', a.categoria, 'citta', a.citta, 'stato', a.stato, 'posti', a.posti,
    'compenso_ora', a.compenso_ora, 'posti_liberi', public._posti_liberi(a.id),
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id),
    'modifica_in_attesa', exists (select 1 from public.modifiche_orari m where m.annuncio_id = a.id and m.stato = 'attesa'),
    'candidati', (select coalesce(jsonb_agg(jsonb_build_object(
        'candidatura_id', c.id, 'lavoratore_id', c.lavoratore_id, 'cv_condiviso', c.cv_condiviso, 'stato', c.stato, 'nome', coalesce(pr.nome, 'Candidato'), 'citta', pr.citta, 'automunito', pr.automunito,
        'proposta', (select jsonb_build_object('id', p.id, 'scade_il', p.scade_il) from public.proposte p where p.candidatura_id = c.id and p.stato = 'attesa' and p.scade_il > now() limit 1),
        'incarico', (select jsonb_build_object('id', i.id, 'stato', i.stato) from public.incarichi i where i.candidatura_id = c.id)
      ) order by c.creato_il), '[]'::jsonb)
      from public.candidature c left join public.profili pr on pr.id = c.lavoratore_id where c.annuncio_id = a.id)
  ) order by a.creato_il desc), '[]'::jsonb)
  from public.annunci a where a.autore_id = auth.uid();
$$;

-- Percorso del CV di un candidato: solo per chi ha pubblicato l'annuncio e solo se il candidato l'ha condiviso.
-- Il file si apre poi con un link firmato a scadenza breve (la policy del bucket «curriculum» fa lo stesso controllo).
create or replace function public.cv_candidatura(p_candidatura uuid) returns text
language sql stable security definer set search_path = '' as $$
  select pp.cv_path from public.candidature c
    join public.annunci a on a.id = c.annuncio_id
    join public.profili_professionali pp on pp.user_id = c.lavoratore_id
  where c.id = p_candidatura and a.autore_id = auth.uid() and c.cv_condiviso and pp.cv_path is not null;
$$;
revoke execute on function public.cv_candidatura(uuid) from public, anon;
grant execute on function public.cv_candidatura(uuid) to authenticated;

-- La coda delle aziende riporta chi le ha registrate (per la verifica simulata dei test)
create or replace function public.admin_trust() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return jsonb_build_object(
    'account', (select count(*) from auth.users),
    'identita_verificate', (select count(*) from public.verifiche where tipo = 'identita' and stato = 'verificata' and not simulata),
    'identita_simulate', (select count(*) from public.verifiche where tipo = 'identita' and stato = 'verificata' and simulata),
    'in_attesa', (select count(*) from public.verifiche where stato in ('in_corso', 'in_attesa')),
    'non_riuscite', (select count(*) from public.verifiche where stato = 'non_riuscita'),
    'revisione_manuale', (select count(*) from public.verifiche where stato = 'revisione_manuale'),
    'foto_in_revisione', (select count(*) from public.profili_professionali where foto_stato = 'in_revisione'),
    'segnalazioni_foto', (select count(*) from public.segnalazioni_utenti where tipo = 'foto' and stato in ('aperta', 'in_esame')),
    'segnalazioni_profili', (select count(*) from public.segnalazioni_utenti where tipo = 'profilo_falso' and stato in ('aperta', 'in_esame')),
    'segnalazioni_aperte', (select count(*) from public.segnalazioni_utenti where stato in ('aperta', 'in_esame')),
    'sospesi', (select count(*) from public.sospensioni where stato = 'attiva'),
    'aziende_verificate', (select count(*) from public.aziende where stato_verifica = 'verificata'),
    'aziende_in_attesa', (select count(*) from public.aziende where stato_verifica in ('non_iniziata', 'in_attesa', 'revisione_manuale')),
    'privati_verificati', (select count(*) from public.profili_professionali pp join public.verifiche v on v.user_id = pp.user_id and v.tipo = 'identita' and v.stato = 'verificata' where pp.tipo = 'privato'),
    'assistenza_aperte', (select count(*) from public.richieste_assistenza where stato <> 'chiusa'),
    'tasso_completamento', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where stato = 'verificata') / count(*)) end from public.verifiche where tipo = 'identita'),
    'ore_medie_verifica', (select round(avg(extract(epoch from verificata_il - creato_il) / 3600)::numeric, 1) from public.verifiche where tipo = 'identita' and stato = 'verificata'),
    'costi_identificazione_eur', 0,
    'coda', jsonb_build_object(
      'segnalazioni', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tipo', s.tipo, 'motivo', s.motivo, 'stato', s.stato, 'creato_il', s.creato_il, 'segnalato_id', s.segnalato_id,
          'segnalato', coalesce((select nome from public.profili where id = s.segnalato_id), '—')) order by s.creato_il desc)
        from public.segnalazioni_utenti s where s.stato in ('aperta', 'in_esame')), '[]'),
      'foto', coalesce((select jsonb_agg(jsonb_build_object('user_id', pp.user_id, 'nome', coalesce(p.nome, 'Utente'), 'foto_path', pp.foto_path, 'stato', pp.foto_stato))
        from public.profili_professionali pp left join public.profili p on p.id = pp.user_id where pp.foto_stato = 'in_revisione'), '[]'),
      'verifiche', coalesce((select jsonb_agg(jsonb_build_object('user_id', v.user_id, 'nome', coalesce(p.nome, 'Utente'), 'tipo', v.tipo, 'stato', v.stato, 'motivo', v.motivo))
        from public.verifiche v left join public.profili p on p.id = v.user_id where v.stato in ('revisione_manuale', 'in_attesa')), '[]'),
      'assistenza', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'tipo', r.tipo, 'messaggio', r.messaggio, 'creato_il', r.creato_il) order by r.creato_il)
        from public.richieste_assistenza r where r.stato <> 'chiusa'), '[]'),
      'aziende', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ragione_sociale', a.ragione_sociale, 'partita_iva', a.partita_iva, 'stato', a.stato_verifica, 'creato_da', a.creato_da))
        from public.aziende a where a.stato_verifica in ('non_iniziata', 'in_attesa', 'revisione_manuale')), '[]'))
  );
end $$;

-- Cerca un account per email (solo admin): serve per abilitare con verifica SIMULATA gli account di test,
-- sospendere o riattivare. Restituisce solo i dati minimi.
create or replace function public.admin_cerca_utente(p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  select jsonb_build_object('id', u.id, 'nome', coalesce(p.nome, 'Utente'), 'email_verificata', u.email_confirmed_at is not null,
    'iscritto_il', u.created_at, 'foto_stato', pp.foto_stato, 'tipo', pp.tipo,
    'sospeso', exists (select 1 from public.sospensioni s where s.user_id = u.id and s.stato = 'attiva'),
    'verifiche', coalesce((select jsonb_object_agg(v.tipo, jsonb_build_object('stato', v.stato, 'simulata', v.simulata)) from public.verifiche v where v.user_id = u.id), '{}'))
  into r
  from auth.users u left join public.profili p on p.id = u.id left join public.profili_professionali pp on pp.user_id = u.id
  where lower(u.email) = lower(btrim(p_email));
  return r;
end $$;
revoke execute on function public.admin_cerca_utente(text) from public, anon;
grant execute on function public.admin_cerca_utente(text) to authenticated;
