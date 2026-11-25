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
const NOME_CAT = Object.fromEntries(CATEGORIE)

const GIORNI = { oggi: 'Oggi', domani: 'Domani', giovedi: 'Giovedì', sabato: 'Sabato', domenica: 'Domenica' }
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

export const INCARICHI_DEMO = DATI.map(([id, titolo, cat, chi, tipo, citta, zona, km, giorno, inizio, fine, euroOra, urgente, esperienza, requisiti, descrizione]) => ({
  id, titolo, cat, chi, tipo, citta, zona, km, giorno, inizio, fine, euroOra, urgente, esperienza, requisiti, descrizione,
  ore: fine - inizio,
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

// La fascia oraria scelta nel tabellone (giorno + orari), per la compatibilità
let leggiFascia = () => null
export function impostaFascia(fn) {
  leggiFascia = fn
}

// Spiega in parole semplici se l'incarico rientra nella fascia scelta
function compatibilita(a) {
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
const filtri = { cat: 'tutte', quando: 'tutti', citta: 'tutte', km: 0, minimo: 0, chi: 'tutti', urgenti: false, compatibili: false, salvati: false, ordine: 'vicini' }
export function scegliCategoria(cat) {
  filtri.cat = cat
}

function filtra(salvati) {
  const lista = INCARICHI_DEMO.filter((a) =>
    (filtri.cat === 'tutte' || a.cat === filtri.cat) &&
    (filtri.quando === 'tutti' || (filtri.quando === 'weekend' ? ['sabato', 'domenica'].includes(a.giorno) : a.giorno === filtri.quando)) &&
    (filtri.citta === 'tutte' || a.citta === filtri.citta) &&
    (!filtri.km || a.km <= filtri.km) &&
    (!filtri.minimo || a.euroOra >= filtri.minimo) &&
    (filtri.chi === 'tutti' || a.tipo === filtri.chi) &&
    (!filtri.urgenti || a.urgente) &&
    (!filtri.salvati || salvati.has(a.id)) &&
    (!filtri.compatibili || compatibilita(a)?.ok))
  const per = { vicini: (a, b) => a.km - b.km, ora: (a, b) => b.euroOra - a.euroOra, totale: (a, b) => b.totale - a.totale, urgenti: (a, b) => b.urgente - a.urgente || a.km - b.km }
  return lista.sort(per[filtri.ordine])
}

// ---------- disegno ----------
const opzioni = (lista, scelto) => lista.map(([v, t]) => `<option value="${v}"${String(v) === String(scelto) ? ' selected' : ''}>${t}</option>`).join('')
const CITTA = [...new Set(INCARICHI_DEMO.map((a) => a.citta))].sort()

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
      <label>Città<select data-f="citta">${opzioni([['tutte', 'Tutte'], ...CITTA.map((c) => [c, c])], filtri.citta)}</select></label>
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
  <p class="filtri__conto" data-conto-incarichi aria-live="polite"></p>
  <div class="schede" data-schede></div>
  <p class="annunci__nota">Incarichi di esempio, non offerte reali. Il totale è una stima lorda: ore × compenso orario. Le tariffe sono esempi, non minimi di legge.</p>`
}

function scheda(a, salvato) {
  return `
  <article class="scheda" data-id="${a.id}">
    <div class="scheda__alto">
      <span class="scheda__cat">${esc(NOME_CAT[a.cat])}</span>
      ${a.urgente ? '<span class="scheda__urgente">Urgente</span>' : ''}
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
  const formalizzazione = privato
    ? 'Per gli incarichi dei privati si possono usare strumenti come il Libretto Famiglia o la prestazione occasionale: la forma giusta va verificata caso per caso.'
    : 'L’azienda indica la forma del rapporto prima della conferma (per esempio lavoro intermittente o a chiamata). Un incarico breve non è per forza occasionale.'
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
      <dt>Pagamento</dt><dd>Lo paga direttamente chi pubblica. JobExpress non trattiene nulla dal compenso.</dd>
      <dt>Forma del rapporto</dt><dd>${formalizzazione}</dd>
      <dt>Recensioni</dt><dd>Ancora nessuna recensione per chi pubblica.</dd>
    </dl>
    ${c ? `<p class="dettaglio__compat ${c.ok ? 'si' : 'no'}">${esc(c.testo)}</p>` : ''}
    <div class="finestra__azioni">
      <button class="tasto" type="button" data-candidati>Candidati</button>
      <button class="tasto tasto--chiaro" type="button" data-d-salva aria-pressed="${salvati.has(a.id)}">${salvati.has(a.id) ? 'Salvato' : 'Salva'}</button>
      <button class="tasto tasto--chiaro" type="button" data-condividi>Condividi</button>
      <button class="tasto tasto--chiaro" type="button" data-segnala>Segnala</button>
    </div>
    <p class="finestra__nota" data-d-esito aria-live="polite">Incarico di esempio, non reale.</p>`)
  const fin = document.querySelector('dialog.finestra')
  const esito = fin.querySelector('[data-d-esito]')
  fin.querySelector('[data-candidati]').onclick = () => strumenti.accesso('Per candidarti, accedi')
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
    esito.textContent = 'Segnalazione simulata: nella versione completa arriva al team di moderazione.'
  }
}

const filtriAttivi = () => filtri.quando !== 'tutti' || filtri.citta !== 'tutte' || filtri.km || filtri.minimo || filtri.chi !== 'tutti' || filtri.urgenti || filtri.compatibili || filtri.salvati

// ---------- avvio ----------
export function mostraIncarichi(box, strumenti) {
  const salvati = leggiSalvati()
  box.innerHTML = barraFiltri()
  const schede = box.querySelector('[data-schede]')
  const conto = box.querySelector('[data-conto-incarichi]')

  const ridisegna = () => {
    const lista = filtra(salvati)
    conto.textContent = `${lista.length} ${lista.length === 1 ? 'incarico' : 'incarichi'}`
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
    const cuore = e.target.closest('[data-salva]')
    if (cuore) {
      const id = Number(cuore.dataset.salva)
      salvati.has(id) ? salvati.delete(id) : salvati.add(id)
      scriviSalvati(salvati)
      return ridisegna()
    }
    const apri = e.target.closest('[data-dettagli]')
    if (apri) return dettaglio(INCARICHI_DEMO.find((a) => a.id === Number(apri.dataset.dettagli)), strumenti, salvati, ridisegna)
    if (e.target.closest('[data-azzera]')) {
      Object.assign(filtri, { cat: 'tutte', quando: 'tutti', citta: 'tutte', km: 0, minimo: 0, chi: 'tutti', urgenti: false, compatibili: false, salvati: false })
      mostraIncarichi(box, strumenti)
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
  ridisegna()
  box.querySelector(`[data-f-cat="${filtri.cat}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
}
