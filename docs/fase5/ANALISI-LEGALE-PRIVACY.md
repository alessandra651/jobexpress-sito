# JobExpress · Analisi legale e privacy (Fase 5, 28 novembre 2026)

> **Importante.** Questa è un'analisi tecnica preparata per orientare il lavoro con i professionisti. **Non è un parere legale** e non sostituisce un avvocato giuslavorista, un consulente del lavoro e un consulente privacy (DPO). Le norme sono state controllate il 28/11/2026. Indico come **«da verificare»** tutto ciò che richiede un parere.

## 0. In una frase
Il prodotto è costruito in modo prudente (nessuna penalità automatica, nessuna biometria, nessun GPS, verifiche simulate segnate come tali, doppio cieco nelle recensioni), ma **prima di far lavorare persone vere servono tre pareri**: inquadramento come intermediazione o piattaforma di lavoro (D.Lgs. 276/2003 e D.Lgs. 208/2026), abbonamenti venduti ai lavoratori (art. 11 D.Lgs. 276/2003), e privacy (DPIA). Fino ad allora l'intermediazione operativa resta **solo in test**, come già previsto.

## 1. Norme che riguardano JobExpress

| Area | Norma | Perché conta | Stato in JobExpress |
|---|---|---|---|
| Intermediazione tra domanda e offerta di lavoro | D.Lgs. 276/2003 (artt. 2, 4, 6) | Se JobExpress «intermedia» servono autorizzazione o un regime particolare | **Da verificare.** Oggi solo test, nessun lavoro reale |
| Divieto di oneri a carico dei lavoratori | D.Lgs. 276/2003, art. 11 | Gli abbonamenti Plus/Friends sono pagati da chi lavora: va escluso che siano un «onere» per accedere al lavoro | Tutto ciò che serve per lavorare è gratuito; Plus non dà priorità. **Serve parere** prima di incassare |
| Lavoro mediante piattaforme digitali | D.Lgs. 208/2026 (dir. UE 2024/2831), in vigore dal 2/12/2026 | Obblighi di trasparenza sugli algoritmi, supervisione umana, informazione, comunicazioni al SIISL, divieto di ritorsioni | Nessuna decisione automatica sulle persone; ordinamento non basato su foto o abbonamento. **Da verificare** se JobExpress rientra nella definizione |
| Privacy | GDPR (Reg. UE 2016/679) e Codice privacy | Dati di lavoratori e committenti, foto, CV, segnalazioni, recensioni | Minimizzazione, bucket privati, link firmati, nessun documento d'identità conservato. **Serve DPIA** |
| Intelligenza artificiale | AI Act (Reg. UE 2024/1689) e norme nazionali di adeguamento | I sistemi IA usati per selezionare o valutare lavoratori sono ad alto rischio | JobExpress AI aiuta solo la persona (CV, colloqui) e **non** classifica né sceglie candidati |
| Recensioni | Codice del consumo (D.Lgs. 206/2005) come modificato dal D.Lgs. 26/2023 (direttiva Omnibus) | Recensioni false, solo positive o presentate come «verificate» senza esserlo sono pratiche scorrette | Solo chi ha completato l'incarico può recensire; doppio cieco; nessuna rimozione dei voti bassi; regole pubbliche |
| Servizi digitali | Reg. UE 2022/2065 (DSA) | Segnalazioni di contenuti, motivazione delle rimozioni, punto di contatto | Segnalazioni, esito motivato, contestazione dell'esito. **Da verificare** obblighi per micro-imprese |
| Sicurezza sul lavoro | D.Lgs. 81/2008 | Responsabilità del datore di lavoro, non della piattaforma | Campo «informazioni di sicurezza» nell'annuncio; nessuna garanzia promessa |
| Contratti e adempimenti | Norme su contratti di lavoro, prestazioni occasionali (art. 54-bis D.L. 50/2017), Libretto Famiglia | La conferma su JobExpress **non è** un contratto | Avviso esplicito; il committente dichiara gli adempimenti, JobExpress non li verifica |

## 2. Funzione per funzione

