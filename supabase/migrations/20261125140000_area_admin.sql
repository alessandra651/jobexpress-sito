-- JobExpress: area Admin del fondatore.
--
-- Regole di sicurezza:
--   * Chi è amministratore lo decide SOLO la tabella "amministratori",
--     che dal sito non si può né leggere né modificare (RLS senza policy).
--   * Il sito chiede "sono admin?" con una funzione: conoscere l'indirizzo
--     della pagina non basta per entrare.
--   * Le statistiche sono solo numeri aggregati: nessun dato personale.
--   * Ogni azione dell'admin viene registrata in "registro_admin".
--
-- Per diventare admin (una volta sola, dal pannello SQL di Supabase):
--   insert into public.amministratori (user_id)
--   select id from auth.users where email = 'LA-TUA-EMAIL';

create table public.amministratori (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creato_il timestamptz not null default now()
);
alter table public.amministratori enable row level security;
revoke all on public.amministratori from anon, authenticated;

create table public.registro_admin (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  azione text not null check (char_length(azione) between 1 and 80),
  dettagli jsonb not null default '{}'::jsonb,
  creato_il timestamptz not null default now()
);
alter table public.registro_admin enable row level security;
revoke all on public.registro_admin from anon, authenticated;
create index registro_admin_creato_il on public.registro_admin (creato_il desc);

create function public.sono_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.amministratori where user_id = (select auth.uid()));
$$;
revoke execute on function public.sono_admin() from public, anon;
grant execute on function public.sono_admin() to authenticated;

create function public.admin_statistiche() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then
    raise exception 'Accesso riservato';
  end if;
  return jsonb_build_object(
    'utenti', (select count(*) from public.profili),
    'nuovi_7_giorni', (select count(*) from public.profili where creato_il > now() - interval '7 days'),
    'lavoratori', (select count(*) from public.profili where 'lavoro' = any (modalita)),
    'aziende', (select count(*) from public.profili where 'attivita' = any (modalita)),
    'privati', (select count(*) from public.profili where 'privato' = any (modalita)),
    'automuniti', (select count(*) from public.profili where automunito),
    'citta', coalesce((select jsonb_agg(jsonb_build_object('citta', citta, 'utenti', n) order by n desc)
      from (select coalesce(citta, 'Non indicata') as citta, count(*) as n from public.profili group by 1 order by 2 desc limit 8) c), '[]'::jsonb),
    'interesse_lavoratori', (select count(*) from public.interesse_lavoratori),
    'interesse_attivita', (select count(*) from public.interesse_attivita),
    'interesse_partner', (select count(*) from public.interesse_partner)
  );
end $$;
revoke execute on function public.admin_statistiche() from public, anon;
grant execute on function public.admin_statistiche() to authenticated;

create function public.admin_registra(azione text, dettagli jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then
    raise exception 'Accesso riservato';
  end if;
  insert into public.registro_admin (user_id, azione, dettagli)
  values ((select auth.uid()), left(azione, 80), coalesce(dettagli, '{}'::jsonb));
end $$;
revoke execute on function public.admin_registra(text, jsonb) from public, anon;
grant execute on function public.admin_registra(text, jsonb) to authenticated;
