-- =====================================================================
-- JobExpress · Fase 4 «Business» (28/11/2026)
-- Panoramica, calendario giorno/settimana/mese, modelli di annuncio, duplicazione,
-- annunci ricorrenti (generati come «da confermare», mai pubblicati da soli), archivio collaborazioni.
-- Architettura per sedi / referenti / ruoli pronta ma SPENTA (business_pro_enabled = false).
-- Nessun prezzo Business Pro, nessun badge aziendale.
-- =====================================================================

insert into public.impostazioni (chiave, valore, descrizione) values
  ('business_dashboard_enabled', 'true', 'Panoramica e calendario per chi pubblica'),
  ('business_templates_enabled', 'true', 'Modelli di annuncio e duplicazione'),
  ('business_recurring_enabled', 'true', 'Annunci ricorrenti (da confermare prima della pubblicazione)'),
  ('business_pro_enabled', 'false', 'Business Pro: più sedi, referenti e ruoli (NON attivo, prezzo da definire)'),
  ('limite_modelli', '30', 'Numero massimo di modelli per utente'),
  ('limite_ricorrenze', '10', 'Numero massimo di ricorrenze attive per utente')
on conflict (chiave) do nothing;

-- ---------- Modelli di annuncio ----------
create table if not exists public.modelli_annuncio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  dati jsonb not null check (jsonb_typeof(dati) = 'object' and pg_column_size(dati) <= 12000),
  usi int not null default 0,
  usato_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index if not exists modelli_annuncio_utente on public.modelli_annuncio (user_id);
alter table public.modelli_annuncio enable row level security;
revoke all on public.modelli_annuncio from anon, authenticated;
grant select on public.modelli_annuncio to authenticated;
create policy modelli_propri on public.modelli_annuncio for select to authenticated using (user_id = auth.uid());

