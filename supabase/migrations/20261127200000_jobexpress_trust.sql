-- JobExpress Trust — identità, sicurezza e nuovo profilo professionale (27 nov 2026)
-- «L'identità si verifica. Le competenze si dimostrano. La reputazione si conquista.»
--
-- Principi:
--   * Gratuito per tutti: nessuna verifica o riconoscimento dipende dall'abbonamento.
--   * Dati separati: profilo professionale (visibile ai registrati, solo ciò che la persona sceglie),
--     dati riservati (solo il titolare), verifiche (scritte solo dal server), file in Storage privato.
--   * Nessuno può attribuirsi da solo lo stato «verificato»: le verifiche le scrive solo il server.
--   * I controlli prima di candidarsi / pubblicare / selezionare / confermare sono TRIGGER nel database:
--     valgono qualunque strada si usi, non solo l'interfaccia.
--   * SPID, CIE, provider esterni, OTP telefono, CAPTCHA, biometria: predisposti e SPENTI.
--   * Non si conservano documenti d'identità, selfie, credenziali dei provider o dati biometrici.

-- =====================================================================
-- 1. IMPOSTAZIONI (modificabili dall'area Admin, mai retroattive)
-- =====================================================================
insert into public.impostazioni (chiave, valore, descrizione) values
  ('identity_verification_required', 'true', 'Identità verificata obbligatoria prima di candidarsi, pubblicare, selezionare o confermare.'),
  ('identity_verification_stage', '"before_operational_access"', 'Quando si chiede la verifica: prima dell''accesso operativo (non alla registrazione).'),
  ('minimum_user_age', '18', 'Età minima per usare JobExpress.'),
  ('minor_accounts_enabled', 'false', 'Account per minorenni: SPENTO finché non esiste un sistema di tutela specifico.'),
  ('profile_photo_required', 'true', 'Foto del volto obbligatoria prima di candidarsi o pubblicare come privato (le aziende possono usare il logo).'),
  ('profile_photo_visibility', '"authenticated_users"', 'Chi vede la foto: authenticated_users (utenti registrati) oppure after_selection (solo dopo la selezione).'),
  ('cv_upload_enabled', 'true', 'Caricamento gratuito del curriculum in PDF.'),
  ('cv_required', 'false', 'Curriculum obbligatorio per candidarsi: NO.'),
  ('cv_max_mb', '5', 'Dimensione massima del curriculum (MB).'),
  ('email_verification_required', 'true', 'Email confermata prima dell''accesso operativo.'),
  ('phone_verification_enabled', 'false', 'Verifica del telefono con codice OTP: serve un servizio SMS, non ancora collegato.'),
  ('captcha_enabled', 'false', 'CAPTCHA accessibile alla registrazione: serve la chiave del servizio, non ancora collegata.'),
  ('spid_enabled', 'false', 'SPID: si accende solo dopo integrazione e autorizzazione.'),
  ('cie_enabled', 'false', 'CIE: si accende solo dopo integrazione e autorizzazione.'),
  ('eidas_enabled', 'false', 'Identità digitali europee (eIDAS): non ancora integrate.'),
  ('id_provider_enabled', 'false', 'Provider esterno di verifica (es. per documenti stranieri): non ancora scelto.'),
  ('alternative_verification_enabled', 'false', 'Verifica alternativa non biometrica con revisione umana: procedura da definire con il legale.'),
  ('biometric_verification_enabled', 'false', 'Verifiche biometriche: NON attive. Solo predisposizione per il futuro.'),
  ('company_verification_required', 'true', 'Le aziende pubblicano solo dopo la verifica dell''attività e del referente.'),
  ('professional_passport_enabled', 'false', 'Passaporto professionale: architettura predisposta, funzione spenta.'),
  ('verifiche_simulate_consentite', 'true', 'Solo in fase di test: l''admin può segnare una verifica come SIMULATA (sempre etichettata). Da spegnere prima del lancio.'),
  ('limite_candidature_ora', '20', 'Anti-abuso: candidature massime per persona in un''ora.'),
  ('limite_annunci_giorno', '10', 'Anti-abuso: annunci massimi per persona in un giorno.'),
  ('limite_segnalazioni_giorno', '10', 'Anti-abuso: segnalazioni massime per persona in un giorno.')
on conflict (chiave) do nothing;

-- =====================================================================
-- 2. PROFILO PROFESSIONALE (visibile ai registrati, solo i campi scelti) e DATI RISERVATI
-- =====================================================================
create table public.profili_professionali (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tipo text not null default 'lavoratore' check (tipo in ('lavoratore', 'privato', 'azienda')),
  cognome text check (cognome is null or char_length(btrim(cognome)) between 1 and 80),
  presentazione text check (presentazione is null or char_length(presentazione) <= 600),
  settori text[] not null default '{}' check (cardinality(settori) <= 15),
  mansioni text[] not null default '{}' check (cardinality(mansioni) <= 30),
  competenze_tecniche text[] not null default '{}' check (cardinality(competenze_tecniche) <= 30),
  competenze_trasversali text[] not null default '{}' check (cardinality(competenze_trasversali) <= 30),
  lingue jsonb not null default '[]' check (jsonb_typeof(lingue) = 'array'),
  formazione jsonb not null default '[]' check (jsonb_typeof(formazione) = 'array'),
  certificazioni jsonb not null default '[]' check (jsonb_typeof(certificazioni) = 'array'),
  esperienze_esterne jsonb not null default '[]' check (jsonb_typeof(esperienze_esterne) = 'array'),
  disponibilita jsonb not null default '{}' check (jsonb_typeof(disponibilita) = 'object'),
  visibilita jsonb not null default '{"foto": true, "presentazione": true, "competenze": true, "esperienze": true, "formazione": true}' check (jsonb_typeof(visibilita) = 'object'),
  foto_path text,
  foto_stato text not null default 'assente' check (foto_stato in ('assente', 'caricata', 'in_revisione', 'verificata', 'da_sostituire')),
  foto_caricata_il timestamptz,
  cv_path text,
  cv_nome text check (cv_nome is null or char_length(cv_nome) <= 120),
  cv_aggiornato_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  check (pg_column_size(esperienze_esterne) + pg_column_size(formazione) + pg_column_size(certificazioni) < 200000)
);
comment on table public.profili_professionali is 'Profilo professionale. Il titolare lo modifica; gli altri registrati vedono solo i campi scelti, tramite profilo_pubblico().';
alter table public.profili_professionali enable row level security;
revoke all on public.profili_professionali from anon, authenticated;
grant select, insert on public.profili_professionali to authenticated;
grant update (tipo, cognome, presentazione, settori, mansioni, competenze_tecniche, competenze_trasversali, lingue, formazione, certificazioni,
  esperienze_esterne, disponibilita, visibilita, foto_path, cv_path, cv_nome) on public.profili_professionali to authenticated;
create policy "leggo il mio profilo professionale" on public.profili_professionali for select to authenticated using ((select auth.uid()) = user_id);
create policy "creo il mio profilo professionale" on public.profili_professionali for insert to authenticated with check ((select auth.uid()) = user_id and foto_stato = 'assente');
create policy "modifico il mio profilo professionale" on public.profili_professionali for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.dati_riservati (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data_nascita date,
  telefono text check (telefono is null or telefono ~ '^\+?[0-9 ]{6,20}$'),
  telefono_verificato_il timestamptz,
  aggiornato_il timestamptz not null default now()
);
comment on table public.dati_riservati is 'Dati riservati: solo il titolare. Mai visibili ad altri utenti.';
alter table public.dati_riservati enable row level security;
revoke all on public.dati_riservati from anon, authenticated;
grant select, insert on public.dati_riservati to authenticated;
grant update (data_nascita, telefono) on public.dati_riservati to authenticated;
create policy "leggo i miei dati riservati" on public.dati_riservati for select to authenticated using ((select auth.uid()) = user_id);
create policy "creo i miei dati riservati" on public.dati_riservati for insert to authenticated with check ((select auth.uid()) = user_id and telefono_verificato_il is null);
create policy "modifico i miei dati riservati" on public.dati_riservati for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- =====================================================================
-- 3. VERIFICHE (scritte SOLO dal server)
-- =====================================================================
create table public.verifiche (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('email', 'telefono', 'identita', 'foto', 'azienda', 'qualifica', 'eta')),
  stato text not null default 'non_iniziata' check (stato in ('non_iniziata', 'in_corso', 'in_attesa', 'verificata', 'non_riuscita', 'revisione_manuale', 'da_aggiornare', 'revocata')),
  metodo text check (metodo in ('spid', 'cie', 'eidas', 'provider', 'alternativo', 'revisione_manuale', 'simulata', 'email_link', 'sms_otp')),
  provider text,
  rif_hash text,             -- impronta dell'identificativo tecnico del provider (mai il codice fiscale in chiaro)
  maggiorenne boolean,       -- solo l'esito, non la data di nascita del documento
  simulata boolean not null default false,
  motivo text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  verificata_il timestamptz,
  scadenza timestamptz,
  unique (user_id, tipo)
);
comment on table public.verifiche is 'Stato delle verifiche. Nessuna scrittura dal sito: solo funzioni del server.';
alter table public.verifiche enable row level security;
revoke all on public.verifiche from anon, authenticated;
grant select (id, user_id, tipo, stato, metodo, provider, simulata, motivo, verificata_il, scadenza, aggiornato_il) on public.verifiche to authenticated;
create policy "vedo le mie verifiche" on public.verifiche for select to authenticated using ((select auth.uid()) = user_id);
-- la stessa identità non può essere verificata su due account
create unique index verifiche_identita_unica on public.verifiche (tipo, provider, rif_hash) where stato = 'verificata' and rif_hash is not null;

