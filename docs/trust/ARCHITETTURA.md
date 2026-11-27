# JobExpress Trust · Architettura

## Verifica progressiva
| Fase | Cosa può fare l'utente | Cosa serve |
|---|---|---|
| 1. Registrazione | creare l'account | email, password, conferma 18 anni, accettazione termini |
| 2. Contatti | — | email confermata (telefono: quando `phone_verification_enabled`) |
| 3. Esplorazione | vedere bacheca, salvare, completare il profilo | niente altro |
| 4. Operatività | candidarsi, pubblicare, selezionare, confermare | identità verificata + foto (aziende: azienda e referente verificati) |

Il controllo vero è **nel database**: trigger `BEFORE INSERT` su `candidature`, `annunci`, `proposte`, `incarichi` chiamano `_controlla_trust()`, che solleva `TRUST:<motivi>` (`sospeso, eta, email, telefono, identita, foto, azienda, troppe_richieste, bloccato`). Il sito legge il messaggio e mostra la finestra «Prima di candidarti / pubblicare» con il pulsante «Completa ora».

## Tabelle
`profili_professionali` · `dati_riservati` · `verifiche` (sola lettura per l'utente) · `sospensioni` · `aziende` · `referenti_aziendali` · `segnalazioni_utenti` · `blocchi` · `richieste_assistenza` · `consensi_informative` · colonna `candidature.cv_condiviso`.

## Stati della verifica
`non_iniziata → in_corso → in_attesa → verificata | non_riuscita | revisione_manuale`, poi eventualmente `da_aggiornare` o `revocata`. Le verifiche fatte dall'admin per i test hanno `simulata = true` e compaiono come «Identità verificata · simulata».

Stati della foto: `assente → caricata → (segnalata) in_revisione → caricata | da_sostituire`. Lo stato `verificata` della foto è previsto ma **nessuna funzione lo imposta** (servirebbe un confronto che oggi non facciamo).

## Badge
I **badge di verifica** (contatti, identità, foto, azienda, qualifica) sono separati dai **badge professionali** (livelli di reputazione) e non si comprano.

## Storage
- `foto-profilo`: privato, 2 MB, JPEG/PNG/WebP, lettura per utenti autenticati, scrittura solo nella propria cartella.
- `curriculum`: privato, 5 MB, PDF; lettura del titolare o del committente dell'annuncio a cui il candidato l'ha condiviso. Apertura sempre con link firmato breve.

## Funzioni
Utente: `mio_trust, profilo_pubblico, condividi_cv, crea_azienda, aggiungi_referente, mie_aziende, segnala_utente, blocca_utente, richiedi_assistenza, registra_consenso, cv_candidatura`.
Server (chiave di servizio): `registra_verifica` (doppioni → revisione manuale; minorenne → non riuscita).
Admin: `admin_trust, admin_cerca_utente, admin_simula_verifica, admin_revoca_verifica, admin_revisione_foto, admin_gestisci_segnalazione, admin_sospendi, admin_riattiva, admin_rispondi_assistenza`.

## Anti-bot e abusi
Limiti per ora/giorno (`limite_candidature_ora=20`, `limite_annunci_giorno=10`, `limite_segnalazioni_giorno=10`), blocchi tra utenti, sospensione cautelativa, impronta anti-doppioni. Captcha previsto ma spento (`captcha_enabled`) finché non si sceglie un fornitore conforme al GDPR.

## Interruttori (tabella `impostazioni`, modificabili dall'admin)
`identity_verification_required, identity_verification_stage, minimum_user_age=18, minor_accounts_enabled=false, profile_photo_required, profile_photo_visibility, cv_upload_enabled, cv_required=false, cv_max_mb, email_verification_required, phone_verification_enabled, captcha_enabled, spid_enabled, cie_enabled, eidas_enabled, id_provider_enabled, alternative_verification_enabled, biometric_verification_enabled, company_verification_required, professional_passport_enabled, verifiche_simulate_consentite`.

## JobExpress Passport (solo architettura, non attivo)
Documento portabile che l'utente potrà condividere fuori da JobExpress: identità verificata (sì/no, metodo), incarichi completati, badge, competenze verificate. Formato previsto: credenziale verificabile firmata (W3C VC / compatibile EUDI Wallet), con divulgazione selettiva e revoca. Interruttore `professional_passport_enabled=false`. Nessun dato nuovo da raccogliere: usa ciò che c'è già.

## Test eseguiti (27/11/2026)
Database (tutto annullato a fine test): privato non verificato bloccato; requisiti con email non confermata; foto in cartella altrui bloccata; auto-verifica foto e identità bloccate; verifica simulata admin; cognome bloccato dopo verifica; candidatura bloccata senza verifica; verifica da provider + doppione in revisione manuale + minorenne rifiutato; candidatura senza CV consentita; utente bloccato; profilo pubblico senza email/data di nascita; segnalazione foto → revisione admin → foto da sostituire blocca le candidature; sospensione nasconde il profilo; azienda non verificata non pubblica, dopo verifica sì; isolamento CV, dati riservati e verifiche; contatori admin.
Sito (Playwright): blocco e finestra Trust con account di prova; caricamento foto con ritaglio; profilo, esperienze, CV PDF (controllo `%PDF-`); verifica simulata e candidatura consentita; anteprima pubblica; pannello admin prova e reale (dati simulati); errore `TRUST:` dal server tradotto nella finestra; chiamate storage e REST corrette.
