-- =====================================================================
-- JobExpress · Fase 3 «Sicurezza e reputazione» (28/11/2026)
-- JobExpress Safe essenziale: condivisione volontaria dell'incarico con link temporaneo e revocabile,
-- centro segnalazioni ampliato (priorità, allegati protetti, stati), blocchi gestibili.
-- Recensioni reciproche a DOPPIO CIECO: 14 giorni, pubblicazione simultanea o alla scadenza,
-- nessuna lettura anticipata (né API né medie), moderazione, replica, nessun badge aziendale.
-- Safe avanzato (contatti di fiducia, avvisi automatici) resta SPENTO.
-- =====================================================================

insert into public.impostazioni (chiave, valore, descrizione) values
  ('safe_basic_enabled', 'true', 'Centro sicurezza, segnalazioni, blocchi, condivisione dell''incarico'),
  ('safe_trusted_contacts_enabled', 'false', 'Contatti di fiducia registrati (futuro, serve valutazione legale)'),
  ('safe_automatic_alerts_enabled', 'false', 'Promemoria e avvisi automatici ai contatti di fiducia (futuro)'),
  ('condivisione_ore_dopo_fine', '2', 'Ore di validità del link di condivisione dopo la fine dell''incarico'),
  ('reciprocal_reviews_enabled', 'true', 'Recensioni reciproche tra lavoratore e committente'),
  ('double_blind_reviews_enabled', 'true', 'Doppio cieco: nessuno legge prima della pubblicazione'),
  ('review_window_days', '14', 'Giorni per lasciare la recensione dopo il completamento')
on conflict (chiave) do nothing;

