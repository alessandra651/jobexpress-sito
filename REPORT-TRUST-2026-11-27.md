# Report finale · JobExpress Trust (27 novembre 2026)

Ramo GitHub: `feature/jobexpress-trust` (non ancora unito a `main`).

## Fatto e funzionante
| Area | Stato |
|---|---|
| Database Trust (tabelle, RLS, trigger, storage privati, funzioni utente/admin/server) | ✅ applicato su Supabase, 15 scenari di test superati |
| Verifica progressiva lato server (`TRUST:` motivi) | ✅ |
| Profilo professionale + completamento | ✅ |
| Foto obbligatoria (ritaglio, ricompressione senza EXIF, formato/peso, sostituzione, segnalazione, revisione admin) | ✅ |
| CV PDF gratuito privato (controllo `%PDF-`, 5 MB, apri/sostituisci/elimina, condivisione per candidatura) | ✅ |
| Sicurezza e identità (stato, contatti, identità, accesso, privacy + anteprima, assistenza) | ✅ |
| Aziende con più referenti, privati | ✅ (verifica azienda solo simulata) |
| Segnalazioni, blocchi, sospensioni, limiti anti-abuso | ✅ |
| Badge di verifica separati dai badge professionali | ✅ |
| Età minima 18, account minorenni spenti | ✅ |
| Pannello Admin Trust + interruttori | ✅ |
| Documentazione: identificazione, GDPR, architettura | ✅ `docs/trust/` |
| Business plan + presentazione | ✅ costo identificazione 0 € nello scenario base + sensibilità |
| 12 screenshot JPEG (dati sintetici) | ✅ `presentazione/screenshot/2026-11-27-trust/` |

## Solo interfaccia o simulato (NON operativo)
- SPID, CIE, eIDAS, provider documentale, verifica assistita: schede «Non ancora attivo».
- Verifica telefono via SMS, captcha: spenti.
- Verifiche dell'identità: **simulate** (etichetta «simulata»). Non sono identificazioni reali.
- JobExpress Passport: solo architettura.

## Regole di sicurezza rispettate
Nessun documento, selfie, PIN, credenziale o template biometrico salvato · nessun riconoscimento facciale né AI sulle foto · foto mai usata per ordinare · nessuna auto-verifica possibile · codice fiscale non usato · nessun segreto nel repository · nessuna modifica distruttiva al database · nessun prezzo inventato.

## Attenzione
Gli account veri ora non possono candidarsi o pubblicare finché non vengono verificati: per i test usa Admin → Trust → «Verifica simulata».

## Prossimi passi consigliati
1. Preventivi da 2–3 aggregatori SPID/CIE e da provider con verifica non biometrica.
2. DPIA e informativa privacy con un consulente.
3. Unire il ramo a `main` quando sei d'accordo.
4. Pulizia dei file (foto/CV) quando un account viene eliminato; esportazione dei dati.
