-- JobExpress — Smart Calendar e JobExpress AI (27 nov 2026)
--
-- calendario_personale: impegni personali e universitari. Li vede SOLO il proprietario:
--   aziende e privati non li vedono mai.
-- ai_conversazioni: storico delle conversazioni con l'assistente (solo il proprietario, eliminabili).
-- ai_utilizzo: contatore mensile delle richieste. Si aggiorna SOLO dal server (funzione AI),
--   mai dal sito: non si può manipolare. Le richieste fallite vengono restituite.
--   Il mese è quello di Europe/Rome; le richieste non usate non si accumulano.

create table public.calendario_personale (
  user_id uuid primary key references auth.users (id) on delete cascade,
  eventi jsonb not null default '[]'::jsonb check (jsonb_typeof(eventi) = 'array' and pg_column_size(eventi) < 300000),
  aggiornato_il timestamptz not null default now()
);
alter table public.calendario_personale enable row level security;
revoke all on public.calendario_personale from anon, authenticated;
grant select, insert, update, delete on public.calendario_personale to authenticated;
create policy "leggo il mio calendario" on public.calendario_personale for select to authenticated using ((select auth.uid()) = user_id);
create policy "creo il mio calendario" on public.calendario_personale for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "modifico il mio calendario" on public.calendario_personale for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "elimino il mio calendario" on public.calendario_personale for delete to authenticated using ((select auth.uid()) = user_id);

create table public.ai_conversazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area text not null check (area in ('colloqui', 'curriculum', 'mansioni', 'crescita', 'economia', 'altro')),
  titolo text not null check (char_length(titolo) between 1 and 120),
  messaggi jsonb not null default '[]'::jsonb check (jsonb_typeof(messaggi) = 'array' and pg_column_size(messaggi) < 200000),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
alter table public.ai_conversazioni enable row level security;
revoke all on public.ai_conversazioni from anon, authenticated;
grant select, delete on public.ai_conversazioni to authenticated;
create policy "leggo le mie conversazioni" on public.ai_conversazioni for select to authenticated using ((select auth.uid()) = user_id);
create policy "elimino le mie conversazioni" on public.ai_conversazioni for delete to authenticated using ((select auth.uid()) = user_id);
create index ai_conversazioni_utente on public.ai_conversazioni (user_id, aggiornato_il desc);

create table public.ai_utilizzo (
  user_id uuid not null references auth.users (id) on delete cascade,
  mese date not null,
  richieste int not null default 0 check (richieste >= 0),
  costo_stimato_eur numeric(10, 4) not null default 0,
  primary key (user_id, mese)
);
alter table public.ai_utilizzo enable row level security;
revoke all on public.ai_utilizzo from anon, authenticated;

create function public._mese_roma() returns date
language sql stable set search_path = '' as $$
  select date_trunc('month', now() at time zone 'Europe/Rome')::date;
$$;

-- Stato del contatore per il sito: «Hai utilizzato X richieste su 20»
create function public.ai_stato() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'attiva', coalesce((public._imp('funzioni_premium') ->> 'ai')::boolean, false),
    'piano', public.piano_di(auth.uid()),
    'limite', (public._imp('ai_richieste_mensili'))::int,
    'usate', coalesce((select richieste from public.ai_utilizzo where user_id = auth.uid() and mese = public._mese_roma()), 0),
    'rinnovo', (public._mese_roma() + interval '1 month')::date
  );
$$;
revoke execute on function public.ai_stato() from public, anon;
grant execute on function public.ai_stato() to authenticated;

-- Prenota una richiesta (solo la funzione server, con chiave di servizio).
-- Blocco per persona: due richieste insieme non superano il limite.
create function public.ai_riserva(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  lim int := (public._imp('ai_richieste_mensili'))::int;
  usate int;
begin
  if not coalesce((public._imp('funzioni_premium') ->> 'ai')::boolean, false) then
    return jsonb_build_object('ok', false, 'motivo', 'non_attiva');
  end if;
  if public.piano_di(p_user) = 'free' then return jsonb_build_object('ok', false, 'motivo', 'serve_plus'); end if;
  perform pg_advisory_xact_lock(hashtextextended('ai:' || p_user, 0));
  insert into public.ai_utilizzo (user_id, mese) values (p_user, public._mese_roma()) on conflict do nothing;
  select richieste into usate from public.ai_utilizzo where user_id = p_user and mese = public._mese_roma() for update;
  if usate >= lim then return jsonb_build_object('ok', false, 'motivo', 'limite', 'usate', usate, 'limite', lim); end if;
  update public.ai_utilizzo set richieste = richieste + 1 where user_id = p_user and mese = public._mese_roma();
  return jsonb_build_object('ok', true, 'usate', usate + 1, 'limite', lim);
end $$;
revoke execute on function public.ai_riserva(uuid) from public, anon, authenticated;
grant execute on function public.ai_riserva(uuid) to service_role;

-- Restituisce la richiesta se il servizio AI ha fallito (non si paga un errore tecnico)
create function public.ai_restituisci(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  update public.ai_utilizzo set richieste = greatest(0, richieste - 1) where user_id = p_user and mese = public._mese_roma();
$$;
revoke execute on function public.ai_restituisci(uuid) from public, anon, authenticated;
grant execute on function public.ai_restituisci(uuid) to service_role;

create function public.ai_registra_costo(p_user uuid, p_eur numeric) returns void
language sql security definer set search_path = '' as $$
  update public.ai_utilizzo set costo_stimato_eur = costo_stimato_eur + greatest(0, p_eur) where user_id = p_user and mese = public._mese_roma();
$$;
revoke execute on function public.ai_registra_costo(uuid, numeric) from public, anon, authenticated;
grant execute on function public.ai_registra_costo(uuid, numeric) to service_role;

-- Statistiche AI per l'admin (solo numeri aggregati)
create function public.admin_statistiche_ai() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return jsonb_build_object(
    'richieste_mese', coalesce((select sum(richieste) from public.ai_utilizzo where mese = public._mese_roma()), 0),
    'utenti_mese', (select count(*) from public.ai_utilizzo where mese = public._mese_roma() and richieste > 0),
    'costo_mese_eur', coalesce((select sum(costo_stimato_eur) from public.ai_utilizzo where mese = public._mese_roma()), 0)
  );
end $$;
revoke execute on function public.admin_statistiche_ai() from public, anon;
grant execute on function public.admin_statistiche_ai() to authenticated;
