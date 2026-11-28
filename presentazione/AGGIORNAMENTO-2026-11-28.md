# JobExpress · Aggiornamento operativo, sicurezza e reputazione reciproca (28 novembre 2026)

Integra la presentazione ufficiale, il business plan (`business-plan/modello.py`) e l'aggiornamento del 27/11.
Ciò che non è verificato è indicato come ipotesi. **«Pronto e testato»** = funziona nel database con account veri ed è stato provato con utenti di test; non ancora con persone reali.

## 1. Cosa è cambiato nel prodotto
| Area | Cosa c'è | Stato |
|---|---|---|
| Assegnazioni | Un posto = una persona; annunci con più posti; versioni delle condizioni con storico; modifica proposta che si può accettare, rifiutare (resta l'originale) o chiarire; adempimenti dichiarati dal committente | Pronto e testato |
| Annullamenti | Quattro fasce (oltre 24 h, 6–24 h, 1–6 h, meno di 1 h) con motivo; **nessuna penalità automatica** | Pronto e testato |
| Mancata presentazione | Segnalata dal committente, la persona dà la sua versione, decide il team con motivazione; non è pubblica | Pronto e testato |
| JobExpress Live | Disponibilità dichiarata (zona, raggio, orari, mansioni), massimo 24 h, si spegne da sola; nessun GPS | Pronto e testato |
| Proposta diretta | L'azienda propone a chi è in Live; diventa incarico solo con l'accettazione; massimo 20 al giorno | Pronto e testato |
| JobExpress Rescue | Posto scoperto → avvisi a gruppi (candidati, Live, chi accetta urgenze); bonus urgenza scelto dall'azienda; massimo 5 avvisi al giorno a persona | Pronto e testato |
| JobExpress Safe | Centro sicurezza con 112, consigli, segnalazioni con priorità e allegati protetti, blocchi; condivisione dell'incarico con una persona di fiducia (link temporaneo, indirizzo solo se scelto) | Pronto e testato |
| Safe avanzato | Contatti di fiducia registrati, avvisi automatici | **Spento e bloccato** (serve parere legale) |
| Recensioni reciproche | Doppio cieco nel database, 14 giorni, pubblicazione simultanea o a scadenza, risposta, rimozione solo motivata; «nuovo» ≠ «negativo»; nessun badge aziendale | Pronto e testato |
| Business | Panoramica, calendario giorno/settimana/mese, modelli, duplicazione, ricorrenze **da confermare**, archivio collaborazioni solo con fatti | Pronto e testato |
| Business Pro | Sedi, referenti, ruoli | Predisposto, **spento**, nessun prezzo |
| Admin | Live/Rescue, annullamenti e mancate presentazioni, Safe, recensioni, contestazioni, notifiche, processi programmati, interruttori (funzioni escluse bloccate anche nel database) | Pronto e testato |

Invariati: abbonamenti Free / Plus 4,99 € al mese o 39,99 € all'anno / Friends 9,99 € al mese o 79,99 € all'anno; pubblicazione gratuita; limite dei 2 incarichi Free **spento**; 3 candidature sovrapposte; conferma reciproca; avviso spostamenti a 30 minuti; AI 20 richieste al mese; Trust e badge a 5 livelli per chi lavora. Live, Rescue e Safe sono **gratuiti e senza priorità per chi paga**.

## 2. Costi tecnici (listini del 28/11/2026)
| Utenti | 300 | 1.000 | 5.000 | 10.000 |
|---|---|---|---|---|
| Totale al mese | ≈ 31 € | ≈ 31 € | ≈ 53 € | ≈ 54 € |

Dettaglio, ipotesi e fonti: `business-plan/costi_infrastruttura.py`, `business-plan/costi_infrastruttura.json`, `../docs/fase5/COSTI.md`.
**Effetto sul business plan:** il modello del 27/11 stimava la tecnologia in 40/60/120 € al mese (scenario prudente, anni 1–3). I listini reali danno **31–54 €**, quindi le stime erano prudenti e restano valide. Il pareggio dipende dai costi professionali e dalla conversione (ipotesi del 2% / 3,5% / 5%).

## 3. Aspetti legali (sintesi)
- **D.Lgs. 208/2026** (lavoro mediante piattaforme digitali) in vigore dal **2 dicembre 2026**: va verificato con un giuslavorista se JobExpress rientra nella definizione. Il prodotto non prende decisioni automatiche sulle persone e non ordina per foto o abbonamento.
- **D.Lgs. 276/2003** (intermediazione e art. 11): pareri necessari prima di incassare abbonamenti.
- **Recensioni:** coerenti con il Codice del consumo dopo la direttiva Omnibus (solo chi ha completato l'incarico); serve una pagina pubblica che lo spieghi.
- **Privacy:** serve la DPIA prima del lancio; informativa da aggiornare con Safe, segnalazioni, recensioni, Live.
- Documento completo: `../docs/fase5/ANALISI-LEGALE-PRIVACY.md`.

## 4. Presentazione
Slide aggiornate in `slide/`: nuove **operativo** (Live, Rescue, Business) e **costi** (quanto costa crescere); aggiornate **fiducia**, **legale**, **app-stato** e **roadmap**. L'ordine è in `slide/deck.json`.
Per portarle nella presentazione online (artifact `WZpcGyMTDE5zTkiY73AREb`): aprire una chat dalla pagina della presentazione e chiedere di caricare questi file.

## 5. Ipotesi nuove da validare
- Uso medio: 60% di utenti attivi al mese, circa 40 MB di traffico ciascuno, 0,6 MB di file.
- Le aziende useranno Rescue e i modelli (da misurare nel pilota).
- Le persone accetteranno di dichiarare la disponibilità Live (da misurare).
- Percentuale di incarichi recensiti (obiettivo indicativo: almeno la metà).
