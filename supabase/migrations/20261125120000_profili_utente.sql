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
