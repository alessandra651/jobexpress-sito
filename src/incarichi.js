import { MOTIVI, segnala } from './segnalazioni.js'

// Bacheca degli incarichi: schede, filtri, dettaglio, preferiti.
// I dati qui sotto sono SOLO DIMOSTRATIVI: nessuna offerta reale,
// nessuna attività reale. Le tariffe non sono minimi di legge.

export const CATEGORIE = [
  ['bar', 'Bar e caffetteria'],
  ['ristorazione', 'Ristorazione'],
  ['camerieri', 'Camerieri'],
  ['cucina', 'Cucina'],
  ['hotel', 'Hotel e turismo'],
  ['negozi', 'Negozi e retail'],
  ['eventi', 'Eventi'],
  ['hostess', 'Hostess e steward'],
  ['pulizie', 'Pulizie'],
  ['babysitting', 'Babysitting'],
  ['petsitting', 'Pet sitting'],
  ['ripetizioni', 'Ripetizioni'],
  ['informatica', 'Assistenza informatica'],
  ['giardinaggio', 'Giardinaggio'],
  ['traslochi', 'Traslochi'],
  ['consegne', 'Consegne'],
  ['domestico', 'Aiuto domestico'],
  ['foto', 'Fotografia e contenuti'],
  ['persona', 'Assistenza alla persona'],
  ['commissioni', 'Piccole commissioni'],
  ['altro', 'Altri incarichi'],
]
export const NOME_CAT = Object.fromEntries(CATEGORIE)

export const GIORNI = { oggi: 'Oggi', domani: 'Domani', lunedi: 'Lunedì', martedi: 'Martedì', mercoledi: 'Mercoledì', giovedi: 'Giovedì', venerdi: 'Venerdì', sabato: 'Sabato', domenica: 'Domenica' }
const ESPERIENZA = { nessuna: 'Nessuna esperienza richiesta', minima: 'Un po’ di esperienza', richiesta: 'Esperienza richiesta' }

