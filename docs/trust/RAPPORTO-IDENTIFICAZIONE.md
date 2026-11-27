# JobExpress Trust · Rapporto sui metodi di identificazione (SPID, CIE, eIDAS, IT-Wallet, provider)

Data: 27 novembre 2026 · Stato: **nessun metodo è attivo**. Tutti gli interruttori (`spid_enabled`, `cie_enabled`, `eidas_enabled`, `id_provider_enabled`, `alternative_verification_enabled`, `biometric_verification_enabled`) sono **spenti** nel database.

> Questo documento non contiene prezzi inventati. Dove un costo non è pubblicato o non è stato quotato per JobExpress è scritto «da richiedere». Non è un parere legale: prima dell'attivazione serve la verifica di un consulente privacy/legale.

## 1. Il principio: autenticazione ≠ identificazione
- **Autenticazione** (accesso all'account): email + password su Supabase Auth. Resta separata.
- **Identificazione** (chi è la persona): fatta **una volta**, da un soggetto esterno affidabile (gestore SPID, Ministero dell'Interno per la CIE, provider). JobExpress riceve **solo l'esito** e pochi attributi minimi (maggiore età sì/no, un riferimento anonimo per evitare doppioni).
- JobExpress **non** chiede mai credenziali SPID o PIN della CIE, **non** conserva documenti, selfie o dati biometrici, **non** usa il codice fiscale come identificativo (il riferimento del provider viene salvato solo come impronta `sha256`).

## 2. SPID
**Come funziona per un privato.** Un'azienda privata che vuole offrire l'accesso con SPID diventa «fornitore di servizi privato» firmando una convenzione con AgID; AgID ha pubblicato la documentazione per l'ingresso dei fornitori privati sul proprio sito e su spid.gov.it. Il percorso indicato da AgID è: studiare le regole tecniche, implementare l'autenticazione, inviare la convenzione via PEC e andare in produzione dopo la controfirma. Le convenzioni prevedono anche una **tabella dei corrispettivi** (Allegato 4) per fornitori privati e aggregatori privati.

**Diretto o tramite aggregatore.**
| | Fornitore diretto | Tramite aggregatore privato |
|---|---|---|
| Convenzione | JobExpress firma con AgID | la firma l'aggregatore; JobExpress è «aggregato» |
| Lavoro tecnico | metadata SAML/OIDC, certificati, collaudo, manutenzione | integrazione con le API dell'aggregatore |
| Tempi | più lunghi | in genere più brevi |
| Costi | corrispettivi dell'Allegato 4 + sviluppo | listino dell'aggregatore (da richiedere) |
| Adatto a JobExpress oggi | no (struttura troppo piccola) | **sì, consigliato** |

Dal 2022 esiste una convenzione specifica per gli aggregatori di servizi privati (Determinazione AgID n. 71/2022): prima un'impresa doveva convenzionarsi con AgID e integrarsi con ogni gestore. Gli aggregatori servono proprio ai fornitori che non ritengono conveniente costruire in casa l'infrastruttura SPID; un'azienda può essere solo aggregatore (non aggregato pubblico).

**Requisiti amministrativi per JobExpress (da verificare con l'aggregatore scelto):** società o impresa iscritta al Registro delle imprese, PEC, firma digitale del legale rappresentante, referente tecnico e amministrativo, informativa privacy aggiornata, elenco dei servizi da comunicare ad AgID.

**Costi:** corrispettivi AgID (Allegato 4) e listini degli aggregatori → **da richiedere**. Nel business plan il costo per verifica è 0 nello scenario base, con una tabella di sensibilità separata.

## 3. CIE («Entra con CIE»)
- Il Ministero dell'Interno è il gestore dell'identità digitale CIE: per offrire «Entra con CIE» bisogna **federarsi** con il Ministero tramite il portale di federazione (onboarding con scambio di metadata, ambiente di pre-produzione e produzione). Le regole sono nel Decreto 8 settembre 2022 e nel Manuale operativo per i fornitori di servizi.
- Riusa paradigmi e protocolli simili a SPID (SAML e OpenID Connect): chi integra uno dei due fa prima con l'altro. Anche per la CIE esistono soggetti che agevolano l'ingresso di fornitori privati.
- Vantaggio citato da AgID: il fornitore che usa CIE (come con SPID) è sollevato dalla responsabilità della verifica dell'identità di chi si autentica.
- PIN e lettura del chip avvengono **solo** sull'app CieID o sul sito del Ministero, mai su JobExpress.
- Costi: **da verificare** sul Manuale operativo e con l'eventuale intermediario.

## 4. eIDAS e IT-Wallet / EUDI Wallet (persone straniere)
- I cittadini UE con un'identità digitale notificata possono usare il nodo eIDAS (il nodo italiano è gestito nell'ambito SPID/CIE). Utile per lavoratori europei.
- **IT-Wallet** (italiano) ed **EUDI Wallet** (europeo): AgID ha adottato a ottobre 2026 il regolamento per la registrazione dei soggetti pubblici e privati al Sistema IT-Wallet; il wallet europeo è previsto in arrivo e le piattaforme private dovranno accettarlo dal 2027 (da verificare sulla norma). È la via più promettente a medio termine perché permette di chiedere **solo l'attributo «maggiorenne»** senza ricevere altri dati.
- Per chi non ha nessuno di questi strumenti (es. persone extra-UE): provider documentale o **verifica assistita** (vedi §6).

## 5. Provider privati di verifica documentale
| Provider | Prezzo pubblicato | Note |
|---|---|---|
| Stripe Identity | sul sito britannico: £1,25 per verifica documento + selfie; prime 50 gratis | Usa **confronto biometrico selfie/documento**: con `biometric_verification_enabled=false` non è utilizzabile così com'è. Disponibilità per aziende italiane **da verificare**. Conserva i dati per conto del cliente. |
| Veriff, Sumsub, Persona, Onfido/Entrust | **non verificati in questo rapporto** (in genere su preventivo) | Da richiedere: prezzo per verifica, sede dei dati (UE), DPA art. 28, possibilità di verifica **senza biometria**, conservazione. |

**Regola per JobExpress:** un provider è accettabile solo se (1) restituisce l'esito senza consegnarci immagini, (2) offre una modalità senza biometria oppure la biometria resta in capo a lui con base giuridica valutata in una DPIA, (3) tratta i dati nell'UE o con garanzie adeguate, (4) firma un DPA.

## 6. Verifica alternativa non biometrica (assistita)
Per chi non ha SPID/CIE/eIDAS: richiesta all'assistenza (già presente: «Non ho SPID né CIE»), videochiamata o incontro con un operatore che **guarda** il documento senza copiarlo, poi l'admin registra l'esito con motivo nel registro. Va attivata solo dopo procedura scritta, formazione e parere legale (`alternative_verification_enabled`).

## 7. Compatibilità con Supabase e con l'app
- Supabase Auth resta per l'accesso. L'identificazione passa da una **Edge Function** (da scrivere quando si sceglie il fornitore) che fa da *service provider* SAML/OIDC oppure riceve il webhook del provider, controlla la firma e chiama `registra_verifica()` con la chiave di servizio. **Già pronti nel database:** `registra_verifica` (solo service role), controllo doppioni con impronta `sha256(provider:riferimento)`, blocco minorenni, revisione manuale.
- I segreti (certificati, chiavi del provider) stanno **solo** nei secrets delle Edge Functions, mai nel repository.
- App mobile futura: stesso flusso via browser di sistema (ASWebAuthenticationSession / Custom Tabs) con ritorno tramite deep link; CieID ha la sua app per la lettura del chip.

## 8. Raccomandazione
1. **Ora:** lasciare tutto spento; usare solo verifiche **simulate** per gli account di test (già fatto, etichetta «simulata»).
2. **Prossimo passo:** chiedere preventivi a 2–3 aggregatori privati SPID/CIE e a 2 provider con modalità non biometrica; far valutare la DPIA.
3. **Attivazione:** un metodo alla volta, con interruttore dall'area Admin, dopo test in pre-produzione.
4. **Medio periodo:** IT-Wallet/EUDI per l'attributo «maggiorenne» con il minimo dei dati.

Fonti principali: agid.gov.it (SPID, convenzioni, aggregatori, IT-Wallet), docs.italia.it e federazione.servizicie.interno.gov.it (CIE), stripe.com/identity.
