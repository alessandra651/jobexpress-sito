-- =====================================================================
-- JobExpress · Fase 1 «Fondamenta» (28/11/2026)
-- Assegnazioni individuali con versioni delle condizioni, stato dei posti negli annunci multipli,
-- annullamenti con fasce temporali (senza penalità automatiche), mancata presentazione da verificare,
-- richieste di modifica delle condizioni con confronto e nuova accettazione.
--
-- Cosa ESISTEVA già e viene riusato: annunci (posti 1–50), turni, candidature, proposte con scadenza,
-- incarichi = un'assegnazione individuale per persona, blocco atomico dei posti (FOR UPDATE + advisory lock),
-- controllo sovrapposizioni, ritiro automatico delle incompatibili, cambio orari a livello di annuncio.
-- Nessuna tabella o colonna esistente viene eliminata.
-- =====================================================================

-- ---------- Impostazioni (interruttori lato server) ----------
insert into public.impostazioni (chiave, valore, descrizione) values
  ('annullamento_anticipato_ore', '24', 'Oltre queste ore prima dell''inizio: annullamento anticipato'),
  ('annullamento_tardivo_ore', '6', 'Da queste ore a quelle dell''anticipato: annullamento tardivo'),
  ('annullamento_urgente_ore', '1', 'Da queste ore al tardivo: urgente; sotto: critico'),
  ('automatic_reputation_penalties_enabled', 'false', 'Penalità reputazionali automatiche (spente: nessuna sanzione automatica)'),
  ('employer_badge_enabled', 'false', 'Badge aziendali a livelli (non previsti)'),
  ('business_multi_position_enabled', 'true', 'Annunci con più posti'),
  ('modifica_condizioni_enabled', 'true', 'Richieste di modifica delle condizioni dopo la conferma')
on conflict (chiave) do nothing;

-- ---------- Annunci: informazioni obbligatorie per un incarico completo ----------
alter table public.annunci
  add column if not exists mansione text check (mansione is null or char_length(mansione) <= 80),
  add column if not exists requisiti text check (requisiti is null or char_length(requisiti) <= 1000),
  add column if not exists qualifiche_obbligatorie text[] not null default '{}',
  add column if not exists tipo_rapporto text not null default 'da_definire'
    check (tipo_rapporto in ('da_definire', 'prestazione_occasionale', 'lavoro_subordinato', 'lavoro_intermittente', 'somministrazione', 'lavoro_autonomo', 'altro')),
  add column if not exists info_sicurezza text check (info_sicurezza is null or char_length(info_sicurezza) <= 1000);