// [id, titolo, categoria, chi pubblica, tipo, città, zona, km, giorno, inizio, fine, €/ora, urgente, esperienza, requisiti, descrizione]
const DATI = [
  [1, 'Cameriere o cameriera di sala', 'camerieri', 'Ristorante in centro', 'azienda', 'Forlì', 'centro', 1.2, 'oggi', 19, 23.5, 11, true, 'minima', ['Divisa fornita', 'Affiancamento al primo turno'], 'Servizio ai tavoli in una serata piena. Prendi le comande, porti i piatti e aiuti a sparecchiare.'],
  [2, 'Banco bar per le colazioni', 'bar', 'Caffetteria vicino alla stazione', 'azienda', 'Forlì', 'stazione', 2, 'domani', 6.5, 11, 10.5, false, 'minima', ['Saper fare il caffè è un plus'], 'Caffè, cappuccini e brioche al banco nelle ore di punta del mattino.'],
  [3, 'Aiuto per un trasloco', 'traslochi', 'Privato', 'privato', 'Forlì', 'zona est', 3.5, 'domenica', 9, 13, 15, false, 'nessuna', ['Buona forma fisica'], 'Carico e scarico di scatoloni e mobili piccoli. Si lavora in due, il furgone c’è già.'],
  [4, 'Ripetizioni di inglese', 'ripetizioni', 'Famiglia', 'privato', 'Cesena', 'centro', 19, 'giovedi', 17, 19, 13.5, false, 'richiesta', ['Livello B2 o superiore'], 'Ripasso di grammatica e conversazione per una ragazza delle superiori, a casa o online.'],
  [5, 'Babysitter per due bambini', 'babysitting', 'Famiglia', 'privato', 'Forlì', 'zona sud', 3, 'domani', 16, 19, 10, false, 'minima', ['Referenze gradite'], 'Merenda, compiti e un po’ di gioco con due bambini di 6 e 9 anni.'],
  [6, 'Allestimento di un evento', 'eventi', 'Agenzia eventi', 'azienda', 'Forlimpopoli', 'zona artigianale', 8, 'sabato', 14, 20, 12, false, 'nessuna', ['Automunito/a'], 'Montaggio di tavoli, luci e segnaletica prima di un evento aziendale.'],
  [7, 'Accoglienza a un convegno', 'hostess', 'Agenzia eventi', 'azienda', 'Forlì', 'zona fiera', 4, 'sabato', 8.5, 13.5, 12.5, false, 'minima', ['Inglese di base', 'Abbigliamento scuro'], 'Registrazione dei partecipanti, consegna dei badge e indicazioni in sala.'],
  [8, 'Dog sitting per un labrador', 'petsitting', 'Privato', 'privato', 'Forlì', 'centro', 1.5, 'sabato', 9, 12, 10, false, 'minima', ['Esperienza con i cani'], 'Due passeggiate e un po’ di compagnia per un labrador tranquillo.'],
  [9, 'Pulizie dopo una festa', 'pulizie', 'Privato', 'privato', 'Forlì', 'zona nord', 4, 'domenica', 10, 13, 12, false, 'nessuna', ['Prodotti forniti'], 'Riordino e pulizia di soggiorno e cucina dopo una festa di compleanno.'],
  [10, 'Aiuto in cucina', 'cucina', 'Trattoria in collina', 'azienda', 'Bertinoro', 'centro', 12, 'oggi', 18, 23, 11.5, true, 'minima', ['Automunito/a'], 'Preparazione degli ingredienti, impiattamento e supporto al cuoco durante il servizio.'],
  [11, 'Inventario in negozio', 'negozi', 'Negozio di abbigliamento', 'azienda', 'Forlì', 'centro', 1, 'domani', 14, 18.5, 10.5, false, 'nessuna', ['Precisione'], 'Conteggio dei capi in magazzino e sistemazione degli scaffali.'],
  [12, 'Riassetto camere', 'hotel', 'Hotel in centro', 'azienda', 'Cesena', 'centro', 20, 'sabato', 9, 13, 11, false, 'minima', ['Divisa fornita'], 'Rifacimento letti e riordino delle camere in un fine settimana pieno.'],
  [13, 'Configurare PC e stampante', 'informatica', 'Privato', 'privato', 'Forlì', 'centro', 2, 'oggi', 17, 19, 15, true, 'richiesta', ['Conoscenza di Windows'], 'Collegare una stampante nuova, sistemare il Wi‑Fi e fare un backup delle foto.'],
  [14, 'Potatura di una siepe', 'giardinaggio', 'Privato', 'privato', 'Meldola', 'periferia', 13, 'domenica', 8.5, 12.5, 12, false, 'minima', ['Attrezzi forniti'], 'Potatura di una siepe lunga e raccolta delle foglie in giardino.'],
  [15, 'Consegne in bici a pranzo', 'consegne', 'Gastronomia', 'azienda', 'Forlì', 'centro', 0.8, 'domani', 11.5, 14.5, 10, false, 'nessuna', ['Bici propria'], 'Consegna di pranzi già pronti a uffici del centro, entro due chilometri.'],
  [16, 'Foto a un evento culturale', 'foto', 'Associazione culturale', 'azienda', 'Forlì', 'centro', 2, 'sabato', 18, 21, 18, false, 'richiesta', ['Attrezzatura propria', 'Portfolio'], 'Foto di una serata di presentazione di libri, con consegna di 40 scatti scelti.'],
  [17, 'Spesa per una persona anziana', 'commissioni', 'Privato', 'privato', 'Forlì', 'zona ovest', 3, 'domani', 10, 11.5, 10, false, 'nessuna', ['Lista della spesa fornita'], 'Fare la spesa al supermercato vicino e portarla a casa.'],
  [18, 'Servizio in sala per un matrimonio', 'ristorazione', 'Catering', 'azienda', 'Castrocaro Terme', 'villa per eventi', 11, 'sabato', 11, 18, 12, false, 'minima', ['Camicia bianca e pantaloni neri'], 'Servizio ai tavoli durante il pranzo di nozze, in una squadra di otto persone.'],
]

// Posizione indicativa sulla mappa (10 unità ≈ 1 km, Forlì centro = 0,0).
// Per i privati è solo il centro di una zona larga, mai un indirizzo.
const POSIZIONE = {
  1: [8, -8], 2: [6, -19], 3: [33, 10], 4: [157, 97], 5: [-6, 29], 6: [73, 35], 7: [-34, -22], 8: [-10, 10], 9: [-5, -39],
  10: [75, 82], 11: [5, 6], 12: [164, 90], 13: [-14, -12], 14: [18, 107], 15: [-4, -6], 16: [15, 12], 17: [-29, 4], 18: [-73, 53],
}

