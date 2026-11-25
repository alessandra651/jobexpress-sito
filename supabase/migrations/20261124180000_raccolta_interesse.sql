-- JobExpress, fase di validazione: raccolta dell'interesse dal sito.
--
-- Principio: da-- JobExpress, fase di validazione: raccolta dell'interesse dal sito.
--
-- Principio: dal sito si può solo SCRIVERE, mai leggere.
--   * RLS attiva su ogni tabella, nessuna policy di lettura, modifica o cancellazione.
--   * I permessi di inserimento sono sulle singole colonne: il pubblico non può
--     impostare id, data, stato o note interne.
--   * Nessun vincolo di unicità sull'email: un errore "già registrato" rivelerebbe
--     a chiunque chi si è iscritto. I doppioni si vedono dal pannello.

create table public.interesse_lavoratori (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  email text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  telefono text check (char_length(telefono) between 6 and 30),
  comune text not null check (char_length(btrim(comune)) between 2 and 80),
  mansioni text[] not null check (
    cardinality(mansioni) between 1 and 6
    and mansioni <@ array['sala', 'cucina', 'bar', 'hotel', 'commercio', 'eventi']
  ),
  disponibilita text[] not null check (
    cardinality(disponibilita) between 1 and 4
    and disponibilita <@ array['ultimo_minuto', 'feriali', 'weekend', 'fino_tre_giorni']
  ),
  dalle time not null,
  alle time not null,
  esperienza text not null check (esperienza in ('nessuna', 'meno_di_uno', 'uno_tre', 'oltre_tre')),
  maggiorenne boolean not null check (maggiorenne),
  intervista boolean not null default false,
  privacy_letta boolean not null check (privacy_letta),
  versione_privacy text not null check (char_length(versione_privacy) <= 20),
  stato text not null default 'nuovo' check (stato in ('nuovo', 'contattato', 'intervistato', 'archiviato')),
  note_interne text
);

create table public.interesse_attivita (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  nome_attivita text not null check (char_length(btrim(nome_attivita)) between 2 and 160),
  tipo text not null check (
    tipo in ('ristorante', 'pizzeria', 'bar', 'pub', 'hotel', 'catering', 'negozio', 'eventi', 'altro')
  ),
  referente text not null check (char_length(btrim(referente)) between 2 and 120),
  comune text not null check (char_length(btrim(comune)) between 2 and 80),
  email text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  telefono text check (char_length(telefono) between 6 and 30),
  mansioni text[] not null check (
    cardinality(mansioni) between 1 and 6
    and mansioni <@ array['sala', 'cucina', 'bar', 'hotel', 'commercio', 'eventi']
  ),
  frequenza text not null check (frequenza in ('meno_di_una', 'una_due', 'tre_cinque', 'oltre_cinque')),
  opinione_commissione text not null default 'non_so' check (opinione_commissione in ('si', 'no', 'forse', 'non_so')),
  esempio_turno text check (char_length(esempio_turno) <= 1000),
  intervista boolean not null default false,
  privacy_letta boolean not null check (privacy_letta),
  versione_privacy text not null check (char_length(versione_privacy) <= 20),
  stato text not null default 'nuovo' check (stato in ('nuovo', 'contattato', 'intervistato', 'archiviato')),
  note_interne text
);

create table public.interesse_partner (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  email text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  organizzazione text check (char_length(organizzazione) <= 160),
  tipo text not null check (
    tipo in ('agenzia_lavoro', 'associazione_categoria', 'sviluppo', 'universita', 'consulenza', 'altro')
  ),
  messaggio text not null check (char_length(btrim(messaggio)) between 1 and 2000),
  privacy_letta boolean not null check (privacy_letta),
  versione_privacy text not null check (char_length(versione_privacy) <= 20),
  stato text not null default 'nuovo' check (stato in ('nuovo', 'contattato', 'archiviato')),
  note_interne text
);

comment on table public.interesse_lavoratori is 'Persone interessate a lavorare. Conservazione massima: 12 mesi.';
comment on table public.interesse_attivita is 'Attività interessate. Conservazione massima: 12 mesi.';
comment on table public.interesse_partner is 'Proposte di collaborazione. Conservazione massima: 12 mesi.';

create index on public.interesse_lavoratori (creato_il desc);
create index on public.interesse_attivita (creato_il desc);
create index on public.interesse_partner (creato_il desc);

-- Sicurezza -----------------------------------------------------------------