### Assegnazioni, annullamenti, mancate presentazioni (Fase 1)
- **Bene:** conferma reciproca, versioni delle condizioni con storico, rifiuto della modifica senza perdere l'incarico, annullamenti per fasce **senza penalità automatiche**, mancata presentazione decisa da una persona dopo aver sentito entrambe le parti.
- **Rischio:** se un domani le fasce o le mancate presentazioni influenzassero la visibilità, diventerebbe una decisione automatica sulle persone (GDPR art. 22, D.Lgs. 208/2026). Oggi l'interruttore `automatic_reputation_penalties_enabled` è spento **e bloccato nel database**.
- **Da fare:** spiegare nelle condizioni d'uso cosa succede quando si annulla o non ci si presenta (nessuna penalità, possibile intervento del team).

### Live, proposte dirette, Rescue (Fase 2)
- **Bene:** la disponibilità è dichiarata dalla persona (zona e raggio, **nessun GPS**), si spegne da sola, il bonus urgenza è scelto dal committente, Rescue avvisa a gruppi senza priorità per chi paga.
- **Rischio:** l'ordine degli avvisi Rescue (prima i candidati, poi chi è in Live, poi chi accetta urgenze) è una logica automatica: andrà **descritto in chiaro** (trasparenza D.Lgs. 208/2026).
- **Da fare:** pagina «Come funzionano Live e Rescue» con i criteri; limite di avvisi al giorno già presente (5).

### Safe e recensioni (Fase 3)
- **Condivisione dell'incarico:** link temporaneo e revocabile, l'indirizzo solo se scelto, pagina non indicizzata. La persona che riceve il link non è un utente: **i dati che vede vanno citati nell'informativa** (destinatari scelti dall'interessato).
- **Segnalazioni:** riservate, con priorità, allegati in un archivio privato (visibili solo a chi segnala e agli amministratori, link di 2 minuti). Contengono possibili **dati delicati** (molestie, discriminazione): conservazione limitata da definire (es. 24 mesi dopo la chiusura) e accesso solo al personale autorizzato.
- **Contatti di fiducia e avvisi automatici:** **non attivi** (bloccati). Prima di accenderli servono base giuridica per i dati del contatto, consenso, e un parere sulla responsabilità se un avviso non parte.
- **Recensioni:** doppio cieco nel database, pubblicazione simultanea o a 14 giorni, replica, rimozione solo motivata e registrata, «nuovo» distinto da «negativo», **nessun badge aziendale**. Conformi allo spirito della disciplina Omnibus: va **pubblicata una pagina** che spieghi chi può recensire e come si verifica (requisito informativo del Codice del consumo).
- **Mai** promettere che la verifica garantisce sicurezza o assenza di precedenti: i testi del sito già lo dicono.

### Business (Fase 4)
- **Panoramica:** i compensi sono una **stima** dichiarata (non contributi, tasse o costo del lavoro).
- **Archivio collaborazioni:** solo fatti (incarichi svolti insieme), **nessuna nota privata o voto nascosto** sulle persone: evita schedature (art. 8 Statuto dei lavoratori e art. 10 D.Lgs. 276/2003 vietano indagini e trattamenti di dati non pertinenti).
- **Annunci ricorrenti:** non si pubblicano mai da soli.
- **Business Pro** (sedi, referenti, ruoli): spento, senza prezzo. Prima di attivarlo: accordo sul trattamento dei dati tra azienda e JobExpress (chi è titolare e chi responsabile).

## 3. Privacy: cosa trattiamo e come

| Dato | Dove | Chi lo vede | Protezione | Conservazione (da definire nella DPIA) |
|---|---|---|---|---|
| Nome, città, ruolo | `profili` | Utenti registrati (nome + iniziale) | RLS | Fino alla cancellazione dell'account |
| Email, telefono, data di nascita | Auth, `dati_riservati` | Solo la persona | RLS | Idem |
| Foto del volto | Bucket privato | Utenti registrati, se la persona lo consente | Link firmati, nessun riconoscimento facciale | Idem |
| CV PDF | Bucket privato | Solo il committente scelto | Link firmati, revocabile | Idem |
| Verifica d'identità | `verifiche` | Persona e admin | Nessun documento né selfie conservato; simulata solo nei test | Esito, non documenti |
| Incarichi, condizioni, annullamenti | Tabelle incarichi | Le due parti | RLS | Obblighi civilistici e fiscali (es. 10 anni per documenti contabili, da verificare) |
| Segnalazioni e allegati | `segnalazioni_utenti`, bucket privato | Chi segnala e admin | RLS, nessun accesso del segnalato | Breve, da definire |
| Recensioni | `recensioni` | Pubbliche solo dopo la pubblicazione | Doppio cieco nel database | Finché l'account esiste, salvo rimozione |
| Disponibilità Live | `disponibilita_live` | Committenti verificati, solo zona dichiarata | Nessun GPS, scade da sola | Breve |
| Link di condivisione | `condivisioni_incarico` | Chi ha il link | Scade 2 ore dopo la fine, revocabile | Breve |
| Conversazioni AI | `ai_conversazioni` | Solo la persona | Limite 20/mese, nessun uso per selezione | Da definire |

