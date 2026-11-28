# JobExpress · Costi per 300 / 1.000 / 5.000 / 10.000 utenti (28 novembre 2026)

Calcolo: `presentazione/business-plan/costi_infrastruttura.py` (risultato in `costi_infrastruttura.json`).
**Prezzi:** solo listini pubblici consultati oggi. **Uso:** ipotesi scritte nel file e modificabili. **Cambio:** 1 € = 1,1734 $ (ultimo cambio BCE trovato, 3/10/2025: da aggiornare).

## 1. Costi tecnici al mese

| Utenti registrati | 300 | 1.000 | 5.000 | 10.000 |
|---|---|---|---|---|
| Attivi nel mese (60%) | 180 | 600 | 3.000 | 6.000 |
| Supabase (database, accessi, file, funzioni) | 25 $ | 25 $ | 30 $ | 30 $ |
| Email (Resend) | 0 $ (piano gratuito) | 0 $ | 20 $ | 20 $ |
| Hosting del sito (Cloudflare Pages) | 0 $ | 0 $ | 0 $ | 0 $ |
| JobExpress AI (Claude Haiku 5.5) | 0,04 $ | 0,14 $ | 0,70 $ | 1,40 $ |
| Dominio e casella (stima del business plan) | 10 € | 10 € | 10 € | 10 € |
| **Totale al mese** | **≈ 31 €** | **≈ 31 €** | **≈ 53 €** | **≈ 54 €** |
| Costo per utente al mese | 0,10 € | 0,03 € | 0,011 € | 0,005 € |

**In parole semplici:** fino a 1.000 utenti la tecnologia costa circa **31 € al mese**. A 10.000 utenti circa **54 € al mese**. Le spese vere sono quelle professionali (tabella 3), non quelle tecniche.

### Perché questi numeri
- **Supabase Pro 25 $/mese** dal primo giorno: il piano gratuito mette in pausa il progetto dopo una settimana di inattività e non ha backup giornalieri, quindi non va bene per persone vere. Il Pro include 100.000 utenti attivi, 8 GB di database, 100 GB di file, 250 GB di traffico e 2 milioni di chiamate alle funzioni, oltre a 10 $ di crediti che coprono il server più piccolo (Micro).
- Da 5.000 utenti ipotizzo un server **Small** (15 $, quindi 5 $ in più dopo i crediti) per avere margine. A 10.000 utenti il traffico stimato (234 GB) è vicino al limite incluso di 250 GB: oltre si pagano 0,09 $ per GB.
- **Email:** il piano gratuito di Resend permette 3.000 email al mese ma **massimo 100 al giorno**. Con 5.000 utenti un giorno di molte iscrizioni supererebbe il limite, quindi serve il piano Pro (20 $ per 50.000 email).
- **AI:** una richiesta di circa 1.500 parole-token in entrata e 500 in uscita costa circa **0,0004 $** con Haiku 5.5. Con il limite di 20 richieste al mese, anche un abbonato che le usa tutte costa meno di 1 centesimo.
- **Hosting:** il sito è statico. Cloudflare Pages gratuito ha banda e richieste illimitate.

### Cosa oggi costa 0 € ma costerà in futuro
| Voce | Perché oggi è 0 | Quando costerà |
|---|---|---|
| Verifica d'identità (SPID/CIE tramite aggregatore) | Spenta, nessun fornitore scelto | Prezzo da chiedere con un **preventivo**; sensibilità già nel business plan (`trust_sensibilita_costo_annuo`) |
| SMS di verifica del telefono | Spento | Listino del fornitore SMS scelto |
| Pagamenti degli abbonamenti (Stripe) | Pagamenti non attivi | Il business plan usa l'ipotesi 1,5% + 0,25 € a pagamento: **da verificare** sul listino Stripe al momento dell'attivazione |
| Notifiche push | Non attive | Generalmente gratuite (Web Push), da verificare |

## 2. Confronto con i ricavi (scenario intermedio del business plan)
Ricavo netto medio per abbonato: **3,06 € al mese** (dopo IVA e commissioni, da `risultati.json`). Conversione ipotizzata: 3,5%.

| Utenti | Abbonati stimati | Ricavo netto al mese | Costi tecnici al mese | Differenza |
|---|---|---|---|---|
| 300 | 11 | ≈ 34 € | ≈ 31 € | ≈ +3 € |
| 1.000 | 35 | ≈ 107 € | ≈ 31 € | ≈ +76 € |
| 5.000 | 175 | ≈ 535 € | ≈ 53 € | ≈ +482 € |
| 10.000 | 350 | ≈ 1.070 € | ≈ 54 € | ≈ +1.016 € |

La tecnologia si ripaga già con poche decine di abbonati. Quello che decide il pareggio sono i **costi professionali** qui sotto e la **conversione**, che è ancora un'ipotesi.

## 3. Costi professionali (stime del business plan, non listini)
| Voce | Stima | Stato |
|---|---|---|
| Commercialista | 150 €/mese | da sostituire con preventivo |
| Assicurazione RC | 40 €/mese | da sostituire con preventivo |
| Strumenti e assistenza | 20 €/mese | stima |
| Pareri legali | 3.000 € il primo anno, poi 1.000 €/anno | da sostituire con preventivo (giuslavorista + privacy) |
| Marketing | 150–450 €/mese secondo lo scenario | scelta |

## 4. Come ridurre i rischi di costo
- Tenere attivi i **limiti già presenti**: 20 richieste AI al mese, 5 avvisi Rescue al giorno, 20 proposte dirette al giorno, 10 segnalazioni al giorno, 30 modelli per utente.
- Controllare ogni mese nel pannello Admin le **richieste AI** e il **traffico**.
- Le foto sono già ridotte a 640 px sul telefono prima del caricamento: il traffico resta basso.

## Fonti dei prezzi (28/11/2026)
- Supabase: https://supabase.com/pricing · https://supabase.com/docs/guides/platform/billing-on-supabase
- Resend: https://resend.com/pricing
- Cloudflare Pages: https://pages.cloudflare.com/
- Claude Haiku 5.5: https://platform.claude.com/docs/en/about-claude/pricing
- Cambio: Banca d'Italia, cambi di riferimento del 3/10/2025 (da aggiornare con il dato del giorno)