create table public.sospensioni (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (char_length(motivo) between 5 and 500),
  stato text not null default 'attiva' check (stato in ('attiva', 'revocata', 'contestata')),
  creato_da uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  chiusa_il timestamptz
);
alter table public.sospensioni enable row level security;
revoke all on public.sospensioni from anon, authenticated;

-- Le informazioni anagrafiche verificate non si cambiano liberamente
create function public._blocca_cognome_verificato() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cognome is distinct from old.cognome
     and exists (select 1 from public.verifiche where user_id = new.user_id and tipo = 'identita' and stato = 'verificata') then
    raise exception 'IDENTITA_BLOCCATA: il cognome verificato si cambia con la procedura di aggiornamento dell''identità';
  end if;
  return new;
end $$;
create function public._blocca_nascita_verificata() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.data_nascita is distinct from old.data_nascita
     and exists (select 1 from public.verifiche where user_id = new.user_id and tipo = 'identita' and stato = 'verificata') then
    raise exception 'IDENTITA_BLOCCATA: la data di nascita verificata si cambia con la procedura di aggiornamento dell''identità';
  end if;
  return new;
end $$;
create trigger profili_professionali_anagrafica before update on public.profili_professionali for each row execute function public._blocca_cognome_verificato();
create trigger dati_riservati_anagrafica before update on public.dati_riservati for each row execute function public._blocca_nascita_verificata();

-- Foto: chi la cambia torna «caricata» (anche se era verificata). Lo stato della foto
-- non è modificabile dal sito (nessun permesso sulla colonna): lo cambiano solo le funzioni del server.
create function public._stato_foto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.foto_path is not distinct from old.foto_path then
    null; -- stessa foto: lo stato resta quello deciso dal server
  elsif new.foto_path is null then
    new.foto_stato := 'assente'; new.foto_caricata_il := null;
  else
    if new.foto_path !~ ('^' || new.user_id::text || '/') then raise exception 'Percorso della foto non valido'; end if;
    new.foto_stato := 'caricata'; new.foto_caricata_il := now();
    update public.verifiche set stato = 'da_aggiornare', aggiornato_il = now() where user_id = new.user_id and tipo = 'foto' and stato = 'verificata';
  end if;
  if new.cv_path is not null and new.cv_path !~ ('^' || new.user_id::text || '/') then raise exception 'Percorso del curriculum non valido'; end if;
  if tg_op = 'INSERT' or new.cv_path is distinct from old.cv_path then new.cv_aggiornato_il := case when new.cv_path is null then null else now() end; end if;
  -- le esperienze e le certificazioni inserite dal titolare sono sempre «autodichiarate»
  new.esperienze_esterne := coalesce((select jsonb_agg(e || '{"stato": "autodichiarata"}') from jsonb_array_elements(new.esperienze_esterne) e), '[]');
  new.certificazioni := coalesce((select jsonb_agg(e || '{"stato": "autodichiarata"}') from jsonb_array_elements(new.certificazioni) e), '[]');
  new.aggiornato_il := now();
  return new;
