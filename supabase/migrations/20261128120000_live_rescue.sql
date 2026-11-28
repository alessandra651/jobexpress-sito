-- =====================================================================
-- JobExpress · Fase 2 «Opportunità immediate» (28/11/2026)
-- JobExpress Live (disponibilità volontaria, con scadenza), proposte dirette dei committenti,
-- JobExpress Rescue (ricerca progressiva di sostituti in 3 gruppi), bonus urgenza,
-- preferenze di notifica, processi programmati idempotenti con registro degli esiti.
-- Gratuito per tutti: nessuna priorità legata agli abbonamenti, nessuna penalità per rifiuto o silenzio.
-- =====================================================================

insert into public.impostazioni (chiave, valore, descrizione) values
  ('live_enabled', 'true', 'JobExpress Live: disponibilità dichiarate dai lavoratori'),
  ('live_scheduled_availability_enabled', 'true', 'Disponibilità Live programmate per il futuro'),
  ('live_max_proposte_giorno', '20', 'Massimo proposte dirette inviate da un committente in 24 ore (anti-spam)'),
  ('rescue_enabled', 'true', 'JobExpress Rescue: ricerca urgente di sostituti'),
  ('rescue_urgency_bonus_enabled', 'true', 'Bonus urgenza facoltativo, interamente per il lavoratore'),
  ('rescue_accelerata_ore', '6', 'Sotto queste ore dall''inizio la ricerca è accelerata'),
  ('rescue_simultanea_ore', '1', 'Sotto queste ore si avvisano tutti i gruppi insieme'),
  ('rescue_minuti_tra_gruppi', '30', 'Minuti tra un gruppo e il successivo nella ricerca ordinaria'),
  ('rescue_minuti_tra_gruppi_accelerata', '10', 'Minuti tra un gruppo e il successivo nella ricerca accelerata'),
  ('rescue_max_avvisi_giorno', '5', 'Massimo avvisi urgenti ricevuti da una persona in 24 ore')
on conflict (chiave) do nothing;

-- ---------- Preferenze di notifica ----------
create table if not exists public.preferenze_notifiche (
  user_id uuid primary key references auth.users (id) on delete cascade,
  urgenti boolean not null default false,          -- avvisi Rescue anche se non ho attivato Live
  proposte_live boolean not null default true,
  promozionali boolean not null default false,
  aggiornato_il timestamptz not null default now()
);
alter table public.preferenze_notifiche enable row level security;
revoke all on public.preferenze_notifiche from anon, authenticated;
grant select on public.preferenze_notifiche to authenticated;
create policy preferenze_proprie on public.preferenze_notifiche for select to authenticated using (user_id = auth.uid());