export const INCARICHI_DEMO = DATI.map(([id, titolo, cat, chi, tipo, citta, zona, km, giorno, inizio, fine, euroOra, urgente, esperienza, requisiti, descrizione]) => ({
  id, titolo, cat, chi, tipo, citta, zona, km, giorno, inizio, fine, euroOra, urgente, esperienza, requisiti, descrizione,
  ore: fine - inizio,
  pos: POSIZIONE[id],
  totale: Math.round(euroOra * (fine - inizio) * 100) / 100,
}))

// ---------- utilità ----------
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const orario = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
const durata = (h) => {
  const o = Math.floor(h), m = Math.round((h - o) * 60)
  return `${o} ${o === 1 ? 'ora' : 'ore'}${m ? ` e ${m} minuti` : ''}`
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const luogo = (a) => `${a.citta}, ${a.zona}`

const SALVATI_CHIAVE = 'jobexpress-salvati'
const leggiSalvati = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SALVATI_CHIAVE) || '[]')) } catch { return new Set() }
}
const scriviSalvati = (s) => {
  try { localStorage.setItem(SALVATI_CHIAVE, JSON.stringify([...s])) } catch { /* memoria del browser non disponibile */ }
}

// Altri incarichi oltre a quelli di esempio (per esempio quelli che pubblichi tu)
const fonti = []
export function registraFonte(fn) {
  fonti.push(fn)
}
export const tuttiIncarichi = () => [...fonti.flatMap((f) => f()), ...INCARICHI_DEMO]

// Il calendario personale, se compilato, ha la precedenza sulla fascia del tabellone
let dalCalendario = () => null
export function impostaCalendario(fn) {
  dalCalendario = fn
}

// La fascia oraria scelta nel tabellone (giorno + orari), per la compatibilità
let leggiFascia = () => null
export function impostaFascia(fn) {
  leggiFascia = fn
}

// Spiega in parole semplici se l'incarico rientra nella fascia scelta
export function compatibilita(a) {
  const c = dalCalendario(a)
  if (c) return c
  const f = leggiFascia()
  if (!f) return null
  const giorni = f.giorno === 'weekend' ? ['sabato', 'domenica'] : [f.giorno]
  const nomeFascia = `${f.giorno === 'weekend' ? 'nel weekend' : f.giorno} dalle ${orario(f.inizio)} alle ${orario(f.fine)}`
  const giornoOk = giorni.includes(a.giorno)
  const oraOk = a.inizio >= f.inizio && a.fine <= f.fine
  if (giornoOk && oraOk) return { ok: true, testo: `Compatibile: l’incarico rientra nella disponibilità che hai indicato (${nomeFascia}).` }
  if (!giornoOk) return { ok: false, testo: `Non è nel giorno che hai indicato (${nomeFascia}).` }
  return { ok: false, testo: `È nel giorno giusto ma esce dalla tua fascia (${nomeFascia}): inizia alle ${orario(a.inizio)} e finisce alle ${orario(a.fine)}.` }
}

// ---------- stato dei filtri ----------
let vista = 'elenco'
let zona = 'citta'
const filtri = { cat: 'tutte', quando: 'tutti', citta: 'tutte', km: 0, minimo: 0, chi: 'tutti', urgenti: false, compatibili: false, salvati: false, ordine: 'vicini' }
export function soloCompatibili() {
  filtri.compatibili = true
}
export function scegliCategoria(cat) {
  filtri.cat = cat
}

