-- JobExpress — collegamento del sito ai dati veri, cambio orari con nuova accettazione, contestazioni (27 nov 2026)

-- ---------- Tabelle del cambio orari ----------
create table public.modifiche_orari (
  id uuid primary key default gen_random_uuid(),
  annuncio_id uuid not null references public.annunci (id) on delete cascade,
  turni jsonb not null check (jsonb_typeof(turni) = 'array'),
  stato text not null default 'attesa' check (stato in ('attesa', 'applicata', 'annullata')),
  creato_il timestamptz not null default now()
);
alter table public.modifiche_orari enable row level security;
revoke all on public.modifiche_orari from anon, authenticated;
create unique index modifiche_orari_una on public.modifiche_orari (annuncio_id) where stato = 'attesa';

create table public.risposte_orari (
  modifica_id uuid not null references public.modifiche_orari (id) on delete cascade,
  incarico_id uuid not null references public.incarichi (id) on delete cascade,
  accetta boolean not null,
  il timestamptz not null default now(),
  primary key (modifica_id, incarico_id)
);
alter table public.risposte_orari enable row level security;
revoke all on public.risposte_orari from anon, authenticated;


-- ---------- Letture per il sito ----------
-- Le mie candidature (lavoratore), con annuncio, turni, proposta in attesa, incarico e cambio orari in sospeso
create function public.mie_candidature() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'candidatura_id', c.id, 'stato', c.stato, 'motivo', c.motivo, 'creato_il', c.creato_il,
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

-- I miei annunci (committente), con candidati (solo nome e città), proposte e incarichi
create function public.miei_annunci() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'titolo', a.titolo, 'categoria', a.categoria, 'citta', a.citta, 'stato', a.stato, 'posti', a.posti,
    'compenso_ora', a.compenso_ora, 'posti_liberi', public._posti_liberi(a.id),
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id),
    'modifica_in_attesa', exists (select 1 from public.modifiche_orari m where m.annuncio_id = a.id and m.stato = 'attesa'),
    'candidati', (select coalesce(jsonb_agg(jsonb_build_object(
        'candidatura_id', c.id, 'stato', c.stato, 'nome', coalesce(pr.nome, 'Candidato'), 'citta', pr.citta, 'automunito', pr.automunito,
        'proposta', (select jsonb_build_object('id', p.id, 'scade_il', p.scade_il) from public.proposte p where p.candidatura_id = c.id and p.stato = 'attesa' and p.scade_il > now() limit 1),
        'incarico', (select jsonb_build_object('id', i.id, 'stato', i.stato) from public.incarichi i where i.candidatura_id = c.id)
      ) order by c.creato_il), '[]'::jsonb)
      from public.candidature c left join public.profili pr on pr.id = c.lavoratore_id where c.annuncio_id = a.id)
  ) order by a.creato_il desc), '[]'::jsonb)
  from public.annunci a where a.autore_id = auth.uid();
$$;