create or replace function public.pubblica_annuncio(p_annuncio jsonb, p_turni jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  nuovo uuid;
  t jsonb;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if jsonb_typeof(p_turni) <> 'array' or jsonb_array_length(p_turni) not between 1 and 31 then
    raise exception 'Servono da 1 a 31 turni';
  end if;
  if coalesce((p_annuncio ->> 'posti')::int, 1) > 1 and not (public._imp('business_multi_position_enabled'))::boolean then
    raise exception 'Annunci con più posti non attivi';
  end if;
  insert into public.annunci (autore_id, nome_pubblico, tipo, titolo, categoria, descrizione, condizioni, citta, zona, lat, lng,
    compenso_ora, compenso_tipo, posti, mansione, requisiti, qualifiche_obbligatorie, tipo_rapporto, info_sicurezza)
  values (u, btrim(p_annuncio ->> 'nome_pubblico'), coalesce(p_annuncio ->> 'tipo', 'azienda'), btrim(p_annuncio ->> 'titolo'),
    p_annuncio ->> 'categoria', nullif(btrim(p_annuncio ->> 'descrizione'), ''), nullif(btrim(p_annuncio ->> 'condizioni'), ''),
    btrim(p_annuncio ->> 'citta'), nullif(btrim(p_annuncio ->> 'zona'), ''),
    (p_annuncio ->> 'lat')::numeric, (p_annuncio ->> 'lng')::numeric,
    (p_annuncio ->> 'compenso_ora')::numeric, coalesce(p_annuncio ->> 'compenso_tipo', 'non_specificato'),
    coalesce((p_annuncio ->> 'posti')::int, 1),
    nullif(btrim(p_annuncio ->> 'mansione'), ''), nullif(btrim(p_annuncio ->> 'requisiti'), ''),
    coalesce(array(select left(btrim(x), 60) from jsonb_array_elements_text(coalesce(p_annuncio -> 'qualifiche_obbligatorie', '[]')) x where btrim(x) <> '' limit 10), '{}'),
    coalesce(nullif(p_annuncio ->> 'tipo_rapporto', ''), 'da_definire'), nullif(btrim(p_annuncio ->> 'info_sicurezza'), ''))
  returning id into nuovo;
  for t in select * from jsonb_array_elements(p_turni) loop
    if (t ->> 'inizio')::timestamptz <= now() then raise exception 'I turni devono essere nel futuro'; end if;
    insert into public.turni (annuncio_id, inizio, fine) values (nuovo, (t ->> 'inizio')::timestamptz, (t ->> 'fine')::timestamptz);
  end loop;
  perform public._registra('annuncio_pubblicato', 'annuncio', nuovo::text);
  return nuovo;
end $$;

-- ---------- Incarichi (= assegnazioni individuali): campi aggiuntivi ----------
alter table public.incarichi
  add column if not exists bonus_urgenza numeric not null default 0 check (bonus_urgenza >= 0 and bonus_urgenza <= 500),
  add column if not exists versione_condizioni int not null default 1,
  add column if not exists adempimenti_dichiarati_il timestamptz,
  add column if not exists archiviato_il timestamptz,
  add column if not exists sostituisce_incarico uuid references public.incarichi (id) on delete set null;

-- ---------- Versioni delle condizioni concordate ----------
create table if not exists public.condizioni_incarico (
  id uuid primary key default gen_random_uuid(),
  incarico_id uuid not null references public.incarichi (id) on delete cascade,
  versione int not null check (versione >= 1),
  condizioni jsonb not null,
  origine text not null check (origine in ('conferma', 'modifica', 'orari')),
  richiesta_id uuid,
  creato_il timestamptz not null default now(),
  unique (incarico_id, versione)
);
alter table public.condizioni_incarico enable row level security;
revoke all on public.condizioni_incarico from anon, authenticated;
grant select on public.condizioni_incarico to authenticated;
create policy condizioni_parti on public.condizioni_incarico for select to authenticated
  using (exists (select 1 from public.incarichi i where i.id = incarico_id and auth.uid() in (i.lavoratore_id, i.committente_id)));

create or replace function public._istantanea_condizioni(p_annuncio uuid, p_bonus numeric) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('titolo', a.titolo, 'mansione', coalesce(a.mansione, a.titolo), 'categoria', a.categoria,
    'citta', a.citta, 'zona', a.zona, 'compenso_ora', a.compenso_ora, 'compenso_tipo', a.compenso_tipo,
    'bonus_urgenza', coalesce(p_bonus, 0), 'tipo_rapporto', a.tipo_rapporto, 'requisiti', a.requisiti,
    'info_sicurezza', a.info_sicurezza, 'note', a.condizioni,
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id))
  from public.annunci a where a.id = p_annuncio;
$$;
revoke execute on function public._istantanea_condizioni(uuid, numeric) from public, anon, authenticated;

create or replace function public._prima_versione_condizioni() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.condizioni_incarico (incarico_id, versione, condizioni, origine)
  values (new.id, 1, public._istantanea_condizioni(new.annuncio_id, new.bonus_urgenza), 'conferma')
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public._prima_versione_condizioni() from public, anon, authenticated;
drop trigger if exists incarichi_prima_versione on public.incarichi;
create trigger incarichi_prima_versione after insert on public.incarichi for each row execute function public._prima_versione_condizioni();

-- versione 1 anche per gli incarichi già esistenti (non cambia nulla nei dati esistenti)
insert into public.condizioni_incarico (incarico_id, versione, condizioni, origine)
select i.id, 1, public._istantanea_condizioni(i.annuncio_id, i.bonus_urgenza), 'conferma' from public.incarichi i
on conflict do nothing;

