# JobExpress · Aggiornamento del modello e del business plan (27 novembre 2026)

Questo documento integra la presentazione ufficiale e il business plan (`business-plan/modello.py`).
Prezzi IVA inclusa. Tutto ciò che non è ancora verificato è indicato come ipotesi.

## 1. Visione
JobExpress passa da marketplace di lavoro last minute a **ecosistema di crescita professionale**: ogni incarico costruisce identità professionale, competenze, guadagni monitorati e una reputazione verificabile. Obiettivo di lungo periodo: diventare un riferimento riconosciuto per la qualità e l’affidabilità dei lavoratori («una stella Michelin del lavoro»).

## 2. Abbonamenti
| | Free | Plus | Friends |
|---|---|---|---|
| Prezzo | gratis | 4,99 €/mese · 39,99 €/anno | 9,99 €/mese · 79,99 €/anno **in tre** |
| Candidature | illimitate | illimitate | illimitate |
| Candidature attive nella stessa fascia oraria | max 3 | max 3 | max 3 |
| Incarichi confermati al mese | illimitati (limite sperimentale di 2 **spento**) | illimitati | illimitati |
| Badge a 5 livelli, recensioni, chat, calendario base, storico e compensi | ✓ | ✓ | ✓ |
| Goal, CV, Career, Smart Calendar | — | ✓ | ✓ ognuno |
| JobExpress AI | — | 20 richieste/mese | 20 a testa |

- La pubblicazione degli annunci resta **gratuita** per aziende e privati. Nessuna commissione sul compenso.
- Friends: tre account indipendenti, invito con link o codice; dati personali, economici e professionali **non condivisi**.
- Badge e reputazione **non si comprano**: Plus non dà visibilità né priorità nelle candidature.
- Prezzi, richieste AI, prova gratuita e funzioni premium sono modificabili dall’area Admin senza toccare il codice.

## 3. Valore delle cinque funzioni Plus
1. **Goal** – obiettivi settimanali/mensili/annuali, compensi previsti/maturati/ricevuti distinti, media oraria, ore indicative, grafici e report.
2. **CV** – curriculum che cresce con ogni incarico completato (esperienze verificabili), 3 modelli, PDF, link revocabile: utile anche fuori dalla piattaforma.
3. **Career** – settori, competenze (autodichiarate / associate / verificate), andamento delle recensioni, suggerimenti basati su dati reali.
4. **Smart Calendar** – lavoro, università e tempo libero insieme; fasce libere, sovrapposizioni, spostamenti, esportazione verso Google/Apple.
5. **AI** – colloqui, curriculum, mansioni, crescita, organizzazione economica; non inventa esperienze e non decide le assunzioni.

## 4. Sistema di assegnazione (differenziante)
- **Massimo 3 candidature attive per fascia oraria**, uguale per tutti e non acquistabile: meno candidature «a pioggia», più affidabilità per chi pubblica.
- **Conferma reciproca**: candidatura → selezione → proposta a tempo → conferma del lavoratore → incarico assegnato. Solo dopo la conferma l’incarico è assegnato; le candidature incompatibili si ritirano da sole.
- **Tempi di conferma** in base a quanto manca all’inizio (5 min, 10 min, 30 min, 2 ore), mai oltre l’inizio; scadenza automatica lato server, **senza penalità** per il lavoratore.
- **Controlli nel database** contro doppie assegnazioni e conferme simultanee.
- **Avviso spostamenti** sotto i 30 minuti tra due incarichi (non blocca).
- La conferma digitale **non sostituisce** il contratto né gli adempimenti obbligatori.

## 5. Strategia di conversione Free → Plus
- Tutto ciò che serve per lavorare resta gratuito: la conversione nasce dal **valore** degli strumenti, non da limiti artificiali.
- Momento chiave: dopo il **secondo incarico completato del mese** compare la schermata «Il tuo percorso è appena iniziato!» con i dati reali della persona e i vantaggi di Plus. Nessuna attivazione automatica.
- Prova gratuita di 7 giorni predisposta (spenta), attivabile dall’Admin, sempre con consenso esplicito.
- Friends come leva di passaparola tra studenti (3,33 € a testa al mese).

## 6. Limite sperimentale dei due incarichi (Free)
- Predisposto con interruttore `free_monthly_job_limit_enabled` = **false** in produzione.
- Conteggio per mese solare (Europe/Rome), un annuncio = un incarico anche con più turni, mese del primo turno; non contano rifiuti, ritiri, proposte scadute o non confermate, annullamenti del committente.
- Serve solo a rendere reversibile la scelta: **non** risolve la questione giuridica e non va acceso senza parere di un avvocato del lavoro.

## 7. Criticità giuridiche da verificare
- Inquadramento dell’attività di intermediazione e autorizzazioni (D.Lgs. 276/2003, art. 11 e seguenti).
- Compatibilità del modello in abbonamento con la normativa sul lavoro; limite dei due incarichi.
- Annunci pubblicati da privati (lavoro domestico, colf/badanti): contratti e adempimenti.
- Responsabilità della piattaforma; distinzione tra assegnazione digitale e instaurazione del rapporto di lavoro.
- Privacy (GDPR): dati del CV, calendario personale, conversazioni AI; uso dell’intelligenza artificiale (AI Act).
- Sistema di reputazione e recensioni (correttezza, contestazioni, rimozione).
- Pagamenti reali: partita IVA/forma giuridica prima di attivarli.

## 8. Costi dell’intelligenza artificiale (ipotesi)
- Una richiesta ≈ 1.500 token in entrata e 500 in uscita con un modello economico ≈ **0,004 €** (da verificare sul listino del provider).
- Massimo 20 richieste per account pagante al mese; uso medio ipotizzato 50% → **≈ 0,04 € per account pagante al mese**.
- Nel business plan il costo AI è ora incluso: effetto trascurabile (utile del 3° anno nello scenario intermedio da 12.195 € a 11.886 €; pareggio invariato al mese 20).
- Protezioni: contatore lato server, limiti di lunghezza, stima dei costi nell’area Admin, funzione spegnibile.

## 9. Evoluzione del prodotto
1. Collegare pubblicazione annunci e candidature del sito al database (le regole sono già pronte e provate).
2. Accendere l’AI (chiave del provider) e le notifiche push/email.
3. Sincronizzazione Google Calendar (OAuth), certificazioni verificate, JobExpress Professional Passport.
4. Stripe in modalità test, poi pagamenti reali dopo la verifica legale; apertura a Cesena e poi in Italia.

## 10. Differenziazione rispetto ai concorrenti
- Doppia conferma e limite di 3 candidature per fascia: affidabilità che le bacheche tradizionali non offrono.
- Reputazione e curriculum **verificabili**, non comprabili.
- Strumenti di crescita (Goal, CV, Career, Smart Calendar, AI) pensati per studenti e giovani che conciliano lavoro e studio.
- Nessuna commissione sul compenso e pubblicazione gratuita.