-- Annullare un annuncio (committente): annulla proposte, candidature e incarichi non ancora iniziati
create function public.annulla_annuncio(p_annuncio uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  r record;
begin
  select * into a from public.annunci where id = p_annuncio for update;
  if a.id is null or a.autore_id <> auth.uid() then raise exception 'Non è un tuo annuncio'; end if;
  if a.stato = 'annullato' then return jsonb_build_object('ok', true); end if;
  update public.annunci set stato = 'annullato', aggiornato_il = now() where id = a.id;
  update public.proposte set stato = 'annullata', risposta_il = now() where annuncio_id = a.id and stato = 'attesa';
  for r in update public.incarichi set stato = 'annullato', annullato_il = now(), annullato_da = 'committente', conta_nel_limite = false
           where annuncio_id = a.id and stato = 'programmato' returning lavoratore_id, id loop
    perform public._notifica(r.lavoratore_id, 'incarico_annullato', format('«%s» è stato annullato dal committente. Non conta nel tuo limite mensile.', a.titolo), jsonb_build_object('annuncio_id', a.id), 'annullato-' || r.id);
  end loop;
  for r in update public.candidature set stato = 'annullata', motivo = 'annuncio_annullato', aggiornato_il = now()
           where annuncio_id = a.id and stato in ('inviata', 'in_valutazione', 'in_attesa_conferma', 'confermata') returning lavoratore_id, id loop
    perform public._notifica(r.lavoratore_id, 'incarico_annullato', format('L’annuncio «%s» è stato annullato.', a.titolo), jsonb_build_object('annuncio_id', a.id), 'annuncio-annullato-' || r.id);
  end loop;
  perform public._registra('annuncio_annullato', 'annuncio', a.id::text);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Cambio orari di un annuncio già assegnato ----------
-- Applica i nuovi orari quando tutti gli assegnati hanno risposto
create function public._chiudi_modifica(p_modifica uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  t jsonb;
  r record;
begin
  select * into m from public.modifiche_orari where id = p_modifica and stato = 'attesa' for update;
  if m.id is null then return; end if;
  if exists (select 1 from public.incarichi i where i.annuncio_id = m.annuncio_id and i.stato = 'programmato'
             and not exists (select 1 from public.risposte_orari x where x.modifica_id = m.id and x.incarico_id = i.id)) then
    return; -- qualcuno deve ancora rispondere
  end if;
  delete from public.turni where annuncio_id = m.annuncio_id;
  for t in select * from jsonb_array_elements(m.turni) loop
    insert into public.turni (annuncio_id, inizio, fine) values (m.annuncio_id, (t ->> 'inizio')::timestamptz, (t ->> 'fine')::timestamptz);
  end loop;
  update public.modifiche_orari set stato = 'applicata' where id = m.id;
  perform public._ritira_incompatibili_annuncio(m.annuncio_id);
  -- le candidature non ancora assegnate devono ricandidarsi (rifanno tutti i controlli)
  for r in update public.candidature set stato = 'annullata', motivo = 'orari_modificati', aggiornato_il = now()
           where annuncio_id = m.annuncio_id and stato in ('inviata', 'in_valutazione') returning id, lavoratore_id loop
    perform public._notifica(r.lavoratore_id, 'incarico_modificato', 'Gli orari di un annuncio a cui ti eri candidato sono cambiati: se ti vanno bene, ricandidati.', jsonb_build_object('annuncio_id', m.annuncio_id), 'orari-' || r.id || '-' || m.id);
  end loop;
  perform public._notifica(a.autore_id, 'incarico_modificato', 'I nuovi orari sono confermati.', jsonb_build_object('annuncio_id', m.annuncio_id), 'orari-ok-' || m.id)
    from public.annunci a where a.id = m.annuncio_id;
  insert into public.registro_operazioni (user_id, azione, oggetto_tipo, oggetto_id, dettagli) values (null, 'orari_applicati', 'annuncio', m.annuncio_id::text, jsonb_build_object('turni', m.turni));
end $$;
revoke execute on function public._chiudi_modifica(uuid) from public, anon, authenticated;

-- Il committente propone nuovi orari. Senza persone assegnate si cambiano subito;
-- con persone assegnate serve la loro nuova accettazione.
create function public.proponi_nuovi_orari(p_annuncio uuid, p_turni jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  t jsonb;
  id_mod uuid;
  r record;
begin
  select * into a from public.annunci where id = p_annuncio for update;
  if a.id is null or a.autore_id <> auth.uid() then raise exception 'Non è un tuo annuncio'; end if;
  if jsonb_typeof(p_turni) <> 'array' or jsonb_array_length(p_turni) not between 1 and 31 then raise exception 'Servono da 1 a 31 turni'; end if;
  for t in select * from jsonb_array_elements(p_turni) loop
    if (t ->> 'inizio')::timestamptz <= now() or (t ->> 'fine')::timestamptz <= (t ->> 'inizio')::timestamptz
       or (t ->> 'fine')::timestamptz - (t ->> 'inizio')::timestamptz > interval '16 hours' then raise exception 'Turni non validi'; end if;
  end loop;
  if not exists (select 1 from public.incarichi where annuncio_id = a.id and stato = 'programmato') then
    -- nessuno assegnato: le proposte in attesa si annullano e si applica subito
    update public.proposte set stato = 'annullata', risposta_il = now() where annuncio_id = a.id and stato = 'attesa';
    update public.candidature set stato = 'inviata', aggiornato_il = now() where annuncio_id = a.id and stato = 'in_attesa_conferma';
    return public.modifica_turni(a.id, p_turni);
  end if;
  if exists (select 1 from public.modifiche_orari where annuncio_id = a.id and stato = 'attesa') then
    return jsonb_build_object('ok', false, 'motivo', 'modifica_gia_in_attesa');
  end if;
  insert into public.modifiche_orari (annuncio_id, turni) values (a.id, p_turni) returning id into id_mod;
  update public.proposte set stato = 'annullata', risposta_il = now() where annuncio_id = a.id and stato = 'attesa';
  update public.candidature set stato = 'inviata', aggiornato_il = now() where annuncio_id = a.id and stato = 'in_attesa_conferma';
  for r in select lavoratore_id, id from public.incarichi where annuncio_id = a.id and stato = 'programmato' loop
    perform public._notifica(r.lavoratore_id, 'incarico_modificato', format('Il committente propone nuovi orari per «%s»: accetta o rifiuta dalla tua area.', a.titolo),
      jsonb_build_object('annuncio_id', a.id, 'modifica_id', id_mod), 'modifica-' || id_mod || '-' || r.id);
  end loop;
  perform public._registra('orari_proposti', 'annuncio', a.id::text, jsonb_build_object('turni', p_turni));
  return jsonb_build_object('ok', true, 'in_attesa', true, 'modifica_id', id_mod);
end $$;

-- Il lavoratore risponde ai nuovi orari. Se li rifiuta, l'incarico si annulla senza penalità
-- e senza contare nel limite mensile. Se li accetta, si ricontrolla la compatibilità.
create function public.rispondi_nuovi_orari(p_modifica uuid, p_accetta boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  m record;
  i record;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lavoratore:' || u, 0));
  select * into m from public.modifiche_orari where id = p_modifica and stato = 'attesa' for update;
  if m.id is null then return jsonb_build_object('ok', false, 'motivo', 'non_in_attesa'); end if;
  select * into i from public.incarichi where annuncio_id = m.annuncio_id and lavoratore_id = u and stato = 'programmato' for update;
  if i.id is null then return jsonb_build_object('ok', false, 'motivo', 'non_trovato'); end if;
  if p_accetta then
    if exists (select 1 from public.incarichi i2 join public.turni t2 on t2.annuncio_id = i2.annuncio_id,
                 jsonb_array_elements(m.turni) n
               where i2.lavoratore_id = u and i2.stato = 'programmato' and i2.id <> i.id
                 and t2.inizio < (n ->> 'fine')::timestamptz and (n ->> 'inizio')::timestamptz < t2.fine) then
      return jsonb_build_object('ok', false, 'motivo', 'incompatibile');
    end if;
  else
    update public.incarichi set stato = 'annullato', annullato_il = now(), annullato_da = 'committente', conta_nel_limite = false where id = i.id;
    update public.candidature set stato = 'annullata', motivo = 'nuovi_orari_rifiutati', aggiornato_il = now() where id = i.candidatura_id;
    update public.annunci set stato = 'pubblicato', aggiornato_il = now() where id = m.annuncio_id and stato = 'completo';
  end if;
  insert into public.risposte_orari (modifica_id, incarico_id, accetta) values (m.id, i.id, p_accetta);
  perform public._notifica(a.autore_id, 'incarico_modificato',
    case when p_accetta then 'Una persona assegnata ha accettato i nuovi orari.' else 'Una persona assegnata non può con i nuovi orari: il suo posto è di nuovo libero.' end,
    jsonb_build_object('annuncio_id', m.annuncio_id), 'risposta-orari-' || m.id || '-' || i.id)
    from public.annunci a where a.id = m.annuncio_id;
  perform public._registra(case when p_accetta then 'orari_accettati' else 'orari_rifiutati' end, 'incarico', i.id::text);
  perform public._chiudi_modifica(m.id);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Contestazioni ----------
create table public.contestazioni (
  id uuid primary key default gen_random_uuid(),
  incarico_id uuid not null references public.incarichi (id) on delete cascade,
  aperta_da uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (char_length(motivo) between 5 and 1000),
  stato text not null default 'aperta' check (stato in ('aperta', 'risolta', 'archiviata')),
  creato_il timestamptz not null default now(),
  chiusa_il timestamptz
);
alter table public.contestazioni enable row level security;
revoke all on public.contestazioni from anon, authenticated;

create function public.contesta_incarico(p_incarico uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  i record;
  primo timestamptz;
begin
  select * into i from public.incarichi where id = p_incarico for update;
  if i.id is null or u not in (i.lavoratore_id, i.committente_id) then raise exception 'Incarico non trovato'; end if;
  select min(inizio) into primo from public.turni where annuncio_id = i.annuncio_id;
  if primo > now() then return jsonb_build_object('ok', false, 'motivo', 'non_iniziato'); end if;
  if i.stato not in ('programmato', 'completato') then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then return jsonb_build_object('ok', false, 'motivo', 'motivo_breve'); end if;
  insert into public.contestazioni (incarico_id, aperta_da, motivo) values (i.id, u, left(btrim(p_motivo), 1000));
  update public.incarichi set stato = 'contestato' where id = i.id;
  perform public._notifica(case when u = i.lavoratore_id then i.committente_id else i.lavoratore_id end, 'incarico_contestato',
    'È stata aperta una contestazione su un incarico. Il team JobExpress la esaminerà.', jsonb_build_object('incarico_id', i.id), 'contestazione-' || i.id);
  perform public._registra('incarico_contestato', 'incarico', i.id::text);
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_contestazioni() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'motivo', c.motivo, 'stato', c.stato, 'creato_il', c.creato_il,
      'titolo', a.titolo, 'da', case when c.aperta_da = i.lavoratore_id then 'lavoratore' else 'committente' end) order by c.creato_il desc)
    from public.contestazioni c join public.incarichi i on i.id = c.incarico_id join public.annunci a on a.id = i.annuncio_id), '[]'::jsonb);
end $$;

create function public.admin_chiudi_contestazione(p_id uuid, p_esito text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if p_esito not in ('risolta', 'archiviata') then raise exception 'Esito non valido'; end if;
  update public.contestazioni set stato = p_esito, chiusa_il = now() where id = p_id;
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'contestazione_' || p_esito, jsonb_build_object('id', p_id));
end $$;

-- permessi
revoke execute on function public.mie_candidature() from public, anon;
revoke execute on function public.miei_annunci() from public, anon;
revoke execute on function public.annulla_annuncio(uuid) from public, anon;
revoke execute on function public.proponi_nuovi_orari(uuid, jsonb) from public, anon;
revoke execute on function public.rispondi_nuovi_orari(uuid, boolean) from public, anon;
revoke execute on function public.contesta_incarico(uuid, text) from public, anon;
revoke execute on function public.admin_contestazioni() from public, anon;
revoke execute on function public.admin_chiudi_contestazione(uuid, text) from public, anon;
grant execute on function public.mie_candidature() to authenticated;
grant execute on function public.miei_annunci() to authenticated;
grant execute on function public.annulla_annuncio(uuid) to authenticated;
grant execute on function public.proponi_nuovi_orari(uuid, jsonb) to authenticated;
grant execute on function public.rispondi_nuovi_orari(uuid, boolean) to authenticated;
grant execute on function public.contesta_incarico(uuid, text) to authenticated;
grant execute on function public.admin_contestazioni() to authenticated;
grant execute on function public.admin_chiudi_contestazione(uuid, text) to authenticated;

-- Con i nuovi orari applicati, le altre candidature delle persone assegnate che ora si sovrappongono
-- vengono ritirate (come quando si conferma un incarico).
create or replace function public._ritira_incompatibili_annuncio(p_annuncio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    update public.candidature c set stato = 'ritirata_incompatibile', motivo = 'nuovi_orari_altro_incarico', aggiornato_il = now()
    where c.annuncio_id <> p_annuncio and c.stato in ('inviata', 'in_valutazione', 'in_attesa_conferma')
      and c.lavoratore_id in (select lavoratore_id from public.incarichi where annuncio_id = p_annuncio and stato = 'programmato')
      and exists (select 1 from public.turni t1 join public.turni t2 on t2.annuncio_id = p_annuncio
                  where t1.annuncio_id = c.annuncio_id and t1.inizio < t2.fine and t2.inizio < t1.fine)
    returning c.id, c.lavoratore_id
  loop
    update public.proposte set stato = 'annullata', risposta_il = now() where candidatura_id = r.id and stato = 'attesa';
    perform public._notifica(r.lavoratore_id, 'candidature_ritirate', 'Una tua candidatura è stata ritirata perché si sovrappone ai nuovi orari di un incarico confermato.', '{}'::jsonb, 'ritiro-orari-' || r.id);
  end loop;
end $$;
revoke execute on function public._ritira_incompatibili_annuncio(uuid) from public, anon, authenticated;
