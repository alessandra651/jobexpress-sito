-- Indirizzo preciso degli annunci, per aprire il luogo in Google Maps o Apple Mappe (27 nov 2026).
-- L'indirizzo NON è pubblico: nella bacheca si vede solo la zona.
-- Lo vedono solo chi ha pubblicato e le persone con l'incarico confermato.
create table public.annunci_indirizzi (
  annuncio_id uuid primary key references public.annunci (id) on delete cascade,
  indirizzo text not null check (char_length(btrim(indirizzo)) between 3 and 160),
  aggiornato_il timestamptz not null default now()
);
alter table public.annunci_indirizzi enable row level security;
revoke all on public.annunci_indirizzi from anon, authenticated;

create function public.imposta_indirizzo(p_annuncio uuid, p_indirizzo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.annunci where id = p_annuncio and autore_id = auth.uid()) then raise exception 'Non è un tuo annuncio'; end if;
  if char_length(btrim(coalesce(p_indirizzo, ''))) < 3 then
    delete from public.annunci_indirizzi where annuncio_id = p_annuncio;
    return;
  end if;
  insert into public.annunci_indirizzi (annuncio_id, indirizzo) values (p_annuncio, left(btrim(p_indirizzo), 160))
  on conflict (annuncio_id) do update set indirizzo = excluded.indirizzo, aggiornato_il = now();
end $$;

-- Indirizzo per le indicazioni stradali: solo per chi ha pubblicato o ha l'incarico confermato
create function public.indirizzo_incarico(p_annuncio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('indirizzo', ai.indirizzo, 'citta', a.citta, 'zona', a.zona)
  from public.annunci a left join public.annunci_indirizzi ai on ai.annuncio_id = a.id
  where a.id = p_annuncio and (a.autore_id = auth.uid() or exists (
    select 1 from public.incarichi i where i.annuncio_id = a.id and i.lavoratore_id = auth.uid() and i.stato in ('programmato', 'completato', 'contestato')));
$$;

revoke execute on function public.imposta_indirizzo(uuid, text) from public, anon;
revoke execute on function public.indirizzo_incarico(uuid) from public, anon;
grant execute on function public.imposta_indirizzo(uuid, text) to authenticated;
grant execute on function public.indirizzo_incarico(uuid) to authenticated;
