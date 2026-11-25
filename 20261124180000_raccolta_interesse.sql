-- JobExpress, fase di validazione: raccolta dell'interesse dal sito.
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
