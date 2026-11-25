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