alter table public.interesse_lavoratori enable row level security;
alter table public.interesse_attivita enable row level security;
alter table public.interesse_partner enable row level security;

revoke all on public.interesse_lavoratori, public.interesse_attivita, public.interesse_partner from anon, authenticated;

grant insert (
  nome, email, telefono, comune, mansioni, disponibilita, dalle, alle, esperienza,
  maggiorenne, intervista, privacy_letta, versione_privacy
) on public.interesse_lavoratori to anon;

grant insert (
  nome_attivita, tipo, referente, comune, email, telefono, mansioni, frequenza,
  opinione_commissione, esempio_turno, intervista, privacy_letta, versione_privacy
) on public.interesse_attivita to anon;

grant insert (
  nome, email, organizzazione, tipo, messaggio, privacy_letta, versione_privacy
) on public.interesse_partner to anon;

create policy "Il sito può inserire" on public.interesse_lavoratori
  for insert to anon with check (privacy_letta and maggiorenne and stato = 'nuovo' and note_interne is null);

create policy "Il sito può inserire" on public.interesse_attivita
  for insert to anon with check (privacy_letta and stato = 'nuovo' and note_interne is null);

create policy "Il sito può inserire" on public.interesse_partner
  for insert to anon with check (privacy_letta and stato = 'nuovo' and note_interne is null);

-- Riepilogo per il pannello: avanzamento rispetto agli obiettivi di validazione
-- (30 attività, 30 persone). Non accessibile dal sito. ------------------------

create view public.riepilogo_validazione with (security_invoker = true) as
select
  'persone' as gruppo,
  count(distinct email) as contatti,
  30 as obiettivo,
  count(distinct email) filter (where intervista) as disponibili_intervista,
  count(distinct email) filter (where stato = 'intervistato') as intervistati
from public.interesse_lavoratori
union all
select
  'attivita',
  count(distinct email),
  30,
  count(distinct email) filter (where intervista),
  count(distinct email) filter (where stato = 'intervistato')
from public.interesse_attivita;

revoke all on public.riepilogo_validazione from anon, authenticated;

-- JobExpress: più categorie nei moduli di interesse e tipo "privato" per chi pubblica.
-- (Già applicata su Supabase il 25/11/2026: copia salvata qui per lo storico.)

do $$ declare c record; begin
  for c in select conrelid::regclass as t, conname from pg_constraint
    where contype='c'
      and conrelid in ('public.interesse_lavoratori'::regclass,'public.interesse_attivita'::regclass)
      and pg_get_constraintdef(oid) like '%mansioni <@%'
  loop execute format('alter table %s drop constraint %I', c.t, c.conname); end loop;
end $$;

alter table public.interesse_lavoratori add constraint interesse_lavoratori_mansioni_check
  check (cardinality(mansioni) between 1 and 12 and mansioni <@ array['sala','cucina','bar','hotel','commercio','eventi',
  'babysitting','pet_sitting','pulizie','giardinaggio','ripetizioni','traslochi','fotografia','servizi_digitali']);
alter table public.interesse_attivita add constraint interesse_attivita_mansioni_check
  check (cardinality(mansioni) between 1 and 12 and mansioni <@ array['sala','cucina','bar','hotel','commercio','eventi',
  'babysitting','pet_sitting','pulizie','giardinaggio','ripetizioni','traslochi','fotografia','servizi_digitali']);

do $$ declare c record; begin
  for c in select conname from pg_constraint
    where contype='c' and conrelid='public.interesse_attivita'::regclass and pg_get_constraintdef(oid) like '%pizzeria%'
  loop execute format('alter table public.interesse_attivita drop constraint %I', c.conname); end loop;
end $$;
alter table public.interesse_attivita add constraint interesse_attivita_tipo_check
  check (tipo in ('ristorante','pizzeria','bar','pub','hotel','catering','negozio','eventi','privato','altro'));

comment on column public.interesse_attivita.opinione_commissione is 'Parere sull''abbonamento facoltativo (prima: commissione)';

-- JobExpress: profili degli utenti registrati (Supabase Auth).
--
-- Regole di sicurezza:
--   * RLS attiva: ognuno legge e modifica SOLO il proprio profilo.
--   * Il profilo nasce in automatico alla registrazione (trigger su auth.users),
--     con i dati scelti nel modulo. Dal sito non si può inserire a mano.
--   * Dal sito si possono modificare solo alcune colonne (nome, città, modalità, automunito).
--   * Ognuno può eliminare il proprio account: il profilo sparisce con lui (on delete cascade).

