-- JobExpress — Aggiornamento «Fondamenta + candidature» (27 nov 2026)
--
-- Cosa aggiunge (non cancella e non modifica nulla di esistente):
--   * impostazioni      regole della piattaforma modificabili dall'admin (limite Free SPENTO)
--   * abbonamenti       piano di ogni utente (Free / Plus / Friends), pagamenti ancora simulati
--   * gruppi_friends    gruppo di 3 persone con codice d'invito
--   * annunci, turni    annunci con uno o più turni (anche notturni o su più giorni)
--   * candidature       massimo N candidature attive nella stessa fascia oraria (N = 3)
--   * proposte          doppia conferma, con scadenza automatica
--   * incarichi         assegnazioni confermate (un annuncio = un incarico, anche con più turni)
--   * notifiche         notifiche interne, senza doppioni
--   * registro_operazioni   traccia delle operazioni importanti (per verifiche e contestazioni)
--
-- Sicurezza:
--   * RLS attiva ovunque. Dal sito NON si scrive direttamente nelle tabelle:
--     tutte le modifiche passano da funzioni che controllano chi sei e le regole.
--   * I controlli (sovrapposizioni, posti, scadenze, limite mensile) avvengono nel database,
--     con blocchi per evitare doppie conferme simultanee.
--   * La conferma digitale NON sostituisce il contratto di lavoro né gli adempimenti obbligatori.