-- campi ammessi nel modello: solo quelli dell'annuncio (mai dati di persone, mai date)
create or replace function public._pulisci_modello(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(coalesce(p, '{}')) e(k, v)
  where k in ('cat', 'titolo', 'descrizione', 'mansioni', 'requisiti', 'esperienza', 'inizio', 'fine', 'citta', 'zona', 'luogo',
              'euroOra', 'natura', 'pagamento', 'rimborsi', 'forma', 'posti', 'qualifiche', 'sicurezza', 'tipo', 'chi');
$$;
revoke execute on function public._pulisci_modello(jsonb) from public, anon, authenticated;

create or replace function public.salva_modello(p_id uuid, p_nome text, p_dati jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); nuovo uuid;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if not (public._imp('business_templates_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  if char_length(btrim(coalesce(p_nome, ''))) < 2 then return jsonb_build_object('ok', false, 'motivo', 'nome_breve'); end if;
  if p_id is not null then
    update public.modelli_annuncio set nome = left(btrim(p_nome), 80), dati = public._pulisci_modello(p_dati), aggiornato_il = now()
    where id = p_id and user_id = u returning id into nuovo;
    return jsonb_build_object('ok', nuovo is not null, 'id', nuovo);
  end if;
  if (select count(*) from public.modelli_annuncio where user_id = u) >= (public._imp('limite_modelli'))::int then
    return jsonb_build_object('ok', false, 'motivo', 'troppi_modelli');
  end if;
  insert into public.modelli_annuncio (user_id, nome, dati) values (u, left(btrim(p_nome), 80), public._pulisci_modello(p_dati)) returning id into nuovo;
  return jsonb_build_object('ok', true, 'id', nuovo);
end $$;
revoke execute on function public.salva_modello(uuid, text, jsonb) from public, anon;
grant execute on function public.salva_modello(uuid, text, jsonb) to authenticated;

create or replace function public.elimina_modello(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.modelli_annuncio where id = p_id and user_id = auth.uid();
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.elimina_modello(uuid) from public, anon;
grant execute on function public.elimina_modello(uuid) to authenticated;

create or replace function public.usa_modello(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  update public.modelli_annuncio set usi = usi + 1, usato_il = now() where id = p_id and user_id = auth.uid() returning dati into d;
  return d;
end $$;
revoke execute on function public.usa_modello(uuid) from public, anon;
grant execute on function public.usa_modello(uuid) to authenticated;

-- ---------- Annunci ricorrenti (mai pubblicati da soli: generano «da confermare») ----------
create table if not exists public.ricorrenze (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  modello_id uuid not null references public.modelli_annuncio (id) on delete cascade,
  giorni int[] not null check (cardinality(giorni) between 1 and 7 and giorni <@ array[1, 2, 3, 4, 5, 6, 7]),  -- 1 = lunedì … 7 = domenica
  dal date not null,
  al date,
  anticipo_giorni int not null default 7 check (anticipo_giorni between 1 and 28),
  attiva boolean not null default true,
  creato_il timestamptz not null default now(),
  check (al is null or al >= dal)
);
alter table public.ricorrenze enable row level security;
revoke all on public.ricorrenze from anon, authenticated;
grant select on public.ricorrenze to authenticated;
create policy ricorrenze_proprie on public.ricorrenze for select to authenticated using (user_id = auth.uid());

create table if not exists public.occorrenze_ricorrenti (
  id uuid primary key default gen_random_uuid(),
  ricorrenza_id uuid not null references public.ricorrenze (id) on delete cascade,
  data date not null,
  stato text not null default 'da_confermare' check (stato in ('da_confermare', 'pubblicata', 'saltata', 'scaduta')),
  annuncio_id uuid references public.annunci (id) on delete set null,
  creato_il timestamptz not null default now(),
  unique (ricorrenza_id, data)
);
alter table public.occorrenze_ricorrenti enable row level security;
revoke all on public.occorrenze_ricorrenti from anon, authenticated;

create or replace function public.salva_ricorrenza(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); nuovo uuid; g int[];
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if not (public._imp('business_recurring_enabled'))::boolean then return jsonb_build_object('ok', false, 'motivo', 'non_attivo'); end if;
  if not exists (select 1 from public.modelli_annuncio where id = (p ->> 'modello_id')::uuid and user_id = u) then return jsonb_build_object('ok', false, 'motivo', 'modello_non_valido'); end if;
  g := array(select distinct x::int from jsonb_array_elements_text(coalesce(p -> 'giorni', '[]')) x order by 1);
  if cardinality(g) = 0 then return jsonb_build_object('ok', false, 'motivo', 'servono_giorni'); end if;
  if (select count(*) from public.ricorrenze where user_id = u and attiva) >= (public._imp('limite_ricorrenze'))::int then return jsonb_build_object('ok', false, 'motivo', 'troppe_ricorrenze'); end if;
  insert into public.ricorrenze (user_id, modello_id, giorni, dal, al, anticipo_giorni)
  values (u, (p ->> 'modello_id')::uuid, g, greatest(coalesce((p ->> 'dal')::date, current_date), current_date), nullif(p ->> 'al', '')::date, coalesce((p ->> 'anticipo_giorni')::int, 7))
  returning id into nuovo;
  perform public._genera_occorrenze(nuovo);
  return jsonb_build_object('ok', true, 'id', nuovo);
end $$;
revoke execute on function public.salva_ricorrenza(jsonb) from public, anon;
grant execute on function public.salva_ricorrenza(jsonb) to authenticated;

create or replace function public.ferma_ricorrenza(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.ricorrenze set attiva = false where id = p_id and user_id = auth.uid();
  if found then update public.occorrenze_ricorrenti set stato = 'saltata' where ricorrenza_id = p_id and stato = 'da_confermare'; end if;
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.ferma_ricorrenza(uuid) from public, anon;
grant execute on function public.ferma_ricorrenza(uuid) to authenticated;

-- crea le date «da confermare» nella finestra di anticipo (idempotente grazie a unique)
create or replace function public._genera_occorrenze(p_ric uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into r from public.ricorrenze where id = p_ric and attiva;
  if r.id is null then return 0; end if;
  insert into public.occorrenze_ricorrenti (ricorrenza_id, data)
  select r.id, d::date from generate_series(greatest(r.dal, oggi + 1), least(coalesce(r.al, oggi + r.anticipo_giorni), oggi + r.anticipo_giorni), interval '1 day') d
  where extract(isodow from d)::int = any (r.giorni)
  on conflict do nothing;
  get diagnostics n = row_count;
  if r.al is not null and r.al < oggi then update public.ricorrenze set attiva = false where id = r.id; end if;
  return n;
end $$;
revoke execute on function public._genera_occorrenze(uuid) from public, anon, authenticated;

create or replace function public.processi_ricorrenze() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x record; n int; tot int := 0; oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if not (public._imp('business_recurring_enabled'))::boolean then return '{}'; end if;
  update public.occorrenze_ricorrenti set stato = 'scaduta' where stato = 'da_confermare' and data < oggi;
  for x in select id, user_id from public.ricorrenze where attiva loop
    n := public._genera_occorrenze(x.id);
    if n > 0 then
      perform public._notifica(x.user_id, 'ricorrenza', 'Ci sono nuove date del tuo annuncio ricorrente da confermare. Nulla viene pubblicato senza la tua conferma.',
        jsonb_build_object('ricorrenza_id', x.id), 'ricorrenza-' || x.id || '-' || oggi);
    end if;
    tot := tot + n;
  end loop;
  return jsonb_build_object('occorrenze_create', tot);
end $$;
revoke execute on function public.processi_ricorrenze() from public, anon, authenticated;

create or replace function public.mie_ricorrenze() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ricorrenze', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'modello_id', r.modello_id, 'modello', m.nome, 'giorni', r.giorni, 'dal', r.dal, 'al', r.al,
        'anticipo_giorni', r.anticipo_giorni, 'attiva', r.attiva) order by r.attiva desc, r.creato_il desc)
      from public.ricorrenze r join public.modelli_annuncio m on m.id = r.modello_id where r.user_id = auth.uid()), '[]'),
    'da_confermare', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'data', o.data, 'ricorrenza_id', r.id, 'modello_id', m.id, 'modello', m.nome, 'dati', m.dati) order by o.data)
      from public.occorrenze_ricorrenti o join public.ricorrenze r on r.id = o.ricorrenza_id join public.modelli_annuncio m on m.id = r.modello_id
      where r.user_id = auth.uid() and o.stato = 'da_confermare'), '[]'));
