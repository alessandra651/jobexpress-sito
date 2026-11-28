-- =====================================================================
-- JobExpress · Fase 5 «Prestazioni» (28/11/2026)
-- Nessun cambiamento di regole: stesse condizioni, solo più veloci.
-- 1) Regole di accesso (RLS): auth.uid() valutato una volta per richiesta, non per ogni riga.
-- 2) Indici sulle colonne più usate nei collegamenti tra tabelle.
-- =====================================================================

alter policy annullamenti_parti on public.annullamenti using (exists (select 1 from public.incarichi i where i.id = annullamenti.incarico_id and (select auth.uid()) in (i.lavoratore_id, i.committente_id)));
alter policy condizioni_parti on public.condizioni_incarico using (exists (select 1 from public.incarichi i where i.id = condizioni_incarico.incarico_id and (select auth.uid()) in (i.lavoratore_id, i.committente_id)));
alter policy mancate_parti on public.mancate_presentazioni using (exists (select 1 from public.incarichi i where i.id = mancate_presentazioni.incarico_id and (select auth.uid()) in (i.lavoratore_id, i.committente_id)));
alter policy richieste_modifica_parti on public.richieste_modifica using (exists (select 1 from public.incarichi i where i.id = richieste_modifica.incarico_id and (select auth.uid()) in (i.lavoratore_id, i.committente_id)));
alter policy condivisioni_proprie on public.condivisioni_incarico using (user_id = (select auth.uid()));
alter policy live_proprie on public.disponibilita_live using (user_id = (select auth.uid()));
alter policy modelli_propri on public.modelli_annuncio using (user_id = (select auth.uid()));
alter policy preferenze_proprie on public.preferenze_notifiche using (user_id = (select auth.uid()));
alter policy proposte_dirette_parti on public.proposte_dirette using ((select auth.uid()) in (committente_id, lavoratore_id));
alter policy recensioni_proprie_o_pubblicate on public.recensioni using (autore_id = (select auth.uid()) or stato = 'pubblicata');
alter policy rescue_contatti_propri on public.rescue_contatti using (user_id = (select auth.uid()));
alter policy rescue_committente on public.rescue_richieste using (committente_id = (select auth.uid()));
alter policy ricorrenze_proprie on public.ricorrenze using (user_id = (select auth.uid()));

create index if not exists incarichi_annuncio on public.incarichi (annuncio_id);
create index if not exists incarichi_committente on public.incarichi (committente_id);
create index if not exists incarichi_proposta on public.incarichi (proposta_id);
create index if not exists proposte_annuncio on public.proposte (annuncio_id);
create index if not exists proposte_lavoratore on public.proposte (lavoratore_id);
create index if not exists proposte_committente on public.proposte (committente_id);
create index if not exists proposte_dirette_committente on public.proposte_dirette (committente_id);
create index if not exists disponibilita_live_utente on public.disponibilita_live (user_id);
create index if not exists rescue_contatti_utente on public.rescue_contatti (user_id);
create index if not exists rescue_richieste_committente on public.rescue_richieste (committente_id);
create index if not exists recensioni_autore on public.recensioni (autore_id);
create index if not exists condivisioni_incarico_inc on public.condivisioni_incarico (incarico_id);
create index if not exists condivisioni_incarico_utente on public.condivisioni_incarico (user_id);
create index if not exists segnalazioni_utenti_autore on public.segnalazioni_utenti (autore_id);
create index if not exists segnalazioni_utenti_segnalato on public.segnalazioni_utenti (segnalato_id);
create index if not exists segnalazioni_utenti_incarico on public.segnalazioni_utenti (incarico_id);
create index if not exists contestazioni_incarico on public.contestazioni (incarico_id);
create index if not exists blocchi_bloccato on public.blocchi (bloccato_id);
create index if not exists ricorrenze_utente on public.ricorrenze (user_id);
create index if not exists ricorrenze_modello on public.ricorrenze (modello_id);
create index if not exists sospensioni_utente on public.sospensioni (user_id);
create index if not exists referenti_aziendali_utente on public.referenti_aziendali (user_id);
create index if not exists richieste_assistenza_utente on public.richieste_assistenza (user_id);
create index if not exists risposte_orari_incarico on public.risposte_orari (incarico_id);