-- ---------- Condivisione dell'incarico con una persona di fiducia ----------
create table if not exists public.condivisioni_incarico (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  incarico_id uuid not null references public.incarichi (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  con_indirizzo boolean not null default false,
  scade_il timestamptz not null,
  revocata_il timestamptz,
  aperture int not null default 0,
  creato_il timestamptz not null default now()
);
alter table public.condivisioni_incarico enable row level security;
revoke all on public.condivisioni_incarico from anon, authenticated;
grant select on public.condivisioni_incarico to authenticated;
create policy condivisioni_proprie on public.condivisioni_incarico for select to authenticated using (user_id = auth.uid());

create or replace function public.crea_condivisione(p_incarico uuid, p_con_indirizzo boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); i record; fine timestamptz; tok uuid; n int;
begin
  if not (public._imp('safe_basic_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  select * into i from public.incarichi where id = p_incarico;
  if i.id is null or i.lavoratore_id <> u then raise exception 'Incarico non trovato'; end if;
  if i.stato <> 'programmato' then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  select max(t.fine) into fine from public.turni t where t.annuncio_id = i.annuncio_id;
  if fine <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_finito'); end if;
  select count(*) into n from public.condivisioni_incarico where incarico_id = i.id and revocata_il is null and scade_il > now();
  if n >= 3 then return jsonb_build_object('ok', false, 'motivo', 'troppe'); end if;
  insert into public.condivisioni_incarico (incarico_id, user_id, con_indirizzo, scade_il)
  values (i.id, u, coalesce(p_con_indirizzo, false), fine + make_interval(hours => (public._imp('condivisione_ore_dopo_fine'))::int))
  returning token into tok;
  perform public._registra('condivisione_creata', 'incarico', i.id::text, jsonb_build_object('con_indirizzo', p_con_indirizzo));
  return jsonb_build_object('ok', true, 'token', tok, 'scade_il', fine + make_interval(hours => (public._imp('condivisione_ore_dopo_fine'))::int));
end $$;
revoke execute on function public.crea_condivisione(uuid, boolean) from public, anon;
grant execute on function public.crea_condivisione(uuid, boolean) to authenticated;

create or replace function public.revoca_condivisione(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.condivisioni_incarico set revocata_il = now() where id = p_id and user_id = auth.uid() and revocata_il is null;
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.revoca_condivisione(uuid) from public, anon;
grant execute on function public.revoca_condivisione(uuid) to authenticated;

create or replace function public.mie_condivisioni(p_incarico uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'token', c.token, 'con_indirizzo', c.con_indirizzo, 'scade_il', c.scade_il,
    'attiva', c.revocata_il is null and c.scade_il > now(), 'aperture', c.aperture, 'creato_il', c.creato_il) order by c.creato_il desc), '[]')
  from public.condivisioni_incarico c where c.incarico_id = p_incarico and c.user_id = auth.uid();
$$;
revoke execute on function public.mie_condivisioni(uuid) from public, anon;
grant execute on function public.mie_condivisioni(uuid) to authenticated;

-- Lettura pubblica tramite link segreto: solo dati essenziali, mai codice fiscale, documenti, telefono, CV.
create or replace function public.leggi_condivisione(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record; r jsonb;
begin
  select * into c from public.condivisioni_incarico where token = p_token;
  if c.id is null or c.revocata_il is not null or c.scade_il <= now() then return null; end if;
  update public.condivisioni_incarico set aperture = aperture + 1 where id = c.id;
  select jsonb_build_object(
    'persona', coalesce((select nome from public.profili where id = i.lavoratore_id), 'Una persona'),
    'mansione', coalesce(a.mansione, a.titolo), 'committente', a.nome_pubblico,
    'citta', a.citta, 'zona', a.zona,
    'indirizzo', case when c.con_indirizzo then (select ai.indirizzo from public.annunci_indirizzi ai where ai.annuncio_id = a.id) end,
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id),
    'stato', i.stato, 'scade_il', c.scade_il)
  into r from public.incarichi i join public.annunci a on a.id = i.annuncio_id where i.id = c.incarico_id;
  return r;
end $$;
revoke execute on function public.leggi_condivisione(uuid) from public;
grant execute on function public.leggi_condivisione(uuid) to anon, authenticated;

-- ---------- Segnalazioni ampliate ----------
alter table public.segnalazioni_utenti drop constraint if exists segnalazioni_utenti_tipo_check;
alter table public.segnalazioni_utenti drop constraint if exists segnalazioni_utenti_stato_check;
alter table public.segnalazioni_utenti
  add constraint segnalazioni_utenti_tipo_check check (tipo in ('foto', 'profilo_falso', 'comportamento', 'annuncio', 'sicurezza', 'altro',
    'annuncio_fraudolento', 'molestie', 'discriminazione', 'aggressivita', 'condizioni_pericolose', 'accordi_non_rispettati',
    'mancato_pagamento', 'lavoro_irregolare', 'furto_identita', 'recensione')),
  add constraint segnalazioni_utenti_stato_check check (stato in ('aperta', 'in_esame', 'info_richieste', 'in_revisione', 'risolta', 'archiviata', 'contestata')),
  add column if not exists incarico_id uuid references public.incarichi (id) on delete set null,
  add column if not exists recensione_id uuid,
  add column if not exists priorita text not null default 'normale' check (priorita in ('normale', 'alta', 'urgente')),
  add column if not exists pericolo_immediato boolean not null default false,
  add column if not exists allegati text[] not null default '{}',
  add column if not exists contestazione text check (contestazione is null or char_length(contestazione) <= 1000);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('segnalazioni', 'segnalazioni', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "allegati segnalazioni: carico nella mia cartella" on storage.objects for insert to authenticated
  with check (bucket_id = 'segnalazioni' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "allegati segnalazioni: vedo i miei o se admin" on storage.objects for select to authenticated
  using (bucket_id = 'segnalazioni' and ((storage.foldername(name))[1] = auth.uid()::text or public.sono_admin()));

create or replace function public.segnala(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t text := p ->> 'tipo'; nuovo bigint; seg uuid; ann uuid; inc uuid; rec uuid; prio text; all_ text[];
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if (select count(*) from public.segnalazioni_utenti where autore_id = u and creato_il > now() - interval '1 day') >= (public._imp('limite_segnalazioni_giorno'))::int then
    raise exception 'TRUST:troppe_richieste';
  end if;
  seg := nullif(p ->> 'segnalato_id', '')::uuid; ann := nullif(p ->> 'annuncio_id', '')::uuid; inc := nullif(p ->> 'incarico_id', '')::uuid; rec := nullif(p ->> 'recensione_id', '')::uuid;
  if seg = u then raise exception 'Operazione non valida'; end if;
  if inc is not null and not exists (select 1 from public.incarichi i where i.id = inc and u in (i.lavoratore_id, i.committente_id)) then raise exception 'Incarico non valido'; end if;
  if inc is not null and seg is null then select case when i.lavoratore_id = u then i.committente_id else i.lavoratore_id end into seg from public.incarichi i where i.id = inc; end if;
  if rec is not null then select autore_id into seg from public.recensioni where id = rec and stato = 'pubblicata'; if seg is null then raise exception 'Recensione non valida'; end if; end if;
  if ann is not null and seg is null then select autore_id into seg from public.annunci where id = ann; end if;
  all_ := coalesce(array(select x from jsonb_array_elements_text(coalesce(p -> 'allegati', '[]')) x where split_part(x, '/', 1) = u::text limit 5), '{}');
  prio := case when coalesce((p ->> 'pericolo_immediato')::boolean, false) or t in ('molestie', 'aggressivita', 'condizioni_pericolose', 'sicurezza') then 'urgente'
               when t in ('furto_identita', 'discriminazione', 'lavoro_irregolare', 'annuncio_fraudolento', 'profilo_falso') then 'alta' else 'normale' end;
  insert into public.segnalazioni_utenti (autore_id, segnalato_id, annuncio_id, incarico_id, recensione_id, tipo, motivo, priorita, pericolo_immediato, allegati)
  values (u, seg, ann, inc, rec, t, left(btrim(coalesce(p ->> 'motivo', '')), 1000), prio, coalesce((p ->> 'pericolo_immediato')::boolean, false), all_)
  returning id into nuovo;
  if t = 'foto' and seg is not null then
    update public.profili_professionali set foto_stato = 'in_revisione' where user_id = seg and foto_stato in ('caricata', 'verificata');
  end if;
  perform public._registra('segnalazione', 'segnalazione', nuovo::text, jsonb_build_object('tipo', t, 'priorita', prio));
  return jsonb_build_object('ok', true, 'id', nuovo, 'priorita', prio);
end $$;
revoke execute on function public.segnala(jsonb) from public, anon;
grant execute on function public.segnala(jsonb) to authenticated;

-- Chi segnala vede solo lo stato delle SUE segnalazioni (mai chi l'ha segnalato vede chi è stato)
create or replace function public.mie_segnalazioni() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'tipo', s.tipo, 'stato', s.stato, 'priorita', s.priorita, 'esito', s.esito,
    'creato_il', s.creato_il, 'gestita_il', s.gestita_il, 'contestazione', s.contestazione) order by s.creato_il desc), '[]')
  from public.segnalazioni_utenti s where s.autore_id = auth.uid();
$$;
revoke execute on function public.mie_segnalazioni() from public, anon;
grant execute on function public.mie_segnalazioni() to authenticated;

create or replace function public.contesta_esito_segnalazione(p_id bigint, p_testo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(btrim(coalesce(p_testo, ''))) < 5 then return jsonb_build_object('ok', false, 'motivo', 'testo_breve'); end if;
  update public.segnalazioni_utenti set stato = 'contestata', contestazione = left(btrim(p_testo), 1000)
  where id = p_id and autore_id = auth.uid() and stato in ('risolta', 'archiviata');
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.contesta_esito_segnalazione(bigint, text) from public, anon;
grant execute on function public.contesta_esito_segnalazione(bigint, text) to authenticated;

create or replace function public.admin_gestisci_segnalazione(p_id bigint, p_stato text, p_esito text) returns void
language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if p_stato not in ('in_esame', 'info_richieste', 'in_revisione', 'risolta', 'archiviata') then raise exception 'Stato non valido'; end if;
  update public.segnalazioni_utenti set stato = p_stato, esito = left(p_esito, 500), gestita_il = case when p_stato in ('risolta', 'archiviata') then now() end
  where id = p_id returning autore_id into a;
  if a is not null and p_stato in ('info_richieste', 'risolta', 'archiviata') then
    perform public._notifica(a, 'segnalazione', case p_stato when 'info_richieste' then 'Ci servono altre informazioni sulla tua segnalazione: rispondi dall''assistenza.' else 'La tua segnalazione è stata gestita. Trovi l''esito nel Centro sicurezza.' end,
      jsonb_build_object('segnalazione_id', p_id), 'segnalazione-' || p_id || '-' || p_stato);
  end if;
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'segnalazione_' || p_stato, jsonb_build_object('id', p_id, 'esito', p_esito));
end $$;

create or replace function public.miei_blocchi() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.bloccato_id, 'nome', coalesce(p.nome, 'Utente'), 'creato_il', b.creato_il) order by b.creato_il desc), '[]')
  from public.blocchi b left join public.profili p on p.id = b.bloccato_id where b.utente_id = auth.uid();
