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

## Aggiornamento 27 novembre 2026 · Abbonamenti + «Il tuo percorso»
- ✅ Pagina abbonamenti: nuove funzioni di Free, Plus (Goal, CV, Career, Smart Calendar, AI) e Friends; prezzi e numero di richieste AI presi dalle regole dell'area Admin; le funzioni non ancora pronte mostrano «in arrivo»; il testo sul limite Free segue l'interruttore
- 🧪 Nuova scheda «Percorso» nell'area personale: obiettivo del mese, badge (gratis per tutti), ultimi incarichi, cinque strumenti
- 🧪 JobExpress Goal (Plus): obiettivo settimanale, mensile, annuale o fino a una data; maturati, mancante, %, media oraria, ore indicative; compensi previsti / maturati / ricevuti distinti; grafici per settimane, mesi, anni con confronto; medie; per categoria; report CSV
- 🧪 Free vede i propri compensi e una presentazione di Goal, senza dati inventati
- 🧪 Schermata «Il tuo percorso è appena iniziato!» per Free al secondo incarico completato del mese (una volta al mese, nessuna attivazione automatica)
- ⏳ JobExpress CV, Career, Smart Calendar, AI: prossimi blocchi
- ⏳ Spostare candidature e guadagni su Supabase (oggi restano sul dispositivo)

## Aggiornamento 27 novembre 2026 · JobExpress CV + Career
- ✅ Database: tabelle `curricula` (solo il proprietario) e `cv_condivisi` (link segreto revocabile, serve Plus), funzioni cv_pubblica / cv_revoca / cv_leggi (migrazione 20261127140000_curriculum.sql)
- 🧪 CV: incarichi completati proposti come «Nuove esperienze» (una sola volta, niente doppioni), esperienze JobExpress «verificabili», esterne/competenze/certificazioni «autodichiarate»; studi, lingue, contatti scelti, foto facoltativa, disponibilità, badge, valutazioni scelte; modelli Minimal/Professional/Modern; ordine e sezioni nascoste; anteprima; PDF con la stampa del browser; pagina pubblica `cv.html?t=…`
- 🧪 Career: incarichi, ore, committenti, valutazione media, completamento, esperienze per settore, incarichi nel tempo, mappa delle competenze (dalle recensioni / dalle esperienze / autodichiarate / verificate: nessuna), andamento recensioni, suggerimenti solo con almeno 3 incarichi
- ✅ Badge, livello, requisiti mancanti, traguardi e storico: gratis per tutti, criteri invariati

## Aggiornamento 27 novembre 2026 · Smart Calendar + JobExpress AI
- ✅ Database: `calendario_personale` (solo il proprietario), `ai_conversazioni` (solo il proprietario, eliminabili), `ai_utilizzo` (contatore mensile scritto SOLO dal server); funzioni ai_stato, ai_riserva, ai_restituisci, admin_statistiche_ai (migrazione 20261127160000_calendario_e_ai.sql). Provato: la 21ª richiesta è bloccata, una richiesta fallita viene restituita, Free e funzione spenta bloccati, il sito non può aumentare il contatore
- ✅ Funzione server `jobexpress-ai` pubblicata su Supabase (chiave del provider solo lì, limiti di lunghezza, stima dei costi, conversazioni salvate)
- ⏳ Per accendere l'AI: aggiungere il segreto ANTHROPIC_API_KEY in Supabase → Edge Functions → Secrets, poi nell'area Admin spuntare «Funzione attiva: JobExpress AI» (oggi spenta)
- 🧪 Smart Calendar: viste giorno/settimana/mese, incarichi/proposte/candidature + impegni universitari, personali, indisponibilità, tempo libero (anche ogni settimana), fasce libere, sovrapposizioni, avvisi spostamenti, ore lavorate e libere, collegamento con Goal, promemoria nel sito, esportazione .ics e «+ Google Calendar»
- ⏳ Sincronizzazione automatica con Google Calendar (serve un progetto Google OAuth) · notifiche push ed email

## Aggiornamento 27 novembre 2026 · Sito collegato ai dati veri
- ✅ Limite dei 2 incarichi Free visibile nel prototipo (regola admin `free_monthly_job_limit_demo`, solo account di prova); per gli account veri resta spento
- ✅ Database: mie_candidature, miei_annunci, annulla_annuncio; cambio orari con nuova accettazione (modifiche_orari, risposte_orari: chi rifiuta perde l'incarico senza penalità né conteggio; dopo i nuovi orari le candidature sovrapposte si ritirano); contestazioni (contestazioni, contesta_incarico, area Admin). Provato su dati di prova
- 🧪 Sito con account vero: annunci veri in bacheca («annuncio vero»), candidatura con controllo del database e finestra «tre candidature» con ritiro, proposte con conto alla rovescia, conferma con avviso spostamenti, rifiuto, ritiro, annullamento, nuovi orari (Accetto / Non posso), completamento, contestazione; per chi pubblica: annuncio salvato nel database, candidati con Seleziona / Rifiuta, risposta in attesa, cambio orari, annullamento; notifiche dal server. Provato nel browser con risposte del database simulate
- ⏳ Prova completa con due account veri dal telefono (serve il sito online o un account reale registrato)

## Aggiornamento 27 novembre 2026 · Google Maps e Apple Mappe
- ✅ Pulsanti «Google Maps» e «Apple Mappe» (senza chiavi né account): nel dettaglio dell'incarico (solo la zona), sotto la mappa della bacheca, negli incarichi confermati («Indicazioni»)
- ✅ Indirizzo preciso salvato a parte (`annunci_indirizzi`): lo vedono solo chi pubblica e chi ha l'incarico confermato (funzioni imposta_indirizzo, indirizzo_incarico)
- ⏳ Accesso con Google: serve il progetto su Google Cloud e la configurazione in Supabase (guida passo passo in chat)
- ⏳ Google Calendar automatico: richiede la verifica dell'app da parte di Google; intanto funzionano «+ Google Calendar» e i file .ics

## Aggiornamento 27 novembre 2026 · JobExpress Trust (ramo `feature/jobexpress-trust`)
- ✅ Database: profilo professionale, dati riservati, verifiche (non modificabili dall'utente), sospensioni, aziende e referenti, segnalazioni, blocchi, assistenza, consensi; trigger che bloccano candidature/annunci/proposte/incarichi senza i requisiti; limiti anti-abuso; bucket privati foto (2 MB) e CV (5 MB). 15 scenari di test superati
- ✅ Sito: Profilo professionale (foto con ritaglio, presentazione, competenze, lingue, esperienze, formazione, disponibilità, CV PDF, completamento), Sicurezza e identità, aziende, anteprima pubblica, segnala/blocca, condivisione CV con la candidatura, finestra «Prima di candidarti/pubblicare», pannello Admin Trust
- 🧪 Verifica dell'identità: solo **simulata** (account di prova) o «simulata» dall'admin per gli account di test
- ⛔ SPID, CIE, eIDAS, provider, verifica assistita, telefono, captcha, biometria: **spenti** (vedi docs/trust/RAPPORTO-IDENTIFICAZIONE.md)
- ⚠️ Con il database Trust attivo gli account veri **non possono candidarsi né pubblicare** finché non sono verificati: è voluto (nessun metodo reale funziona ancora). Per provarli: Admin → Trust → cerca email → «Verifica simulata»
- ⏳ Preventivi aggregatori SPID/CIE e provider senza biometria · DPIA · informativa privacy aggiornata · pulizia dei file nello storage quando si elimina l'account · esportazione dati (portabilità) · cognome nella registrazione
