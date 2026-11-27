# JobExpress Trust · Documentazione privacy (GDPR) — bozza tecnica

Non è un parere legale. Serve a preparare il lavoro del consulente e la DPIA. Titolare: JobExpress (Alessandra Mihai, Forlì).

## 1. Principi (art. 5) e privacy by design (art. 25)
- **Minimizzazione:** dal processo di identificazione arrivano solo esito, metodo, maggiore età sì/no, impronta anonima anti-doppioni. Niente documenti, selfie, PIN, credenziali, template biometrici, codice fiscale come identificativo.
- **Limitazione della finalità:** la foto serve a riconoscersi all'arrivo sul posto di lavoro; **non** si usa per ordinare, filtrare o valutare. Nessuna AI sulla foto.
- **Visibilità predefinita ridotta:** gli altri vedono nome + iniziale del cognome; telefono, email, data di nascita, CV mai pubblici; chi non è registrato non vede i profili.
- **Esattezza:** cognome e data di nascita si bloccano dopo la verifica (si correggono solo tramite assistenza).

## 2. Registro dei trattamenti (sintesi)
| Dato | Finalità | Base giuridica (art. 6) | Chi lo vede | Conservazione (proposta) |
|---|---|---|---|---|
| Nome, cognome, città, profilo professionale | far incontrare lavoratori e committenti | contratto (b) | utenti registrati (campi scelti) | finché c'è l'account |
| Foto del volto / logo | riconoscimento all'incarico, riduzione profili falsi | contratto (b) + legittimo interesse (f) | utenti registrati (o solo chi seleziona) | finché c'è l'account; sostituzioni: vecchio file cancellato subito |
| CV PDF | candidature | contratto (b) | titolare + committente scelto | fino a cancellazione |
| Data di nascita, telefono | età minima, contatto | obbligo/contratto (b,c) | solo titolare | finché c'è l'account |
| Esito verifica identità | sicurezza della piattaforma | legittimo interesse (f) / contratto | titolare, admin | fino a cancellazione account + periodo per contestazioni (da definire) |
| Impronta anti-doppioni | evitare account multipli | legittimo interesse (f) | nessuno (solo confronto) | come sopra |
| Segnalazioni, blocchi, sospensioni | sicurezza | legittimo interesse (f) | admin | da definire (es. 24 mesi) |
| Consensi informative | prova del consenso | obbligo (c) | admin | durata account + prescrizione |

**Art. 9 (dati particolari):** la foto **non** è trattata come dato biometrico perché non c'è trattamento tecnico specifico per identificare univocamente la persona (nessun riconoscimento facciale). Se un giorno si attivasse la biometria (`biometric_verification_enabled`), servirebbe una base dell'art. 9 (consenso esplicito), DPIA e alternativa senza biometria.

## 3. Informative (art. 13–14)
Da aggiornare in `privacy.html` prima di attivare un metodo reale: nuove finalità (foto, CV, verifica), destinatari (gestore SPID/Ministero/provider come autonomi titolari o responsabili), conservazione, diritti, nessuna decisione basata unicamente su trattamento automatizzato. Tabella `consensi_informative` + funzione `registra_consenso()` già pronte.

## 4. Decisioni automatizzate (art. 22)
Il blocco «prima di candidarti serve la verifica» è una regola di accesso trasparente, non una valutazione della persona. Esiti negativi o dubbi (doppioni, minorenni) vanno in **revisione manuale** e l'utente può contestare dall'assistenza.

## 5. Responsabili (art. 28) e trasferimenti (art. 44 ss.)
- Supabase (database, storage): verificare regione UE del progetto e DPA.
- Provider di identificazione / aggregatore: DPA obbligatorio, dati nell'UE o garanzie adeguate (SCC).
- Fornitore AI: nessun dato Trust (foto, documenti, data di nascita, telefono) viene inviato all'AI.

## 6. Sicurezza (art. 32)
RLS su tutte le tabelle; `verifiche` senza permessi di scrittura per gli utenti; bucket **privati** con link firmati a scadenza (5–10 min); percorsi file vincolati alla cartella dell'utente; foto ricodificate sul dispositivo (via EXIF/GPS); limiti di frequenza su candidature, annunci e segnalazioni; funzioni `SECURITY DEFINER` con `search_path` vuoto; registro admin delle azioni; nessun dato sensibile nei log applicativi.

## 7. Violazioni (art. 33–34)
Procedura: individuare e contenere, valutare il rischio, notifica al Garante entro 72 ore se c'è rischio, comunicazione agli interessati se rischio elevato, annotazione nel registro delle violazioni. Referente: titolare.

## 8. DPIA (art. 35)
**Consigliata prima di attivare** un qualsiasi metodo reale di identificazione: trattamento su larga scala potenziale, profili lavorativi, verifica dell'identità, possibili utenti vulnerabili. Punti da valutare: necessità della foto obbligatoria, alternativa per chi non può caricarla, rischio di discriminazione (mitigato: foto non usata per ranking), esattezza delle verifiche, durata di conservazione.

## 9. Diritti degli interessati
Accesso, rettifica (tramite assistenza per dati bloccati), cancellazione (`elimina_mio_account` cancella profilo, foto, CV in cascata — da verificare la pulizia dei file nello storage), opposizione, portabilità (da implementare: esportazione JSON del profilo).