-- =====================================================================
-- 1. IMPOSTAZIONI (modificabili solo dall'admin)
-- =====================================================================
create table public.impostazioni (
  chiave text primary key check (chiave ~ '^[a-z_]{3,60}$'),
  valore jsonb not null,
  descrizione text,
  aggiornato_il timestamptz not null default now(),
  aggiornato_da uuid references auth.users (id) on delete set null
);
comment on table public.impostazioni is 'Regole della piattaforma. Leggibili da tutti (servono ai testi del sito), modificabili solo con admin_imposta().';
alter table public.impostazioni enable row level security;
revoke all on public.impostazioni from anon, authenticated;
grant select (chiave, valore, descrizione, aggiornato_il) on public.impostazioni to anon, authenticated;
create policy "tutti leggono le impostazioni" on public.impostazioni for select to anon, authenticated using (true);

insert into public.impostazioni (chiave, valore, descrizione) values
  ('free_monthly_job_limit_enabled', 'false', 'Limite sperimentale incarichi mensili per Free. SPENTO finché non c''è la verifica legale.'),
  ('free_monthly_job_limit', '2', 'Numero massimo di incarichi confermati al mese per Free, quando il limite è acceso.'),
  ('max_candidature_sovrapposte', '3', 'Candidature attive massime nella stessa fascia oraria. Uguale per tutti i piani.'),
  ('tempi_conferma', '[{"meno_di_minuti":60,"minuti":5},{"meno_di_minuti":180,"minuti":10},{"meno_di_minuti":1440,"minuti":30},{"meno_di_minuti":null,"minuti":120}]',
    'Tempo per confermare una proposta, in base a quanto manca all''inizio. Mai oltre l''inizio.'),
  ('margine_spostamenti_minuti', '30', 'Sotto questo margine tra due incarichi compare l''avviso spostamenti (non blocca).'),
  ('ai_richieste_mensili', '20', 'Richieste AI al mese per Plus e per ogni membro Friends.'),
  ('prezzi', '{"plus":{"mese":4.99,"anno":39.99},"friends":{"mese":9.99,"anno":79.99}}', 'Prezzi degli abbonamenti in euro.'),
  ('prova_gratuita', '{"attiva":false,"giorni":7}', 'Prova gratuita di Plus. Mai attivata senza consenso esplicito.'),
  ('promozione', '{"attiva":false,"fine":null}', 'Durata di eventuali promozioni.'),
  ('funzioni_premium', '{"goal":true,"cv":true,"career":true,"smart_calendar":true,"ai":false}', 'Funzioni Plus attive.'),
  ('annullamenti_lavoratore_contano', 'true', 'Se il lavoratore annulla un incarico confermato, resta nel conteggio mensile (evita abusi). Nessuna penalità su badge o recensioni.');

create function public._imp(p_chiave text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select valore from public.impostazioni where chiave = p_chiave;
$$;
revoke execute on function public._imp(text) from public, anon, authenticated;

-- =====================================================================
-- 2. REGISTRO OPERAZIONI E NOTIFICHE
-- =====================================================================
create table public.registro_operazioni (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  azione text not null check (char_length(azione) between 1 and 60),
  oggetto_tipo text,
  oggetto_id text,
  dettagli jsonb not null default '{}'::jsonb,
  creato_il timestamptz not null default now()
);
alter table public.registro_operazioni enable row level security;
revoke all on public.registro_operazioni from anon, authenticated;
create index registro_operazioni_oggetto on public.registro_operazioni (oggetto_tipo, oggetto_id);

create function public._registra(p_azione text, p_tipo text, p_id text, p_dettagli jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.registro_operazioni (user_id, azione, oggetto_tipo, oggetto_id, dettagli)
  values (auth.uid(), p_azione, p_tipo, p_id, coalesce(p_dettagli, '{}'::jsonb));
$$;
revoke execute on function public._registra(text, text, text, jsonb) from public, anon, authenticated;

create table public.notifiche (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (char_length(tipo) between 1 and 40),
  testo text not null check (char_length(testo) between 1 and 500),
  dati jsonb not null default '{}'::jsonb,
  chiave text not null,                       -- evita notifiche doppie
  promozionale boolean not null default false, -- gestibili a parte da quelle di servizio
  letta boolean not null default false,
  creato_il timestamptz not null default now(),
  unique (user_id, chiave)
);
alter table public.notifiche enable row level security;
revoke all on public.notifiche from anon, authenticated;
grant select on public.notifiche to authenticated;
create policy "leggo le mie notifiche" on public.notifiche for select to authenticated using ((select auth.uid()) = user_id);
create index notifiche_utente on public.notifiche (user_id, creato_il desc);

create function public._notifica(p_user uuid, p_tipo text, p_testo text, p_dati jsonb, p_chiave text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifiche (user_id, tipo, testo, dati, chiave)
  values (p_user, p_tipo, left(p_testo, 500), coalesce(p_dati, '{}'::jsonb), p_chiave)
  on conflict (user_id, chiave) do nothing;
$$;
revoke execute on function public._notifica(uuid, text, text, jsonb, text) from public, anon, authenticated;

create function public.segna_notifiche_lette(p_ids bigint[] default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifiche set letta = true
  where user_id = auth.uid() and not letta and (p_ids is null or id = any (p_ids));
$$;
revoke execute on function public.segna_notifiche_lette(bigint[]) from public, anon;
grant execute on function public.segna_notifiche_lette(bigint[]) to authenticated;

-- =====================================================================
-- 3. ABBONAMENTI E GRUPPI FRIENDS (pagamenti ancora simulati)
-- =====================================================================
create table public.gruppi_friends (
  id uuid primary key default gen_random_uuid(),
  titolare_id uuid not null references auth.users (id) on delete cascade,
  codice text not null unique check (codice ~ '^[A-Z0-9]{8}$'),
  creato_il timestamptz not null default now()
);
alter table public.gruppi_friends enable row level security;
revoke all on public.gruppi_friends from anon, authenticated;

create table public.abbonamenti (
  user_id uuid primary key references auth.users (id) on delete cascade,
  piano text not null default 'free' check (piano in ('free', 'plus', 'friends')),
  periodo text check (periodo in ('mese', 'anno')),
  stato text not null default 'attivo' check (stato in ('attivo', 'scaduto', 'annullato')),
  inizio timestamptz not null default now(),
  fine timestamptz,
  gruppo_id uuid references public.gruppi_friends (id) on delete set null,
  prova boolean not null default false,
  simulato boolean not null default true,     -- true finché non ci sono pagamenti veri
  aggiornato_il timestamptz not null default now()
);
comment on table public.abbonamenti is 'Piano di ogni utente. Ognuno vede solo il proprio. I membri Friends non vedono i dati degli altri.';
alter table public.abbonamenti enable row level security;
revoke all on public.abbonamenti from anon, authenticated;
grant select on public.abbonamenti to authenticated;
create policy "leggo il mio abbonamento" on public.abbonamenti for select to authenticated using ((select auth.uid()) = user_id);

-- Piano effettivo di un utente (free se scaduto o assente)
create function public.piano_di(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select a.piano from public.abbonamenti a
    where a.user_id = p_user and a.stato = 'attivo' and (a.fine is null or a.fine > now())
  ), 'free');
$$;
revoke execute on function public.piano_di(uuid) from public, anon, authenticated;

-- Attivazione di prova (pagamento simulato): solo su richiesta esplicita dell'utente.
create function public.attiva_piano_simulato(p_piano text, p_periodo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  g uuid;
  cod text;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if p_piano not in ('free', 'plus', 'friends') then raise exception 'Piano non valido'; end if;
  if p_piano <> 'free' and p_periodo not in ('mese', 'anno') then raise exception 'Periodo non valido'; end if;

  if p_piano = 'friends' then
    select id, codice into g, cod from public.gruppi_friends where titolare_id = u;
    if g is null then
      cod := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      insert into public.gruppi_friends (titolare_id, codice) values (u, cod) returning id into g;
    end if;
  end if;

  insert into public.abbonamenti as a (user_id, piano, periodo, stato, inizio, fine, gruppo_id, simulato, aggiornato_il)
  values (u, p_piano, case when p_piano = 'free' then null else p_periodo end, 'attivo', now(),
          case when p_piano = 'free' then null when p_periodo = 'anno' then now() + interval '1 year' else now() + interval '1 month' end,
          g, true, now())
  on conflict (user_id) do update set piano = excluded.piano, periodo = excluded.periodo, stato = 'attivo',
    inizio = excluded.inizio, fine = excluded.fine, gruppo_id = excluded.gruppo_id, simulato = true, aggiornato_il = now();

  perform public._registra('abbonamento_simulato', 'abbonamento', u::text, jsonb_build_object('piano', p_piano, 'periodo', p_periodo));
  return jsonb_build_object('ok', true, 'piano', p_piano, 'codice_invito', cod);
end $$;
revoke execute on function public.attiva_piano_simulato(text, text) from public, anon;
grant execute on function public.attiva_piano_simulato(text, text) to authenticated;

-- Entrare in un gruppo Friends con il codice (max 3 persone, titolare compreso)
create function public.unisciti_friends(p_codice text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  gr record;
  membri int;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  select g.id, g.titolare_id, a.fine into gr
  from public.gruppi_friends g join public.abbonamenti a on a.user_id = g.titolare_id and a.gruppo_id = g.id
  where g.codice = upper(btrim(p_codice)) and a.stato = 'attivo' and (a.fine is null or a.fine > now())
  for update of g;
  if gr.id is null then return jsonb_build_object('ok', false, 'motivo', 'codice_non_valido'); end if;
  if gr.titolare_id = u then return jsonb_build_object('ok', false, 'motivo', 'sei_il_titolare'); end if;
  select count(*) into membri from public.abbonamenti where gruppo_id = gr.id and stato = 'attivo';
  if membri >= 3 then return jsonb_build_object('ok', false, 'motivo', 'gruppo_pieno'); end if;

  insert into public.abbonamenti as a (user_id, piano, periodo, stato, inizio, fine, gruppo_id, simulato, aggiornato_il)
  values (u, 'friends', null, 'attivo', now(), gr.fine, gr.id, true, now())
  on conflict (user_id) do update set piano = 'friends', periodo = null, stato = 'attivo', inizio = now(),
    fine = gr.fine, gruppo_id = gr.id, simulato = true, aggiornato_il = now();
  perform public._registra('friends_ingresso', 'gruppo_friends', gr.id::text);
  perform public._notifica(gr.titolare_id, 'friends', 'Una persona è entrata nel tuo gruppo Friends.', '{}'::jsonb, 'friends-' || gr.id || '-' || u);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.unisciti_friends(text) from public, anon;
grant execute on function public.unisciti_friends(text) to authenticated;

-- =====================================================================
-- 4. ANNUNCI E TURNI
-- =====================================================================
create table public.annunci (
  id uuid primary key default gen_random_uuid(),
  autore_id uuid not null references auth.users (id) on delete cascade,
  nome_pubblico text not null check (char_length(btrim(nome_pubblico)) between 1 and 80),
  tipo text not null default 'azienda' check (tipo in ('azienda', 'privato')),
  titolo text not null check (char_length(btrim(titolo)) between 3 and 80),
  categoria text not null check (char_length(categoria) between 2 and 40),
  descrizione text check (descrizione is null or char_length(descrizione) <= 2000),
  condizioni text check (condizioni is null or char_length(condizioni) <= 500),
  citta text not null check (char_length(btrim(citta)) between 2 and 80),
  zona text check (zona is null or char_length(zona) <= 80),
  lat numeric(9, 6) check (lat is null or lat between -90 and 90),     -- per i futuri calcoli di distanza
  lng numeric(9, 6) check (lng is null or lng between -180 and 180),
  compenso_ora numeric(8, 2) not null check (compenso_ora > 0 and compenso_ora <= 500),
  compenso_tipo text not null default 'non_specificato' check (compenso_tipo in ('lordo', 'netto', 'non_specificato')),
  posti int not null default 1 check (posti between 1 and 50),
  stato text not null default 'pubblicato' check (stato in ('pubblicato', 'completo', 'chiuso', 'annullato')),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
alter table public.annunci enable row level security;
revoke all on public.annunci from anon, authenticated;
grant select on public.annunci to anon, authenticated;
create policy "annunci visibili" on public.annunci for select to anon, authenticated
  using (stato in ('pubblicato', 'completo') or autore_id = (select auth.uid()));
create index annunci_autore on public.annunci (autore_id);

create table public.turni (
  id bigint generated always as identity primary key,
  annuncio_id uuid not null references public.annunci (id) on delete cascade,
  inizio timestamptz not null,
  fine timestamptz not null,
  check (fine > inizio and fine - inizio <= interval '16 hours')  -- i turni notturni finiscono il giorno dopo: va bene
);
alter table public.turni enable row level security;
revoke all on public.turni from anon, authenticated;
grant select on public.turni to anon, authenticated;
create policy "turni visibili" on public.turni for select to anon, authenticated
  using (exists (select 1 from public.annunci a where a.id = annuncio_id));
create index turni_annuncio on public.turni (annuncio_id, inizio);

-- =====================================================================
-- 5. CANDIDATURE, PROPOSTE, INCARICHI
-- =====================================================================
create table public.candidature (
  id uuid primary key default gen_random_uuid(),
  annuncio_id uuid not null references public.annunci (id) on delete cascade,
  lavoratore_id uuid not null references auth.users (id) on delete cascade,
  stato text not null default 'inviata' check (stato in (
    'inviata', 'in_valutazione', 'in_attesa_conferma', 'confermata',
    'rifiutata_committente', 'rifiutata_lavoratore', 'ritirata', 'ritirata_incompatibile',
    'scaduta', 'annullata')),
  motivo text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
alter table public.candidature enable row level security;
revoke all on public.candidature from anon, authenticated;
grant select on public.candidature to authenticated;
create policy "candidature mie o ai miei annunci" on public.candidature for select to authenticated
  using (lavoratore_id = (select auth.uid())
    or exists (select 1 from public.annunci a where a.id = annuncio_id and a.autore_id = (select auth.uid())));
-- una sola candidatura attiva per persona e annuncio
create unique index candidature_una_attiva on public.candidature (annuncio_id, lavoratore_id)
  where stato in ('inviata', 'in_valutazione', 'in_attesa_conferma', 'confermata');
create index candidature_lavoratore on public.candidature (lavoratore_id, stato);

create table public.proposte (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references public.candidature (id) on delete cascade,
  annuncio_id uuid not null references public.annunci (id) on delete cascade,
  lavoratore_id uuid not null references auth.users (id) on delete cascade,
  committente_id uuid not null references auth.users (id) on delete cascade,
  stato text not null default 'attesa' check (stato in ('attesa', 'confermata', 'rifiutata', 'scaduta', 'annullata')),
  creata_il timestamptz not null default now(),
  scade_il timestamptz not null,
  risposta_il timestamptz
);
alter table public.proposte enable row level security;
revoke all on public.proposte from anon, authenticated;
grant select on public.proposte to authenticated;
create policy "proposte mie" on public.proposte for select to authenticated
  using (lavoratore_id = (select auth.uid()) or committente_id = (select auth.uid()));
create unique index proposte_una_in_attesa on public.proposte (candidatura_id) where stato = 'attesa';
create index proposte_scadenza on public.proposte (scade_il) where stato = 'attesa';

create table public.incarichi (
  id uuid primary key default gen_random_uuid(),
  annuncio_id uuid not null references public.annunci (id) on delete cascade,
  candidatura_id uuid not null unique references public.candidature (id) on delete cascade,
  proposta_id uuid references public.proposte (id) on delete set null,
  lavoratore_id uuid not null references auth.users (id) on delete cascade,
  committente_id uuid not null references auth.users (id) on delete cascade,
  stato text not null default 'programmato' check (stato in ('programmato', 'completato', 'annullato', 'contestato')),
  mese_conteggio date not null,              -- mese (Europe/Rome) del primo turno
  conta_nel_limite boolean not null default true,
  confermato_il timestamptz not null default now(),
  annullato_il timestamptz,
  annullato_da text check (annullato_da in ('committente', 'lavoratore', 'admin')),
  completato_il timestamptz
);
comment on column public.incarichi.stato is '«In corso» non si salva: si ricava dagli orari dei turni.';
alter table public.incarichi enable row level security;
revoke all on public.incarichi from anon, authenticated;
grant select on public.incarichi to authenticated;
create policy "incarichi miei" on public.incarichi for select to authenticated
  using (lavoratore_id = (select auth.uid()) or committente_id = (select auth.uid()));
create index incarichi_lavoratore on public.incarichi (lavoratore_id, mese_conteggio);

-- =====================================================================
-- 6. FUNZIONI DI SUPPORTO (interne)
-- =====================================================================
-- Turni delle candidature attive di un lavoratore (escluso un annuncio)
create function public._miei_turni_attivi(p_user uuid, p_escludi uuid)
returns table (candidatura_id uuid, annuncio_id uuid, inizio timestamptz, fine timestamptz, stato text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.annuncio_id, t.inizio, t.fine, c.stato
  from public.candidature c join public.turni t on t.annuncio_id = c.annuncio_id
  where c.lavoratore_id = p_user
    and c.stato in ('inviata', 'in_valutazione', 'in_attesa_conferma', 'confermata')
    and c.annuncio_id is distinct from p_escludi
    and t.fine > now();
$$;
revoke execute on function public._miei_turni_attivi(uuid, uuid) from public, anon, authenticated;

-- Quante candidature sarebbero attive insieme, al massimo, aggiungendo l'annuncio p_annuncio.
-- Guarda gli intervalli veri (non "ha una sovrapposizione qualsiasi"): conta, istante per istante,
-- le candidature diverse che si sovrappongono a ogni turno del nuovo annuncio.
create function public._picco_sovrapposte(p_user uuid, p_annuncio uuid)
returns table (picco int, conflitti uuid[])
language sql stable security definer set search_path = '' as $$
  with nuovi as (select inizio, fine from public.turni where annuncio_id = p_annuncio),
  esistenti as (select * from public._miei_turni_attivi(p_user, p_annuncio)),
  punti as (
    select n.inizio as p from nuovi n
    union
    select e.inizio from esistenti e join nuovi n on e.inizio > n.inizio and e.inizio < n.fine
  ),
  conteggi as (
    select pt.p, count(distinct e.candidatura_id)::int as n, array_agg(distinct e.candidatura_id) as ids
    from punti pt join esistenti e on e.inizio <= pt.p and e.fine > pt.p
    group by pt.p
  )
  select coalesce(max(n), 0)::int,
         coalesce((select array_agg(distinct x) from conteggi c2, unnest(c2.ids) x
                   where c2.n = (select max(n) from conteggi)), '{}')
  from conteggi;
$$;
revoke execute on function public._picco_sovrapposte(uuid, uuid) from public, anon, authenticated;

-- Incarichi confermati del lavoratore che si sovrappongono davvero all'annuncio
create function public._incarichi_sovrapposti(p_user uuid, p_annuncio uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct i.id), '{}')
  from public.incarichi i
  join public.turni ti on ti.annuncio_id = i.annuncio_id
  join public.turni tn on tn.annuncio_id = p_annuncio
  where i.lavoratore_id = p_user and i.stato = 'programmato' and i.annuncio_id <> p_annuncio
    and ti.inizio < tn.fine and tn.inizio < ti.fine;
$$;
revoke execute on function public._incarichi_sovrapposti(uuid, uuid) from public, anon, authenticated;

-- Avvisi spostamenti: incarichi confermati con meno di N minuti tra uno e l'altro (non blocca)
create function public._avvisi_spostamenti(p_user uuid, p_annuncio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct jsonb_build_object(
      'incarico_id', i.id, 'titolo', a.titolo, 'nome', a.nome_pubblico, 'citta', a.citta,
      'minuti', floor(extract(epoch from greatest(tn.inizio - ti.fine, ti.inizio - tn.fine)) / 60)::int)), '[]'::jsonb)
  from public.incarichi i
  join public.annunci a on a.id = i.annuncio_id
  join public.turni ti on ti.annuncio_id = i.annuncio_id
  join public.turni tn on tn.annuncio_id = p_annuncio
  where i.lavoratore_id = p_user and i.stato = 'programmato' and i.annuncio_id <> p_annuncio
    and not (ti.inizio < tn.fine and tn.inizio < ti.fine)
    and greatest(tn.inizio - ti.fine, ti.inizio - tn.fine) < make_interval(mins => (public._imp('margine_spostamenti_minuti'))::int);
$$;
revoke execute on function public._avvisi_spostamenti(uuid, uuid) from public, anon, authenticated;

-- Descrizione breve di candidature (per i messaggi di avviso)
create function public._descrivi_candidature(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'candidatura_id', c.id, 'annuncio_id', a.id, 'nome', a.nome_pubblico, 'titolo', a.titolo,
      'stato', c.stato, 'compenso_ora', a.compenso_ora, 'compenso_tipo', a.compenso_tipo,
      'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio)
                from public.turni t where t.annuncio_id = a.id))
    order by c.creato_il), '[]'::jsonb)
  from public.candidature c join public.annunci a on a.id = c.annuncio_id
  where c.id = any (p_ids);
$$;
revoke execute on function public._descrivi_candidature(uuid[]) from public, anon, authenticated;

-- Minuti per confermare una proposta, dalla tabella in impostazioni
create function public._minuti_conferma(p_minuti_mancanti numeric) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (r ->> 'minuti')::int
    from jsonb_array_elements(public._imp('tempi_conferma')) with ordinality as x (r, n)
    where r ->> 'meno_di_minuti' is null or p_minuti_mancanti < (r ->> 'meno_di_minuti')::numeric
    order by n limit 1), 120);
$$;
revoke execute on function public._minuti_conferma(numeric) from public, anon, authenticated;

-- Incarichi che contano nel mese (Europe/Rome) per un lavoratore
create function public._incarichi_del_mese(p_user uuid, p_mese date) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.incarichi
  where lavoratore_id = p_user and mese_conteggio = p_mese
    and (stato <> 'annullato' or conta_nel_limite);
$$;
revoke execute on function public._incarichi_del_mese(uuid, date) from public, anon, authenticated;

-- Posti ancora liberi (posti meno incarichi validi meno proposte in attesa non scadute)
create function public._posti_liberi(p_annuncio uuid) returns int
language sql stable security definer set search_path = '' as $$
  select a.posti
    - (select count(*) from public.incarichi i where i.annuncio_id = a.id and i.stato <> 'annullato')::int
    - (select count(*) from public.proposte p where p.annuncio_id = a.id and p.stato = 'attesa' and p.scade_il > now())::int
  from public.annunci a where a.id = p_annuncio;
$$;
revoke execute on function public._posti_liberi(uuid) from public, anon, authenticated;

-- =====================================================================
-- 7. SCADENZA DELLE PROPOSTE (idempotente: si può chiamare quante volte si vuole)
-- =====================================================================
create function public.scadi_proposte() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.proposte p set stato = 'scaduta', risposta_il = now()
    where p.stato = 'attesa' and p.scade_il <= now()
    returning p.id, p.candidatura_id, p.annuncio_id, p.lavoratore_id, p.committente_id
  loop
    update public.candidature set stato = 'scaduta', aggiornato_il = now()
      where id = r.candidatura_id and stato = 'in_attesa_conferma';
    -- nessuna penalità per il lavoratore: solo un avviso neutro
    perform public._notifica(r.committente_id, 'proposta_scaduta',
      'Una proposta non è stata confermata in tempo: il posto è di nuovo libero e puoi selezionare un''altra persona.',
      jsonb_build_object('annuncio_id', r.annuncio_id), 'proposta-scaduta-' || r.id);
    perform public._notifica(r.lavoratore_id, 'proposta_scaduta',
      'Una proposta è scaduta. Nessun problema: non cambia nulla per il tuo profilo.',
      jsonb_build_object('annuncio_id', r.annuncio_id), 'proposta-scaduta-' || r.id);
    insert into public.registro_operazioni (user_id, azione, oggetto_tipo, oggetto_id)
      values (null, 'proposta_scaduta', 'proposta', r.id::text);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.scadi_proposte() from public, anon, authenticated;

-- =====================================================================
-- 8. AZIONI DEL COMMITTENTE (azienda o privato)
-- =====================================================================
-- Pubblica un annuncio con i suoi turni. p_turni = [{"inizio": "...", "fine": "..."}]
create function public.pubblica_annuncio(p_annuncio jsonb, p_turni jsonb) returns uuid
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
  insert into public.annunci (autore_id, nome_pubblico, tipo, titolo, categoria, descrizione, condizioni, citta, zona, lat, lng, compenso_ora, compenso_tipo, posti)
  values (u, btrim(p_annuncio ->> 'nome_pubblico'), coalesce(p_annuncio ->> 'tipo', 'azienda'), btrim(p_annuncio ->> 'titolo'),
    p_annuncio ->> 'categoria', nullif(btrim(p_annuncio ->> 'descrizione'), ''), nullif(btrim(p_annuncio ->> 'condizioni'), ''),
    btrim(p_annuncio ->> 'citta'), nullif(btrim(p_annuncio ->> 'zona'), ''),
    (p_annuncio ->> 'lat')::numeric, (p_annuncio ->> 'lng')::numeric,
    (p_annuncio ->> 'compenso_ora')::numeric, coalesce(p_annuncio ->> 'compenso_tipo', 'non_specificato'),
    coalesce((p_annuncio ->> 'posti')::int, 1))
  returning id into nuovo;
  for t in select * from jsonb_array_elements(p_turni) loop
    if (t ->> 'inizio')::timestamptz <= now() then raise exception 'I turni devono essere nel futuro'; end if;
    insert into public.turni (annuncio_id, inizio, fine) values (nuovo, (t ->> 'inizio')::timestamptz, (t ->> 'fine')::timestamptz);
  end loop;
  perform public._registra('annuncio_pubblicato', 'annuncio', nuovo::text);
  return nuovo;
end $$;
revoke execute on function public.pubblica_annuncio(jsonb, jsonb) from public, anon;
grant execute on function public.pubblica_annuncio(jsonb, jsonb) to authenticated;

-- Seleziona un candidato: crea una proposta con scadenza (non è ancora l'assegnazione)
create function public.seleziona_candidato(p_candidatura uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  c record;
  a record;
  primo timestamptz;
  minuti int;
  scadenza timestamptz;
  prop uuid;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  perform public.scadi_proposte();
  select * into c from public.candidature where id = p_candidatura for update;
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'non_trovata'); end if;
  select * into a from public.annunci where id = c.annuncio_id for update;   -- blocca i posti dell'annuncio
  if a.autore_id <> u then raise exception 'Non è un tuo annuncio'; end if;
  if a.stato <> 'pubblicato' then return jsonb_build_object('ok', false, 'motivo', 'annuncio_non_disponibile'); end if;
  if c.stato not in ('inviata', 'in_valutazione') then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido', 'stato', c.stato); end if;
  select min(inizio) into primo from public.turni where annuncio_id = a.id;
  if primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;
  if public._posti_liberi(a.id) <= 0 then return jsonb_build_object('ok', false, 'motivo', 'posti_esauriti'); end if;

  minuti := public._minuti_conferma(extract(epoch from primo - now()) / 60);
  scadenza := least(now() + make_interval(mins => minuti), primo);   -- mai oltre l'inizio
  insert into public.proposte (candidatura_id, annuncio_id, lavoratore_id, committente_id, scade_il)
  values (c.id, a.id, c.lavoratore_id, u, scadenza) returning id into prop;
  update public.candidature set stato = 'in_attesa_conferma', aggiornato_il = now() where id = c.id;

  perform public._notifica(c.lavoratore_id, 'proposta_ricevuta',
    format('%s ti propone «%s». Hai tempo fino alle %s per confermare.', a.nome_pubblico, a.titolo,
           to_char(scadenza at time zone 'Europe/Rome', 'HH24:MI')),
    jsonb_build_object('proposta_id', prop, 'annuncio_id', a.id), 'proposta-' || prop);
  perform public._registra('candidato_selezionato', 'proposta', prop::text, jsonb_build_object('candidatura', c.id, 'scade_il', scadenza));
  return jsonb_build_object('ok', true, 'proposta_id', prop, 'scade_il', scadenza);
end $$;
revoke execute on function public.seleziona_candidato(uuid) from public, anon;
grant execute on function public.seleziona_candidato(uuid) to authenticated;

create function public.rifiuta_candidato(p_candidatura uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c record;
begin
  select c2.*, a.autore_id, a.titolo into c from public.candidature c2 join public.annunci a on a.id = c2.annuncio_id
  where c2.id = p_candidatura for update of c2;
  if c.id is null or c.autore_id <> auth.uid() then raise exception 'Non è un tuo annuncio'; end if;
  if c.stato not in ('inviata', 'in_valutazione') then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  update public.candidature set stato = 'rifiutata_committente', aggiornato_il = now() where id = c.id;
  perform public._notifica(c.lavoratore_id, 'candidatura_rifiutata', format('Per «%s» è stata scelta un''altra persona.', c.titolo),
    jsonb_build_object('annuncio_id', c.annuncio_id), 'rifiuto-' || c.id);
  perform public._registra('candidato_rifiutato', 'candidatura', c.id::text);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.rifiuta_candidato(uuid) from public, anon;
grant execute on function public.rifiuta_candidato(uuid) to authenticated;

-- Cambiare gli orari: se ci sono incarichi o proposte serve una nuova accettazione del lavoratore,
-- quindi qui viene bloccato. Se ci sono solo candidature, vengono annullate e le persone
-- avvisate: ricandidandosi rifanno tutti i controlli (è la loro nuova accettazione).
create function public.modifica_turni(p_annuncio uuid, p_turni jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  r record;
  t jsonb;
begin
  select * into a from public.annunci where id = p_annuncio for update;
  if a.id is null or a.autore_id <> auth.uid() then raise exception 'Non è un tuo annuncio'; end if;
  if exists (select 1 from public.incarichi where annuncio_id = a.id and stato = 'programmato')
     or exists (select 1 from public.proposte where annuncio_id = a.id and stato = 'attesa' and scade_il > now()) then
    return jsonb_build_object('ok', false, 'motivo', 'serve_nuova_accettazione');
  end if;
  if jsonb_typeof(p_turni) <> 'array' or jsonb_array_length(p_turni) not between 1 and 31 then raise exception 'Servono da 1 a 31 turni'; end if;
  delete from public.turni where annuncio_id = a.id;
  for t in select * from jsonb_array_elements(p_turni) loop
    if (t ->> 'inizio')::timestamptz <= now() then raise exception 'I turni devono essere nel futuro'; end if;
    insert into public.turni (annuncio_id, inizio, fine) values (a.id, (t ->> 'inizio')::timestamptz, (t ->> 'fine')::timestamptz);
  end loop;
  for r in update public.candidature set stato = 'annullata', motivo = 'orari_modificati', aggiornato_il = now()
           where annuncio_id = a.id and stato in ('inviata', 'in_valutazione') returning id, lavoratore_id loop
    perform public._notifica(r.lavoratore_id, 'incarico_modificato',
      format('Gli orari di «%s» sono cambiati. Se ti vanno ancora bene, ricandidati.', a.titolo),
      jsonb_build_object('annuncio_id', a.id), 'orari-' || r.id);
  end loop;
  update public.annunci set aggiornato_il = now() where id = a.id;
  perform public._registra('turni_modificati', 'annuncio', a.id::text, jsonb_build_object('turni', p_turni));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.modifica_turni(uuid, jsonb) from public, anon;
grant execute on function public.modifica_turni(uuid, jsonb) to authenticated;

-- =====================================================================
-- 9. AZIONI DEL LAVORATORE
-- =====================================================================
create function public.candidati(p_annuncio uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  a record;
  primo timestamptz;
  limite int := (public._imp('max_candidature_sovrapposte'))::int;
  pk record;
  occupati uuid[];
  nuova uuid;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lavoratore:' || u, 0));   -- una richiesta alla volta per persona
  select * into a from public.annunci where id = p_annuncio;
  if a.id is null or a.stato <> 'pubblicato' then return jsonb_build_object('ok', false, 'motivo', 'annuncio_non_disponibile'); end if;
  if a.autore_id = u then return jsonb_build_object('ok', false, 'motivo', 'tuo_annuncio'); end if;
  select min(inizio) into primo from public.turni where annuncio_id = a.id;
  if primo is null or primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;
  if exists (select 1 from public.candidature where annuncio_id = a.id and lavoratore_id = u
             and stato in ('inviata', 'in_valutazione', 'in_attesa_conferma', 'confermata')) then
    return jsonb_build_object('ok', false, 'motivo', 'gia_candidato');
  end if;

  occupati := public._incarichi_sovrapposti(u, a.id);
  if cardinality(occupati) > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'incarico_confermato',
      'conflitti', public._descrivi_candidature(array(select candidatura_id from public.incarichi where id = any (occupati))));
  end if;

  select * into pk from public._picco_sovrapposte(u, a.id);
  if pk.picco + 1 > limite then
    return jsonb_build_object('ok', false, 'motivo', 'sovrapposte', 'limite', limite,
      'conflitti', public._descrivi_candidature(pk.conflitti));
  end if;

  insert into public.candidature (annuncio_id, lavoratore_id) values (a.id, u) returning id into nuova;
  perform public._notifica(a.autore_id, 'nuova_candidatura', format('Nuova candidatura per «%s».', a.titolo),
    jsonb_build_object('annuncio_id', a.id, 'candidatura_id', nuova), 'candidatura-' || nuova);
  perform public._registra('candidatura_inviata', 'candidatura', nuova::text);
  return jsonb_build_object('ok', true, 'candidatura_id', nuova, 'avvisi_spostamenti', public._avvisi_spostamenti(u, a.id));
end $$;
revoke execute on function public.candidati(uuid) from public, anon;
grant execute on function public.candidati(uuid) to authenticated;

create function public.ritira_candidatura(p_candidatura uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  c record;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lavoratore:' || u, 0));
  select c2.*, a.autore_id, a.titolo into c from public.candidature c2 join public.annunci a on a.id = c2.annuncio_id
  where c2.id = p_candidatura and c2.lavoratore_id = u for update of c2;
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'non_trovata'); end if;
  if c.stato not in ('inviata', 'in_valutazione', 'in_attesa_conferma') then
    return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido', 'stato', c.stato);
  end if;
  update public.candidature set stato = 'ritirata', aggiornato_il = now() where id = c.id;
  update public.proposte set stato = 'annullata', risposta_il = now() where candidatura_id = c.id and stato = 'attesa';
  perform public._notifica(c.autore_id, 'candidatura_ritirata', format('Una persona ha ritirato la candidatura per «%s».', c.titolo),
    jsonb_build_object('annuncio_id', c.annuncio_id), 'ritiro-' || c.id);
  perform public._registra('candidatura_ritirata', 'candidatura', c.id::text);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.ritira_candidatura(uuid) from public, anon;
grant execute on function public.ritira_candidatura(uuid) to authenticated;

-- Risposta alla proposta. Solo con la conferma del lavoratore l'incarico è assegnato.
create function public.rispondi_proposta(p_proposta uuid, p_accetta boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  p record;
  a record;
  primo timestamptz;
  mese date;
  occupati uuid[];
  nuovo uuid;
  r record;
  ritirate int := 0;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lavoratore:' || u, 0));   -- niente doppie conferme simultanee
  select * into p from public.proposte where id = p_proposta and lavoratore_id = u for update;
  if p.id is null then return jsonb_build_object('ok', false, 'motivo', 'non_trovata'); end if;
  if p.stato <> 'attesa' then return jsonb_build_object('ok', false, 'motivo', 'non_in_attesa', 'stato', p.stato); end if;
  if p.scade_il <= now() then
    perform public.scadi_proposte();
    return jsonb_build_object('ok', false, 'motivo', 'scaduta');
  end if;

  if not p_accetta then
    update public.proposte set stato = 'rifiutata', risposta_il = now() where id = p.id;
    update public.candidature set stato = 'rifiutata_lavoratore', aggiornato_il = now() where id = p.candidatura_id;
    perform public._notifica(p.committente_id, 'proposta_rifiutata', 'La persona selezionata ha rifiutato la proposta: puoi sceglierne un''altra.',
      jsonb_build_object('annuncio_id', p.annuncio_id), 'proposta-rifiutata-' || p.id);
    perform public._registra('proposta_rifiutata', 'proposta', p.id::text);
    return jsonb_build_object('ok', true, 'stato', 'rifiutata');
  end if;

  select * into a from public.annunci where id = p.annuncio_id for update;   -- blocca i posti
  if a.stato not in ('pubblicato', 'completo') then return jsonb_build_object('ok', false, 'motivo', 'annuncio_non_disponibile'); end if;
  select min(inizio) into primo from public.turni where annuncio_id = a.id;
  if primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;

  occupati := public._incarichi_sovrapposti(u, a.id);
  if cardinality(occupati) > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'incarico_confermato',
      'conflitti', public._descrivi_candidature(array(select candidatura_id from public.incarichi where id = any (occupati))));
  end if;

  mese := date_trunc('month', primo at time zone 'Europe/Rome')::date;
  if (public._imp('free_monthly_job_limit_enabled'))::boolean and public.piano_di(u) = 'free'
     and public._incarichi_del_mese(u, mese) >= (public._imp('free_monthly_job_limit'))::int then
    return jsonb_build_object('ok', false, 'motivo', 'limite_mensile', 'mese', mese,
      'limite', (public._imp('free_monthly_job_limit'))::int);
  end if;

  -- Assegnazione
  insert into public.incarichi (annuncio_id, candidatura_id, proposta_id, lavoratore_id, committente_id, mese_conteggio)
  values (a.id, p.candidatura_id, p.id, u, p.committente_id, mese) returning id into nuovo;
  update public.proposte set stato = 'confermata', risposta_il = now() where id = p.id;
  update public.candidature set stato = 'confermata', aggiornato_il = now() where id = p.candidatura_id;
  if public._posti_liberi(a.id) <= 0 then update public.annunci set stato = 'completo', aggiornato_il = now() where id = a.id; end if;

  -- Ritiro automatico delle candidature incompatibili (orari che si sovrappongono davvero)
  for r in
    update public.candidature c set stato = 'ritirata_incompatibile', motivo = 'confermato_altro_incarico', aggiornato_il = now()
    where c.lavoratore_id = u and c.id <> p.candidatura_id
      and c.stato in ('inviata', 'in_valutazione', 'in_attesa_conferma')
      and exists (select 1 from public.turni t1 join public.turni t2 on t2.annuncio_id = a.id
                  where t1.annuncio_id = c.annuncio_id and t1.inizio < t2.fine and t2.inizio < t1.fine)
    returning c.id, c.annuncio_id
  loop
    update public.proposte set stato = 'annullata', risposta_il = now() where candidatura_id = r.id and stato = 'attesa';
    perform public._notifica(x.autore_id, 'candidatura_ritirata_incompatibile',
      format('Una candidatura per «%s» è stata ritirata: la persona ha confermato un altro incarico nello stesso orario.', x.titolo),
      jsonb_build_object('annuncio_id', x.id), 'ritiro-auto-' || r.id)
      from public.annunci x where x.id = r.annuncio_id;
    ritirate := ritirate + 1;
  end loop;

  if ritirate > 0 then
    perform public._notifica(u, 'candidature_ritirate',
      format('Abbiamo ritirato %s candidatur%s con orari incompatibili con l''incarico confermato.', ritirate, case when ritirate = 1 then 'a' else 'e' end),
      jsonb_build_object('incarico_id', nuovo), 'ritiri-' || nuovo);
  end if;
  perform public._notifica(p.committente_id, 'proposta_confermata', format('Proposta confermata per «%s».', a.titolo),
    jsonb_build_object('annuncio_id', a.id, 'incarico_id', nuovo), 'proposta-confermata-' || p.id);
  perform public._registra('proposta_confermata', 'incarico', nuovo::text, jsonb_build_object('proposta', p.id, 'ritirate', ritirate));
  return jsonb_build_object('ok', true, 'incarico_id', nuovo, 'ritirate', ritirate,
    'avvisi_spostamenti', public._avvisi_spostamenti(u, a.id));
end $$;
revoke execute on function public.rispondi_proposta(uuid, boolean) from public, anon;
grant execute on function public.rispondi_proposta(uuid, boolean) to authenticated;

-- Annullare un incarico prima dell'inizio (committente o lavoratore)
create function public.annulla_incarico(p_incarico uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  i record;
  primo timestamptz;
  chi text;
begin
  select * into i from public.incarichi where id = p_incarico for update;
  if i.id is null or u not in (i.lavoratore_id, i.committente_id) then raise exception 'Incarico non trovato'; end if;
  if i.stato <> 'programmato' then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  select min(inizio) into primo from public.turni where annuncio_id = i.annuncio_id;
  if primo <= now() then return jsonb_build_object('ok', false, 'motivo', 'gia_iniziato'); end if;
  chi := case when u = i.committente_id then 'committente' else 'lavoratore' end;
  update public.incarichi set stato = 'annullato', annullato_il = now(), annullato_da = chi,
    conta_nel_limite = (chi = 'lavoratore' and (public._imp('annullamenti_lavoratore_contano'))::boolean)
  where id = i.id;
  update public.candidature set stato = 'annullata', motivo = 'annullato_da_' || chi, aggiornato_il = now() where id = i.candidatura_id;
  update public.annunci set stato = 'pubblicato', aggiornato_il = now() where id = i.annuncio_id and stato = 'completo';
  perform public._notifica(case when chi = 'committente' then i.lavoratore_id else i.committente_id end, 'incarico_annullato',
    case when chi = 'committente' then 'Il committente ha annullato un incarico confermato. Non conta nel tuo limite mensile.'
         else 'La persona assegnata ha annullato l''incarico: il posto è di nuovo libero.' end,
    jsonb_build_object('incarico_id', i.id), 'annullato-' || i.id);
  perform public._registra('incarico_annullato', 'incarico', i.id::text, jsonb_build_object('da', chi));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.annulla_incarico(uuid) from public, anon;
grant execute on function public.annulla_incarico(uuid) to authenticated;

-- Segnare un incarico come completato (dopo la fine dell'ultimo turno)
create function public.completa_incarico(p_incarico uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  i record;
  ultimo timestamptz;
begin
  select * into i from public.incarichi where id = p_incarico for update;
  if i.id is null or u not in (i.lavoratore_id, i.committente_id) then raise exception 'Incarico non trovato'; end if;
  if i.stato <> 'programmato' then return jsonb_build_object('ok', false, 'motivo', 'stato_non_valido'); end if;
  select max(fine) into ultimo from public.turni where annuncio_id = i.annuncio_id;
  if ultimo > now() then return jsonb_build_object('ok', false, 'motivo', 'non_ancora_finito'); end if;
  update public.incarichi set stato = 'completato', completato_il = now() where id = i.id;
  perform public._notifica(i.lavoratore_id, 'incarico_completato', 'Incarico completato. Puoi registrare il compenso e lasciare una recensione.',
    jsonb_build_object('incarico_id', i.id), 'completato-' || i.id);
  perform public._registra('incarico_completato', 'incarico', i.id::text);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.completa_incarico(uuid) from public, anon;
grant execute on function public.completa_incarico(uuid) to authenticated;

-- Avvisi spostamenti prima di confermare (gratuito per tutti)
create function public.controlla_spostamenti(p_annuncio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public._avvisi_spostamenti(auth.uid(), p_annuncio);
$$;
revoke execute on function public.controlla_spostamenti(uuid) from public, anon;
grant execute on function public.controlla_spostamenti(uuid) to authenticated;

-- Situazione dell'utente: piano, limiti e ora del server (per il conto alla rovescia)
create function public.mia_situazione() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ora_server', now(),
    'piano', public.piano_di(auth.uid()),
    'max_sovrapposte', (public._imp('max_candidature_sovrapposte'))::int,
    'limite_mensile_attivo', (public._imp('free_monthly_job_limit_enabled'))::boolean,
    'limite_mensile', (public._imp('free_monthly_job_limit'))::int,
    'incarichi_questo_mese', public._incarichi_del_mese(auth.uid(), date_trunc('month', now() at time zone 'Europe/Rome')::date),
    'proposte_in_attesa', (select coalesce(jsonb_agg(jsonb_build_object(
        'proposta_id', p.id, 'scade_il', p.scade_il, 'annuncio_id', a.id, 'nome', a.nome_pubblico, 'titolo', a.titolo,
        'citta', a.citta, 'zona', a.zona, 'compenso_ora', a.compenso_ora, 'compenso_tipo', a.compenso_tipo, 'condizioni', a.condizioni,
        'turni', (select jsonb_agg(jsonb_build_object('inizio', t.inizio, 'fine', t.fine) order by t.inizio) from public.turni t where t.annuncio_id = a.id))
        order by p.scade_il), '[]'::jsonb)
      from public.proposte p join public.annunci a on a.id = p.annuncio_id
      where p.lavoratore_id = auth.uid() and p.stato = 'attesa' and p.scade_il > now())
  );
$$;
revoke execute on function public.mia_situazione() from public, anon;
grant execute on function public.mia_situazione() to authenticated;

-- =====================================================================
-- 10. ADMIN: modifica delle impostazioni (registrata, mai retroattiva)
-- =====================================================================
create function public.admin_imposta(p_chiave text, p_valore jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  vecchio jsonb;
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  select valore into vecchio from public.impostazioni where chiave = p_chiave for update;
  if vecchio is null then raise exception 'Impostazione sconosciuta'; end if;
  if jsonb_typeof(p_valore) <> jsonb_typeof(vecchio) then raise exception 'Tipo di valore non valido'; end if;
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
revoke execute on function public.admin_imposta(text, jsonb) from public, anon;
grant execute on function public.admin_imposta(text, jsonb) to authenticated;

-- Statistiche reali sulle candidature (solo numeri aggregati)
create function public.admin_statistiche_incarichi() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return jsonb_build_object(
    'annunci_pubblicati', (select count(*) from public.annunci),
    'candidature_inviate', (select count(*) from public.candidature),
    'incarichi_assegnati', (select count(*) from public.incarichi where stato <> 'annullato'),
    'incarichi_completati', (select count(*) from public.incarichi where stato = 'completato'),
    'proposte_totali', (select count(*) from public.proposte where stato <> 'attesa'),
    'proposte_confermate', (select count(*) from public.proposte where stato = 'confermata'),
    'proposte_scadute', (select count(*) from public.proposte where stato = 'scaduta'),
    'ritirate_incompatibili', (select count(*) from public.candidature where stato = 'ritirata_incompatibile'),
    'minuti_medi_assegnazione', (select round(avg(extract(epoch from i.confermato_il - c.creato_il) / 60)) from public.incarichi i join public.candidature c on c.id = i.candidatura_id),
    'abbonamenti', (select coalesce(jsonb_object_agg(piano, n), '{}'::jsonb) from (
        select piano, count(*) n from public.abbonamenti where stato = 'attivo' and (fine is null or fine > now()) group by piano) x),
    'pagamenti_reali', false
  );
end $$;
revoke execute on function public.admin_statistiche_incarichi() from public, anon;
grant execute on function public.admin_statistiche_incarichi() to authenticated;

-- =====================================================================
-- 11. SCADENZA AUTOMATICA OGNI MINUTO (funziona anche ad app chiusa)
-- =====================================================================
create extension if not exists pg_cron;
select cron.schedule('jobexpress-scadi-proposte', '* * * * *', 'select public.scadi_proposte()');