create table public.profili (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text check (nome is null or char_length(btrim(nome)) between 1 and 120),
  citta text check (citta is null or char_length(btrim(citta)) between 1 and 80),
  modalita text[] not null default '{}' check (modalita <@ array['lavoro', 'attivita', 'privato']),
  automunito boolean not null default false,
  maggiorenne boolean not null default false,
  termini_accettati_il timestamptz,
  versione_privacy text check (versione_privacy is null or char_length(versione_privacy) <= 20),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

comment on table public.profili is 'Profilo di ogni utente registrato. Visibile solo al proprietario.';

alter table public.profili enable row level security;

create policy "leggo il mio profilo" on public.profili
  for select to authenticated using ((select auth.uid()) = id);

create policy "modifico il mio profilo" on public.profili
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke all on public.profili from anon, authenticated;
grant select on public.profili to authenticated;
grant update (nome, citta, modalita, automunito) on public.profili to authenticated;

-- Data di aggiornamento automatica
create function public.profili_aggiorna_data() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;

create trigger profili_aggiorna_data before update on public.profili
  for each row execute function public.profili_aggiorna_data();

-- Alla registrazione crea il profilo con i dati del modulo (user metadata).
-- Pensata per non bloccare mai una registrazione: i valori strani vengono scartati.
create function public.crea_profilo_nuovo_utente() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profili (id, nome, citta, modalita, automunito, maggiorenne, termini_accettati_il, versione_privacy)
  values (
    new.id,
    nullif(left(btrim(coalesce(m ->> 'nome', m ->> 'full_name', m ->> 'name', '')), 120), ''),
    nullif(left(btrim(coalesce(m ->> 'citta', '')), 80), ''),
    coalesce(array(
      select distinct v from jsonb_array_elements_text(
        case when jsonb_typeof(m -> 'modalita') = 'array' then m -> 'modalita' else '[]'::jsonb end
      ) as v where v in ('lavoro', 'attivita', 'privato')
    ), '{}'),
    coalesce(m ->> 'automunito', '') = 'true',
    coalesce(m ->> 'maggiorenne', '') = 'true',
    case when coalesce(m ->> 'termini', '') = 'true' then now() end,
    nullif(left(coalesce(m ->> 'versione_privacy', ''), 20), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.crea_profilo_nuovo_utente() from public, anon, authenticated;

create trigger crea_profilo_nuovo_utente after insert on auth.users
  for each row execute function public.crea_profilo_nuovo_utente();

-- Eliminazione del proprio account (dal Profilo, con conferma)
create function public.elimina_mio_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Accesso richiesto';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.elimina_mio_account() from public, anon;
grant execute on function public.elimina_mio_account() to authenticated;
l sito si può solo SCRIVERE, mai leggere.
--   * RLS attiva su ogni tabella, nessuna policy di lettura, modifica o cancellazione.
--   * I permessi di inserimento sono sulle singole colonne: il pubblico non può
--     impostare id, data, stato o note interne.
--   * Nessun vincolo di unicità sull'email: un errore "già registrato" rivelerebbe
--     a chiunque chi si è iscritto. I doppioni si vedono dal pannello.

create table public.interesse_lavoratori (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  email text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  telefono text check (char_length(telefono) between 6 and 30),
  comune text not null check (char_length(btrim(comune)) between 2 and 80),
  mansioni text[] not null check (
    cardinality(mansioni) between 1 and 6
    and mansioni <@ array['sala', 'cucina', 'bar', 'hotel', 'commercio', 'eventi']
  ),
  disponibilita text[] not null check (
    cardinality(disponibilita) between 1 and 4
    and disponibilita <@ array['ultimo_minuto', 'feriali', 'weekend', 'fino_tre_giorni']
  ),
  dalle time not null,
  alle time not null,
  esperienza text not null check (esperienza in ('nessuna', 'meno_di_uno', 'uno_tre', 'oltre_tre')),
  maggiorenne boolean not null check (maggiorenne),
  intervista boolean not null default false,
  privacy_letta boolean not null check (privacy_letta),
  versione_privacy text not null check (char_length(versione_privacy) <= 20),
  stato text not null default 'nuovo' check (stato in ('nuovo', 'contattato', 'intervistato', 'archiviato')),
  note_interne text
);

create table public.interesse_attivita (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  nome_attivita text not null check (char_length(btrim(nome_attivita)) between 2 and 160),
  tipo text not null check (
    tipo in ('ristorante', 'pizzeria', 'bar', 'pub', 'hotel', 'catering', 'negozio', 'eventi', 'altro')
  ),
  referente text not null check (char_length(btrim(referente)) between 2 and 120),
  comune text not null check (char_length(btrim(comune)) between 2 and 80),
  email text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  telefono text check (char_length(telefono) between 6 and 30),
  mansioni text[] not null check (
    cardinality(mansioni) between 1 and 6
    and mansioni <@ array['sala', 'cucina', 'bar', 'hotel', 'commercio', 'eventi']
  ),
  frequenza text not null check (frequenza in ('meno_di_una', 'una_due', 'tre_cinque', 'oltre_cinque')),
  opinione_commissione text not null default 'non_so' check (opinione_commissione in ('si', 'no', 'forse', 'non_so')),
  esempio_turno text check (char_length(esempio_turno) <= 1000),
  intervista boolean not null default false,
  privacy_letta boolean not null check (privacy_letta),
  versione_privacy text not null check (char_length(versione_privacy) <= 20),
  stato text not null default 'nuovo' check (stato in ('nuovo', 'contattato', 'intervistato', 'archiviato')),
  note_interne text
);

create table public.interesse_partner (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  email text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  organizzazione text check (char_length(organizzazione) <= 160),
  tipo text not null check (
    tipo in ('agenzia_lavoro', 'associazione_categoria', 'sviluppo', 'universita', 'consulenza', 'altro')
  ),
  messaggio text not null check (char_length(btrim(messaggio)) between 1 and 2000),
  privacy_letta boolean not null check (privacy_letta),
  versione_privacy text not null check (char_length(versione_privacy) <= 20),
  stato text not null default 'nuovo' check (stato in ('nuovo', 'contattato', 'archiviato')),
  note_interne text
);

comment on table public.interesse_lavoratori is 'Persone interessate a lavorare. Conservazione massima: 12 mesi.';
comment on table public.interesse_attivita is 'Attività interessate. Conservazione massima: 12 mesi.';
comment on table public.interesse_partner is 'Proposte di collaborazione. Conservazione massima: 12 mesi.';

create index on public.interesse_lavoratori (creato_il desc);
create index on public.interesse_attivita (creato_il desc);
create index on public.interesse_partner (creato_il desc);

-- Sicurezza -----------------------------------------------------------------

alter table public.interesse_lavoratori enable row level security;
alter table public.interesse_attivita enable row level security;
alter table public.interesse_partner enable row level security;

revoke all on public.interesse_lavoratori, public.interesse_attivita, public.interesse_partner from anon, authenticated;

grant insert (
  nome, email, telefono, comune, mansioni, disponibilita, dalle, alle, esperienza,
  maggiorenne, intervista, privacy_letta, versione_privacy
) on public.interesse_lavoratori to anon;

grant insert (
  nome_attivita, tipo, referente, comune, email, telefono, mansioni, frequenza,
  opinione_commissione, esempio_turno, intervista, privacy_letta, versione_privacy
) on public.interesse_attivita to anon;

grant insert (
  nome, email, organizzazione, tipo, messaggio, privacy_letta, versione_privacy
) on public.interesse_partner to anon;

create policy "Il sito può inserire" on public.interesse_lavoratori
  for insert to anon with check (privacy_letta and maggiorenne and stato = 'nuovo' and note_interne is null);

create policy "Il sito può inserire" on public.interesse_attivita
  for insert to anon with check (privacy_letta and stato = 'nuovo' and note_interne is null);

create policy "Il sito può inserire" on public.interesse_partner
  for insert to anon with check (privacy_letta and stato = 'nuovo' and note_interne is null);

-- Riepilogo per il pannello: avanzamento rispetto agli obiettivi di validazione
-- (30 attività, 30 persone). Non accessibile dal sito. ------------------------

create view public.riepilogo_validazione with (security_invoker = true) as
select
  'persone' as gruppo,
  count(distinct email) as contatti,
  30 as obiettivo,
  count(distinct email) filter (where intervista) as disponibili_intervista,
  count(distinct email) filter (where stato = 'intervistato') as intervistati
from public.interesse_lavoratori
union all
select
  'attivita',
  count(distinct email),
  30,
  count(distinct email) filter (where intervista),
  count(distinct email) filter (where stato = 'intervistato')
from public.interesse_attivita;

revoke all on public.riepilogo_validazione from anon, authenticated;
