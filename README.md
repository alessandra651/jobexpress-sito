# JobExpress, sito

Il lavoro, quando serve. Sito informativo per la fase di validazione: spiega il progetto e raccoglie l'interesse di
lavoratori, attività e partner su Supabase.

Il sito **non** svolge intermediazione: non pubblica offerte, non mette in contatto le parti e non raccoglie curriculum.

## Avvio

```bash
npm install
npm run dev      # sviluppo su http://localhost:5173
npm run build    # sito pronto in dist/
```

`dist/` è statico: si può caricare su Vercel, Netlify, GitHub Pages o qualsiasi hosting.

## Struttura

| File | Contenuto |
| --- | --- |
| `index.html`, `privacy.html` | Le due pagine, con tutti i testi |
| `src/stile.css` | Colori, tipografia e layout |
| `src/tabellone.js`, `src/esempi.js` | Tabellone interattivo e dati dimostrativi |
| `src/moduli.js` | Schede, controlli e invio dei moduli |
| `src/supabase.js` | Inserimento via API REST |
| `src/config.js` | Supabase, titolare del trattamento, commissione |
| `supabase/migrations/` | Tabelle e regole di accesso |

Scroll fluido con [Lenis](https://github.com/darkroomengineering/lenis). Carattere Mona Sans, incluso nel sito: nessuna
richiesta a servizi esterni tranne Supabase al momento dell'invio. Nessun cookie.

## Supabase

Il sito è collegato al progetto `lpwpigtknyarfiiqocfp` (Irlanda). La migrazione in `supabase/migrations/` è già stata
eseguita. Per usare un altro progetto: esegui la migrazione nel suo SQL Editor e imposta le variabili di `.env.example`.

La publishable key è pubblica per natura. La chiave `secret` o `service_role` non deve mai entrare in questo repository.

Dal sito si può solo inserire: lettura, modifica e cancellazione sono bloccate e i contatti si vedono solo dal pannello
Supabase (Table Editor). La vista `riepilogo_validazione` mostra l'avanzamento verso gli obiettivi di 30 attività e 30 persone.

## Prima di pubblicare

- [ ] Compilare `TITOLARE` in `src/config.js`
- [ ] Firmare il DPA di Supabase e completare in `privacy.html` la parte sugli accessi da fuori UE
- [ ] Far rivedere informativa e testi a un legale
- [ ] Cancellare periodicamente i contatti più vecchi di 12 mesi, come promesso nell'informativa:

```sql
delete from interesse_lavoratori where creato_il < now() - interval '12 months';
delete from interesse_attivita   where creato_il < now() - interval '12 months';
delete from interesse_partner    where creato_il < now() - interval '12 months';
```