// Un incarico corrisponde a questi filtri? (usata anche dalle ricerche salvate)
export function corrisponde(a, f, salvati = new Set()) {
  return (f.cat === 'tutte' || a.cat === f.cat) &&
    (f.quando === 'tutti' || (f.quando === 'weekend' ? ['sabato', 'domenica'].includes(a.giorno) : a.giorno === f.quando)) &&
    (f.citta === 'tutte' || a.citta === f.citta) &&
    (!f.km || a.km <= f.km) &&
    (!f.minimo || a.euroOra >= f.minimo) &&
    (f.chi === 'tutti' || a.tipo === f.chi) &&
    (!f.urgenti || a.urgente) &&
    (!f.salvati || salvati.has(a.id)) &&
    (!f.compatibili || compatibilita(a)?.ok)
}
export const leggiFiltri = () => ({ ...filtri, salvati: false })
export function impostaFiltri(f) {
  Object.assign(filtri, f)
}
export function descriviFiltri(f) {
  const parti = [f.cat === 'tutte' ? 'Tutte le categorie' : NOME_CAT[f.cat]]
  if (f.quando !== 'tutti') parti.push({ oggi: 'oggi', domani: 'domani', weekend: 'nel weekend' }[f.quando] || f.quando)
  if (f.citta !== 'tutte') parti.push(f.citta)
  if (f.km) parti.push(`entro ${f.km} km`)
  if (f.minimo) parti.push(`da ${String(f.minimo).replace('.', ',')} €/ora`)
  if (f.chi !== 'tutti') parti.push(f.chi === 'azienda' ? 'aziende' : 'privati')
  if (f.urgenti) parti.push('urgenti')
  if (f.compatibili) parti.push('compatibili con i miei orari')
  return parti.join(' · ')
}
let salvaRicerca = null
export function impostaSalvaRicerca(fn) {
  salvaRicerca = fn
}
let dopoRidisegno = () => {}
export function quandoCambiaBacheca(fn) {
  dopoRidisegno = fn
}

function filtra(salvati) {
  const lista = tuttiIncarichi().filter((a) => corrisponde(a, filtri, salvati))
  const per = { vicini: (a, b) => a.km - b.km, ora: (a, b) => b.euroOra - a.euroOra, totale: (a, b) => b.totale - a.totale, urgenti: (a, b) => b.urgente - a.urgente || a.km - b.km }
  return lista.sort(per[filtri.ordine])
}

// ---------- disegno ----------
const opzioni = (lista, scelto) => lista.map(([v, t]) => `<option value="${v}"${String(v) === String(scelto) ? ' selected' : ''}>${t}</option>`).join('')
const citta = () => [...new Set(tuttiIncarichi().map((a) => a.citta))].sort()

function barraFiltri() {
  return `
  <div class="filtri">
    <div class="filtri__categorie" role="group" aria-label="Categoria">
      ${[['tutte', 'Tutte'], ...CATEGORIE].map(([v, t]) => `<button type="button" data-f-cat="${v}" aria-pressed="${filtri.cat === v}">${t}</button>`).join('')}
    </div>
    <details class="filtri__altri" data-altri>
    <summary>Altri filtri</summary>
    <div class="filtri__riga">
      <label>Quando<select data-f="quando">${opzioni([['tutti', 'Qualsiasi'], ['oggi', 'Oggi'], ['domani', 'Domani'], ['weekend', 'Nel weekend']], filtri.quando)}</select></label>
      <label>Città<select data-f="citta">${opzioni([['tutte', 'Tutte'], ...citta().map((c) => [c, c])], filtri.citta)}</select></label>
      <label>Distanza<select data-f="km">${opzioni([[0, 'Qualsiasi'], [5, 'Entro 5 km'], [10, 'Entro 10 km'], [25, 'Entro 25 km']], filtri.km)}</select></label>
      <label>Compenso<select data-f="minimo">${opzioni([[0, 'Qualsiasi'], [10.5, 'Da 10,50 €/ora'], [12, 'Da 12 €/ora'], [15, 'Da 15 €/ora']], filtri.minimo)}</select></label>
      <label>Chi pubblica<select data-f="chi">${opzioni([['tutti', 'Tutti'], ['azienda', 'Aziende'], ['privato', 'Privati']], filtri.chi)}</select></label>
      <label>Ordina<select data-f="ordine">${opzioni([['vicini', 'Più vicini'], ['ora', 'Compenso orario'], ['totale', 'Compenso totale'], ['urgenti', 'Prima gli urgenti']], filtri.ordine)}</select></label>
    </div>
    <div class="filtri__spunte">
      <label class="interruttore"><input type="checkbox" data-f="urgenti"${filtri.urgenti ? ' checked' : ''} /> Solo urgenti</label>
      <label class="interruttore"><input type="checkbox" data-f="compatibili"${filtri.compatibili ? ' checked' : ''} /> Compatibili con i miei orari</label>
      <label class="interruttore"><input type="checkbox" data-f="salvati"${filtri.salvati ? ' checked' : ''} /> Solo salvati</label>
    </div>
    </details>
  </div>
  <div class="bacheca__barra">
    <p class="filtri__conto" data-conto-incarichi aria-live="polite"></p>
    <button type="button" class="salva-ricerca" data-salva-ricerca>Salva questa ricerca</button>
    <p class="salva-ricerca__esito" data-esito-ricerca role="status"></p>
    <div class="scelta scelta--vista2" role="group" aria-label="Come vedi gli incarichi">
      <button type="button" data-vista2="elenco" aria-pressed="${vista === 'elenco'}">Elenco</button>
      <button type="button" data-vista2="mappa" aria-pressed="${vista === 'mappa'}">Mappa</button>
    </div>
  </div>
  <div class="schede" data-schede${vista === 'mappa' ? ' hidden' : ''}></div>
  <div class="mappa-inc" data-mappa-inc${vista === 'elenco' ? ' hidden' : ''}></div>
  <p class="annunci__nota">Incarichi di esempio, non offerte reali. Il totale è una stima lorda: ore × compenso orario. Le tariffe sono esempi, non minimi di legge.</p>`
}

