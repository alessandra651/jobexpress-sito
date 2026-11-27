-- JobExpress CV — curriculum personale e link condivisibili (27 nov 2026)
--   * curricula: il curriculum di ogni persona. Lo vede e lo modifica solo lei.
--   * cv_condivisi: copia "fotografata" di ciò che la persona ha scelto di mostrare,
--     raggiungibile con un link segreto. Si può revocare in ogni momento.
--     Contiene solo le sezioni scelte: niente dati economici o chat private.

create table public.curricula (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dati jsonb not null default '{}'::jsonb check (pg_column_size(dati) < 400000),
  aggiornato_il timestamptz not null default now()
);
comment on table public.curricula is 'Curriculum personale. Visibile e modificabile solo dal proprietario.';
alter table public.curricula enable row level security;
revoke all on public.curricula from anon, authenticated;
grant select, insert, update, delete on public.curricula to authenticated;
create policy "leggo il mio cv" on public.curricula for select to authenticated using ((select auth.uid()) = user_id);
create policy "creo il mio cv" on public.curricula for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "modifico il mio cv" on public.curricula for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "elimino il mio cv" on public.curricula for delete to authenticated using ((select auth.uid()) = user_id);

create table public.cv_condivisi (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contenuto jsonb not null check (pg_column_size(contenuto) < 400000),
  revocato boolean not null default false,
  creato_il timestamptz not null default now(),
  revocato_il timestamptz
);
alter table public.cv_condivisi enable row level security;
revoke all on public.cv_condivisi from anon, authenticated;
grant select (token, revocato, creato_il, revocato_il) on public.cv_condivisi to authenticated;
create policy "vedo i miei link" on public.cv_condivisi for select to authenticated using ((select auth.uid()) = user_id);

-- Crea un link (serve Plus). Un solo link attivo per persona: il precedente viene revocato.
create function public.cv_pubblica(p_contenuto jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  t uuid;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if public.piano_di(u) = 'free' then raise exception 'Serve Plus'; end if;
  if jsonb_typeof(p_contenuto) <> 'object' then raise exception 'Contenuto non valido'; end if;
  update public.cv_condivisi set revocato = true, revocato_il = now() where user_id = u and not revocato;
  insert into public.cv_condivisi (user_id, contenuto) values (u, p_contenuto) returning token into t;
  perform public._registra('cv_link_creato', 'cv', t::text);
  return t;
end $$;
revoke execute on function public.cv_pubblica(jsonb) from public, anon;
grant execute on function public.cv_pubblica(jsonb) to authenticated;

create function public.cv_revoca() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.cv_condivisi set revocato = true, revocato_il = now() where user_id = auth.uid() and not revocato;
  perform public._registra('cv_link_revocato', 'cv', auth.uid()::text);
end $$;
revoke execute on function public.cv_revoca() from public, anon;
grant execute on function public.cv_revoca() to authenticated;

-- Lettura pubblica con il link: solo se non revocato
create function public.cv_leggi(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select contenuto from public.cv_condivisi where token = p_token and not revocato;
$$;
revoke execute on function public.cv_leggi(uuid) from public;
grant execute on function public.cv_leggi(uuid) to anon, authenticated;