**Cosa manca prima del lancio**
1. **DPIA** (valutazione d'impatto): obbligatoria per probabile monitoraggio sistematico, dati su larga scala di lavoratori e uso di valutazioni (recensioni).
2. **Informativa privacy** aggiornata con: condivisione Safe, segnalazioni e allegati, recensioni, Live, archivio collaborazioni, processi automatici (Rescue), tempi di conservazione.
3. **Registro dei trattamenti** e nomina dei responsabili esterni (Supabase, hosting, provider AI, futuro provider SPID/CIE).
4. **Trasferimenti extra-UE:** verificare dove sono i server del progetto Supabase e del provider AI (clausole contrattuali standard o Data Privacy Framework).
5. **Diritti degli interessati:** l'eliminazione dell'account esiste; serve anche **l'esportazione dei dati** (portabilità).
6. **Cancellazione automatica** di segnalazioni chiuse, link scaduti, disponibilità passate dopo il periodo stabilito.

## 4. Cose che il progetto ha già escluso (e restano escluse)
- Biometria, riconoscimento facciale, liveness, deduzioni dal volto, ordinamento per foto.
- Conservazione di documenti d'identità, selfie, credenziali SPID o PIN CIE.
- Codice fiscale come identificatore.
- Penalità reputazionali automatiche; badge per le aziende; «JobExpress Excellence».
- Priorità a pagamento in Live, Rescue o Safe.
- Tracciamento GPS.
- Account di minorenni.

Le prime tre righe sono **bloccate anche nel database** (gli interruttori non si accendono dal pannello).

## 5. Elenco per i professionisti (domande da portare)
**Avvocato giuslavorista**
1. JobExpress svolge «intermediazione» ai sensi del D.Lgs. 276/2003? Serve un'autorizzazione o basta un modello da bacheca?
2. Rientra nella definizione di «piattaforma di lavoro digitale» del D.Lgs. 208/2026? Quali obblighi scattano (informazione, SIISL, supervisione umana)?
3. Gli abbonamenti Plus/Friends pagati dai lavoratori sono compatibili con l'art. 11 del D.Lgs. 276/2003, visto che per lavorare non servono?
4. Responsabilità della piattaforma per annunci irregolari (lavoro in nero, mancato pagamento) e per i lavori domestici pubblicati da privati.
5. Il bonus urgenza pagato dal committente: come va trattato (retribuzione, rimborso)?

**Consulente privacy / DPO**
1. DPIA e basi giuridiche (contratto, legittimo interesse, consenso) per ogni trattamento della tabella.
2. Tempi di conservazione di segnalazioni, allegati, recensioni, conversazioni AI.
3. Condivisione Safe con persone non registrate: informativa e limiti.
4. Trasferimenti extra-UE dei fornitori.

**Consulente del lavoro / commercialista**
1. Forma giuridica prima di incassare abbonamenti (partita IVA, regime).
2. Testi standard per ricordare ai committenti gli adempimenti (comunicazioni obbligatorie, prestazioni occasionali, Libretto Famiglia).

## 6. Fonti consultate (28/11/2026)
- D.Lgs. 2 novembre 2026, n. 208 (G.U. n. 266 del 14/11/2026), in vigore dal 2/12/2026 — Ministero del Lavoro: https://lavoro.gov.it/notizie/pagine/lavoro-su-piattaforme-recepita-la-direttiva-ue
- D.Lgs. 276/2003 — Normattiva: https://www.normattiva.it/eli/id/2003/10/09//003G0297/CONSOLIDATED
- Codice del consumo e recensioni (D.Lgs. 26/2023, art. 23) — AGCM, schema di linee guida: https://www.agcm.it/dotcmsdoc/consultazioni/Schema_Linee_guida_recensioni_online.pdf
- Fonti già raccolte in precedenza: `presentazione/FONTI.md`