export function scheda(a, salvato) {
  return `
  <article class="scheda" data-id="${a.id}">
    <div class="scheda__alto">
      <span class="scheda__cat">${esc(NOME_CAT[a.cat])}</span>
      ${a.urgente ? '<span class="scheda__urgente">Urgente</span>' : ''}
      ${a.mio ? '<span class="scheda__mio">Tuo annuncio</span>' : ''}
      <button type="button" class="scheda__cuore" data-salva="${a.id}" aria-pressed="${salvato}" aria-label="${salvato ? 'Togli dai salvati' : 'Salva'}: ${esc(a.titolo)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
      </button>
    </div>
    <h3>${esc(a.titolo)}</h3>
    <p class="scheda__chi">${esc(a.chi)} · ${esc(luogo(a))} · ${String(a.km).replace('.', ',')} km</p>
    <p class="scheda__quando">${GIORNI[a.giorno]}, ${orario(a.inizio)}–${orario(a.fine)} · ${durata(a.ore)}</p>
    <p class="scheda__req">${esc(a.requisiti[0])}</p>
    <div class="scheda__basso">
      <span class="scheda__ora">${euro.format(a.euroOra)}/ora</span>
      <span class="scheda__tot">${euro.format(a.totale)} <small>totali stimati, lordi</small></span>
      <button type="button" class="scheda__apri" data-dettagli="${a.id}">Dettagli</button>
    </div>
  </article>`
}