create or replace function public.imposta_preferenze_notifiche(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  insert into public.preferenze_notifiche (user_id, urgenti, proposte_live, promozionali)
  values (auth.uid(), coalesce((p ->> 'urgenti')::boolean, false), coalesce((p ->> 'proposte_live')::boolean, true), coalesce((p ->> 'promozionali')::boolean, false))
  on conflict (user_id) do update set
    urgenti = coalesce((p ->> 'urgenti')::boolean, preferenze_notifiche.urgenti),
    proposte_live = coalesce((p ->> 'proposte_live')::boolean, preferenze_notifiche.proposte_live),
    promozionali = coalesce((p ->> 'promozionali')::boolean, preferenze_notifiche.promozionali),
    aggiornato_il = now();
  return (select to_jsonb(x) - 'user_id' from public.preferenze_notifiche x where user_id = auth.uid());
end $$;
revoke execute on function public.imposta_preferenze_notifiche(jsonb) from public, anon;
grant execute on function public.imposta_preferenze_notifiche(jsonb) to authenticated;

-- ---------- Disponibilità Live ----------
create table if not exists public.disponibilita_live (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  inizio timestamptz not null,
  fine timestamptz not null,
  citta text not null check (char_length(btrim(citta)) between 2 and 80),
  zona text check (zona is null or char_length(zona) <= 80),
  raggio_km int not null default 10 check (raggio_km between 1 and 100),
  mansioni text[] not null default '{}',
  compenso_min numeric check (compenso_min is null or (compenso_min > 0 and compenso_min <= 500)),
  urgenti boolean not null default true,
  stato text not null default 'attiva' check (stato in ('attiva', 'disattivata', 'scaduta')),
  creato_il timestamptz not null default now(),
  chiusa_il timestamptz,
  check (fine > inizio and fine - inizio <= interval '24 hours')
);
create index if not exists disponibilita_live_attive on public.disponibilita_live (inizio, fine) where stato = 'attiva';
alter table public.disponibilita_live enable row level security;
revoke all on public.disponibilita_live from anon, authenticated;
grant select on public.disponibilita_live to authenticated;
create policy live_proprie on public.disponibilita_live for select to authenticated using (user_id = auth.uid());

create or replace function public.live_attiva(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); ini timestamptz; fin timestamptz; nuovo uuid; c text;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if not (public._imp('live_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  ini := coalesce((p ->> 'inizio')::timestamptz, now());
  fin := coalesce((p ->> 'fine')::timestamptz, ini + make_interval(mins => round(coalesce((p ->> 'durata_ore')::numeric, 4) * 60)::int));
  if ini < now() - interval '5 minutes' then ini := now(); end if;
  if fin <= ini or fin - ini > interval '24 hours' then return jsonb_build_object('ok', false, 'motivo', 'orari_non_validi'); end if;
  if ini > now() + interval '15 minutes' and not (public._imp('live_scheduled_availability_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  if ini > now() + interval '30 days' then return jsonb_build_object('ok', false, 'motivo', 'troppo_lontano'); end if;
  if exists (select 1 from public.disponibilita_live where user_id = u and stato = 'attiva' and inizio < fin and ini < fine) then
    return jsonb_build_object('ok', false, 'motivo', 'sovrapposta');
  end if;
  if (select count(*) from public.disponibilita_live where user_id = u and stato = 'attiva') >= 30 then return jsonb_build_object('ok', false, 'motivo', 'troppe'); end if;
  c := coalesce(nullif(btrim(p ->> 'citta'), ''), (select citta from public.profili where id = u), 'Forlì');
  insert into public.disponibilita_live (user_id, inizio, fine, citta, zona, raggio_km, mansioni, compenso_min, urgenti)
  values (u, ini, fin, left(c, 80), nullif(left(btrim(coalesce(p ->> 'zona', '')), 80), ''),
    coalesce((p ->> 'raggio_km')::int, 10),
    coalesce(array(select left(lower(btrim(x)), 40) from jsonb_array_elements_text(coalesce(p -> 'mansioni', '[]')) x where btrim(x) <> '' limit 10), '{}'),
    nullif((p ->> 'compenso_min')::numeric, 0), coalesce((p ->> 'urgenti')::boolean, true))
  returning id into nuovo;
  perform public._registra('live_attivata', 'disponibilita', nuovo::text);
  return jsonb_build_object('ok', true, 'id', nuovo, 'inizio', ini, 'fine', fin);
end $$;
revoke execute on function public.live_attiva(jsonb) from public, anon;
grant execute on function public.live_attiva(jsonb) to authenticated;

-- Disattiva una disponibilità (o tutte quelle in corso e future se p_id è null). Non tocca gli incarichi confermati.
create or replace function public.live_disattiva(p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.disponibilita_live set stato = 'disattivata', chiusa_il = now()
  where user_id = auth.uid() and stato = 'attiva' and (p_id is null or id = p_id);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'disattivate', n);
end $$;
revoke execute on function public.live_disattiva(uuid) from public, anon;
grant execute on function public.live_disattiva(uuid) to authenticated;

create or replace function public.mie_disponibilita() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'inizio', d.inizio, 'fine', d.fine, 'citta', d.citta, 'zona', d.zona,
    'raggio_km', d.raggio_km, 'mansioni', d.mansioni, 'compenso_min', d.compenso_min, 'urgenti', d.urgenti,
    'in_corso', d.inizio <= now(),
    'incarichi', (select count(*) from public.incarichi i join public.turni t on t.annuncio_id = i.annuncio_id
                  where i.lavoratore_id = d.user_id and i.stato = 'programmato' and t.inizio < d.fine and d.inizio < t.fine))
    order by d.inizio), '[]')
  from public.disponibilita_live d where d.user_id = auth.uid() and d.stato = 'attiva' and d.fine > now();
$$;
revoke execute on function public.mie_disponibilita() from public, anon;
grant execute on function public.mie_disponibilita() to authenticated;

-- «Lavoratori disponibili» per i committenti verificati. Ordine: orario compatibile, poi casuale stabile nel giorno.
-- MAI per abbonamento. Niente posizione precisa, telefono o indirizzo.
create or replace function public.lavoratori_disponibili(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); ini timestamptz; fin timestamptz; v_citta text; v_mans text;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if not (public._imp('live_enabled'))::boolean then return '[]'::jsonb; end if;
  if cardinality(public._requisiti_trust(u, 'pubblica')) > 0 then return jsonb_build_object('errore', 'verifica_richiesta'); end if;
  ini := coalesce((p ->> 'inizio')::timestamptz, now());
  fin := coalesce((p ->> 'fine')::timestamptz, ini + interval '1 hour');
  v_citta := nullif(btrim(p ->> 'citta'), '');
  v_mans := nullif(lower(btrim(p ->> 'mansione')), '');
  return coalesce((select jsonb_agg(x order by x ->> 'ordine') from (
    select jsonb_build_object(
      'user_id', d.user_id, 'disponibilita_id', d.id,
      'nome', coalesce(pr.nome, 'Utente') || coalesce(' ' || left(pp.cognome, 1) || '.', ''),
      'foto_path', case when coalesce((pp.visibilita ->> 'foto')::boolean, true) then pp.foto_path end,
      'citta', d.citta, 'zona', d.zona, 'raggio_km', d.raggio_km, 'inizio', d.inizio, 'fine', d.fine,
      'mansioni', d.mansioni, 'compenso_min', d.compenso_min,
      'competenze', case when coalesce((pp.visibilita ->> 'competenze')::boolean, true) then to_jsonb(coalesce(pp.mansioni, '{}') || coalesce(pp.competenze_tecniche, '{}')) else '[]'::jsonb end,
      'identita_verificata', exists (select 1 from public.verifiche v where v.user_id = d.user_id and v.tipo = 'identita' and v.stato = 'verificata'),
      'identita_simulata', exists (select 1 from public.verifiche v where v.user_id = d.user_id and v.tipo = 'identita' and v.stato = 'verificata' and v.simulata),
      'incarichi_completati', (select count(*) from public.incarichi i where i.lavoratore_id = d.user_id and i.stato = 'completato'),
      'immediata', d.inizio <= now(),
      'ordine', to_char(d.inizio, 'YYYYMMDDHH24MI') || md5(d.user_id::text || current_date::text)) as x
    from public.disponibilita_live d
    join public.profili pr on pr.id = d.user_id
    left join public.profili_professionali pp on pp.user_id = d.user_id
    where d.stato = 'attiva' and d.fine > now() and d.user_id <> u
      and d.inizio <= ini and d.fine >= fin
      and (v_citta is null or lower(d.citta) = lower(v_citta))
      and (v_mans is null or exists (select 1 from unnest(d.mansioni || coalesce(pp.mansioni, '{}') || coalesce(pp.settori, '{}')) m where lower(m) like '%' || v_mans || '%'))
      and (not coalesce((p ->> 'solo_immediata')::boolean, false) or d.inizio <= now())
      and cardinality(public._requisiti_trust(d.user_id, 'candidatura')) = 0
      and not exists (select 1 from public.blocchi b where (b.utente_id = u and b.bloccato_id = d.user_id) or (b.utente_id = d.user_id and b.bloccato_id = u))
      and not exists (select 1 from public.incarichi i join public.turni t on t.annuncio_id = i.annuncio_id
                      where i.lavoratore_id = d.user_id and i.stato = 'programmato' and t.inizio < fin and ini < t.fine)
    order by d.inizio, md5(d.user_id::text || current_date::text)
    limit 50) q), '[]'::jsonb);
end $$;
revoke execute on function public.lavoratori_disponibili(jsonb) from public, anon;
grant execute on function public.lavoratori_disponibili(jsonb) to authenticated;

-- ---------- Assegnazione da un'offerta (proposta diretta o Rescue) ----------
-- L'offerta del committente vale come sua conferma; l'accettazione del lavoratore completa la conferma reciproca.
-- Controlli atomici: annuncio bloccato (FOR UPDATE), posti liberi, sovrapposizioni, Trust, limite mensile (se attivo).
create or replace function public._assegna_da_offerta(p_annuncio uuid, p_origine text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); a record; primo timestamptz; cand uuid; prop uuid; r jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('lavoratore:' || u, 0));
  select * into a from public.annunci where id = p_annuncio for update;
  if a.id is null or a.stato <> 'pubblicato' then return jsonb_build_object('ok', false, 'motivo', 'posti_esauriti'); end if;
  if a.autore_id = u then return jsonb_build_object('ok', false, 'motivo', 'tuo_annuncio'); end if;
  select min(inizio) into primo from public.turni where annuncio_id = a.id;
  if primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;
  if exists (select 1 from public.candidature where annuncio_id = a.id and lavoratore_id = u and stato in ('in_attesa_conferma', 'confermata')) then
    return jsonb_build_object('ok', false, 'motivo', 'gia_candidato');
  end if;
  if public._posti_liberi(a.id) <= 0 then return jsonb_build_object('ok', false, 'motivo', 'posti_esauriti'); end if;
  if cardinality(public._incarichi_sovrapposti(u, a.id)) > 0 then return jsonb_build_object('ok', false, 'motivo', 'incarico_confermato'); end if;
  begin
    select id into cand from public.candidature where annuncio_id = a.id and lavoratore_id = u and stato in ('inviata', 'in_valutazione') for update;
    if cand is null then
      insert into public.candidature (annuncio_id, lavoratore_id, stato, motivo) values (a.id, u, 'in_attesa_conferma', p_origine) returning id into cand;
    else
      update public.candidature set stato = 'in_attesa_conferma', motivo = p_origine, aggiornato_il = now() where id = cand;
    end if;
    insert into public.proposte (candidatura_id, annuncio_id, lavoratore_id, committente_id, scade_il)
    values (cand, a.id, u, a.autore_id, now() + interval '10 minutes') returning id into prop;
    r := public.rispondi_proposta(prop, true);
    if not coalesce((r ->> 'ok')::boolean, false) then raise exception 'ANNULLA_OFFERTA:%', r::text; end if;
  exception when raise_exception then
    if sqlerrm like 'ANNULLA_OFFERTA:%' then return substring(sqlerrm from 17)::jsonb; end if;
    raise;
  end;
  return r;
end $$;
revoke execute on function public._assegna_da_offerta(uuid, text) from public, anon, authenticated;

-- ---------- Proposte dirette (Live) ----------
create table if not exists public.proposte_dirette (
  id uuid primary key default gen_random_uuid(),
  annuncio_id uuid not null references public.annunci (id) on delete cascade,
  committente_id uuid not null references auth.users (id) on delete cascade,
  lavoratore_id uuid not null references auth.users (id) on delete cascade,
  messaggio text check (messaggio is null or char_length(messaggio) <= 500),
  stato text not null default 'inviata' check (stato in ('inviata', 'chiarimento', 'accettata', 'rifiutata', 'scaduta', 'ritirata', 'non_piu_disponibile')),
  domanda text check (domanda is null or char_length(domanda) <= 500),
  risposta text check (risposta is null or char_length(risposta) <= 500),
  incarico_id uuid references public.incarichi (id) on delete set null,
  scade_il timestamptz not null,
  creato_il timestamptz not null default now(),
  risposta_il timestamptz
);
create unique index if not exists proposte_dirette_una_aperta on public.proposte_dirette (annuncio_id, lavoratore_id) where stato in ('inviata', 'chiarimento');
create index if not exists proposte_dirette_lavoratore on public.proposte_dirette (lavoratore_id, stato);
alter table public.proposte_dirette enable row level security;
revoke all on public.proposte_dirette from anon, authenticated;
grant select on public.proposte_dirette to authenticated;
create policy proposte_dirette_parti on public.proposte_dirette for select to authenticated using (auth.uid() in (committente_id, lavoratore_id));

create or replace function public.invia_proposta_diretta(p_annuncio uuid, p_lavoratore uuid, p_messaggio text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); a record; primo timestamptz; ultima timestamptz; scad timestamptz; nuovo uuid;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if not (public._imp('live_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  perform public._controlla_trust(u, 'seleziona');
  select * into a from public.annunci where id = p_annuncio;
  if a.id is null or a.autore_id <> u then raise exception 'Non è un tuo annuncio'; end if;
  if a.stato <> 'pubblicato' or public._posti_liberi(a.id) <= 0 then return jsonb_build_object('ok', false, 'motivo', 'posti_esauriti'); end if;
  -- una proposta operativa deve essere completa
  if a.mansione is null or a.tipo_rapporto = 'da_definire' or a.compenso_ora is null or a.citta is null then
    return jsonb_build_object('ok', false, 'motivo', 'annuncio_incompleto');
  end if;
  select min(inizio), max(fine) into primo, ultima from public.turni where annuncio_id = a.id;
  if primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;
  if not exists (select 1 from public.disponibilita_live d where d.user_id = p_lavoratore and d.stato = 'attiva' and d.inizio <= primo and d.fine >= ultima) then
    return jsonb_build_object('ok', false, 'motivo', 'non_disponibile');
  end if;
  if exists (select 1 from public.preferenze_notifiche pn where pn.user_id = p_lavoratore and not pn.proposte_live) then
    return jsonb_build_object('ok', false, 'motivo', 'non_disponibile');
  end if;
  if cardinality(public._requisiti_trust(p_lavoratore, 'candidatura')) > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'non_disponibile');
  end if;
  if exists (select 1 from public.blocchi b where (b.utente_id = u and b.bloccato_id = p_lavoratore) or (b.utente_id = p_lavoratore and b.bloccato_id = u)) then
    raise exception 'TRUST:bloccato';
  end if;
  if (select count(*) from public.proposte_dirette where committente_id = u and creato_il > now() - interval '24 hours') >= (public._imp('live_max_proposte_giorno'))::int then
    raise exception 'TRUST:troppe_richieste';
  end if;
  if exists (select 1 from public.proposte_dirette where annuncio_id = a.id and lavoratore_id = p_lavoratore and stato in ('rifiutata') and creato_il > now() - interval '24 hours') then
    return jsonb_build_object('ok', false, 'motivo', 'gia_rifiutata');
  end if;
  scad := least(now() + make_interval(mins => public._minuti_conferma(extract(epoch from primo - now()) / 60)), primo);
  insert into public.proposte_dirette (annuncio_id, committente_id, lavoratore_id, messaggio, scade_il)
  values (a.id, u, p_lavoratore, nullif(left(btrim(coalesce(p_messaggio, '')), 500), ''), scad)
  on conflict do nothing returning id into nuovo;
  if nuovo is null then return jsonb_build_object('ok', false, 'motivo', 'gia_inviata'); end if;
  perform public._notifica(p_lavoratore, 'proposta_live', format('Hai ricevuto una proposta per «%s». Puoi accettare, rifiutare o chiedere un chiarimento: nessuna penalità se non rispondi.', a.titolo),
    jsonb_build_object('proposta_diretta_id', nuovo), 'proposta-live-' || nuovo);
  perform public._registra('proposta_diretta_inviata', 'proposta_diretta', nuovo::text);
  return jsonb_build_object('ok', true, 'id', nuovo, 'scade_il', scad);
end $$;
revoke execute on function public.invia_proposta_diretta(uuid, uuid, text) from public, anon;
grant execute on function public.invia_proposta_diretta(uuid, uuid, text) to authenticated;

create or replace function public.rispondi_proposta_diretta(p_id uuid, p_esito text, p_testo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); pd record; r jsonb; t text;
begin
  if p_esito not in ('accetta', 'rifiuta', 'chiarimento') then raise exception 'Esito non valido'; end if;
  select * into pd from public.proposte_dirette where id = p_id and lavoratore_id = u for update;
  if pd.id is null then raise exception 'Proposta non trovata'; end if;
  if pd.stato not in ('inviata', 'chiarimento') then return jsonb_build_object('ok', false, 'motivo', 'non_in_attesa'); end if;
  if pd.scade_il <= now() then
    update public.proposte_dirette set stato = 'scaduta', risposta_il = now() where id = pd.id;
    return jsonb_build_object('ok', false, 'motivo', 'scaduta');
  end if;
  select titolo into t from public.annunci where id = pd.annuncio_id;
  if p_esito = 'rifiuta' then
    update public.proposte_dirette set stato = 'rifiutata', risposta_il = now() where id = pd.id;
    perform public._notifica(pd.committente_id, 'proposta_live', format('La proposta per «%s» non è stata accettata. Puoi contattare un''altra persona.', t), jsonb_build_object('annuncio_id', pd.annuncio_id), 'proposta-live-esito-' || pd.id);
    return jsonb_build_object('ok', true, 'stato', 'rifiutata');
  end if;
  if p_esito = 'chiarimento' then
    if char_length(btrim(coalesce(p_testo, ''))) < 3 then return jsonb_build_object('ok', false, 'motivo', 'testo_breve'); end if;
    update public.proposte_dirette set stato = 'chiarimento', domanda = left(btrim(p_testo), 500) where id = pd.id;
    perform public._notifica(pd.committente_id, 'proposta_live', format('Domanda sulla proposta «%s»: rispondi dall''area personale.', t), jsonb_build_object('annuncio_id', pd.annuncio_id), 'proposta-live-dom-' || pd.id || '-' || md5(p_testo));
    return jsonb_build_object('ok', true, 'stato', 'chiarimento');
  end if;
  r := public._assegna_da_offerta(pd.annuncio_id, 'proposta_diretta');
  if coalesce((r ->> 'ok')::boolean, false) then
    update public.proposte_dirette set stato = 'accettata', risposta_il = now(), incarico_id = (r ->> 'incarico_id')::uuid where id = pd.id;
  elsif r ->> 'motivo' in ('posti_esauriti', 'gia_iniziato') then
    update public.proposte_dirette set stato = 'non_piu_disponibile', risposta_il = now() where id = pd.id;
  end if;
  return r;
end $$;
revoke execute on function public.rispondi_proposta_diretta(uuid, text, text) from public, anon;
grant execute on function public.rispondi_proposta_diretta(uuid, text, text) to authenticated;

create or replace function public.rispondi_domanda_proposta(p_id uuid, p_testo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pd record;
begin
  select * into pd from public.proposte_dirette where id = p_id and committente_id = auth.uid() and stato = 'chiarimento' for update;
  if pd.id is null then return jsonb_build_object('ok', false, 'motivo', 'non_in_attesa'); end if;
  if char_length(btrim(coalesce(p_testo, ''))) < 2 then return jsonb_build_object('ok', false, 'motivo', 'testo_breve'); end if;
  update public.proposte_dirette set risposta = left(btrim(p_testo), 500), stato = 'inviata' where id = pd.id;
  perform public._notifica(pd.lavoratore_id, 'proposta_live', 'Il committente ha risposto alla tua domanda sulla proposta.', jsonb_build_object('proposta_diretta_id', pd.id), 'proposta-live-risp-' || pd.id || '-' || md5(p_testo));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.rispondi_domanda_proposta(uuid, text) from public, anon;
grant execute on function public.rispondi_domanda_proposta(uuid, text) to authenticated;

create or replace function public.ritira_proposta_diretta(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.proposte_dirette set stato = 'ritirata', risposta_il = now()
  where id = p_id and committente_id = auth.uid() and stato in ('inviata', 'chiarimento');
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.ritira_proposta_diretta(uuid) from public, anon;
grant execute on function public.ritira_proposta_diretta(uuid) to authenticated;

-- ---------- Rescue ----------
create table if not exists public.rescue_richieste (
  id uuid primary key default gen_random_uuid(),
  annuncio_id uuid not null references public.annunci (id) on delete cascade,
  committente_id uuid not null references auth.users (id) on delete cascade,
  incarico_originale_id uuid references public.incarichi (id) on delete set null,
  motivo text not null check (motivo in ('annullamento', 'mancata_presentazione', 'posto_scoperto', 'altro')),
  bonus_urgenza numeric not null default 0 check (bonus_urgenza >= 0 and bonus_urgenza <= 500),
  stato text not null default 'attiva' check (stato in ('attiva', 'coperta', 'annullata', 'scaduta')),
  intensita text not null default 'ordinaria' check (intensita in ('ordinaria', 'accelerata', 'simultanea')),
  gruppo_raggiunto int not null default 0,
  creato_il timestamptz not null default now(),
  chiusa_il timestamptz
);
create unique index if not exists rescue_una_attiva on public.rescue_richieste (annuncio_id) where stato = 'attiva';
alter table public.rescue_richieste enable row level security;
revoke all on public.rescue_richieste from anon, authenticated;
grant select on public.rescue_richieste to authenticated;
create policy rescue_committente on public.rescue_richieste for select to authenticated using (committente_id = auth.uid());

create table if not exists public.rescue_contatti (
  richiesta_id uuid not null references public.rescue_richieste (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  gruppo int not null check (gruppo between 1 and 3),
  notificato_il timestamptz not null default now(),
  risposta text not null default 'nessuna' check (risposta in ('nessuna', 'accettata', 'rifiutata', 'non_piu_disponibile')),
  risposta_il timestamptz,
  primary key (richiesta_id, user_id)
);
alter table public.rescue_contatti enable row level security;
revoke all on public.rescue_contatti from anon, authenticated;
grant select on public.rescue_contatti to authenticated;
create policy rescue_contatti_propri on public.rescue_contatti for select to authenticated using (user_id = auth.uid());

-- Il bonus della ricerca Rescue attiva finisce nell'assegnazione (e quindi nella versione 1 delle condizioni)
create or replace function public._incarico_da_rescue() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.rescue_richieste where annuncio_id = new.annuncio_id and stato = 'attiva';
  if r.id is not null then
    if coalesce(new.bonus_urgenza, 0) = 0 then new.bonus_urgenza := r.bonus_urgenza; end if;
    if new.sostituisce_incarico is null then new.sostituisce_incarico := r.incarico_originale_id; end if;
  end if;
  return new;
end $$;
revoke execute on function public._incarico_da_rescue() from public, anon, authenticated;
drop trigger if exists incarichi_rescue_prima on public.incarichi;
create trigger incarichi_rescue_prima before insert on public.incarichi for each row execute function public._incarico_da_rescue();

create or replace function public._rescue_dopo_assegnazione() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.rescue_contatti rc set risposta = 'accettata', risposta_il = now()
  from public.rescue_richieste r where r.id = rc.richiesta_id and r.annuncio_id = new.annuncio_id and r.stato = 'attiva' and rc.user_id = new.lavoratore_id;
  if (select a2.posti - (select count(*) from public.incarichi i where i.annuncio_id = a2.id and i.stato <> 'annullato')
        - (select count(*) from public.proposte p where p.annuncio_id = a2.id and p.stato = 'attesa' and p.scade_il > now() and p.id is distinct from new.proposta_id)
      from public.annunci a2 where a2.id = new.annuncio_id) <= 0 then
    update public.rescue_richieste set stato = 'coperta', chiusa_il = now() where annuncio_id = new.annuncio_id and stato = 'attiva';
    if found then
      perform public._notifica(a.autore_id, 'rescue', format('Rescue: «%s» è di nuovo coperto.', a.titolo), jsonb_build_object('annuncio_id', a.id), 'rescue-coperto-' || a.id || '-' || new.id)
      from public.annunci a where a.id = new.annuncio_id;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public._rescue_dopo_assegnazione() from public, anon, authenticated;
drop trigger if exists incarichi_rescue_dopo on public.incarichi;
create trigger incarichi_rescue_dopo after insert on public.incarichi for each row execute function public._rescue_dopo_assegnazione();

-- Chi può essere avvisato per un annuncio (filtri comuni a tutti i gruppi)
create or replace function public._rescue_idoneo(p_user uuid, p_annuncio uuid, p_committente uuid, p_escluso uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user <> p_committente and p_user is distinct from p_escluso
    and cardinality(public._requisiti_trust(p_user, 'candidatura')) = 0
    and not exists (select 1 from public.blocchi b where (b.utente_id = p_committente and b.bloccato_id = p_user) or (b.utente_id = p_user and b.bloccato_id = p_committente))
    and cardinality(public._incarichi_sovrapposti(p_user, p_annuncio)) = 0
    and not exists (select 1 from public.candidature c where c.annuncio_id = p_annuncio and c.lavoratore_id = p_user and c.stato in ('in_attesa_conferma', 'confermata'))
    and (select count(*) from public.rescue_contatti rc where rc.user_id = p_user and rc.notificato_il > now() - interval '24 hours') < (public._imp('rescue_max_avvisi_giorno'))::int;
$$;
revoke execute on function public._rescue_idoneo(uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public._rescue_contatta(p_richiesta uuid, p_gruppo int) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; a record; primo timestamptz; ultima timestamptz; escluso uuid; x record; n int := 0;
begin
  select * into r from public.rescue_richieste where id = p_richiesta;
  select * into a from public.annunci where id = r.annuncio_id;
  select min(inizio), max(fine) into primo, ultima from public.turni where annuncio_id = a.id;
  select lavoratore_id into escluso from public.incarichi where id = r.incarico_originale_id;
  for x in
    select distinct q.uid from (
      select c.lavoratore_id as uid from public.candidature c
        where p_gruppo = 1 and c.annuncio_id = a.id and c.stato in ('inviata', 'in_valutazione', 'scaduta', 'rifiutata_committente', 'ritirata', 'ritirata_incompatibile')
      union
      select d.user_id from public.disponibilita_live d
        where p_gruppo = 2 and d.stato = 'attiva' and d.urgenti and d.inizio <= primo and d.fine >= ultima and lower(d.citta) = lower(a.citta)
          and (cardinality(d.mansioni) = 0 or exists (select 1 from unnest(d.mansioni) m where lower(m) in (lower(a.categoria), lower(coalesce(a.mansione, ''))) or lower(coalesce(a.mansione, a.titolo)) like '%' || lower(m) || '%'))
          and (d.compenso_min is null or d.compenso_min <= a.compenso_ora)
      union
      select pn.user_id from public.preferenze_notifiche pn join public.profili pr on pr.id = pn.user_id
        where p_gruppo = 3 and pn.urgenti and lower(coalesce(pr.citta, '')) = lower(a.citta)
    ) q
    where not exists (select 1 from public.rescue_contatti rc where rc.richiesta_id = r.id and rc.user_id = q.uid)
      and public._rescue_idoneo(q.uid, a.id, r.committente_id, escluso)
    limit 200
  loop
    insert into public.rescue_contatti (richiesta_id, user_id, gruppo) values (r.id, x.uid, p_gruppo) on conflict do nothing;
    if found then
      perform public._notifica(x.uid, 'rescue', format('Incarico urgente a %s: «%s», %s alle %s.%s Rispondi da Attività → Offerte.', a.citta, a.titolo,
        to_char(primo at time zone 'Europe/Rome', 'DD/MM'), to_char(primo at time zone 'Europe/Rome', 'HH24:MI'),
        case when r.bonus_urgenza > 0 then format(' Bonus urgenza %s €.', r.bonus_urgenza) else '' end),
        jsonb_build_object('rescue_id', r.id, 'annuncio_id', a.id), 'rescue-' || r.id);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public._rescue_contatta(uuid, int) from public, anon, authenticated;

-- Avanza la ricerca: idempotente (ogni persona è avvisata al massimo una volta per richiesta)
create or replace function public._rescue_avanza(p_richiesta uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; primo timestamptz; minuti numeric; intens text; passo int; g int; tot int := 0; raggiunto int := 0;
begin
  select * into r from public.rescue_richieste where id = p_richiesta and stato = 'attiva' for update skip locked;
  if r.id is null then return jsonb_build_object('ok', false); end if;
  select min(inizio) into primo from public.turni where annuncio_id = r.annuncio_id;
  if primo <= now() then
    update public.rescue_richieste set stato = 'scaduta', chiusa_il = now() where id = r.id;
    perform public._notifica(r.committente_id, 'rescue', 'Rescue chiuso: l''incarico è iniziato senza che si trovasse un sostituto. Ci dispiace.', jsonb_build_object('annuncio_id', r.annuncio_id), 'rescue-scaduto-' || r.id);
    return jsonb_build_object('ok', true, 'stato', 'scaduta');
  end if;
  if public._posti_liberi(r.annuncio_id) <= 0 and not exists (select 1 from public.proposte p where p.annuncio_id = r.annuncio_id and p.stato = 'attesa' and p.scade_il > now()) then
    update public.rescue_richieste set stato = 'coperta', chiusa_il = now() where id = r.id;
    return jsonb_build_object('ok', true, 'stato', 'coperta');
  end if;
  minuti := extract(epoch from primo - now()) / 60;
  intens := case when minuti < (public._imp('rescue_simultanea_ore'))::numeric * 60 then 'simultanea'
                 when minuti < (public._imp('rescue_accelerata_ore'))::numeric * 60 then 'accelerata' else 'ordinaria' end;
  passo := case intens when 'ordinaria' then (public._imp('rescue_minuti_tra_gruppi'))::int
                       when 'accelerata' then (public._imp('rescue_minuti_tra_gruppi_accelerata'))::int else 0 end;
  for g in 1..3 loop
    if intens = 'simultanea' or now() >= r.creato_il + make_interval(mins => (g - 1) * passo) then
      tot := tot + public._rescue_contatta(r.id, g);
      raggiunto := g;
    end if;
  end loop;
  update public.rescue_richieste set intensita = intens, gruppo_raggiunto = greatest(gruppo_raggiunto, raggiunto) where id = r.id;
  return jsonb_build_object('ok', true, 'intensita', intens, 'gruppo', raggiunto, 'nuovi_avvisati', tot);
end $$;
revoke execute on function public._rescue_avanza(uuid) from public, anon, authenticated;

create or replace function public.attiva_rescue(p_annuncio uuid, p_bonus numeric default 0, p_motivo text default 'posto_scoperto', p_incarico_originale uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); a record; primo timestamptz; nuovo uuid; r jsonb; b numeric;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if not (public._imp('rescue_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  select * into a from public.annunci where id = p_annuncio for update;
  if a.id is null or a.autore_id <> u then raise exception 'Non è un tuo annuncio'; end if;
  select min(inizio) into primo from public.turni where annuncio_id = a.id;
  if primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;
  if a.stato <> 'pubblicato' or public._posti_liberi(a.id) <= 0 then return jsonb_build_object('ok', false, 'motivo', 'nessun_posto_scoperto'); end if;
  if p_incarico_originale is not null and not exists (select 1 from public.incarichi where id = p_incarico_originale and annuncio_id = a.id) then raise exception 'Incarico non valido'; end if;
  b := case when (public._imp('rescue_urgency_bonus_enabled'))::boolean then greatest(0, least(coalesce(p_bonus, 0), 500)) else 0 end;
  insert into public.rescue_richieste (annuncio_id, committente_id, incarico_originale_id, motivo, bonus_urgenza)
  values (a.id, u, p_incarico_originale, coalesce(nullif(p_motivo, ''), 'posto_scoperto'), b)
  on conflict do nothing returning id into nuovo;
  if nuovo is null then return jsonb_build_object('ok', false, 'motivo', 'rescue_gia_attivo'); end if;
  perform public._registra('rescue_attivato', 'rescue', nuovo::text, jsonb_build_object('bonus', b, 'motivo', p_motivo));
  r := public._rescue_avanza(nuovo);
  return jsonb_build_object('ok', true, 'id', nuovo) || r;
end $$;
revoke execute on function public.attiva_rescue(uuid, numeric, text, uuid) from public, anon;
grant execute on function public.attiva_rescue(uuid, numeric, text, uuid) to authenticated;

create or replace function public.chiudi_rescue(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.rescue_richieste set stato = 'annullata', chiusa_il = now() where id = p_id and committente_id = auth.uid() and stato = 'attiva';
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.chiudi_rescue(uuid) from public, anon;
grant execute on function public.chiudi_rescue(uuid) to authenticated;

-- Il bonus si può solo AUMENTARE durante la ricerca (chi ha già accettato tiene il suo).
create or replace function public.aumenta_bonus_rescue(p_id uuid, p_bonus numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not (public._imp('rescue_urgency_bonus_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  update public.rescue_richieste set bonus_urgenza = least(p_bonus, 500)
  where id = p_id and committente_id = auth.uid() and stato = 'attiva' and p_bonus > bonus_urgenza;
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.aumenta_bonus_rescue(uuid, numeric) from public, anon;
grant execute on function public.aumenta_bonus_rescue(uuid, numeric) to authenticated;

create or replace function public.rispondi_rescue(p_richiesta uuid, p_accetta boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); rc record; r jsonb;
begin
  select c.*, q.stato as stato_richiesta, q.annuncio_id into rc from public.rescue_contatti c join public.rescue_richieste q on q.id = c.richiesta_id
  where c.richiesta_id = p_richiesta and c.user_id = u for update of c;
  if rc.user_id is null then raise exception 'Offerta non trovata'; end if;
  if rc.risposta <> 'nessuna' then return jsonb_build_object('ok', false, 'motivo', 'gia_risposto'); end if;
  if rc.stato_richiesta <> 'attiva' then
    update public.rescue_contatti set risposta = 'non_piu_disponibile', risposta_il = now() where richiesta_id = p_richiesta and user_id = u;
    return jsonb_build_object('ok', false, 'motivo', 'posti_esauriti');
  end if;
  if not p_accetta then
    update public.rescue_contatti set risposta = 'rifiutata', risposta_il = now() where richiesta_id = p_richiesta and user_id = u;
    return jsonb_build_object('ok', true, 'stato', 'rifiutata');
  end if;
  r := public._assegna_da_offerta(rc.annuncio_id, 'rescue');
  if not coalesce((r ->> 'ok')::boolean, false) and r ->> 'motivo' in ('posti_esauriti', 'gia_iniziato') then
    update public.rescue_contatti set risposta = 'non_piu_disponibile', risposta_il = now() where richiesta_id = p_richiesta and user_id = u;
  end if;
  return r;
end $$;
revoke execute on function public.rispondi_rescue(uuid, boolean) from public, anon;
grant execute on function public.rispondi_rescue(uuid, boolean) to authenticated;

-- Offerte ricevute dal lavoratore (proposte dirette + Rescue) con tutte le condizioni prima di accettare
create or replace function public._annuncio_offerta(p_annuncio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'titolo', a.titolo, 'nome', a.nome_pubblico, 'categoria', a.categoria, 'mansione', coalesce(a.mansione, a.titolo),
    'citta', a.citta, 'zona', a.zona, 'compenso_ora', a.compenso_ora, 'compenso_tipo', a.compenso_tipo, 'requisiti', a.requisiti,
    'qualifiche_obbligatorie', a.qualifiche_obbligatorie, 'tipo_rapporto', a.tipo_rapporto, 'info_sicurezza', a.info_sicurezza, 'condizioni', a.condizioni,
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id))
  from public.annunci a where a.id = p_annuncio;
$$;
revoke execute on function public._annuncio_offerta(uuid) from public, anon, authenticated;

create or replace function public.mie_offerte() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(o order by o ->> 'creato_il' desc), '[]') from (
    select jsonb_build_object('tipo', 'proposta', 'id', pd.id, 'stato', pd.stato, 'messaggio', pd.messaggio, 'domanda', pd.domanda, 'risposta', pd.risposta,
      'scade_il', pd.scade_il, 'creato_il', pd.creato_il, 'bonus_urgenza', 0, 'annuncio', public._annuncio_offerta(pd.annuncio_id)) as o
    from public.proposte_dirette pd where pd.lavoratore_id = auth.uid() and pd.stato in ('inviata', 'chiarimento') and pd.scade_il > now()
    union all
    select jsonb_build_object('tipo', 'rescue', 'id', r.id, 'stato', r.stato, 'creato_il', rc.notificato_il, 'bonus_urgenza', r.bonus_urgenza,
      'intensita', r.intensita, 'annuncio', public._annuncio_offerta(r.annuncio_id))
    from public.rescue_contatti rc join public.rescue_richieste r on r.id = rc.richiesta_id
    where rc.user_id = auth.uid() and rc.risposta = 'nessuna' and r.stato = 'attiva') q;
$$;
revoke execute on function public.mie_offerte() from public, anon;
grant execute on function public.mie_offerte() to authenticated;

-- Stato Rescue e proposte dirette per il committente
create or replace function public._rescue_json(p_annuncio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'stato', r.stato, 'intensita', r.intensita, 'bonus_urgenza', r.bonus_urgenza, 'gruppo', r.gruppo_raggiunto,
    'creato_il', r.creato_il, 'chiusa_il', r.chiusa_il,
    'avvisati', (select count(*) from public.rescue_contatti c where c.richiesta_id = r.id),
    'per_gruppo', (select jsonb_object_agg(g, n) from (select gruppo g, count(*) n from public.rescue_contatti c where c.richiesta_id = r.id group by gruppo) z),
    'rifiuti', (select count(*) from public.rescue_contatti c where c.richiesta_id = r.id and c.risposta = 'rifiutata'),
    'accettazioni', (select count(*) from public.rescue_contatti c where c.richiesta_id = r.id and c.risposta = 'accettata'))
  from public.rescue_richieste r where r.annuncio_id = p_annuncio order by r.creato_il desc limit 1;
$$;
revoke execute on function public._rescue_json(uuid) from public, anon, authenticated;

create or replace function public.miei_annunci() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'titolo', a.titolo, 'categoria', a.categoria, 'citta', a.citta, 'stato', a.stato, 'posti', a.posti,
    'compenso_ora', a.compenso_ora, 'posti_liberi', public._posti_liberi(a.id), 'posti_stato', public._posti_stato(a.id),
    'mansione', a.mansione, 'tipo_rapporto', a.tipo_rapporto, 'rescue', public._rescue_json(a.id),
    'proposte_dirette', (select coalesce(jsonb_agg(jsonb_build_object('id', pd.id, 'stato', pd.stato, 'nome', coalesce(pr.nome, 'Utente'), 'domanda', pd.domanda, 'scade_il', pd.scade_il) order by pd.creato_il desc), '[]')
                         from public.proposte_dirette pd left join public.profili pr on pr.id = pd.lavoratore_id where pd.annuncio_id = a.id and pd.creato_il > now() - interval '7 days'),
    'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id),
    'modifica_in_attesa', exists (select 1 from public.modifiche_orari m where m.annuncio_id = a.id and m.stato = 'attesa'),
    'candidati', (select coalesce(jsonb_agg(jsonb_build_object(
        'candidatura_id', c.id, 'lavoratore_id', c.lavoratore_id, 'cv_condiviso', c.cv_condiviso, 'stato', c.stato, 'motivo', c.motivo, 'nome', coalesce(pr.nome, 'Candidato'), 'citta', pr.citta, 'automunito', pr.automunito,
        'proposta', (select jsonb_build_object('id', p.id, 'scade_il', p.scade_il) from public.proposte p where p.candidatura_id = c.id and p.stato = 'attesa' and p.scade_il > now() limit 1),
        'incarico', (select public._incarico_json(i.id) from public.incarichi i where i.candidatura_id = c.id)
      ) order by c.creato_il), '[]'::jsonb)
      from public.candidature c left join public.profili pr on pr.id = c.lavoratore_id where c.annuncio_id = a.id)
  ) order by a.creato_il desc), '[]'::jsonb)
  from public.annunci a where a.autore_id = auth.uid();
$$;

-- ---------- Processi programmati (ogni minuto, idempotenti, con registro) ----------
create table if not exists public.registro_processi (
  id bigint generated always as identity primary key,
  nome text not null,
  esito text not null check (esito in ('ok', 'errore')),
  dettagli jsonb not null default '{}',
  eseguito_il timestamptz not null default now()
);
alter table public.registro_processi enable row level security;
revoke all on public.registro_processi from anon, authenticated;

create or replace function public.processi_operativi() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n1 int := 0; n2 int := 0; n3 int := 0; x record; esito_tot jsonb := '{}';
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
  if n1 + n2 + n3 > 0 then insert into public.registro_processi (nome, esito, dettagli) values ('processi_operativi', 'ok', esito_tot); end if;
  return esito_tot;
end $$;
revoke execute on function public.processi_operativi() from public, anon, authenticated;

select cron.schedule('jobexpress-processi-operativi', '* * * * *', 'select public.processi_operativi()');

-- ---------- Statistiche per l'area Admin (solo dati aggregati) ----------
create or replace function public.admin_operativo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return jsonb_build_object(
    'rescue_richieste', (select count(*) from public.rescue_richieste),
    'rescue_attive', (select count(*) from public.rescue_richieste where stato = 'attiva'),
    'rescue_coperte', (select count(*) from public.rescue_richieste where stato = 'coperta'),
    'rescue_scoperte', (select count(*) from public.rescue_richieste where stato = 'scaduta'),
    'rescue_minuti_medi', (select round(avg(extract(epoch from chiusa_il - creato_il) / 60)) from public.rescue_richieste where stato = 'coperta'),
    'rescue_minuti_mediani', (select round((percentile_cont(0.5) within group (order by extract(epoch from chiusa_il - creato_il) / 60))::numeric) from public.rescue_richieste where stato = 'coperta'),
    'rescue_avvisati', (select count(*) from public.rescue_contatti),
    'rescue_risposte', (select count(*) from public.rescue_contatti where risposta <> 'nessuna'),
    'rescue_bonus_medio', (select round(avg(bonus_urgenza), 2) from public.rescue_richieste where bonus_urgenza > 0),
    'rescue_categorie', (select coalesce(jsonb_object_agg(categoria, n), '{}') from (select a.categoria, count(*) n from public.rescue_richieste r join public.annunci a on a.id = r.annuncio_id group by 1 order by 2 desc limit 5) z),
    'live_attive_ora', (select count(distinct user_id) from public.disponibilita_live where stato = 'attiva' and inizio <= now() and fine > now()),
    'live_programmate', (select count(*) from public.disponibilita_live where stato = 'attiva' and inizio > now()),
    'proposte_dirette', (select count(*) from public.proposte_dirette),
    'proposte_accettate', (select count(*) from public.proposte_dirette where stato = 'accettata'),
    'proposte_risposte', (select count(*) from public.proposte_dirette where stato in ('accettata', 'rifiutata', 'non_piu_disponibile')),
    'annullamenti_per_fascia', (select coalesce(jsonb_object_agg(fascia, n), '{}') from (select fascia, count(*) n from public.annullamenti group by 1) z),
    'mancate_presentazioni_aperte', (select count(*) from public.mancate_presentazioni where stato in ('segnalata', 'chiarimento_inviato', 'in_revisione', 'contestata')),
    'modifiche_in_attesa', (select count(*) from public.richieste_modifica where stato in ('attesa', 'chiarimento')),
    'processi_errori_24h', (select count(*) from public.registro_processi where esito = 'errore' and eseguito_il > now() - interval '24 hours'),
    'processi_ultimo', (select max(eseguito_il) from public.registro_processi),
    'coda_mancate', coalesce((select jsonb_agg(jsonb_build_object('id', mp.id, 'stato', mp.stato, 'nota', mp.nota, 'chiarimento', mp.chiarimento, 'creato_il', mp.creato_il,
        'lavoratore', coalesce(pl.nome, 'Utente'), 'committente', coalesce(pc.nome, 'Utente'), 'titolo', a.titolo) order by mp.creato_il)
      from public.mancate_presentazioni mp join public.incarichi i on i.id = mp.incarico_id join public.annunci a on a.id = i.annuncio_id
      left join public.profili pl on pl.id = i.lavoratore_id left join public.profili pc on pc.id = i.committente_id
      where mp.stato in ('segnalata', 'chiarimento_inviato', 'in_revisione', 'contestata')), '[]'));
end $$;
revoke execute on function public.admin_operativo() from public, anon;
grant execute on function public.admin_operativo() to authenticated;