$$;
revoke execute on function public.miei_blocchi() from public, anon;
grant execute on function public.miei_blocchi() to authenticated;

create or replace function public.sblocca_utente(p_utente uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.blocchi where utente_id = auth.uid() and bloccato_id = p_utente;
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.sblocca_utente(uuid) from public, anon;
grant execute on function public.sblocca_utente(uuid) to authenticated;

-- ---------- Recensioni reciproche a doppio cieco ----------
create table if not exists public.periodi_recensione (
  incarico_id uuid primary key references public.incarichi (id) on delete cascade,
  apre_il timestamptz not null default now(),
  chiude_il timestamptz not null,
  stato text not null default 'aperto' check (stato in ('aperto', 'pubblicato', 'chiuso_vuoto')),
  pubblicato_il timestamptz,
  promemoria_il timestamptz
);
alter table public.periodi_recensione enable row level security;
revoke all on public.periodi_recensione from anon, authenticated;

create table if not exists public.recensioni (
  id uuid primary key default gen_random_uuid(),
  incarico_id uuid not null references public.incarichi (id) on delete cascade,
  autore_id uuid not null references auth.users (id) on delete cascade,
  destinatario_id uuid not null references auth.users (id) on delete cascade,
  ruolo_autore text not null check (ruolo_autore in ('lavoratore', 'committente')),
  voti jsonb not null default '{}',
  media numeric check (media is null or (media >= 1 and media <= 5)),
  commento text check (commento is null or char_length(commento) <= 1000),
  stato text not null default 'bozza' check (stato in ('bozza', 'inviata', 'pubblicata', 'rimossa')),
  inviata_il timestamptz,
  pubblicata_il timestamptz,
  risposta text check (risposta is null or char_length(risposta) <= 600),
  risposta_il timestamptz,
  rimossa_motivo text,
  aggiornata_il timestamptz not null default now(),
  unique (incarico_id, autore_id),
  check (autore_id <> destinatario_id)
);
create index if not exists recensioni_destinatario on public.recensioni (destinatario_id) where stato = 'pubblicata';
alter table public.recensioni enable row level security;
revoke all on public.recensioni from anon, authenticated;
grant select on public.recensioni to authenticated;
-- l'autore vede la sua (anche in bozza); tutti gli altri SOLO le pubblicate. Il doppio cieco è nel database.
create policy recensioni_proprie_o_pubblicate on public.recensioni for select to authenticated
  using (autore_id = auth.uid() or stato = 'pubblicata');

create or replace function public._apri_periodo_recensione() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stato = 'completato' and old.stato is distinct from 'completato' then
    insert into public.periodi_recensione (incarico_id, apre_il, chiude_il)
    values (new.id, now(), now() + make_interval(days => (public._imp('review_window_days'))::int))
    on conflict do nothing;
    perform public._notifica(x, 'recensione', 'Puoi lasciare una recensione sull''incarico completato. Resta nascosta finché anche l''altra parte non scrive la sua o passano 14 giorni.',
      jsonb_build_object('incarico_id', new.id), 'recensione-apre-' || new.id) from unnest(array[new.lavoratore_id, new.committente_id]) x;
  end if;
  return new;
end $$;
revoke execute on function public._apri_periodo_recensione() from public, anon, authenticated;
drop trigger if exists incarichi_periodo_recensione on public.incarichi;
create trigger incarichi_periodo_recensione after update of stato on public.incarichi for each row execute function public._apri_periodo_recensione();

-- incarichi già completati prima di oggi: si apre il periodo da adesso
insert into public.periodi_recensione (incarico_id, apre_il, chiude_il)
select id, now(), now() + interval '14 days' from public.incarichi where stato = 'completato' on conflict do nothing;

-- Pubblica le recensioni INVIATE di un incarico, tutte insieme (atomico, idempotente)
create or replace function public._pubblica_recensioni(p_incarico uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; i record;
begin
  update public.recensioni set stato = 'pubblicata', pubblicata_il = now(), aggiornata_il = now()
  where incarico_id = p_incarico and stato = 'inviata';
  get diagnostics n = row_count;
  update public.periodi_recensione set stato = case when n > 0 or exists (select 1 from public.recensioni where incarico_id = p_incarico and stato = 'pubblicata') then 'pubblicato' else 'chiuso_vuoto' end,
    pubblicato_il = now() where incarico_id = p_incarico and stato = 'aperto';
  if n > 0 then
    select * into i from public.incarichi where id = p_incarico;
    perform public._notifica(x, 'recensione', 'Le recensioni del vostro incarico sono state pubblicate.', jsonb_build_object('incarico_id', p_incarico), 'recensione-pubblicata-' || p_incarico)
      from unnest(array[i.lavoratore_id, i.committente_id]) x;
  end if;
  return n;
end $$;
revoke execute on function public._pubblica_recensioni(uuid) from public, anon, authenticated;

create or replace function public.salva_recensione(p_incarico uuid, p_voti jsonb, p_commento text default null, p_invia boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); i record; pr record; ruolo text; dest uuid; cats text[]; k text; v jsonb; puliti jsonb := '{}'; somma numeric := 0; n int := 0; m numeric; esistente record;
begin
  if not (public._imp('reciprocal_reviews_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  select * into i from public.incarichi where id = p_incarico;
  if i.id is null or u not in (i.lavoratore_id, i.committente_id) then raise exception 'Incarico non trovato'; end if;
  if i.stato <> 'completato' then return jsonb_build_object('ok', false, 'motivo', 'non_completato'); end if;
  select * into pr from public.periodi_recensione where incarico_id = i.id for update;
  if pr.incarico_id is null or pr.stato <> 'aperto' or pr.chiude_il <= now() then return jsonb_build_object('ok', false, 'motivo', 'periodo_chiuso'); end if;
  ruolo := case when u = i.lavoratore_id then 'lavoratore' else 'committente' end;
  dest := case when ruolo = 'lavoratore' then i.committente_id else i.lavoratore_id end;
  -- il lavoratore valuta il committente; il committente valuta il lavoratore
  cats := case when ruolo = 'lavoratore' then array['rispetto_compenso', 'rispetto_orari', 'ambiente', 'comunicazione', 'organizzazione']
               else array['puntualita', 'professionalita', 'qualita', 'comunicazione', 'rispetto_accordi'] end;
  for k in select jsonb_object_keys(coalesce(p_voti, '{}')) loop
    if not (k = any (cats)) then raise exception 'Categoria non valida: %', k; end if;
    v := p_voti -> k;
    if v is null or jsonb_typeof(v) = 'null' then puliti := puliti || jsonb_build_object(k, null);     -- «non valutabile»
    elsif jsonb_typeof(v) = 'number' and (v::text)::numeric in (1, 2, 3, 4, 5) then
      puliti := puliti || jsonb_build_object(k, v); somma := somma + (v::text)::numeric; n := n + 1;
    else raise exception 'Voto non valido'; end if;
  end loop;
  if p_invia and n = 0 then return jsonb_build_object('ok', false, 'motivo', 'serve_un_voto'); end if;
  m := case when n > 0 then round(somma / n, 2) end;
  select * into esistente from public.recensioni where incarico_id = i.id and autore_id = u for update;
  if esistente.id is not null and esistente.stato <> 'bozza' then return jsonb_build_object('ok', false, 'motivo', 'gia_inviata'); end if;
  insert into public.recensioni (incarico_id, autore_id, destinatario_id, ruolo_autore, voti, media, commento, stato, inviata_il)
  values (i.id, u, dest, ruolo, puliti, m, nullif(left(btrim(coalesce(p_commento, '')), 1000), ''), case when p_invia then 'inviata' else 'bozza' end, case when p_invia then now() end)
  on conflict (incarico_id, autore_id) do update set voti = excluded.voti, media = excluded.media, commento = excluded.commento,
    stato = excluded.stato, inviata_il = excluded.inviata_il, aggiornata_il = now();
  if p_invia then
    perform public._registra('recensione_inviata', 'incarico', i.id::text, '{}'::jsonb);
    -- entrambe inviate → pubblicazione simultanea
    if (select count(*) from public.recensioni where incarico_id = i.id and stato = 'inviata') = 2 then
      perform public._pubblica_recensioni(i.id);
      return jsonb_build_object('ok', true, 'stato', 'pubblicata');
    end if;
    return jsonb_build_object('ok', true, 'stato', 'inviata', 'pubblicazione_entro', pr.chiude_il);
  end if;
  return jsonb_build_object('ok', true, 'stato', 'bozza');
end $$;
revoke execute on function public.salva_recensione(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.salva_recensione(uuid, jsonb, text, boolean) to authenticated;

-- Le mie recensioni da scrivere / scritte / ricevute (quelle ricevute SOLO se pubblicate)
create or replace function public.mie_recensioni() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'incarico_id', i.id, 'titolo', a.titolo, 'ruolo', case when i.lavoratore_id = auth.uid() then 'lavoratore' else 'committente' end,
    'altra_parte', coalesce(case when i.lavoratore_id = auth.uid() then a.nome_pubblico else (select nome from public.profili where id = i.lavoratore_id) end, 'Utente'),
    'completato_il', i.completato_il, 'periodo', jsonb_build_object('stato', pr.stato, 'chiude_il', pr.chiude_il),
    'mia', (select jsonb_build_object('id', r.id, 'stato', r.stato, 'voti', r.voti, 'media', r.media, 'commento', r.commento, 'risposta', r.risposta)
            from public.recensioni r where r.incarico_id = i.id and r.autore_id = auth.uid()),
    'ricevuta', (select jsonb_build_object('id', r.id, 'voti', r.voti, 'media', r.media, 'commento', r.commento, 'risposta', r.risposta, 'pubblicata_il', r.pubblicata_il)
                 from public.recensioni r where r.incarico_id = i.id and r.destinatario_id = auth.uid() and r.stato = 'pubblicata')
  ) order by i.completato_il desc nulls last), '[]')
  from public.incarichi i join public.annunci a on a.id = i.annuncio_id join public.periodi_recensione pr on pr.incarico_id = i.id
  where auth.uid() in (i.lavoratore_id, i.committente_id) and i.stato = 'completato';
$$;
revoke execute on function public.mie_recensioni() from public, anon;
grant execute on function public.mie_recensioni() to authenticated;

-- Reputazione pubblica: solo recensioni PUBBLICATE e non rimosse. Nessun voto di partenza per chi è nuovo.
create or replace function public.reputazione_pubblica(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with r as (select * from public.recensioni where destinatario_id = p_user and stato = 'pubblicata')
  select jsonb_build_object(
    'recensioni', (select count(*) from r),
    'media', (select round(avg(media), 2) from r),
    'distribuzione', (select jsonb_object_agg(s, (select count(*) from r where round(r.media) = s)) from generate_series(1, 5) s),
    'per_categoria', (select coalesce(jsonb_object_agg(k, m), '{}') from (select k, round(avg((r.voti ->> k)::numeric), 2) m from r, jsonb_object_keys(r.voti) k where r.voti ->> k is not null group by k) z),
    'collaborazioni', (select count(*) from public.incarichi i where i.stato = 'completato' and p_user in (i.lavoratore_id, i.committente_id)),
    'commenti', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'media', r.media, 'commento', r.commento, 'ruolo_autore', r.ruolo_autore,
        'quando', to_char(r.pubblicata_il, 'YYYY-MM'), 'risposta', r.risposta) order by r.pubblicata_il desc), '[]')
      from (select * from r where commento is not null order by pubblicata_il desc limit 20) r));