function dettaglio(a, strumenti, salvati, ridisegna) {
  const c = compatibilita(a)
  const privato = a.tipo === 'privato'
  const formalizzazione = a.forma || (privato
    ? 'Per gli incarichi dei privati si possono usare strumenti come il Libretto Famiglia o la prestazione occasionale: la forma giusta va verificata caso per caso.'
    : 'L’azienda indica la forma del rapporto prima della conferma (per esempio lavoro intermittente o a chiamata). Un incarico breve non è per forza occasionale.')
  strumenti.apri(`
    <p class="dettaglio__cat">${esc(NOME_CAT[a.cat])}${a.urgente ? ' · <span class="scheda__urgente">Urgente</span>' : ''}</p>
    <h2>${esc(a.titolo)}</h2>
    <p><strong>${esc(a.chi)}</strong> · ${privato ? 'Privato' : 'Azienda'}</p>
    <div class="dettaglio__cifre">
      <div><span>Compenso orario</span><strong>${euro.format(a.euroOra)}</strong></div>
      <div><span>Totale stimato</span><strong>${euro.format(a.totale)}</strong></div>
      <div><span>Durata</span><strong>${durata(a.ore)}</strong></div>
    </div>
    <p>${esc(a.descrizione)}</p>
    <dl class="dettaglio__info">
      <dt>Quando</dt><dd>${GIORNI[a.giorno]}, dalle ${orario(a.inizio)} alle ${orario(a.fine)}</dd>
      <dt>Dove</dt><dd>${esc(luogo(a))}, a circa ${String(a.km).replace('.', ',')} km${privato ? '. Zona indicativa: l’indirizzo preciso arriva solo dopo la conferma.' : ''}</dd>
      <dt>Requisiti</dt><dd>${a.requisiti.map(esc).join(' · ')}</dd>
      <dt>Esperienza</dt><dd>${ESPERIENZA[a.esperienza]}</dd>
      <dt>Compenso</dt><dd>Importo lordo stimato (ore × compenso orario). Il netto dipende dalla forma del rapporto.</dd>
      <dt>Pagamento</dt><dd>${a.pagamento ? esc(a.pagamento) + '. ' : ''}Lo paga direttamente chi pubblica. JobExpress non trattiene nulla dal compenso.</dd>${a.mansioni ? `<dt>Mansioni</dt><dd>${esc(a.mansioni)}</dd>` : ''}${a.rimborsi ? `<dt>Rimborsi</dt><dd>${esc(a.rimborsi)}</dd>` : ''}
      <dt>Forma del rapporto</dt><dd>${formalizzazione}</dd>
      <dt>Recensioni</dt><dd>Ancora nessuna recensione per chi pubblica.</dd>
    </dl>
    ${c ? `<p class="dettaglio__compat ${c.ok ? 'si' : 'no'}">${esc(c.testo)}</p>` : ''}
    <div class="finestra__azioni">
      ${a.mio ? '' : '<button class="tasto" type="button" data-candidati>Candidati</button>'}
      <button class="tasto tasto--chiaro" type="button" data-d-salva aria-pressed="${salvati.has(a.id)}">${salvati.has(a.id) ? 'Salvato' : 'Salva'}</button>
      <button class="tasto tasto--chiaro" type="button" data-condividi>Condividi</button>
      <button class="tasto tasto--chiaro" type="button" data-segnala>Segnala</button>
    </div>
    <p class="finestra__nota" data-d-esito aria-live="polite">${a.mio ? 'È un tuo annuncio: lo gestisci da «La mia area».' : a.reale ? 'Annuncio vero, pubblicato su JobExpress.' : 'Incarico di esempio, non reale.'}</p>`)
  const fin = document.querySelector('dialog.finestra')
  const esito = fin.querySelector('[data-d-esito]')
  if (!a.mio) fin.querySelector('[data-candidati]').onclick = () => {
    if (!strumenti.candidati) return strumenti.accesso('Per candidarti, accedi')
    Promise.resolve(strumenti.candidati(a, `${GIORNI[a.giorno]}, ${orario(a.inizio)}–${orario(a.fine)}`)).then((msg) => { if (msg) esito.textContent = msg })
  }
  fin.querySelector('[data-d-salva]').onclick = (e) => {
    salvati.has(a.id) ? salvati.delete(a.id) : salvati.add(a.id)
    scriviSalvati(salvati)
    e.currentTarget.textContent = salvati.has(a.id) ? 'Salvato' : 'Salva'
    e.currentTarget.setAttribute('aria-pressed', salvati.has(a.id))
    ridisegna()
  }
  fin.querySelector('[data-condividi]').onclick = async () => {
    const testo = `${a.titolo} · ${luogo(a)} · ${GIORNI[a.giorno]} ${orario(a.inizio)}–${orario(a.fine)} · ${euro.format(a.euroOra)}/ora (JobExpress)`
    try {
      await navigator.clipboard.writeText(testo)
      esito.textContent = 'Testo dell’incarico copiato: incollalo dove vuoi.'
    } catch {
      esito.textContent = testo
    }
  }
  fin.querySelector('[data-segnala]').onclick = () => {
    esito.innerHTML = `<span class="segnala-mini">Perché lo segnali?
      <select data-motivo aria-label="Motivo della segnalazione">${MOTIVI.map((m) => `<option>${m}</option>`).join('')}</select>
      <button type="button" class="tasto tasto--chiaro" data-invia-segnala>Invia</button></span>`
    esito.querySelector('[data-invia-segnala]').onclick = () => {
      segnala({ tipo: 'annuncio', riferimento: a.id, titolo: a.titolo, motivo: esito.querySelector('[data-motivo]').value })
      esito.textContent = 'Grazie: la segnalazione è arrivata alla moderazione. Versione di prova: resta su questo dispositivo.'
    }
  }
}