end $$;
create trigger profili_professionali_foto before insert or update on public.profili_professionali for each row execute function public._stato_foto();

-- =====================================================================
-- 4. STORAGE PRIVATO: foto e curriculum
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('foto-profilo', 'foto-profilo', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('curriculum', 'curriculum', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- Foto: ognuno scrive solo nella propria cartella; la vedono gli utenti registrati (non i motori di ricerca)
create policy "foto: carico la mia" on storage.objects for insert to authenticated
  with check (bucket_id = 'foto-profilo' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto: sostituisco la mia" on storage.objects for update to authenticated
  using (bucket_id = 'foto-profilo' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto: elimino la mia" on storage.objects for delete to authenticated
  using (bucket_id = 'foto-profilo' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto: la vedono i registrati" on storage.objects for select to authenticated
  using (bucket_id = 'foto-profilo');

-- Curriculum: solo il titolare, e i committenti a cui la persona l'ha allegato in una candidatura
alter table public.candidature add column if not exists cv_condiviso boolean not null default false;
create policy "cv: carico il mio" on storage.objects for insert to authenticated
  with check (bucket_id = 'curriculum' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cv: sostituisco il mio" on storage.objects for update to authenticated
  using (bucket_id = 'curriculum' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cv: elimino il mio" on storage.objects for delete to authenticated
  using (bucket_id = 'curriculum' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cv: lo vedo io o chi l'ha ricevuto" on storage.objects for select to authenticated
  using (bucket_id = 'curriculum' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.candidature c join public.annunci a on a.id = c.annuncio_id
               where c.cv_condiviso and a.autore_id = (select auth.uid()) and c.lavoratore_id::text = (storage.foldername(name))[1])));

create function public.condividi_cv(p_candidatura uuid, p_condividi boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.candidature set cv_condiviso = p_condividi where id = p_candidatura and lavoratore_id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'motivo', 'non_trovata'); end if;
  perform public._registra(case when p_condividi then 'cv_condiviso' else 'cv_ritirato' end, 'candidatura', p_candidatura::text);
  return jsonb_build_object('ok', true);
end $$;

-- =====================================================================
-- 5. AZIENDE E REFERENTI
-- =====================================================================
create table public.aziende (
  id uuid primary key default gen_random_uuid(),
  ragione_sociale text not null check (char_length(btrim(ragione_sociale)) between 2 and 120),
  partita_iva text check (partita_iva is null or partita_iva ~ '^[0-9]{11}$'),
  forma_giuridica text check (forma_giuridica is null or char_length(forma_giuridica) <= 60),
  sede text check (sede is null or char_length(sede) <= 160),
  categoria text check (categoria is null or char_length(categoria) <= 60),
  email text check (email is null or char_length(email) <= 120),
  telefono text check (telefono is null or char_length(telefono) <= 30),
  stato_verifica text not null default 'non_iniziata' check (stato_verifica in ('non_iniziata', 'in_attesa', 'verificata', 'non_riuscita', 'revisione_manuale', 'revocata')),
  creato_da uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now()
);
alter table public.aziende enable row level security;
revoke all on public.aziende from anon, authenticated;

create table public.referenti_aziendali (
  azienda_id uuid not null references public.aziende (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ruolo text not null default 'referente' check (ruolo in ('titolare', 'referente', 'collaboratore')),
  titolo_rappresentanza text check (titolo_rappresentanza is null or char_length(titolo_rappresentanza) <= 200),
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'verificato', 'revocato')),
  permessi jsonb not null default '{"pubblica": true, "seleziona": true, "gestisce_referenti": false}',
  creato_il timestamptz not null default now(),
  primary key (azienda_id, user_id)
);
alter table public.referenti_aziendali enable row level security;
revoke all on public.referenti_aziendali from anon, authenticated;

create function public.crea_azienda(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  nuova uuid;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if (select count(*) from public.referenti_aziendali where user_id = u) >= 5 then raise exception 'Troppe aziende collegate'; end if;
  insert into public.aziende (ragione_sociale, partita_iva, forma_giuridica, sede, categoria, email, telefono, creato_da)
  values (btrim(p ->> 'ragione_sociale'), nullif(regexp_replace(coalesce(p ->> 'partita_iva', ''), '\s', '', 'g'), ''), nullif(btrim(p ->> 'forma_giuridica'), ''),
          nullif(btrim(p ->> 'sede'), ''), nullif(btrim(p ->> 'categoria'), ''), nullif(btrim(p ->> 'email'), ''), nullif(btrim(p ->> 'telefono'), ''), u)
  returning id into nuova;
  insert into public.referenti_aziendali (azienda_id, user_id, ruolo, titolo_rappresentanza, permessi)
  values (nuova, u, coalesce(nullif(p ->> 'ruolo', ''), 'titolare'), nullif(btrim(p ->> 'titolo_rappresentanza'), ''), '{"pubblica": true, "seleziona": true, "gestisce_referenti": true}');
  insert into public.profili_professionali (user_id, tipo) values (u, 'azienda') on conflict (user_id) do update set tipo = 'azienda';
  perform public._registra('azienda_creata', 'azienda', nuova::text);
  return nuova;
end $$;

-- Aggiunge un referente (serve che abbia già un account); resta «in attesa» finché non viene verificato
create function public.aggiungi_referente(p_azienda uuid, p_email text, p_ruolo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  altro uuid;
begin
  if not exists (select 1 from public.referenti_aziendali where azienda_id = p_azienda and user_id = auth.uid() and stato <> 'revocato' and (permessi ->> 'gestisce_referenti')::boolean) then
    raise exception 'Non puoi gestire i referenti di questa azienda';
  end if;
  select id into altro from auth.users where lower(email) = lower(btrim(p_email));
  if altro is null then return jsonb_build_object('ok', false, 'motivo', 'utente_non_trovato'); end if;
  insert into public.referenti_aziendali (azienda_id, user_id, ruolo) values (p_azienda, altro, case when p_ruolo in ('referente', 'collaboratore') then p_ruolo else 'collaboratore' end)
  on conflict do nothing;
  perform public._notifica(altro, 'azienda', 'Sei stato aggiunto come referente di un’azienda su JobExpress.', jsonb_build_object('azienda_id', p_azienda), 'referente-' || p_azienda || '-' || altro);
  perform public._registra('referente_aggiunto', 'azienda', p_azienda::text);
  return jsonb_build_object('ok', true);
end $$;

create function public.mie_aziende() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'ragione_sociale', a.ragione_sociale, 'partita_iva', a.partita_iva, 'forma_giuridica', a.forma_giuridica,
    'sede', a.sede, 'categoria', a.categoria, 'email', a.email, 'telefono', a.telefono, 'stato_verifica', a.stato_verifica, 'ruolo', r.ruolo, 'stato_referente', r.stato,
    'referenti', (select jsonb_agg(jsonb_build_object('nome', coalesce(p.nome, 'Referente'), 'ruolo', r2.ruolo, 'stato', r2.stato)) from public.referenti_aziendali r2 left join public.profili p on p.id = r2.user_id where r2.azienda_id = a.id))), '[]')
  from public.aziende a join public.referenti_aziendali r on r.azienda_id = a.id and r.user_id = auth.uid();
$$;

-- =====================================================================
-- 6. SEGNALAZIONI, BLOCCHI, ASSISTENZA, CONSENSI
-- =====================================================================
create table public.segnalazioni_utenti (
  id bigint generated always as identity primary key,
  autore_id uuid references auth.users (id) on delete set null,
  segnalato_id uuid references auth.users (id) on delete cascade,
  annuncio_id uuid references public.annunci (id) on delete cascade,
  tipo text not null check (tipo in ('foto', 'profilo_falso', 'comportamento', 'annuncio', 'sicurezza', 'altro')),
  motivo text not null check (char_length(motivo) between 5 and 1000),
  stato text not null default 'aperta' check (stato in ('aperta', 'in_esame', 'risolta', 'archiviata')),
  esito text,
  creato_il timestamptz not null default now(),
  gestita_il timestamptz
);
alter table public.segnalazioni_utenti enable row level security;
revoke all on public.segnalazioni_utenti from anon, authenticated;

create table public.blocchi (
  utente_id uuid not null references auth.users (id) on delete cascade,
  bloccato_id uuid not null references auth.users (id) on delete cascade,
  creato_il timestamptz not null default now(),
  primary key (utente_id, bloccato_id),
  check (utente_id <> bloccato_id)
);
alter table public.blocchi enable row level security;
revoke all on public.blocchi from anon, authenticated;
grant select, delete on public.blocchi to authenticated;
create policy "vedo i miei blocchi" on public.blocchi for select to authenticated using ((select auth.uid()) = utente_id);
create policy "tolgo i miei blocchi" on public.blocchi for delete to authenticated using ((select auth.uid()) = utente_id);

create table public.richieste_assistenza (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('verifica', 'contestazione_verifica', 'metodo_alternativo', 'account', 'privacy', 'sospensione', 'altro')),
  messaggio text not null check (char_length(messaggio) between 5 and 2000),
  stato text not null default 'aperta' check (stato in ('aperta', 'in_esame', 'chiusa')),
  risposta text,
  creato_il timestamptz not null default now(),
  chiusa_il timestamptz
);
alter table public.richieste_assistenza enable row level security;
revoke all on public.richieste_assistenza from anon, authenticated;
grant select on public.richieste_assistenza to authenticated;
create policy "vedo le mie richieste" on public.richieste_assistenza for select to authenticated using ((select auth.uid()) = user_id);

create table public.consensi_informative (
  user_id uuid not null references auth.users (id) on delete cascade,
  documento text not null check (documento in ('condizioni', 'privacy', 'privacy_verifica', 'privacy_foto', 'privacy_cv')),
  versione text not null check (char_length(versione) between 1 and 20),
  accettato_il timestamptz not null default now(),
  primary key (user_id, documento, versione)
);
alter table public.consensi_informative enable row level security;
revoke all on public.consensi_informative from anon, authenticated;
grant select on public.consensi_informative to authenticated;
create policy "vedo i miei consensi" on public.consensi_informative for select to authenticated using ((select auth.uid()) = user_id);

create function public.segnala_utente(p_segnalato uuid, p_annuncio uuid, p_tipo text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if (select count(*) from public.segnalazioni_utenti where autore_id = u and creato_il > now() - interval '1 day') >= (public._imp('limite_segnalazioni_giorno'))::int then
    return jsonb_build_object('ok', false, 'motivo', 'troppe_richieste');
  end if;
  insert into public.segnalazioni_utenti (autore_id, segnalato_id, annuncio_id, tipo, motivo) values (u, p_segnalato, p_annuncio, p_tipo, left(btrim(p_motivo), 1000));
  if p_tipo = 'foto' and p_segnalato is not null then
    update public.profili_professionali set foto_stato = 'in_revisione' where user_id = p_segnalato and foto_stato in ('caricata', 'verificata');
  end if;
  perform public._registra('segnalazione', 'utente', coalesce(p_segnalato::text, p_annuncio::text), jsonb_build_object('tipo', p_tipo));
  return jsonb_build_object('ok', true);
end $$;

create function public.blocca_utente(p_utente uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_utente = auth.uid() then raise exception 'Operazione non valida'; end if;
  insert into public.blocchi (utente_id, bloccato_id) values (auth.uid(), p_utente) on conflict do nothing;
  perform public._registra('utente_bloccato', 'utente', p_utente::text);
  return jsonb_build_object('ok', true);
end $$;

create function public.richiedi_assistenza(p_tipo text, p_messaggio text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if (select count(*) from public.richieste_assistenza where user_id = auth.uid() and creato_il > now() - interval '1 day') >= 10 then
    return jsonb_build_object('ok', false, 'motivo', 'troppe_richieste');
  end if;
  insert into public.richieste_assistenza (user_id, tipo, messaggio) values (auth.uid(), p_tipo, left(btrim(p_messaggio), 2000));
  return jsonb_build_object('ok', true);
end $$;

create function public.registra_consenso(p_documento text, p_versione text) returns void
language sql security definer set search_path = '' as $$
  insert into public.consensi_informative (user_id, documento, versione) values (auth.uid(), p_documento, p_versione) on conflict do nothing;
$$;

-- =====================================================================
-- 7. REQUISITI PER L'ACCESSO OPERATIVO (controllati nel database)
-- =====================================================================
create function public._requisiti_trust(p_user uuid, p_azione text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  manca text[] := '{}';
  pp record;
  tipo_pub text;
begin
  select * into pp from public.profili_professionali where user_id = p_user;
  if exists (select 1 from public.sospensioni where user_id = p_user and stato = 'attiva') then manca := array_append(manca, 'sospeso'); end if;
  if not coalesce((select maggiorenne from public.profili where id = p_user), false)
     or exists (select 1 from public.verifiche where user_id = p_user and tipo = 'identita' and maggiorenne = false and not (public._imp('minor_accounts_enabled'))::boolean) then
    manca := array_append(manca, 'eta');
  end if;
  if (public._imp('email_verification_required'))::boolean and (select email_confirmed_at from auth.users where id = p_user) is null then manca := array_append(manca, 'email'); end if;
  if (public._imp('phone_verification_enabled'))::boolean and (select telefono_verificato_il from public.dati_riservati where user_id = p_user) is null then manca := array_append(manca, 'telefono'); end if;
  if (public._imp('identity_verification_required'))::boolean
     and not exists (select 1 from public.verifiche where user_id = p_user and tipo = 'identita' and stato = 'verificata') then
    manca := array_append(manca, 'identita');
  end if;
  tipo_pub := coalesce(pp.tipo, 'lavoratore');
  -- foto del volto: lavoratori e privati (le aziende possono usare il logo, ma serve comunque un'immagine)
  if (public._imp('profile_photo_required'))::boolean and (pp.foto_path is null or pp.foto_stato in ('assente', 'da_sostituire')) then manca := array_append(manca, 'foto'); end if;
  if p_azione in ('pubblica', 'seleziona') and tipo_pub = 'azienda' and (public._imp('company_verification_required'))::boolean
     and not exists (select 1 from public.referenti_aziendali r join public.aziende a on a.id = r.azienda_id
                     where r.user_id = p_user and r.stato = 'verificato' and a.stato_verifica = 'verificata') then
    manca := array_append(manca, 'azienda');
  end if;
  return manca;
end $$;
revoke execute on function public._requisiti_trust(uuid, text) from public, anon, authenticated;

create function public._controlla_trust(p_user uuid, p_azione text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  manca text[] := public._requisiti_trust(p_user, p_azione);
begin
  if cardinality(manca) > 0 then raise exception 'TRUST:%', array_to_string(manca, ','); end if;
end $$;
revoke execute on function public._controlla_trust(uuid, text) from public, anon, authenticated;

create function public._trigger_trust() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'candidature' then
    perform public._controlla_trust(new.lavoratore_id, 'candidatura');
    if (select count(*) from public.candidature where lavoratore_id = new.lavoratore_id and creato_il > now() - interval '1 hour') >= (public._imp('limite_candidature_ora'))::int then
      raise exception 'TRUST:troppe_richieste';
    end if;
    if exists (select 1 from public.annunci a join public.blocchi b on (b.utente_id = a.autore_id and b.bloccato_id = new.lavoratore_id) or (b.utente_id = new.lavoratore_id and b.bloccato_id = a.autore_id)
               where a.id = new.annuncio_id) then
      raise exception 'TRUST:bloccato';
    end if;
  elsif tg_table_name = 'annunci' then
    perform public._controlla_trust(new.autore_id, 'pubblica');
    if (select count(*) from public.annunci where autore_id = new.autore_id and creato_il > now() - interval '1 day') >= (public._imp('limite_annunci_giorno'))::int then
      raise exception 'TRUST:troppe_richieste';
    end if;
  elsif tg_table_name = 'proposte' then
    perform public._controlla_trust(new.committente_id, 'seleziona');
  elsif tg_table_name = 'incarichi' then
    perform public._controlla_trust(new.lavoratore_id, 'conferma');
  end if;
  return new;
end $$;
create trigger trust_candidature before insert on public.candidature for each row execute function public._trigger_trust();
create trigger trust_annunci before insert on public.annunci for each row execute function public._trigger_trust();
create trigger trust_proposte before insert on public.proposte for each row execute function public._trigger_trust();
create trigger trust_incarichi before insert on public.incarichi for each row execute function public._trigger_trust();

-- =====================================================================
-- 8. LETTURE PER IL SITO
-- =====================================================================
-- Il mio stato Trust (Centro sicurezza e identità)
create function public.mio_trust() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'email', (select email from auth.users where id = auth.uid()),
    'email_verificata', (select email_confirmed_at is not null from auth.users where id = auth.uid()),
    'iscritto_il', (select created_at from auth.users where id = auth.uid()),
    'ultimo_accesso', (select last_sign_in_at from auth.users where id = auth.uid()),
    'verifiche', coalesce((select jsonb_object_agg(tipo, jsonb_build_object('stato', stato, 'metodo', metodo, 'provider', provider, 'simulata', simulata, 'verificata_il', verificata_il, 'motivo', motivo))
                  from public.verifiche where user_id = auth.uid()), '{}'),
    'foto_stato', (select foto_stato from public.profili_professionali where user_id = auth.uid()),
    'mancano_candidatura', public._requisiti_trust(auth.uid(), 'candidatura'),
    'mancano_pubblica', public._requisiti_trust(auth.uid(), 'pubblica'),
    'sospeso', exists (select 1 from public.sospensioni where user_id = auth.uid() and stato = 'attiva'),
    'richieste', coalesce((select jsonb_agg(jsonb_build_object('tipo', tipo, 'stato', stato, 'creato_il', creato_il, 'risposta', risposta) order by creato_il desc)
                  from public.richieste_assistenza where user_id = auth.uid()), '[]')
  );
$$;

-- Profilo come lo vedono gli altri utenti registrati (nome + iniziale del cognome, solo i campi scelti)
create function public.profilo_pubblico(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', pp.user_id, 'tipo', pp.tipo,
    'nome', coalesce(p.nome, 'Utente') || case when pp.cognome is not null then ' ' || left(pp.cognome, 1) || '.' else '' end,
    'citta', p.citta,
    'foto_path', case when (pp.visibilita ->> 'foto')::boolean is not false and pp.foto_stato in ('caricata', 'verificata')
                        and (public._imp('profile_photo_visibility') #>> '{}' = 'authenticated_users'
                             or exists (select 1 from public.candidature c join public.annunci a on a.id = c.annuncio_id where c.lavoratore_id = pp.user_id and a.autore_id = auth.uid() and c.stato in ('in_attesa_conferma', 'confermata'))
                             or pp.user_id = auth.uid())
                      then pp.foto_path end,
    'presentazione', case when (pp.visibilita ->> 'presentazione')::boolean is not false then pp.presentazione end,
    'settori', case when (pp.visibilita ->> 'competenze')::boolean is not false then pp.settori end,
    'mansioni', case when (pp.visibilita ->> 'competenze')::boolean is not false then pp.mansioni end,
    'competenze_tecniche', case when (pp.visibilita ->> 'competenze')::boolean is not false then pp.competenze_tecniche end,
    'competenze_trasversali', case when (pp.visibilita ->> 'competenze')::boolean is not false then pp.competenze_trasversali end,
    'lingue', case when (pp.visibilita ->> 'competenze')::boolean is not false then pp.lingue end,
    'esperienze_esterne', case when (pp.visibilita ->> 'esperienze')::boolean is not false then pp.esperienze_esterne end,
    'formazione', case when (pp.visibilita ->> 'formazione')::boolean is not false then pp.formazione end,
    'certificazioni', case when (pp.visibilita ->> 'formazione')::boolean is not false then pp.certificazioni end,
    'iscritto_il', date_trunc('month', p.creato_il),
    'incarichi_completati', (select count(*) from public.incarichi i where i.lavoratore_id = pp.user_id and i.stato = 'completato'),
    'riconoscimenti', jsonb_build_object(
      'contatti', (select email_confirmed_at is not null from auth.users where id = pp.user_id)
                  and (not (public._imp('phone_verification_enabled'))::boolean or exists (select 1 from public.dati_riservati d where d.user_id = pp.user_id and d.telefono_verificato_il is not null)),
      'identita', exists (select 1 from public.verifiche v where v.user_id = pp.user_id and v.tipo = 'identita' and v.stato = 'verificata'),
      'identita_simulata', exists (select 1 from public.verifiche v where v.user_id = pp.user_id and v.tipo = 'identita' and v.stato = 'verificata' and v.simulata),
      'foto', pp.foto_stato = 'verificata',
      'azienda', exists (select 1 from public.referenti_aziendali r join public.aziende a on a.id = r.azienda_id where r.user_id = pp.user_id and r.stato = 'verificato' and a.stato_verifica = 'verificata'),
      'qualifiche', exists (select 1 from public.verifiche v where v.user_id = pp.user_id and v.tipo = 'qualifica' and v.stato = 'verificata'))
  )
  from public.profili_professionali pp join public.profili p on p.id = pp.user_id
  where pp.user_id = p_user and auth.uid() is not null
    and not exists (select 1 from public.sospensioni s where s.user_id = pp.user_id and s.stato = 'attiva');
$$;

-- =====================================================================
-- 9. VERIFICHE DAL SERVER (provider) E STRUMENTI ADMIN
-- =====================================================================
-- Registra l'esito di una verifica arrivato dal provider (solo funzione server con chiave di servizio).
-- Controlli: identità già usata su un altro account → revisione manuale; minorenne → non riuscita.
create function public.registra_verifica(p_user uuid, p_tipo text, p_metodo text, p_provider text, p_rif text, p_maggiorenne boolean, p_esito text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  impronta text := case when p_rif is null then null else encode(sha256(convert_to(p_provider || ':' || p_rif, 'UTF8')), 'hex') end;
  stato_finale text := case when p_esito in ('verificata', 'non_riuscita', 'in_attesa', 'in_corso') then p_esito else 'non_riuscita' end;
  nota text;
begin
  if stato_finale = 'verificata' and impronta is not null and exists (select 1 from public.verifiche where tipo = p_tipo and provider = p_provider and rif_hash = impronta and stato = 'verificata' and user_id <> p_user) then
    stato_finale := 'revisione_manuale'; nota := 'possibile_account_duplicato';
  end if;
  if stato_finale = 'verificata' and p_tipo = 'identita' and p_maggiorenne is false and not (public._imp('minor_accounts_enabled'))::boolean then
    stato_finale := 'non_riuscita'; nota := 'eta_minima';
  end if;
  insert into public.verifiche (user_id, tipo, stato, metodo, provider, rif_hash, maggiorenne, simulata, motivo, verificata_il, aggiornato_il)
  values (p_user, p_tipo, stato_finale, p_metodo, p_provider, impronta, p_maggiorenne, false, nota, case when stato_finale = 'verificata' then now() end, now())
  on conflict (user_id, tipo) do update set stato = excluded.stato, metodo = excluded.metodo, provider = excluded.provider, rif_hash = excluded.rif_hash,
    maggiorenne = excluded.maggiorenne, simulata = false, motivo = excluded.motivo, verificata_il = excluded.verificata_il, aggiornato_il = now();
  insert into public.registro_operazioni (user_id, azione, oggetto_tipo, oggetto_id, dettagli)
  values (null, 'verifica_' || stato_finale, p_tipo, p_user::text, jsonb_build_object('metodo', p_metodo, 'provider', p_provider, 'nota', nota));
  perform public._notifica(p_user, 'verifica', case stato_finale when 'verificata' then 'La tua verifica è stata completata.' when 'revisione_manuale' then 'La tua verifica richiede un controllo da parte del team JobExpress.' else 'La verifica non è riuscita: puoi riprovare o usare un altro metodo.' end,
    jsonb_build_object('tipo', p_tipo), 'verifica-' || p_tipo || '-' || p_user || '-' || extract(epoch from now())::bigint);
  return jsonb_build_object('ok', true, 'stato', stato_finale, 'nota', nota);
end $$;
revoke execute on function public.registra_verifica(uuid, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.registra_verifica(uuid, text, text, text, text, boolean, text) to service_role;

-- Solo in fase di test: verifica SIMULATA (sempre etichettata, mai mostrata come vera)
create function public.admin_simula_verifica(p_user uuid, p_tipo text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if not (public._imp('verifiche_simulate_consentite'))::boolean then raise exception 'Verifiche simulate disattivate'; end if;
  if p_tipo not in ('identita', 'azienda', 'qualifica') then raise exception 'Tipo non valido'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Serve un motivo'; end if;
  insert into public.verifiche (user_id, tipo, stato, metodo, maggiorenne, simulata, motivo, verificata_il)
  values (p_user, p_tipo, 'verificata', 'simulata', true, true, 'SIMULATA: ' || left(p_motivo, 200), now())
  on conflict (user_id, tipo) do update set stato = 'verificata', metodo = 'simulata', simulata = true, maggiorenne = true, motivo = excluded.motivo, verificata_il = now(), aggiornato_il = now();
  if p_tipo = 'azienda' then
    update public.referenti_aziendali set stato = 'verificato' where user_id = p_user and stato = 'in_attesa';
    update public.aziende set stato_verifica = 'verificata' where id in (select azienda_id from public.referenti_aziendali where user_id = p_user);
  end if;
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'verifica_simulata', jsonb_build_object('utente', p_user, 'tipo', p_tipo, 'motivo', p_motivo));
end $$;

create function public.admin_revoca_verifica(p_user uuid, p_tipo text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Serve un motivo'; end if;
  update public.verifiche set stato = 'revocata', motivo = left(p_motivo, 300), aggiornato_il = now() where user_id = p_user and tipo = p_tipo;
  if p_tipo = 'azienda' then update public.referenti_aziendali set stato = 'revocato' where user_id = p_user; end if;
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'verifica_revocata', jsonb_build_object('utente', p_user, 'tipo', p_tipo, 'motivo', p_motivo));
  perform public._notifica(p_user, 'verifica', 'Una tua verifica è stata revocata. Puoi chiedere assistenza o contestare l’esito.', jsonb_build_object('tipo', p_tipo), 'revoca-' || p_tipo || '-' || p_user || '-' || extract(epoch from now())::bigint);
end $$;

-- Revisione manuale della foto: «controllata» (torna caricata) oppure «da sostituire». Mai «verificata» a mano.
create function public.admin_revisione_foto(p_user uuid, p_esito text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if p_esito not in ('ok', 'da_sostituire') then raise exception 'Esito non valido'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Serve un motivo'; end if;
  update public.profili_professionali set foto_stato = case when p_esito = 'ok' then 'caricata' else 'da_sostituire' end where user_id = p_user;
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'revisione_foto', jsonb_build_object('utente', p_user, 'esito', p_esito, 'motivo', p_motivo));
  if p_esito = 'da_sostituire' then
    perform public._notifica(p_user, 'verifica', 'La tua foto del profilo va sostituita: deve mostrare chiaramente il tuo volto.', '{}'::jsonb, 'foto-' || p_user || '-' || extract(epoch from now())::bigint);
  end if;
end $$;

create function public.admin_gestisci_segnalazione(p_id bigint, p_stato text, p_esito text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if p_stato not in ('in_esame', 'risolta', 'archiviata') then raise exception 'Stato non valido'; end if;
  update public.segnalazioni_utenti set stato = p_stato, esito = left(p_esito, 500), gestita_il = case when p_stato <> 'in_esame' then now() end where id = p_id;
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'segnalazione_' || p_stato, jsonb_build_object('id', p_id, 'esito', p_esito));
end $$;

-- Sospensione proporzionata, motivata e contestabile (gli incarichi già assegnati restano nello storico)
create function public.admin_sospendi(p_user uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Serve un motivo'; end if;
  insert into public.sospensioni (user_id, motivo, creato_da) values (p_user, p_motivo, auth.uid());
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'sospensione', jsonb_build_object('utente', p_user, 'motivo', p_motivo));
  perform public._notifica(p_user, 'verifica', 'Il tuo account è sospeso in via cautelativa. Puoi contestare la decisione dalla sezione Sicurezza e identità.', '{}'::jsonb, 'sospeso-' || p_user || '-' || extract(epoch from now())::bigint);
end $$;

create function public.admin_riattiva(p_user uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  update public.sospensioni set stato = 'revocata', chiusa_il = now() where user_id = p_user and stato = 'attiva';
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'riattivazione', jsonb_build_object('utente', p_user, 'motivo', p_motivo));
end $$;

create function public.admin_rispondi_assistenza(p_id bigint, p_risposta text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  update public.richieste_assistenza set stato = 'chiusa', risposta = left(p_risposta, 2000), chiusa_il = now() where id = p_id;
  insert into public.registro_admin (user_id, azione, dettagli) values (auth.uid(), 'assistenza_chiusa', jsonb_build_object('id', p_id));
end $$;

create function public.admin_trust() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sono_admin() then raise exception 'Accesso riservato'; end if;
  return jsonb_build_object(
    'account', (select count(*) from auth.users),
    'identita_verificate', (select count(*) from public.verifiche where tipo = 'identita' and stato = 'verificata' and not simulata),
    'identita_simulate', (select count(*) from public.verifiche where tipo = 'identita' and stato = 'verificata' and simulata),
    'in_attesa', (select count(*) from public.verifiche where stato in ('in_corso', 'in_attesa')),
    'non_riuscite', (select count(*) from public.verifiche where stato = 'non_riuscita'),
    'revisione_manuale', (select count(*) from public.verifiche where stato = 'revisione_manuale'),
    'foto_in_revisione', (select count(*) from public.profili_professionali where foto_stato = 'in_revisione'),
    'segnalazioni_foto', (select count(*) from public.segnalazioni_utenti where tipo = 'foto' and stato in ('aperta', 'in_esame')),
    'segnalazioni_profili', (select count(*) from public.segnalazioni_utenti where tipo = 'profilo_falso' and stato in ('aperta', 'in_esame')),
    'segnalazioni_aperte', (select count(*) from public.segnalazioni_utenti where stato in ('aperta', 'in_esame')),
    'sospesi', (select count(*) from public.sospensioni where stato = 'attiva'),
    'aziende_verificate', (select count(*) from public.aziende where stato_verifica = 'verificata'),
    'aziende_in_attesa', (select count(*) from public.aziende where stato_verifica in ('non_iniziata', 'in_attesa', 'revisione_manuale')),
    'privati_verificati', (select count(*) from public.profili_professionali pp join public.verifiche v on v.user_id = pp.user_id and v.tipo = 'identita' and v.stato = 'verificata' where pp.tipo = 'privato'),
    'assistenza_aperte', (select count(*) from public.richieste_assistenza where stato <> 'chiusa'),
    'tasso_completamento', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where stato = 'verificata') / count(*)) end from public.verifiche where tipo = 'identita'),
    'ore_medie_verifica', (select round(avg(extract(epoch from verificata_il - creato_il) / 3600)::numeric, 1) from public.verifiche where tipo = 'identita' and stato = 'verificata'),
    'costi_identificazione_eur', 0,
    'coda', jsonb_build_object(
      'segnalazioni', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tipo', s.tipo, 'motivo', s.motivo, 'stato', s.stato, 'creato_il', s.creato_il, 'segnalato_id', s.segnalato_id,
          'segnalato', coalesce((select nome from public.profili where id = s.segnalato_id), '—')) order by s.creato_il desc)
        from public.segnalazioni_utenti s where s.stato in ('aperta', 'in_esame')), '[]'),
      'foto', coalesce((select jsonb_agg(jsonb_build_object('user_id', pp.user_id, 'nome', coalesce(p.nome, 'Utente'), 'foto_path', pp.foto_path, 'stato', pp.foto_stato))
        from public.profili_professionali pp left join public.profili p on p.id = pp.user_id where pp.foto_stato = 'in_revisione'), '[]'),
      'verifiche', coalesce((select jsonb_agg(jsonb_build_object('user_id', v.user_id, 'nome', coalesce(p.nome, 'Utente'), 'tipo', v.tipo, 'stato', v.stato, 'motivo', v.motivo))
        from public.verifiche v left join public.profili p on p.id = v.user_id where v.stato in ('revisione_manuale', 'in_attesa')), '[]'),
      'assistenza', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'tipo', r.tipo, 'messaggio', r.messaggio, 'creato_il', r.creato_il) order by r.creato_il)
        from public.richieste_assistenza r where r.stato <> 'chiusa'), '[]'),
      'aziende', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ragione_sociale', a.ragione_sociale, 'partita_iva', a.partita_iva, 'stato', a.stato_verifica))
        from public.aziende a where a.stato_verifica in ('non_iniziata', 'in_attesa', 'revisione_manuale')), '[]'))
  );