$$;
revoke execute on function public.mie_ricorrenze() from public, anon;
grant execute on function public.mie_ricorrenze() to authenticated;

-- dopo che il sito ha pubblicato l'annuncio (con le stesse regole di sempre), segna la data come fatta
create or replace function public.segna_occorrenza(p_id uuid, p_esito text, p_annuncio uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_esito not in ('pubblicata', 'saltata') then raise exception 'Esito non valido'; end if;
  if p_esito = 'pubblicata' and not exists (select 1 from public.annunci where id = p_annuncio and autore_id = auth.uid()) then raise exception 'Annuncio non valido'; end if;
  update public.occorrenze_ricorrenti o set stato = p_esito, annuncio_id = case when p_esito = 'pubblicata' then p_annuncio end
  from public.ricorrenze r where o.id = p_id and r.id = o.ricorrenza_id and r.user_id = auth.uid() and o.stato = 'da_confermare';
  return jsonb_build_object('ok', found);
end $$;
revoke execute on function public.segna_occorrenza(uuid, text, uuid) from public, anon;
grant execute on function public.segna_occorrenza(uuid, text, uuid) to authenticated;

-- ---------- Duplicazione: dati completi di un MIO annuncio, per ricompilarlo ----------
create or replace function public.annuncio_da_duplicare(p_annuncio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('titolo', a.titolo, 'categoria', a.categoria, 'descrizione', a.descrizione, 'condizioni', a.condizioni, 'nome_pubblico', a.nome_pubblico,
    'tipo', a.tipo, 'citta', a.citta, 'zona', a.zona, 'compenso_ora', a.compenso_ora, 'compenso_tipo', a.compenso_tipo, 'posti', a.posti, 'mansione', a.mansione,
    'requisiti', a.requisiti, 'qualifiche_obbligatorie', a.qualifiche_obbligatorie, 'tipo_rapporto', a.tipo_rapporto, 'info_sicurezza', a.info_sicurezza,
    'turno', (select jsonb_build_object('inizio', t.inizio, 'fine', t.fine) from public.turni t where t.annuncio_id = a.id order by t.inizio limit 1))
  from public.annunci a where a.id = p_annuncio and a.autore_id = auth.uid();
$$;
revoke execute on function public.annuncio_da_duplicare(uuid) from public, anon;
grant execute on function public.annuncio_da_duplicare(uuid) to authenticated;

-- ---------- Panoramica ----------
create or replace function public.panoramica_business(p_dal date, p_al date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); da timestamptz; a_ timestamptz;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if p_al < p_dal or p_al - p_dal > 400 then raise exception 'Periodo non valido'; end if;
  da := (p_dal::timestamp at time zone 'Europe/Rome'); a_ := ((p_al + 1)::timestamp at time zone 'Europe/Rome');
  return (
    with ann as (select a.* from public.annunci a where a.autore_id = u and exists (select 1 from public.turni t where t.annuncio_id = a.id and t.inizio < a_ and t.fine > da)),
    inc as (select i.*, (select sum(extract(epoch from t.fine - t.inizio)) / 3600 from public.turni t where t.annuncio_id = i.annuncio_id) ore,
                   (select compenso_ora from public.annunci where id = i.annuncio_id) comp
            from public.incarichi i where i.annuncio_id in (select id from ann))
    select jsonb_build_object(
      'periodo', jsonb_build_object('dal', p_dal, 'al', p_al),
      'annunci', (select count(*) from ann),
      'annunci_aperti', (select count(*) from ann where stato = 'pubblicato'),
      'posti_richiesti', (select coalesce(sum(posti), 0) from ann where stato <> 'annullato'),
      'posti_coperti', (select count(*) from inc where stato in ('programmato', 'completato', 'contestato')),
      'completati', (select count(*) from inc where stato = 'completato'),
      'annullati_da_te', (select count(*) from inc where stato = 'annullato' and annullato_da = u),
      'annullati_da_persone', (select count(*) from inc where stato = 'annullato' and annullato_da is distinct from u),
      'ore', (select round(coalesce(sum(ore), 0), 1) from inc where stato in ('programmato', 'completato', 'contestato')),
      'compensi_stimati', (select round(coalesce(sum(ore * comp + coalesce(bonus_urgenza, 0)), 0), 2) from inc where stato in ('programmato', 'completato', 'contestato')),
      'rescue_attive', (select count(*) from public.rescue_richieste r where r.annuncio_id in (select id from ann) and r.stato = 'attiva'),
      'da_fare', jsonb_build_object(
        'candidature_da_valutare', (select count(*) from public.candidature c join public.annunci a on a.id = c.annuncio_id where a.autore_id = u and a.stato = 'pubblicato' and c.stato in ('inviata', 'in_valutazione')),
        'proposte_in_attesa', (select count(*) from public.proposte p join public.candidature c on c.id = p.candidatura_id join public.annunci a on a.id = c.annuncio_id where a.autore_id = u and p.stato = 'attesa' and p.scade_il > now()),
        'adempimenti_da_dichiarare', (select count(*) from public.incarichi i where i.committente_id = u and i.stato = 'programmato' and i.adempimenti_dichiarati_il is null
                                        and exists (select 1 from public.turni t where t.annuncio_id = i.annuncio_id and t.inizio > now())),
        'da_segnare_completati', (select count(*) from public.incarichi i where i.committente_id = u and i.stato = 'programmato'
                                    and not exists (select 1 from public.turni t where t.annuncio_id = i.annuncio_id and t.fine > now())),
        'recensioni_da_scrivere', (select count(*) from public.periodi_recensione pr join public.incarichi i on i.id = pr.incarico_id
                                     where i.committente_id = u and pr.stato = 'aperto' and not exists (select 1 from public.recensioni r where r.incarico_id = i.id and r.autore_id = u and r.stato <> 'bozza')),
        'date_ricorrenti_da_confermare', (select count(*) from public.occorrenze_ricorrenti o join public.ricorrenze r on r.id = o.ricorrenza_id where r.user_id = u and o.stato = 'da_confermare'))
    ));
end $$;
revoke execute on function public.panoramica_business(date, date) from public, anon;
grant execute on function public.panoramica_business(date, date) to authenticated;

-- ---------- Calendario (giorno / settimana / mese) ----------
create or replace function public.calendario_business(p_dal date, p_al date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); da timestamptz; a_ timestamptz;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if p_al < p_dal or p_al - p_dal > 62 then raise exception 'Periodo non valido'; end if;
  da := (p_dal::timestamp at time zone 'Europe/Rome'); a_ := ((p_al + 1)::timestamp at time zone 'Europe/Rome');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'annuncio_id', a.id, 'titolo', a.titolo, 'mansione', a.mansione, 'stato', a.stato, 'zona', a.zona, 'citta', a.citta,
      'inizio', t.inizio, 'fine', t.fine, 'posti', a.posti, 'posti_stato', public._posti_stato(a.id),
      'rescue', exists (select 1 from public.rescue_richieste r where r.annuncio_id = a.id and r.stato = 'attiva'),
      'persone', (select coalesce(jsonb_agg(jsonb_build_object('nome', coalesce(p.nome, 'Persona'), 'stato', i.stato, 'lavoratore_id', i.lavoratore_id) order by p.nome), '[]')
                  from public.incarichi i left join public.profili p on p.id = i.lavoratore_id where i.annuncio_id = a.id and i.stato in ('programmato', 'completato', 'contestato'))
    ) order by t.inizio)
    from public.turni t join public.annunci a on a.id = t.annuncio_id
    where a.autore_id = u and t.inizio < a_ and t.fine > da), '[]');