const filtriAttivi = () => filtri.quando !== 'tutti' || filtri.citta !== 'tutte' || filtri.km || filtri.minimo || filtri.chi !== 'tutti' || filtri.urgenti || filtri.compatibili || filtri.salvati

// ---------- mappa ----------
const LUOGHI = [
  ['Forlimpopoli', 69, 38], ['Bertinoro', 75, 82], ['Meldola', 18, 107], ['Castrocaro', -73, 53], ['Cesena', 161, 93], ['Predappio', -50, 132],
]

function mappa(lista) {
  const citta = zona === 'citta'
  const vb = citta ? '-50 -50 100 100' : '-110 -62 300 212'
  const k = citta ? 0.33 : 1 // dimensione dei segni in base allo zoom
  const visibili = lista.filter((a) => {
    const [x, y] = a.pos
    return citta ? Math.abs(x) <= 48 && Math.abs(y) <= 48 : true
  })
  const fuori = lista.length - visibili.length
  const sfondo = citta
    ? `<circle class="mi__anello" r="20"/><circle class="mi__anello" r="40"/>
       <text class="mi__zona" x="0" y="1.1" text-anchor="middle" font-size="3.2">Centro</text>`
    : `<polyline class="mi__via" points="-215,-121 -125,-70 0,0 69,38 161,93 235,137"/>
       ${LUOGHI.map(([n, x, y]) => `<circle class="mi__paese" cx="${x}" cy="${y}" r="4"/><text class="mi__nome" x="${x}" y="${y - 9}" text-anchor="middle">${n}</text>`).join('')}
       <circle class="mi__paese" r="7"/><text class="mi__nome mi__nome--forte" x="0" y="-49" text-anchor="middle">Forlì</text>`
  const segni = visibili.map((a) => {
    const [x, y] = a.pos
    const r = 5.5 * k
    const etichetta = `${a.titolo}, ${luogo(a)}, ${GIORNI[a.giorno]} ${orario(a.inizio)}–${orario(a.fine)}, ${euro.format(a.euroOra)} all’ora`
    const zonaPriv = a.tipo === 'privato' ? `<circle class="mi__zonapriv" cx="${x}" cy="${y}" r="${citta ? 9 : 10}"/>` : ''
    const prezzo = citta ? `<text class="mi__prezzo" x="${x}" y="${y - r - 1}" text-anchor="middle" font-size="2.8">${String(a.euroOra).replace('.', ',')} €/h</text>` : ''
    return `<g class="mi__segno${a.urgente ? ' urgente' : ''}" role="button" tabindex="0" data-dettagli="${a.id}" aria-label="${esc(etichetta)}">
      ${zonaPriv}<circle class="mi__punto" cx="${x}" cy="${y}" r="${r}"/>${prezzo}<title>${esc(etichetta)}</title></g>`
  }).join('')
  return `
    <div class="mi__comandi">
      <div class="scelta scelta--vista2" role="group" aria-label="Zona della mappa">
        <button type="button" data-zona="citta" aria-pressed="${citta}">Forlì città</button>
        <button type="button" data-zona="dintorni" aria-pressed="${!citta}">Dintorni</button>
      </div>
      <p class="mi__legenda"><span><i class="mi__l-punto"></i>Attività</span><span><i class="mi__l-zona"></i>Privato: solo la zona, mai l’indirizzo</span>${citta ? '<span>Anelli a 2 e 4 km dal centro</span>' : ''}</p>
    </div>
    <svg class="mi__svg" viewBox="${vb}" role="group" aria-label="Mappa degli incarichi: tocca un punto per aprire l’incarico">${sfondo}${segni}</svg>
    ${fuori ? `<p class="mi__fuori">${fuori} ${fuori === 1 ? 'incarico è' : 'incarichi sono'} fuori città: guarda «Dintorni».</p>` : ''}
    ${!lista.length ? '<p class="mi__fuori">Nessun incarico con questi filtri.</p>' : ''}`
}

// ---------- avvio ----------
let ultimi = null

// Ridisegna la bacheca (per esempio dopo aver pubblicato un annuncio)
export function aggiornaBacheca() {
  ultimi?.ridisegna()
}