end $$;

-- =====================================================================
-- 10. PERMESSI DELLE FUNZIONI
-- =====================================================================
revoke execute on function public.condividi_cv(uuid, boolean) from public, anon;
revoke execute on function public.crea_azienda(jsonb) from public, anon;
revoke execute on function public.aggiungi_referente(uuid, text, text) from public, anon;
revoke execute on function public.mie_aziende() from public, anon;
revoke execute on function public.segnala_utente(uuid, uuid, text, text) from public, anon;
revoke execute on function public.blocca_utente(uuid) from public, anon;
revoke execute on function public.richiedi_assistenza(text, text) from public, anon;
revoke execute on function public.registra_consenso(text, text) from public, anon;
revoke execute on function public.mio_trust() from public, anon;
revoke execute on function public.profilo_pubblico(uuid) from public, anon;
revoke execute on function public.admin_simula_verifica(uuid, text, text) from public, anon;
revoke execute on function public.admin_revoca_verifica(uuid, text, text) from public, anon;
revoke execute on function public.admin_revisione_foto(uuid, text, text) from public, anon;
revoke execute on function public.admin_gestisci_segnalazione(bigint, text, text) from public, anon;
revoke execute on function public.admin_sospendi(uuid, text) from public, anon;
revoke execute on function public.admin_riattiva(uuid, text) from public, anon;
revoke execute on function public.admin_rispondi_assistenza(bigint, text) from public, anon;
revoke execute on function public.admin_trust() from public, anon;
grant execute on function public.condividi_cv(uuid, boolean) to authenticated;
grant execute on function public.crea_azienda(jsonb) to authenticated;
grant execute on function public.aggiungi_referente(uuid, text, text) to authenticated;
grant execute on function public.mie_aziende() to authenticated;
grant execute on function public.segnala_utente(uuid, uuid, text, text) to authenticated;
grant execute on function public.blocca_utente(uuid) to authenticated;
grant execute on function public.richiedi_assistenza(text, text) to authenticated;
grant execute on function public.registra_consenso(text, text) to authenticated;
grant execute on function public.mio_trust() to authenticated;
grant execute on function public.profilo_pubblico(uuid) to authenticated;
grant execute on function public.admin_simula_verifica(uuid, text, text) to authenticated;
grant execute on function public.admin_revoca_verifica(uuid, text, text) to authenticated;
grant execute on function public.admin_revisione_foto(uuid, text, text) to authenticated;
grant execute on function public.admin_gestisci_segnalazione(bigint, text, text) to authenticated;
grant execute on function public.admin_sospendi(uuid, text) to authenticated;
grant execute on function public.admin_riattiva(uuid, text) to authenticated;
grant execute on function public.admin_rispondi_assistenza(bigint, text) to authenticated;
grant execute on function public.admin_trust() to authenticated;