$$;
revoke execute on function public.reputazione_pubblica(uuid) from public, anon;
grant execute on function public.reputazione_pubblica(uuid) to authenticated;

-- Diritto di replica (una volta, a recensione pubblicata)
create or replace function public.rispondi_recensione(p_id uuid, p_testo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(btrim(coalesce(p_testo, ''))) < 3 then return jsonb_build_object('ok', false, 'motivo', 'testo_breve'); end if;
  update public.recensioni set risposta = left(btrim(p_testo), 600), risposta_il = now()
  where id = p_id and destinatario_id = auth.uid() and stato = 'pubblicata' and risposta is null;
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.rispondi_recensione(uuid, text) from public, anon;
grant execute on function public.rispondi_recensione(uuid, text) to authenticated;

-- Rimozione motivata (solo admin, registrata). Le medie si ricalcolano da sole perché escludono le rimosse.
create or replace function public.admin_rimuovi_recensione(p_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Serve un motivo'; end if;
  update public.recensioni set stato = 'rimossa', rimossa_motivo = left(p_motivo, 500), aggiornata_il = now() where id = p_id and stato = 'pubblicata';
  if found then insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'recensione_rimossa', jsonb_build_object('id', p_id, 'motivo', p_motivo)); end if;
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.admin_rimuovi_recensione(uuid, text) from public, anon;
grant execute on function public.admin_rimuovi_recensione(uuid, text) to authenticated;

-- Scadenza dei 14 giorni e promemoria (2 giorni prima, solo a chi non ha inviato)
create or replace function public.processi_recensioni() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x record; n int := 0; p int := 0;
begin
  for x in select incarico_id from public.periodi_recensione where stato = 'aperto' and chiude_il <= now() for update skip locked loop
    perform public._pubblica_recensioni(x.incarico_id); n := n + 1;
  end loop;
  for x in select pr.incarico_id, i.lavoratore_id, i.committente_id from public.periodi_recensione pr join public.incarichi i on i.id = pr.incarico_id
           where pr.stato = 'aperto' and pr.promemoria_il is null and pr.chiude_il - now() < interval '2 days' loop
    perform public._notifica(y, 'recensione', 'Mancano 2 giorni per lasciare la recensione. È facoltativa: se non scrivi, non succede niente.', jsonb_build_object('incarico_id', x.incarico_id), 'recensione-promemoria-' || x.incarico_id)
      from unnest(array[x.lavoratore_id, x.committente_id]) y
      where not exists (select 1 from public.recensioni r where r.incarico_id = x.incarico_id and r.autore_id = y and r.stato <> 'bozza');
    update public.periodi_recensione set promemoria_il = now() where incarico_id = x.incarico_id; p := p + 1;
  end loop;
  return jsonb_build_object('periodi_chiusi', n, 'promemoria', p);
end $$;
revoke execute on function public.processi_recensioni() from public, anon, authenticated;

create or replace function public.processi_operativi() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n1 int := 0; n2 int := 0; n3 int := 0; x record; esito_tot jsonb := '{}'; rr jsonb;
begin
  begin
    update public.disponibilita_live set stato = 'scaduta', chiusa_il = now() where stato = 'attiva' and fine <= now();
    get diagnostics n1 = row_count;
    esito_tot := esito_tot || jsonb_build_object('live_scadute', n1);
  exception when others then
    insert into public.registro_processi (nome, esito, dettagli) values ('live_scadenza', 'errore', jsonb_build_object('errore', sqlerrm));
  end;
  begin
    for x in update public.proposte_dirette set stato = 'scaduta', risposta_il = now()
             where stato in ('inviata', 'chiarimento') and scade_il <= now() returning id, committente_id, annuncio_id loop
      perform public._notifica(x.committente_id, 'proposta_live', 'Una proposta diretta è scaduta senza risposta. Nessun problema: puoi contattare un''altra persona.', jsonb_build_object('annuncio_id', x.annuncio_id), 'proposta-live-scad-' || x.id);
      n2 := n2 + 1;
    end loop;
    esito_tot := esito_tot || jsonb_build_object('proposte_scadute', n2);
  exception when others then
    insert into public.registro_processi (nome, esito, dettagli) values ('proposte_dirette_scadenza', 'errore', jsonb_build_object('errore', sqlerrm));
  end;
  for x in select id from public.rescue_richieste where stato = 'attiva' loop
    begin
      perform public._rescue_avanza(x.id);
      n3 := n3 + 1;
    exception when others then
      insert into public.registro_processi (nome, esito, dettagli) values ('rescue_avanza', 'errore', jsonb_build_object('rescue', x.id, 'errore', sqlerrm));
    end;
  end loop;
  esito_tot := esito_tot || jsonb_build_object('rescue_avanzate', n3);
  begin
    rr := public.processi_recensioni();
    esito_tot := esito_tot || rr;
  exception when others then
    insert into public.registro_processi (nome, esito, dettagli) values ('recensioni', 'errore', jsonb_build_object('errore', sqlerrm));
  end;
  if n1 + n2 + n3 + coalesce((rr ->> 'periodi_chiusi')::int, 0) + coalesce((rr ->> 'promemoria')::int, 0) > 0 then
    insert into public.registro_processi (nome, esito, dettagli) values ('processi_operativi', 'ok', esito_tot);
  end if;
  return esito_tot;
end $$;
revoke execute on function public.processi_operativi() from public, anon, authenticated;

-- ---------- Admin: Safe e recensioni ----------
create or replace function public.admin_safe() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return jsonb_build_object(
    'segnalazioni_aperte', (select count(*) from public.segnalazioni_utenti where stato in ('aperta', 'in_esame', 'info_richieste', 'in_revisione', 'contestata')),
    'urgenti', (select count(*) from public.segnalazioni_utenti where priorita = 'urgente' and stato in ('aperta', 'in_esame', 'info_richieste', 'in_revisione')),
    'per_tipo', (select coalesce(jsonb_object_agg(tipo, n), '{}') from (select tipo, count(*) n from public.segnalazioni_utenti group by 1) z),
    'condivisioni_attive', (select count(*) from public.condivisioni_incarico where revocata_il is null and scade_il > now()),
    'blocchi', (select count(*) from public.blocchi),
    'recensioni_pubblicate', (select count(*) from public.recensioni where stato = 'pubblicata'),
    'recensioni_in_attesa', (select count(*) from public.recensioni where stato = 'inviata'),
    'recensioni_rimosse', (select count(*) from public.recensioni where stato = 'rimossa'),
    'incarichi_recensiti_perc', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where exists (select 1 from public.recensioni r where r.incarico_id = pr.incarico_id and r.stato = 'pubblicata')) / count(*)) end from public.periodi_recensione pr where pr.stato <> 'aperto'),
    'coda', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tipo', s.tipo, 'priorita', s.priorita, 'stato', s.stato, 'motivo', s.motivo, 'pericolo', s.pericolo_immediato,
        'allegati', s.allegati, 'contestazione', s.contestazione, 'recensione_id', s.recensione_id, 'creato_il', s.creato_il,
        'segnalato', coalesce((select nome from public.profili where id = s.segnalato_id), '—'), 'segnalato_id', s.segnalato_id)
        order by case s.priorita when 'urgente' then 0 when 'alta' then 1 else 2 end, s.creato_il)
      from public.segnalazioni_utenti s where s.stato in ('aperta', 'in_esame', 'info_richieste', 'in_revisione', 'contestata')), '[]'));
end $$;
revoke execute on function public.admin_safe() from public, anon;
grant execute on function public.admin_safe() to authenticated;