// Apre il dettaglio di un incarico da fuori (per esempio dai suggerimenti del calendario)
export function apriIncarico(id) {
  const a = tuttiIncarichi().find((x) => String(x.id) === String(id))
  if (a && ultimi) dettaglio(a, ultimi.strumenti, ultimi.salvati, ultimi.ridisegna)
}

export function mostraIncarichi(box, strumenti) {
  const salvati = leggiSalvati()
  box.innerHTML = barraFiltri()
  const schede = box.querySelector('[data-schede]')
  const conto = box.querySelector('[data-conto-incarichi]')
  const scatola = box.querySelector('[data-mappa-inc]')

  const ridisegna = () => {
    const lista = filtra(salvati)
    conto.textContent = `${lista.length} ${lista.length === 1 ? 'incarico' : 'incarichi'}`
    if (vista === 'mappa') scatola.innerHTML = mappa(lista)
    schede.innerHTML = lista.length
      ? lista.map((a) => scheda(a, salvati.has(a.id))).join('')
      : `<div class="vuoto"><strong>Non ci sono incarichi compatibili con questi filtri.</strong><p>Prova ad ampliare il raggio di ricerca o modificare la disponibilità.</p><button type="button" class="tasto tasto--chiaro" data-azzera>Togli i filtri</button></div>`
  }

  // onclick/onchange (e non addEventListener) così, ridisegnando, non si sommano
  box.onclick = (e) => {
    const cat = e.target.closest('[data-f-cat]')
    if (cat) {
      filtri.cat = cat.dataset.fCat
      box.querySelectorAll('[data-f-cat]').forEach((b) => b.setAttribute('aria-pressed', b === cat))
      return ridisegna()
    }
    if (e.target.closest('[data-salva-ricerca]')) {
      const msg = salvaRicerca ? salvaRicerca() : 'Accedi per salvare le ricerche.'
      const n = box.querySelector('[data-esito-ricerca]')
      if (n) n.textContent = msg
      return
    }
    const v = e.target.closest('[data-vista2]')
    if (v) {
      vista = v.dataset.vista2
      box.querySelectorAll('[data-vista2]').forEach((b) => b.setAttribute('aria-pressed', b === v))
      schede.hidden = vista !== 'elenco'
      scatola.hidden = vista !== 'mappa'
      return ridisegna()
    }
    const z = e.target.closest('[data-zona]')
    if (z) {
      zona = z.dataset.zona
      return ridisegna()
    }
    const cuore = e.target.closest('[data-salva]')
    if (cuore) {
      const grezzo = cuore.dataset.salva
      const id = /^\d+$/.test(grezzo) ? Number(grezzo) : grezzo
      salvati.has(id) ? salvati.delete(id) : salvati.add(id)
      scriviSalvati(salvati)
      return ridisegna()
    }
    const apri = e.target.closest('[data-dettagli]')
    if (apri) return dettaglio(tuttiIncarichi().find((a) => String(a.id) === apri.dataset.dettagli), strumenti, salvati, ridisegna)
    if (e.target.closest('[data-azzera]')) {
      Object.assign(filtri, { cat: 'tutte', quando: 'tutti', citta: 'tutte', km: 0, minimo: 0, chi: 'tutti', urgenti: false, compatibili: false, salvati: false })
      mostraIncarichi(box, strumenti)
    }
  }
  box.onkeydown = (e) => {
    const segno = e.target.closest('.mi__segno')
    if (segno && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      segno.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  }
  box.onchange = (e) => {
    const campo = e.target.closest('[data-f]')
    if (!campo) return
    const k = campo.dataset.f
    filtri[k] = campo.type === 'checkbox' ? campo.checked : ['km', 'minimo'].includes(k) ? Number(campo.value) : campo.value
    ridisegna()
  }
  // Su computer i filtri sono sempre aperti, sul telefono si aprono con un tocco
  const altri = box.querySelector('[data-altri]')
  if (altri && (matchMedia('(min-width: 701px)').matches || filtriAttivi())) altri.open = true
  ultimi = { strumenti, salvati, ridisegna }
  ridisegna()
  box.querySelector(`[data-f-cat="${filtri.cat}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
}