end $$;
revoke execute on function public.calendario_business(date, date) from public, anon;
grant execute on function public.calendario_business(date, date) to authenticated;

-- ---------- Archivio collaborazioni (solo fatti: incarichi svolti insieme. Niente note private sulle persone) ----------
create or replace function public.archivio_collaborazioni() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(z order by z ->> 'ultima' desc), '[]') from (
    select jsonb_build_object('lavoratore_id', i.lavoratore_id, 'nome', coalesce(max(p.nome), 'Persona'), 'citta', max(p.citta),
      'completati', count(*) filter (where i.stato = 'completato'),
      'programmati', count(*) filter (where i.stato = 'programmato'),
      'ultima', max(i.completato_il),
      'mansioni', (select jsonb_agg(distinct coalesce(a2.mansione, a2.titolo)) from public.incarichi i2 join public.annunci a2 on a2.id = i2.annuncio_id
                   where i2.committente_id = auth.uid() and i2.lavoratore_id = i.lavoratore_id and i2.stato in ('completato', 'programmato')),
      'bloccata', exists (select 1 from public.blocchi b where b.utente_id = auth.uid() and b.bloccato_id = i.lavoratore_id)) z
    from public.incarichi i left join public.profili p on p.id = i.lavoratore_id
    where i.committente_id = auth.uid() and i.stato in ('completato', 'programmato')
    group by i.lavoratore_id
    having count(*) filter (where i.stato = 'completato') > 0) q;