create or replace function public._condizioni_attuali(p_incarico uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select condizioni from public.condizioni_incarico where incarico_id = p_incarico order by versione desc limit 1;
$$;
revoke execute on function public._condizioni_attuali(uuid) from public, anon, authenticated;

-- Quando i nuovi orari dell'annuncio vengono accettati, la persona riceve una nuova versione con i turni aggiornati
create or replace function public._versione_dopo_orari() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v int; c jsonb; t jsonb;
begin
  if not new.accetta then return new; end if;
  select turni into t from public.modifiche_orari where id = new.modifica_id;
  select coalesce(max(versione), 0) + 1 into v from public.condizioni_incarico where incarico_id = new.incarico_id;
  c := coalesce(public._condizioni_attuali(new.incarico_id), '{}'::jsonb) || jsonb_build_object('turni', t);
  insert into public.condizioni_incarico (incarico_id, versione, condizioni, origine, richiesta_id) values (new.incarico_id, v, c, 'orari', new.modifica_id);
  update public.incarichi set versione_condizioni = v where id = new.incarico_id;
  return new;
end $$;
revoke execute on function public._versione_dopo_orari() from public, anon, authenticated;
drop trigger if exists risposte_orari_versione on public.risposte_orari;
create trigger risposte_orari_versione after insert on public.risposte_orari for each row execute function public._versione_dopo_orari();

-- ---------- Fasce di annullamento ----------
create or replace function public._fascia_annullamento(p_minuti numeric) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_minuti >= (public._imp('annullamento_anticipato_ore'))::numeric * 60 then 'anticipato'
    when p_minuti >= (public._imp('annullamento_tardivo_ore'))::numeric * 60 then 'tardivo'
    when p_minuti >= (public._imp('annullamento_urgente_ore'))::numeric * 60 then 'urgente'
    else 'critico' end;
$$;
revoke execute on function public._fascia_annullamento(numeric) from public, anon, authenticated;

create table if not exists public.annullamenti (
  id uuid primary key default gen_random_uuid(),
  incarico_id uuid not null unique references public.incarichi (id) on delete cascade,
  richiesto_da uuid references auth.users (id) on delete set null,
  ruolo text not null check (ruolo in ('lavoratore', 'committente', 'admin')),
  categoria text not null check (categoria in ('imprevisto_personale', 'emergenza', 'problema_organizzativo', 'modifica_condizioni', 'accordo_reciproco', 'altro')),
  nota text check (nota is null or char_length(nota) <= 300),
  minuti_preavviso int not null,
  fascia text not null check (fascia in ('anticipato', 'tardivo', 'urgente', 'critico')),
  assistenza_richiesta boolean not null default false,
  stato text not null default 'registrato' check (stato in ('registrato', 'contestato', 'chiuso')),
  creato_il timestamptz not null default now()
);
alter table public.annullamenti enable row level security;
revoke all on public.annullamenti from anon, authenticated;
grant select on public.annullamenti to authenticated;
create policy annullamenti_parti on public.annullamenti for select to authenticated
  using (exists (select 1 from public.incarichi i where i.id = incarico_id and auth.uid() in (i.lavoratore_id, i.committente_id)));

-- Annullamento DOPO la conferma: registra l'evento, libera il posto, NON applica penalità automatiche.
-- Non equivale alla cessazione giuridica di un rapporto: gli obblighi contrattuali restano da gestire a parte.
create or replace function public.richiedi_annullamento(p_incarico uuid, p_categoria text, p_nota text default null, p_assistenza boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  i record; a record;
  primo timestamptz; chi text; minuti int; fascia text; ann uuid;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  select * into i from public.incarichi where id = p_incarico for update;
  if i.id is null or u not in (i.lavoratore_id, i.committente_id) then raise exception 'Incarico non trovato'; end if;
  if i.stato <> 'programmato' then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  select min(inizio) into primo from public.turni where annuncio_id = i.annuncio_id;
  if primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;
  if p_categoria not in ('imprevisto_personale', 'emergenza', 'problema_organizzativo', 'modifica_condizioni', 'accordo_reciproco', 'altro') then
    raise exception 'Categoria non valida';
  end if;
  chi := case when u = i.committente_id then 'committente' else 'lavoratore' end;
  minuti := floor(extract(epoch from primo - now()) / 60);
  fascia := public._fascia_annullamento(minuti);
  select * into a from public.annunci where id = i.annuncio_id for update;

  update public.incarichi set stato = 'annullato', annullato_il = now(), annullato_da = chi,
    conta_nel_limite = (chi = 'lavoratore' and (public._imp('annullamenti_lavoratore_contano'))::boolean)
  where id = i.id;
  update public.candidature set stato = 'annullata', motivo = 'annullato_da_' || chi, aggiornato_il = now() where id = i.candidatura_id;
  update public.annunci set stato = 'pubblicato', aggiornato_il = now() where id = i.annuncio_id and stato = 'completo';
  update public.richieste_modifica set stato = 'superata', risposta_il = now() where incarico_id = i.id and stato in ('attesa', 'chiarimento');
  insert into public.annullamenti (incarico_id, richiesto_da, ruolo, categoria, nota, minuti_preavviso, fascia, assistenza_richiesta)
  values (i.id, u, chi, p_categoria, nullif(left(btrim(coalesce(p_nota, '')), 300), ''), minuti, fascia, coalesce(p_assistenza, false))
  returning id into ann;

  perform public._notifica(case when chi = 'committente' then i.lavoratore_id else i.committente_id end, 'incarico_annullato',
    case when chi = 'committente' then format('Il committente ha annullato l''incarico «%s». Non è una valutazione su di te.', a.titolo)
         else format('La persona assegnata a «%s» ha annullato (%s): il posto è di nuovo libero.', a.titolo, fascia) end,
    jsonb_build_object('incarico_id', i.id, 'annuncio_id', a.id, 'fascia', fascia), 'annullato-' || i.id);
  perform public._registra('incarico_annullato', 'incarico', i.id::text, jsonb_build_object('da', chi, 'fascia', fascia, 'categoria', p_categoria));
  return jsonb_build_object('ok', true, 'fascia', fascia, 'minuti_preavviso', minuti,
    'posto_scoperto', chi = 'lavoratore', 'annuncio_id', a.id, 'annullamento_id', ann);
end $$;
revoke execute on function public.richiedi_annullamento(uuid, text, text, boolean) from public, anon;
grant execute on function public.richiedi_annullamento(uuid, text, text, boolean) to authenticated;

-- La vecchia funzione resta compatibile e passa dal nuovo percorso
create or replace function public.annulla_incarico(p_incarico uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select public.richiedi_annullamento(p_incarico, 'altro', null, false);
$$;

-- ---------- Mancata presentazione: evento DA VERIFICARE, mai pubblico ----------
create table if not exists public.mancate_presentazioni (
  id uuid primary key default gen_random_uuid(),
  incarico_id uuid not null unique references public.incarichi (id) on delete cascade,
  segnalata_da uuid references auth.users (id) on delete set null,
  nota text check (nota is null or char_length(nota) <= 500),
  chiarimento text check (chiarimento is null or char_length(chiarimento) <= 1000),
  stato text not null default 'segnalata' check (stato in ('segnalata', 'chiarimento_inviato', 'in_revisione', 'confermata', 'non_confermata', 'contestata')),
  decisione text check (decisione is null or char_length(decisione) <= 500),
  decisa_da uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);
alter table public.mancate_presentazioni enable row level security;
revoke all on public.mancate_presentazioni from anon, authenticated;
grant select on public.mancate_presentazioni to authenticated;
create policy mancate_parti on public.mancate_presentazioni for select to authenticated
  using (exists (select 1 from public.incarichi i where i.id = incarico_id and auth.uid() in (i.lavoratore_id, i.committente_id)));

create or replace function public.segnala_mancata_presentazione(p_incarico uuid, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); i record; primo timestamptz; t text;
begin
  select * into i from public.incarichi where id = p_incarico for update;
  if i.id is null or i.committente_id <> u then raise exception 'Incarico non trovato'; end if;
  if i.stato <> 'programmato' then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  select min(inizio) into primo from public.turni where annuncio_id = i.annuncio_id;
  if primo > now() then return jsonb_build_object('ok', false, 'motivo', 'non_ancora_iniziato'); end if;
  insert into public.mancate_presentazioni (incarico_id, segnalata_da, nota) values (i.id, u, nullif(left(btrim(coalesce(p_nota, '')), 500), ''))
  on conflict (incarico_id) do nothing;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'gia_segnalata'); end if;
  select a.titolo into t from public.annunci a where a.id = i.annuncio_id;
  perform public._notifica(i.lavoratore_id, 'mancata_presentazione',
    format('Il committente di «%s» segnala che non risulti presente. Puoi spiegare cosa è successo: nulla viene reso pubblico.', t),
    jsonb_build_object('incarico_id', i.id), 'mancata-' || i.id);
  perform public._registra('mancata_presentazione_segnalata', 'incarico', i.id::text);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.segnala_mancata_presentazione(uuid, text) from public, anon;
grant execute on function public.segnala_mancata_presentazione(uuid, text) to authenticated;

create or replace function public.chiarisci_mancata_presentazione(p_incarico uuid, p_testo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); m record;
begin
  select mp.*, i.lavoratore_id, i.committente_id into m from public.mancate_presentazioni mp join public.incarichi i on i.id = mp.incarico_id
  where mp.incarico_id = p_incarico for update of mp;
  if m.id is null or m.lavoratore_id <> u then raise exception 'Non trovata'; end if;
  if m.stato not in ('segnalata', 'chiarimento_inviato', 'confermata') then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  if char_length(btrim(coalesce(p_testo, ''))) < 5 then return jsonb_build_object('ok', false, 'motivo', 'testo_breve'); end if;
  update public.mancate_presentazioni set chiarimento = left(btrim(p_testo), 1000),
    stato = case when stato = 'confermata' then 'contestata' else 'chiarimento_inviato' end, aggiornata_il = now() where id = m.id;
  perform public._notifica(m.committente_id, 'mancata_presentazione', 'La persona ha inviato la sua versione sulla mancata presentazione. Il team la esaminerà.',
    jsonb_build_object('incarico_id', p_incarico), 'mancata-chiarimento-' || m.id);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.chiarisci_mancata_presentazione(uuid, text) from public, anon;
grant execute on function public.chiarisci_mancata_presentazione(uuid, text) to authenticated;

create or replace function public.admin_decidi_mancata_presentazione(p_id uuid, p_esito text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if p_esito not in ('in_revisione', 'confermata', 'non_confermata') then raise exception 'Esito non valido'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Serve una motivazione'; end if;
  select mp.*, i.lavoratore_id, i.committente_id into m from public.mancate_presentazioni mp join public.incarichi i on i.id = mp.incarico_id where mp.id = p_id for update of mp;
  if m.id is null then raise exception 'Non trovata'; end if;
  update public.mancate_presentazioni set stato = p_esito, decisione = left(p_motivo, 500), decisa_da = auth.uid(), aggiornata_il = now() where id = p_id;
  if p_esito <> 'in_revisione' then
    perform public._notifica(m.lavoratore_id, 'mancata_presentazione', 'C''è una decisione motivata sulla mancata presentazione. Puoi contestarla rispondendo.', jsonb_build_object('incarico_id', m.incarico_id), 'mancata-esito-' || m.id || '-' || p_esito);
    perform public._notifica(m.committente_id, 'mancata_presentazione', 'C''è una decisione motivata sulla mancata presentazione segnalata.', jsonb_build_object('incarico_id', m.incarico_id), 'mancata-esito-c-' || m.id || '-' || p_esito);
  end if;
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'mancata_presentazione_' || p_esito, jsonb_build_object('id', p_id, 'motivo', p_motivo));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.admin_decidi_mancata_presentazione(uuid, text, text) from public, anon;
grant execute on function public.admin_decidi_mancata_presentazione(uuid, text, text) to authenticated;

-- ---------- Fase dell'assegnazione (derivata, non sostituisce gli stati esistenti) ----------
create or replace function public._fase_incarico(p_incarico uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when i.archiviato_il is not null then 'archiviato'
    when i.stato = 'annullato' then 'annullato'
    when i.stato = 'contestato' then 'contestato'
    when i.stato = 'completato' then 'completato'
    when exists (select 1 from public.mancate_presentazioni m where m.incarico_id = i.id and m.stato not in ('non_confermata')) then 'mancata_presentazione_da_verificare'
    when (select max(fine) from public.turni t where t.annuncio_id = i.annuncio_id) <= now() then 'da_completare'
    when (select min(inizio) from public.turni t where t.annuncio_id = i.annuncio_id) <= now() then 'in_corso'
    when i.adempimenti_dichiarati_il is null then 'adempimenti_da_completare'
    else 'pronto_avvio' end
  from public.incarichi i where i.id = p_incarico;
$$;
revoke execute on function public._fase_incarico(uuid) from public, anon, authenticated;

-- ---------- Richieste di modifica delle condizioni (dopo la conferma) ----------
create table if not exists public.richieste_modifica (
  id uuid primary key default gen_random_uuid(),
  incarico_id uuid not null references public.incarichi (id) on delete cascade,
  richiesta_da uuid references auth.users (id) on delete set null,
  versione_base int not null,
  nuove jsonb not null,
  messaggio text check (messaggio is null or char_length(messaggio) <= 500),
  stato text not null default 'attesa' check (stato in ('attesa', 'accettata', 'rifiutata', 'chiarimento', 'ritirata', 'superata')),
  risposta text check (risposta is null or char_length(risposta) <= 500),
  creato_il timestamptz not null default now(),
  risposta_il timestamptz
);
create unique index if not exists richieste_modifica_una_aperta on public.richieste_modifica (incarico_id) where stato in ('attesa', 'chiarimento');
alter table public.richieste_modifica enable row level security;
revoke all on public.richieste_modifica from anon, authenticated;
grant select on public.richieste_modifica to authenticated;
create policy richieste_modifica_parti on public.richieste_modifica for select to authenticated
  using (exists (select 1 from public.incarichi i where i.id = incarico_id and auth.uid() in (i.lavoratore_id, i.committente_id)));

-- Campi modificabili per singola assegnazione. Gli orari si cambiano con «nuovi orari» (stessa logica di accettazione).
create or replace function public.proponi_modifica_condizioni(p_incarico uuid, p_nuove jsonb, p_messaggio text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); i record; primo timestamptz; att jsonb; pulite jsonb := '{}'; k text; rid uuid; t text;
begin
  if not (public._imp('modifica_condizioni_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  select * into i from public.incarichi where id = p_incarico for update;
  if i.id is null or i.committente_id <> u then raise exception 'Incarico non trovato'; end if;
  if i.stato <> 'programmato' then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  select min(inizio) into primo from public.turni where annuncio_id = i.annuncio_id;
  if primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;
  att := public._condizioni_attuali(i.id);
  for k in select jsonb_object_keys(coalesce(p_nuove, '{}')) loop
    if k not in ('compenso_ora', 'mansione', 'zona', 'bonus_urgenza', 'note') then raise exception 'Campo non modificabile: %', k; end if;
    if (p_nuove -> k) is distinct from (att -> k) then pulite := pulite || jsonb_build_object(k, p_nuove -> k); end if;
  end loop;
  if pulite = '{}'::jsonb then return jsonb_build_object('ok', false, 'motivo', 'nessuna_modifica'); end if;
  if pulite ? 'compenso_ora' and ((pulite ->> 'compenso_ora')::numeric <= 0 or (pulite ->> 'compenso_ora')::numeric > 500) then raise exception 'Compenso non valido'; end if;
  if pulite ? 'bonus_urgenza' and ((pulite ->> 'bonus_urgenza')::numeric < 0 or (pulite ->> 'bonus_urgenza')::numeric > 500) then raise exception 'Bonus non valido'; end if;
  update public.richieste_modifica set stato = 'superata', risposta_il = now() where incarico_id = i.id and stato in ('attesa', 'chiarimento');
  insert into public.richieste_modifica (incarico_id, richiesta_da, versione_base, nuove, messaggio)
  values (i.id, u, i.versione_condizioni, pulite, nullif(left(btrim(coalesce(p_messaggio, '')), 500), '')) returning id into rid;
  select a.titolo into t from public.annunci a where a.id = i.annuncio_id;
  perform public._notifica(i.lavoratore_id, 'richiesta_modifica', format('Il committente propone di modificare le condizioni di «%s». Finché non accetti valgono quelle originali.', t),
    jsonb_build_object('incarico_id', i.id, 'richiesta_id', rid), 'modifica-cond-' || rid);
  perform public._registra('modifica_condizioni_proposta', 'incarico', i.id::text, jsonb_build_object('richiesta', rid, 'campi', pulite));
  return jsonb_build_object('ok', true, 'richiesta_id', rid);
end $$;
revoke execute on function public.proponi_modifica_condizioni(uuid, jsonb, text) from public, anon;
grant execute on function public.proponi_modifica_condizioni(uuid, jsonb, text) to authenticated;

-- Il rifiuto NON equivale alla rinuncia: l'assegnazione resta con le condizioni originali.
create or replace function public.rispondi_modifica_condizioni(p_richiesta uuid, p_esito text, p_testo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r record; v int; nuove jsonb;
begin
  if p_esito not in ('accetta', 'rifiuta', 'chiarimento') then raise exception 'Esito non valido'; end if;
  select rm.*, i.lavoratore_id, i.committente_id, i.stato as stato_incarico, i.versione_condizioni into r
  from public.richieste_modifica rm join public.incarichi i on i.id = rm.incarico_id where rm.id = p_richiesta for update of rm;
  if r.id is null or r.lavoratore_id <> u then raise exception 'Richiesta non trovata'; end if;
  if r.stato not in ('attesa', 'chiarimento') or r.stato_incarico <> 'programmato' then return jsonb_build_object('ok', false, 'motivo', 'non_in_attesa'); end if;
  if p_esito = 'chiarimento' then
    if char_length(btrim(coalesce(p_testo, ''))) < 3 then return jsonb_build_object('ok', false, 'motivo', 'testo_breve'); end if;
    update public.richieste_modifica set stato = 'chiarimento', risposta = left(btrim(p_testo), 500) where id = r.id;
    perform public._notifica(r.committente_id, 'richiesta_modifica', 'La persona chiede un chiarimento sulla modifica proposta.', jsonb_build_object('incarico_id', r.incarico_id), 'modifica-chiar-' || r.id || '-' || md5(p_testo));
    return jsonb_build_object('ok', true, 'stato', 'chiarimento');
  end if;
  if p_esito = 'rifiuta' then
    update public.richieste_modifica set stato = 'rifiutata', risposta = nullif(left(btrim(coalesce(p_testo, '')), 500), ''), risposta_il = now() where id = r.id;
    perform public._notifica(r.committente_id, 'richiesta_modifica', 'La modifica non è stata accettata: l''incarico resta con le condizioni originali.', jsonb_build_object('incarico_id', r.incarico_id), 'modifica-esito-' || r.id);
    perform public._registra('modifica_condizioni_rifiutata', 'incarico', r.incarico_id::text);
    return jsonb_build_object('ok', true, 'stato', 'rifiutata');
  end if;
  if r.versione_base <> r.versione_condizioni then
    update public.richieste_modifica set stato = 'superata', risposta_il = now() where id = r.id;
    return jsonb_build_object('ok', false, 'motivo', 'superata');
  end if;
  nuove := public._condizioni_attuali(r.incarico_id) || r.nuove;
  v := r.versione_condizioni + 1;
  insert into public.condizioni_incarico (incarico_id, versione, condizioni, origine, richiesta_id) values (r.incarico_id, v, nuove, 'modifica', r.id);
  update public.incarichi set versione_condizioni = v, bonus_urgenza = coalesce((nuove ->> 'bonus_urgenza')::numeric, bonus_urgenza) where id = r.incarico_id;
  update public.richieste_modifica set stato = 'accettata', risposta_il = now() where id = r.id;
  perform public._notifica(r.committente_id, 'richiesta_modifica', 'La modifica delle condizioni è stata accettata.', jsonb_build_object('incarico_id', r.incarico_id), 'modifica-esito-' || r.id);
  perform public._registra('modifica_condizioni_accettata', 'incarico', r.incarico_id::text, jsonb_build_object('versione', v));
  return jsonb_build_object('ok', true, 'stato', 'accettata', 'versione', v);
end $$;
revoke execute on function public.rispondi_modifica_condizioni(uuid, text, text) from public, anon;
grant execute on function public.rispondi_modifica_condizioni(uuid, text, text) to authenticated;

create or replace function public.ritira_modifica_condizioni(p_richiesta uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.richieste_modifica rm set stato = 'ritirata', risposta_il = now()
  from public.incarichi i where rm.id = p_richiesta and i.id = rm.incarico_id and i.committente_id = auth.uid() and rm.stato in ('attesa', 'chiarimento');
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.ritira_modifica_condizioni(uuid) from public, anon;
grant execute on function public.ritira_modifica_condizioni(uuid) to authenticated;

-- Il committente dichiara di aver completato gli adempimenti (es. comunicazioni obbligatorie).
-- È una DICHIARAZIONE: JobExpress non la verifica e non è prova della regolarizzazione del rapporto.
create or replace function public.dichiara_adempimenti(p_incarico uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.incarichi set adempimenti_dichiarati_il = now()
  where id = p_incarico and committente_id = auth.uid() and stato = 'programmato' and adempimenti_dichiarati_il is null;
  if found then perform public._registra('adempimenti_dichiarati', 'incarico', p_incarico::text); end if;
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.dichiara_adempimenti(uuid) from public, anon;
grant execute on function public.dichiara_adempimenti(uuid) to authenticated;

-- ---------- Stato dei posti di un annuncio (anche multiplo) ----------
create or replace function public._posti_stato(p_annuncio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with x as (
    select a.posti,
      (select count(*) from public.proposte p where p.annuncio_id = a.id and p.stato = 'attesa' and p.scade_il > now())::int as riservati,
      (select count(*) from public.incarichi i where i.annuncio_id = a.id and i.stato = 'programmato')::int as confermati,
      (select count(*) from public.incarichi i where i.annuncio_id = a.id and i.stato in ('completato', 'contestato'))::int as completati,
      (select count(*) from public.incarichi i where i.annuncio_id = a.id and i.stato = 'annullato')::int as annullati,
      (select min(inizio) <= now() from public.turni t where t.annuncio_id = a.id) as iniziato
    from public.annunci a where a.id = p_annuncio)
  select jsonb_build_object('richiesti', posti, 'riservati', riservati, 'confermati', confermati, 'completati', completati,
    'annullati', annullati,
    'disponibili', case when coalesce(iniziato, false) then 0 else greatest(posti - riservati - confermati - completati, 0) end,
    'scoperti', case when coalesce(iniziato, false) then greatest(posti - confermati - completati, 0) else 0 end) from x;
$$;
revoke execute on function public._posti_stato(uuid) from public, anon, authenticated;

-- Storico delle condizioni di un'assegnazione (solo le parti)
create or replace function public.storico_condizioni(p_incarico uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('versione', c.versione, 'origine', c.origine, 'condizioni', c.condizioni, 'creato_il', c.creato_il) order by c.versione), '[]')
  from public.condizioni_incarico c join public.incarichi i on i.id = c.incarico_id
  where c.incarico_id = p_incarico and auth.uid() in (i.lavoratore_id, i.committente_id);
$$;
revoke execute on function public.storico_condizioni(uuid) from public, anon;
grant execute on function public.storico_condizioni(uuid) to authenticated;

-- ---------- Liste aggiornate (stessi campi di prima + nuovi) ----------
create or replace function public._incarico_json(p_incarico uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', i.id, 'stato', i.stato, 'annullato_da', i.annullato_da, 'fase', public._fase_incarico(i.id),
    'versione', i.versione_condizioni, 'bonus_urgenza', i.bonus_urgenza, 'adempimenti_dichiarati', i.adempimenti_dichiarati_il is not null,
    'condizioni', public._condizioni_attuali(i.id),
    'annullamento', (select jsonb_build_object('fascia', an.fascia, 'ruolo', an.ruolo, 'categoria', an.categoria, 'creato_il', an.creato_il) from public.annullamenti an where an.incarico_id = i.id),
    'modifica_condizioni', (select jsonb_build_object('id', rm.id, 'nuove', rm.nuove, 'messaggio', rm.messaggio, 'stato', rm.stato, 'risposta', rm.risposta)
                            from public.richieste_modifica rm where rm.incarico_id = i.id and rm.stato in ('attesa', 'chiarimento')),
    'mancata_presentazione', (select jsonb_build_object('stato', mp.stato, 'nota', mp.nota, 'chiarimento', mp.chiarimento, 'decisione', mp.decisione)
                              from public.mancate_presentazioni mp where mp.incarico_id = i.id))
  from public.incarichi i where i.id = p_incarico;
$$;
revoke execute on function public._incarico_json(uuid) from public, anon, authenticated;

create or replace function public.mie_candidature() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'candidatura_id', c.id, 'cv_condiviso', c.cv_condiviso, 'stato', c.stato, 'motivo', c.motivo, 'creato_il', c.creato_il,
    'annuncio', jsonb_build_object('id', a.id, 'titolo', a.titolo, 'nome', a.nome_pubblico, 'categoria', a.categoria, 'citta', a.citta, 'zona', a.zona,
      'compenso_ora', a.compenso_ora, 'compenso_tipo', a.compenso_tipo, 'condizioni', a.condizioni, 'stato', a.stato,
      'mansione', a.mansione, 'requisiti', a.requisiti, 'tipo_rapporto', a.tipo_rapporto, 'info_sicurezza', a.info_sicurezza, 'posti', a.posti),
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id),
    'proposta', (select jsonb_build_object('id', p.id, 'scade_il', p.scade_il, 'stato', p.stato) from public.proposte p
                 where p.candidatura_id = c.id and p.stato = 'attesa' and p.scade_il > now() limit 1),
    'incarico', (select public._incarico_json(i.id) from public.incarichi i where i.candidatura_id = c.id),
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
    'compenso_ora', a.compenso_ora, 'posti_liberi', public._posti_liberi(a.id), 'posti_stato', public._posti_stato(a.id),
    'mansione', a.mansione, 'tipo_rapporto', a.tipo_rapporto,
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id),
    'modifica_in_attesa', exists (select 1 from public.modifiche_orari m where m.annuncio_id = a.id and m.stato = 'attesa'),
    'candidati', (select coalesce(jsonb_agg(jsonb_build_object(
        'candidatura_id', c.id, 'lavoratore_id', c.lavoratore_id, 'cv_condiviso', c.cv_condiviso, 'stato', c.stato, 'nome', coalesce(pr.nome, 'Candidato'), 'citta', pr.citta, 'automunito', pr.automunito,
        'proposta', (select jsonb_build_object('id', p.id, 'scade_il', p.scade_il) from public.proposte p where p.candidatura_id = c.id and p.stato = 'attesa' and p.scade_il > now() limit 1),
        'incarico', (select public._incarico_json(i.id) from public.incarichi i where i.candidatura_id = c.id)
      ) order by c.creato_il), '[]'::jsonb)
      from public.candidature c left join public.profili pr on pr.id = c.lavoratore_id where c.annuncio_id = a.id)
  ) order by a.creato_il desc), '[]'::jsonb)
  from public.annunci a where a.autore_id = auth.uid();
$$;
