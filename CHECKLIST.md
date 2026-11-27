# JobExpress · checklist del prodotto (25 novembre 2026)

Legenda: ✅ fatto e collaudato · 🧪 funziona in prova (dati sul dispositivo o simulati) · ⏳ da fare prima del lancio

## Sito e design
- ✅ Home operativa: titolo, Cerco lavoro / Offro lavoro, calendario a fasce, «Disponibile ora»
- ✅ Bacheca incarichi con filtri, ordinamento, mappa (elenco / mappa), categorie, dettaglio
- ✅ Menu, piè di pagina completo, domande frequenti, pagine Chi siamo, Sicurezza, Privacy, Cookie, Condizioni
- ✅ Versione telefono e computer, barra in basso, accessibilità di base (nomi dei pulsanti, etichette, movimento ridotto)
- ⏳ Logo: le proposte armonizzate sono in `public/` (file proposta-*.svg) e aspettano l’approvazione

## Account (Supabase)
- ✅ Registrazione, accesso, recupero password, uscita, eliminazione account, profilo (tabella `profili` con RLS)
- ⏳ Accesso con Google e Apple: da attivare nel pannello Supabase, poi aggiungere a `PROVIDER_ATTIVI` in `src/auth.js`
- ⏳ Email: collegare un servizio SMTP (il servizio gratuito di Supabase scrive solo al team) e impostare l’indirizzo del sito in Authentication → URL Configuration

## Percorso lavoratore 🧪
- Candidatura, selezione (simulata), conferma, completamento, compenso dichiarato, recensioni reciproche
- Calendario intelligente, «Disponibile ora», obiettivo guadagno, salvati e ricerche salvate, chat, notifiche

## Percorso di chi pubblica 🧪
- Procedura in 8 passaggi, bozze, programmazione, revisione per le categorie sensibili
- Candidature ricevute (di esempio), selezione, completamento, recensione, chat

## Abbonamenti 🧪
- Free, Plus, Friends con mensile/annuale, pagamento simulato, disdetta, ricevute, inviti Friends
- ⏳ Stripe in modalità test (serve un account Stripe), poi pagamenti veri solo dopo la verifica legale
- ⏳ Partita IVA / forma giuridica prima dei pagamenti

## Amministrazione
- ✅ Area Admin protetta da Supabase (`amministratori`, `sono_admin`, `admin_statistiche`, `registro_admin`)
- 🧪 Moderazione annunci e segnalazioni sui dati del dispositivo
- ⏳ Aggiungere il proprio account alla tabella `amministratori` (vedi il file della migrazione)

## App sul telefono (PWA)
- ✅ Manifest, icone, service worker (non salva mai dati personali), pagina offline, avviso nuova versione, pulsante «Installa l’app»
- ⏳ Funziona solo con il sito online in https

## Prima del lancio
- ⏳ Revisione legale di Privacy, Cookie e Condizioni (sono bozze)
- ⏳ Verifica del modello rispetto al D.Lgs. 276/2003
- ⏳ Spostare candidature, annunci, chat, recensioni dal dispositivo a Supabase (tabelle con RLS)
- ⏳ Ospitare i caratteri sul sito invece di Google Fonts
- ⏳ Togliere `noindex` dalle pagine e aggiornare `robots.txt`
- ⏳ Togliere i dati e le risposte di esempio

## Aggiornamento 27 novembre 2026 · Fondamenta + candidature
Database (migrazione `supabase/migrations/20261127120000_candidature_proposte_incarichi.sql`, già applicata su Supabase):
- ✅ Tabelle nuove: impostazioni, abbonamenti, gruppi_friends, annunci, turni, candidature, proposte, incarichi, notifiche, registro_operazioni (RLS attiva, nessuna scrittura diretta dal sito)
- ✅ Massimo 3 candidature attive nella stessa fascia oraria, contate sugli orari veri (turni notturni e su più giorni compresi), uguale per tutti i piani
- ✅ Doppia conferma: candidatura → selezione → proposta con scadenza → conferma del lavoratore → incarico assegnato
- ✅ Alla conferma: ritiro automatico delle candidature incompatibili, proposte incompatibili annullate, posti aggiornati, committenti avvisati
- ✅ Blocchi nel database contro doppie conferme simultanee e posti assegnati due volte
- ✅ Scadenza automatica delle proposte ogni minuto (pg_cron), anche ad app chiusa, senza penalità
- ✅ Avviso spostamenti sotto i 30 minuti (non blocca)
- ✅ Limite sperimentale incarichi Free: `free_monthly_job_limit_enabled` = SPENTO; un annuncio con più turni conta 1; conta il mese del primo turno (Europe/Rome); gli annullamenti del committente non contano
- ✅ Regole modificabili dall'area Admin (registrate in registro_admin, mai retroattive)
- ✅ 15 prove automatiche superate (vedi report del 27/11)
Sito:
- 🧪 Le stesse regole funzionano nella versione di prova (annunci di esempio): avviso «tre candidature», proposta con conto alla rovescia, avviso spostamenti, ritiro automatico
- ⏳ Collegare pubblicazione annunci e candidature del sito alle funzioni vere del database (prossimo blocco)
- ⏳ Modifica orari di un annuncio già assegnato: oggi il database la blocca; serve la schermata di nuova accettazione del lavoratore
- ⏳ Notifiche push ed email (oggi solo interne)
- ⚖️ Da verificare con un avvocato del lavoro prima di accendere il limite Free e prima dei pagamenti veri