$$;
revoke execute on function public.archivio_collaborazioni() from public, anon;
grant execute on function public.archivio_collaborazioni() to authenticated;

-- ---------- Architettura Business Pro (SPENTA): sedi, collegamento annuncio → azienda/sede ----------
create table if not exists public.sedi_azienda (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  citta text not null check (char_length(citta) between 2 and 80),
  zona text check (zona is null or char_length(zona) <= 80),
  attiva boolean not null default true,
  creato_il timestamptz not null default now()
);
alter table public.sedi_azienda enable row level security;
revoke all on public.sedi_azienda from anon, authenticated;
alter table public.annunci add column if not exists azienda_id uuid references public.aziende (id) on delete set null,
                           add column if not exists sede_id uuid references public.sedi_azienda (id) on delete set null;
-- permessi per ruolo (usati quando Business Pro sarà attivo): titolare tutto; referente pubblica e gestisce; collaboratore solo calendario
insert into public.impostazioni (chiave, valore, descrizione) values
  ('business_ruoli_permessi', '{"titolare":["pubblica","gestisci","calendario","sedi","referenti"],"referente":["pubblica","gestisci","calendario"],"collaboratore":["calendario"]}', 'Permessi per ruolo (Business Pro, non attivo)')
on conflict (chiave) do nothing;

create or replace function public.mie_sedi() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public._imp('business_pro_enabled'))::boolean then return jsonb_build_object('attivo', false); end if;
  return jsonb_build_object('attivo', true, 'sedi', coalesce((select jsonb_agg(to_jsonb(s) order by s.nome) from public.sedi_azienda s
    where s.azienda_id in (select azienda_id from public.referenti_aziendali where user_id = auth.uid() and stato = 'verificato')), '[]'));
end $$;
revoke execute on function public.mie_sedi() from public, anon;
grant execute on function public.mie_sedi() to authenticated;

-- ---------- processi programmati: aggiunge le ricorrenze ----------
create or replace function public.processi_operativi() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n1 int := 0; n2 int := 0; n3 int := 0; x record; esito_tot jsonb := '{}'; rr jsonb; ric jsonb;
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
  begin
    rr := public.processi_recensioni();
    esito_tot := esito_tot || rr;
  exception when others then
    insert into public.registro_processi (nome, esito, dettagli) values ('recensioni', 'errore', jsonb_build_object('errore', sqlerrm));
  end;
  begin
    ric := public.processi_ricorrenze();
    esito_tot := esito_tot || ric;
  exception when others then
    insert into public.registro_processi (nome, esito, dettagli) values ('ricorrenze', 'errore', jsonb_build_object('errore', sqlerrm));
  end;
  if n1 + n2 + n3 + coalesce((rr ->> 'periodi_chiusi')::int, 0) + coalesce((rr ->> 'promemoria')::int, 0) + coalesce((ric ->> 'occorrenze_create')::int, 0) > 0 then
    insert into public.registro_processi (nome, esito, dettagli) values ('processi_operativi', 'ok', esito_tot);
  end if;
  return esito_tot;
end $$;
revoke execute on function public.processi_operativi() from public, anon, authenticated;

-- ---------- ritocco Fase 3: il mancato pagamento ha priorità alta ----------
create or replace function public._priorita_segnalazione(t text, pericolo boolean) returns text
language sql immutable set search_path = '' as $$
  select case when pericolo or t in ('molestie', 'aggressivita', 'condizioni_pericolose', 'sicurezza') then 'urgente'
              when t in ('furto_identita', 'discriminazione', 'lavoro_irregolare', 'annuncio_fraudolento', 'profilo_falso', 'mancato_pagamento') then 'alta'
              else 'normale' end;
$$;
revoke execute on function public._priorita_segnalazione(text, boolean) from public, anon, authenticated;
create or replace function public.segnala(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t text := p ->> 'tipo'; nuovo bigint; seg uuid; ann uuid; inc uuid; rec uuid; prio text; all_ text[];
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if (select count(*) from public.segnalazioni_utenti where autore_id = u and creato_il > now() - interval '1 day') >= (public._imp('limite_segnalazioni_giorno'))::int then
    raise exception 'TRUST:troppe_richieste';
  end if;
  seg := nullif(p ->> 'segnalato_id', '')::uuid; ann := nullif(p ->> 'annuncio_id', '')::uuid; inc := nullif(p ->> 'incarico_id', '')::uuid; rec := nullif(p ->> 'recensione_id', '')::uuid;
  if seg = u then raise exception 'Operazione non valida'; end if;
  if inc is not null and not exists (select 1 from public.incarichi i where i.id = inc and u in (i.lavoratore_id, i.committente_id)) then raise exception 'Incarico non valido'; end if;
  if inc is not null and seg is null then select case when i.lavoratore_id = u then i.committente_id else i.lavoratore_id end into seg from public.incarichi i where i.id = inc; end if;
  if rec is not null then select autore_id into seg from public.recensioni where id = rec and stato = 'pubblicata'; if seg is null then raise exception 'Recensione non valida'; end if; end if;
  if ann is not null and seg is null then select autore_id into seg from public.annunci where id = ann; end if;
  all_ := coalesce(array(select x from jsonb_array_elements_text(coalesce(p -> 'allegati', '[]')) x where split_part(x, '/', 1) = u::text limit 5), '{}');
  prio := public._priorita_segnalazione(t, coalesce((p ->> 'pericolo_immediato')::boolean, false));
  insert into public.segnalazioni_utenti (autore_id, segnalato_id, annuncio_id, incarico_id, recensione_id, tipo, motivo, priorita, pericolo_immediato, allegati)
  values (u, seg, ann, inc, rec, t, left(btrim(coalesce(p ->> 'motivo', '')), 1000), prio, coalesce((p ->> 'pericolo_immediato')::boolean, false), all_)
  returning id into nuovo;
  if t = 'foto' and seg is not null then
    update public.profili_professionali set foto_stato = 'in_revisione' where user_id = seg and foto_stato in ('caricata', 'verificata');
  end if;
  perform public._registra('segnalazione', 'segnalazione', nuovo::text, jsonb_build_object('tipo', t, 'priorita', prio));
  return jsonb_build_object('ok', true, 'id', nuovo, 'priorita', prio);
end $$;
revoke execute on function public.segnala(jsonb) from public, anon;
grant execute on function public.segnala(jsonb) to authenticated;
