// Area di chi pubblica (aziende e privati): procedura guidata in 8 passaggi,
// annunci (bozze, attivi, programmati, chiusi) e candidature ricevute.
// La pubblicazione è sempre gratuita.
// In questa versione di prova tutto resta su questo dispositivo e le candidature
// ricevute sono di esempio.
import { CATEGORIE, NOME_CAT, aggiornaBacheca, registraFonte, scheda } from './incarichi.js'
import { avviaConversazione } from './chat.js'
import { notifica } from './notifiche.js'
import { apriRecensione, controllaRicerche } from './lavori.js'
import { aggiorna as aggiornaReale, caricaBacheca, pannelloCommittenteReale, pubblicaReale } from './reale.js'

const CHIAVE = 'jobexpress-miei-annunci'
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const hhmm = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
const daOra = (v) => { const [h, m] = String(v || '').split(':').map(Number); return Number.isNaN(h) ? null : h + (m || 0) / 60 }
const oggiIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const nomeData = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

// Categorie che non si pubblicano in automatico: vanno controllate prima
const DA_VERIFICARE = ['persona']
const CITTA = { 'Forlì': [2, [12, -14]], Forlimpopoli: [8, [69, 38]], Bertinoro: [12, [75, 82]], Meldola: [13, [18, 107]], 'Castrocaro Terme': [11, [-73, 53]], Predappio: [15, [-50, 132]], Cesena: [19, [161, 93]] }
const FORME = [
  'Da definire con un consulente del lavoro',
  'Lavoro intermittente (a chiamata)',
  'Contratto a tempo determinato',
  'Prestazione occasionale',
  'Libretto Famiglia (per i privati)',
]
const PAGAMENTI = ['Bonifico', 'In busta paga', 'Libretto Famiglia (INPS)', 'Da concordare']
const LUOGHI = ['Nella mia attività', 'A casa mia', 'All’aperto', 'Online']
const NOMI_PROVA = [['Sara', 'Due stagioni in sala, automunita'], ['Luca', 'Studente, disponibile la sera'], ['Amina', 'Esperienza in hotel e bar'], ['Davide', 'Abituato a lavori di fatica'], ['Marta', 'Ha lavorato in cucina'], ['Yassin', 'Disponibile anche all’ultimo minuto']]
const STATI = { bozza: 'Bozza', attivo: 'Attivo', programmato: 'Programmato', revisione: 'In revisione', chiuso: 'Chiuso' }

let s = {} // strumenti: apri, utente, apriAccesso, dopo
const leggi = () => { try { return JSON.parse(localStorage.getItem(CHIAVE) || '[]') } catch { return [] } }
const scrivi = (l) => { try { localStorage.setItem(CHIAVE, JSON.stringify(l)) } catch { /* non disponibile */ } }

// Un annuncio programmato diventa attivo da solo all'ora scelta
function aggiornaStati() {
  const l = leggi()
  let cambiato = false
  l.forEach((a) => {
    if (a.stato === 'programmato' && a.pubblicaIl <= Date.now()) { a.stato = 'attivo'; a.candidati = candidatiProva(a); cambiato = true }
  })
  if (cambiato) scrivi(l)
  return l
}

function candidatiProva(a) {
  const n = 2 + (a.titolo.length % 2)
  const inizio = a.titolo.length % NOMI_PROVA.length
  return Array.from({ length: n }, (_, i) => {
    const [nome, info] = NOMI_PROVA[(inizio + i) % NOMI_PROVA.length]
    return { nome, info, stato: 'nuova' }
  })
}

// ---------- dagli annunci alla bacheca ----------
function comeIncarico(a) {
  const d = new Date(`${a.data}T00:00:00`)
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const diff = Math.round((d - oggi) / 864e5)
  const giorno = diff === 0 ? 'oggi' : diff === 1 ? 'domani' : ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'][d.getDay()]
  const [km, pos] = CITTA[a.citta] || [20, [120, 120]]
  const ore = a.fine - a.inizio
  return {
    id: a.id, titolo: a.titolo, cat: a.cat, chi: a.chi, tipo: a.tipo, citta: a.citta, zona: a.zona || 'zona indicativa',
    km, pos, giorno, data: a.data, inizio: a.inizio, fine: a.fine, euroOra: a.euroOra, urgente: a.urgente,
    esperienza: a.esperienza, requisiti: a.requisiti.length ? a.requisiti : ['Nessun requisito particolare'], descrizione: a.descrizione,
    ore, totale: Math.round(a.euroOra * ore * 100) / 100, mio: true, forma: a.forma,
    pagamento: `${a.pagamento} · compenso ${a.natura.toLowerCase()}`, mansioni: a.mansioni, rimborsi: a.rimborsi,
  }
}
export function annunciInBacheca() {
  const settimana = new Date(); settimana.setDate(settimana.getDate() + 7)
  return aggiornaStati().filter((a) => a.stato === 'attivo' && !a.realeId && a.data >= oggiIso() && new Date(`${a.data}T00:00:00`) < settimana).map(comeIncarico)
}

// ---------- procedura guidata ----------
const PASSI = ['Categoria', 'Descrizione', 'Quando', 'Dove', 'Compenso', 'Formalizzazione', 'Anteprima', 'Pubblicazione']
let bozza = null
let passo = 0

function nuovaBozza() {
  const u = s.utente()
  const privato = !u.modalita?.includes('attivita') && u.modalita?.includes('privato')
  return {
    id: `m-${Date.now()}`, stato: 'bozza', cat: '', titolo: '', descrizione: '', mansioni: '', requisiti: [], esperienza: 'nessuna',
    data: oggiIso(), inizio: 18, fine: 22, ricorrenza: 'nessuna', urgente: false,
    citta: u.citta || 'Forlì', zona: '', luogo: privato ? 'A casa mia' : 'Nella mia attività', indirizzo: '',
    euroOra: 11, natura: 'Lordo', pagamento: privato ? 'Libretto Famiglia (INPS)' : 'In busta paga', rimborsi: '',
    forma: privato ? FORME[4] : FORME[0],
    tipo: privato ? 'privato' : 'azienda', chi: privato ? 'Privato' : (u.nome || 'La mia attività'), candidati: [], creato: Date.now(),
  }
}

const campo = (id, etichetta, html, extra = '') => `<div class="campo"><label for="${id}">${etichetta}${extra}</label>${html}</div>`
const opz = (lista, scelto) => lista.map((v) => `<option ${v === scelto ? 'selected' : ''}>${esc(v)}</option>`).join('')

function corpoPasso() {
  const b = bozza
  switch (passo) {
    case 0: return `
      <fieldset class="pa-cat"><legend class="sr">Categoria</legend>
        ${CATEGORIE.map(([k, t]) => `<label class="pillola"><input type="radio" name="cat" value="${k}" ${b.cat === k ? 'checked' : ''} required /> <span>${t}</span></label>`).join('')}
      </fieldset>
      <p class="finestra__nota" data-nota-cat>${DA_VERIFICARE.includes(b.cat) ? 'Questa categoria richiede una verifica: l’annuncio resterà in revisione prima di essere visibile.' : 'Scegli la categoria che descrive meglio l’incarico.'}</p>`
    case 1: return `
      ${campo('pa-titolo', 'Titolo', `<input id="pa-titolo" name="titolo" required minlength="4" maxlength="80" value="${esc(b.titolo)}" placeholder="Cameriere o cameriera di sala" />`)}
      ${campo('pa-desc', 'Descrizione', `<textarea id="pa-desc" name="descrizione" required minlength="20" maxlength="1000" rows="3" placeholder="Cosa c’è da fare, in poche righe">${esc(b.descrizione)}</textarea>`)}
      ${campo('pa-mans', 'Mansioni', `<input id="pa-mans" name="mansioni" maxlength="200" value="${esc(b.mansioni)}" placeholder="Servizio ai tavoli, sparecchiare" />`, ' <span class="facoltativo">facoltativo</span>')}
      ${campo('pa-req', 'Requisiti', `<input id="pa-req" name="requisiti" maxlength="200" value="${esc(b.requisiti.join(', '))}" placeholder="Divisa fornita, automunito/a" />`, ' <span class="facoltativo">separati da virgola</span>')}
      ${campo('pa-esp', 'Esperienza necessaria', `<select id="pa-esp" name="esperienza">${[['nessuna', 'Nessuna'], ['minima', 'Un po’'], ['richiesta', 'Richiesta']].map(([v, t]) => `<option value="${v}" ${b.esperienza === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}`
    case 2: return `
      ${campo('pa-data', 'Giorno', `<input id="pa-data" name="data" type="date" required min="${oggiIso()}" value="${b.data}" />`)}
      <div class="pa-due">
        ${campo('pa-ini', 'Dalle', `<input id="pa-ini" name="inizio" type="time" step="900" required value="${hhmm(b.inizio)}" />`)}
        ${campo('pa-fine', 'Alle', `<input id="pa-fine" name="fine" type="time" step="900" required value="${hhmm(b.fine % 24)}" />`)}
      </div>
      <p class="pa-calcolo" data-durata></p>
      ${campo('pa-ric', 'Si ripete?', `<select id="pa-ric" name="ricorrenza"><option value="nessuna" ${b.ricorrenza === 'nessuna' ? 'selected' : ''}>No, solo questa volta</option><option value="settimana" ${b.ricorrenza === 'settimana' ? 'selected' : ''}>Sì, ogni settimana</option></select>`)}
      <label class="spunta"><input type="checkbox" name="urgente" ${b.urgente ? 'checked' : ''} /> Mi serve qualcuno con urgenza</label>`
    case 3: return `
      ${campo('pa-citta', 'Città', `<input id="pa-citta" name="citta" list="pa-citta-l" required maxlength="80" value="${esc(b.citta)}" /><datalist id="pa-citta-l">${Object.keys(CITTA).map((c) => `<option value="${c}"></option>`).join('')}</datalist>`)}
      ${campo('pa-zona', 'Zona', `<input id="pa-zona" name="zona" maxlength="60" value="${esc(b.zona)}" placeholder="centro, zona stazione…" />`, ' <span class="facoltativo">facoltativo</span>')}
      ${campo('pa-luogo', 'Dove si svolge', `<select id="pa-luogo" name="luogo">${opz(LUOGHI, b.luogo)}</select>`)}
      ${campo('pa-ind', 'Indirizzo', `<input id="pa-ind" name="indirizzo" maxlength="160" value="${esc(b.indirizzo)}" autocomplete="street-address" />`, ' <span class="facoltativo">facoltativo</span>')}
      <p class="finestra__nota">L’indirizzo non è mai pubblico: lo vede solo la persona che confermi. Nella bacheca appare solo la zona.</p>`
    case 4: return `
      <div class="pa-due">
        ${campo('pa-euro', 'Compenso all’ora (€)', `<input id="pa-euro" name="euroOra" type="number" inputmode="decimal" min="1" max="200" step="0.5" required value="${b.euroOra}" />`)}
        ${campo('pa-nat', 'Natura del compenso', `<select id="pa-nat" name="natura">${opz(['Lordo', 'Netto'], b.natura)}</select>`)}
      </div>
      <p class="pa-calcolo" data-totale></p>
      ${campo('pa-pag', 'Come paghi', `<select id="pa-pag" name="pagamento">${opz(PAGAMENTI, b.pagamento)}</select>`)}
      ${campo('pa-rimb', 'Rimborsi', `<input id="pa-rimb" name="rimborsi" maxlength="120" value="${esc(b.rimborsi)}" placeholder="Pasto, benzina…" />`, ' <span class="facoltativo">facoltativo</span>')}
      <p class="finestra__nota">Il compenso lo paghi tu direttamente alla persona. JobExpress non trattiene niente e la pubblicazione è gratuita.</p>`
    case 5: return `
      ${campo('pa-forma', 'Come pensi di formalizzare l’incarico?', `<select id="pa-forma" name="forma">${opz(FORME, b.forma)}</select>`)}
      <p class="finestra__nota">Un incarico breve non è per forza una prestazione occasionale: la forma giusta dipende da come si svolge il lavoro. Nel dubbio, chiedi a un consulente del lavoro.</p>`
    case 6: return `
      <p>Così lo vedrà chi cerca lavoro:</p>
      <div class="pa-anteprima">${scheda(comeIncarico(bozza), false)}</div>
      <dl class="dettaglio__info">
        <dt>Descrizione</dt><dd>${esc(b.descrizione)}</dd>
        <dt>Dove</dt><dd>${esc(b.citta)}${b.zona ? `, ${esc(b.zona)}` : ''} · ${esc(b.luogo)}${b.indirizzo ? ' · indirizzo nascosto fino alla conferma' : ''}</dd>
        <dt>Pagamento</dt><dd>${esc(b.pagamento)}, compenso ${esc(b.natura.toLowerCase())}${b.rimborsi ? ` · rimborsi: ${esc(b.rimborsi)}` : ''}</dd>
        <dt>Forma</dt><dd>${esc(b.forma)}</dd>
        ${b.ricorrenza === 'settimana' ? '<dt>Ricorrenza</dt><dd>Ogni settimana</dd>' : ''}
      </dl>`
    case 7: {
      const verifica = DA_VERIFICARE.includes(b.cat)
      return `
      <div class="pa-scelte">
        <label class="pa-scelta"><input type="radio" name="come" value="ora" checked /> <span><strong>${verifica ? 'Invia in revisione' : 'Pubblica adesso'}</strong> ${verifica ? 'Lo controlliamo e poi diventa visibile.' : 'Diventa subito visibile nella bacheca.'}</span></label>
        <label class="pa-scelta"><input type="radio" name="come" value="programma" ${verifica ? 'disabled' : ''} /> <span><strong>Programma</strong> Scegli tu quando pubblicarlo.
          <input type="datetime-local" name="quando" aria-label="Quando pubblicare" min="${new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)}" /></span></label>
        <label class="pa-scelta"><input type="radio" name="come" value="bozza" /> <span><strong>Salva come bozza</strong> Lo finisci dopo, da «La mia area».</span></label>
      </div>
      <p class="finestra__nota">Versione di prova: l’annuncio resta su questo dispositivo e le candidature che riceverai sono di esempio.</p>`
    }
  }
  return ''
}

function disegnaProcedura() {
  s.apri(`
    <p class="dettaglio__cat">Pubblica un incarico · gratis</p>
    <h2>${PASSI[passo]}</h2>
    <div class="pa-avanzamento" role="progressbar" aria-valuemin="1" aria-valuemax="8" aria-valuenow="${passo + 1}" aria-label="Passo ${passo + 1} di 8">
      ${PASSI.map((_, i) => `<i class="${i <= passo ? 'fatto' : ''}"></i>`).join('')}
    </div>
    <p class="pa-passo">Passo ${passo + 1} di 8</p>
    <form class="conto-form" data-procedura novalidate>
      ${corpoPasso()}
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni pa-azioni">
        ${passo > 0 ? '<button type="button" class="tasto tasto--chiaro" data-indietro>Indietro</button>' : ''}
        <button type="submit" class="tasto">${passo === 7 ? 'Conferma' : 'Avanti'}</button>
      </div>
    </form>`)
  const dlg = document.querySelector('dialog.finestra')
  const f = dlg.querySelector('[data-procedura]')
  const calcola = () => {
    const ini = daOra(f.elements.inizio?.value ?? hhmm(bozza.inizio))
    let fine = daOra(f.elements.fine?.value ?? hhmm(bozza.fine))
    if (ini != null && fine != null && fine <= ini) fine += 24
    const ore = ini != null && fine != null ? fine - ini : 0
    const d = dlg.querySelector('[data-durata]')
    if (d) d.textContent = ore ? `Durata: ${String(Math.round(ore * 100) / 100).replace('.', ',')} ore${fine > 24 ? ' (finisce dopo mezzanotte)' : ''}` : ''
    const t = dlg.querySelector('[data-totale]')
    if (t) {
      const e = Number(f.elements.euroOra.value)
      const oreB = bozza.fine - bozza.inizio
      t.textContent = e > 0 ? `Totale stimato: ${euro.format(e * oreB)} per ${String(oreB).replace('.', ',')} ore` : ''
    }
  }
  f.addEventListener('input', calcola)
  f.addEventListener('change', (e) => {
    if (e.target.name === 'cat') {
      dlg.querySelector('[data-nota-cat]').textContent = DA_VERIFICARE.includes(e.target.value)
        ? 'Questa categoria richiede una verifica: l’annuncio resterà in revisione prima di essere visibile.' : 'Ottima scelta.'
    }
    if (e.target.name === 'quando') f.querySelector('[value=programma]').checked = true
  })
  calcola()
  dlg.querySelector('[data-indietro]')?.addEventListener('click', () => { leggiCampi(f); passo--; disegnaProcedura() })
  f.onsubmit = (e) => {
    e.preventDefault()
    const errore = leggiCampi(f)
    if (errore) { f.querySelector('[data-errore]').textContent = errore; return }
    if (passo < 7) { passo++; return disegnaProcedura() }
    concludi(f)
  }
  dlg.querySelector('input:not([type=hidden]), select, textarea')?.focus()
}

// Legge i campi del passo nella bozza. Restituisce un messaggio se qualcosa non va.
function leggiCampi(f) {
  const b = bozza
  const v = (n) => f.elements[n]?.value?.trim() ?? ''
  switch (passo) {
    case 0:
      if (!f.querySelector('[name=cat]:checked')) return 'Scegli una categoria.'
      b.cat = f.querySelector('[name=cat]:checked').value
      break
    case 1:
      b.titolo = v('titolo'); b.descrizione = v('descrizione'); b.mansioni = v('mansioni'); b.esperienza = v('esperienza')
      b.requisiti = v('requisiti').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5)
      if (b.titolo.length < 4) return 'Scrivi un titolo di almeno 4 lettere.'
      if (b.descrizione.length < 20) return 'Scrivi una descrizione di almeno 20 caratteri: aiuta a ricevere candidature giuste.'
      break
    case 2: {
      const ini = daOra(v('inizio'))
      let fine = daOra(v('fine'))
      if (!v('data') || v('data') < oggiIso()) return 'Scegli un giorno da oggi in poi.'
      if (ini == null || fine == null) return 'Indica l’ora di inizio e di fine.'
      if (fine <= ini) fine += 24
      if (fine - ini > 12) return 'Un incarico può durare al massimo 12 ore.'
      if (fine - ini < 0.5) return 'Un incarico deve durare almeno mezz’ora.'
      Object.assign(b, { data: v('data'), inizio: ini, fine, ricorrenza: v('ricorrenza'), urgente: f.elements.urgente.checked })
      break
    }
    case 3:
      if (v('citta').length < 2) return 'Indica la città.'
      Object.assign(b, { citta: v('citta'), zona: v('zona'), luogo: v('luogo'), indirizzo: v('indirizzo') })
      break
    case 4: {
      const e = Number(String(v('euroOra')).replace(',', '.'))
      if (!(e >= 1 && e <= 200)) return 'Indica un compenso orario tra 1 e 200 €.'
      Object.assign(b, { euroOra: e, natura: v('natura'), pagamento: v('pagamento'), rimborsi: v('rimborsi') })
      break
    }
    case 5:
      b.forma = v('forma')
      break
    case 7: {
      const come = f.querySelector('[name=come]:checked')?.value
      if (come === 'programma') {
        const q = new Date(v('quando')).getTime()
        if (!q || q <= Date.now()) return 'Scegli una data e un’ora future per la pubblicazione.'
        b.pubblicaIl = q
      }
      b._come = come
      break
    }
  }
  return ''
}

function concludi() {
  const b = bozza
  const come = b._come
  delete b._come
  if (come === 'bozza') b.stato = 'bozza'
  else if (DA_VERIFICARE.includes(b.cat)) b.stato = 'revisione'
  else if (come === 'programma') b.stato = 'programmato'
  else { b.stato = 'attivo'; b.candidati = b.candidati.length ? b.candidati : candidatiProva(b) }
  if (b.stato === 'attivo') notifica('ricevuta', `${b.candidati.length} candidature di esempio per «${b.titolo}».`, { scheda: 'attivita', modo: 'pubblico' })
  const l = leggi().filter((x) => x.id !== b.id)
  l.unshift(b)
  scrivi(l)
  aggiornaBacheca()
  // Account vero: l'annuncio attivo viene pubblicato anche nel database (le regole le applica Supabase)
  if (b.stato === 'attivo' && !b.realeId) {
    pubblicaReale(b).then((id) => {
      if (!id) return
      const l2 = leggi(); const x = l2.find((y) => y.id === b.id)
      if (x) { x.realeId = id; x.candidati = []; scrivi(l2) }
      caricaBacheca(); aggiornaReale(); aggiornaBacheca()
    }).catch(() => notifica('annuncio', `«${b.titolo}» non è stato pubblicato nel database: riprova più tardi.`, { scheda: 'attivita', modo: 'pubblico' }))
  }
  controllaRicerche()
  const testi = {
    attivo: 'È visibile nella bacheca. Le candidature arrivano nella tua area.',
    bozza: 'La trovi in «La mia area» → Attività, quando vuoi finirla.',
    programmato: `Verrà pubblicato ${new Date(b.pubblicaIl).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`,
    revisione: 'Questa categoria richiede un controllo prima di essere visibile.',
  }
  s.apri(`<h2>${{ attivo: 'Incarico pubblicato', bozza: 'Bozza salvata', programmato: 'Pubblicazione programmata', revisione: 'Inviato in revisione' }[b.stato]}</h2>
    <p>${esc(b.titolo)} · ${nomeData(b.data)}, ${hhmm(b.inizio)}–${hhmm(b.fine)}</p><p>${testi[b.stato]}</p>
    <div class="finestra__azioni"><button type="button" class="tasto" data-vai-area>Vai ai tuoi annunci</button></div>`)
  document.querySelector('dialog.finestra [data-vai-area]').onclick = () => { document.querySelector('dialog.finestra').close(); s.dopo() }
  bozza = null
}

export const haAnnunci = () => leggi().length > 0
export const tuttiIMieiAnnunci = () => aggiornaStati()

// Moderazione dall'area Admin: approva o rifiuta un annuncio in revisione
export function moderaAnnuncio(id, approvato) {
  const l = leggi()
  const a = l.find((x) => x.id === id)
  if (!a) return null
  a.stato = approvato ? 'attivo' : 'bozza'
  if (approvato && !a.candidati.length) a.candidati = candidatiProva(a)
  scrivi(l)
  aggiornaBacheca()
  notifica('annuncio', approvato ? `«${a.titolo}» è stato approvato ed è visibile.` : `«${a.titolo}» non è stato approvato: lo trovi tra le bozze per correggerlo.`, { scheda: 'attivita', modo: 'pubblico' })
  return a
}

export function apriProcedura(id) {
  const u = s.utente()
  if (!u) return s.apriAccesso('Per pubblicare un incarico, registrati o accedi')
  const esistente = id && leggi().find((a) => a.id === id)
  bozza = esistente ? { ...esistente } : nuovaBozza()
  passo = esistente ? 1 : 0
  disegnaProcedura()
}

// ---------- pannelli dell'area ----------
function conteggi(l) {
  return {
    attivi: l.filter((a) => a.stato === 'attivo').length,
    bozze: l.filter((a) => a.stato === 'bozza').length,
    nuove: l.reduce((t, a) => t + a.candidati.filter((c) => c.stato === 'nuova').length, 0),
    confermare: l.reduce((t, a) => t + a.candidati.filter((c) => c.stato === 'selezionato').length, 0),
    programmati: l.filter((a) => a.stato === 'programmato').length,
    chiusi: l.filter((a) => a.stato === 'chiuso').length,
  }
}

export function pannelloPubblicatoreHome() {
  const l = aggiornaStati()
  const c = conteggi(l)
  return `
    <div class="area__griglia">
      <article class="riquadro riquadro--dispo riquadro--largo">
        <h3>Hai bisogno di una mano?</h3>
        <p class="grande">Pubblica un incarico</p>
        <p>In pochi passaggi, gratis. Le candidature arrivano qui.</p>
        <button type="button" class="tasto tasto--lime" data-pubblica>+ Pubblica un incarico</button>
      </article>
      <article class="riquadro riquadro--largo">
        <h3>I tuoi incarichi</h3>
        <ul class="stat stat--sei">
          <li><strong>${c.attivi}</strong><span>Annunci attivi</span></li>
          <li><strong>${c.nuove}</strong><span>Candidature da vedere</span></li>
          <li><strong>${c.confermare}</strong><span>Da confermare</span></li>
          <li><strong>${c.bozze}</strong><span>Bozze</span></li>
          <li><strong>${c.programmati}</strong><span>Programmati</span></li>
          <li><strong>${c.chiusi}</strong><span>Chiusi</span></li>
        </ul>
        ${l.length ? '<button type="button" class="tasto tasto--chiaro" data-area-scheda="attivita">Gestisci gli annunci</button>' : ''}
      </article>
    </div>`
}

let filtroStato = 'tutti'
export function pannelloAnnunci() {
  const l = aggiornaStati()
  const veri = pannelloCommittenteReale()
  if (!l.length) {
    if (veri.includes('<ul')) return veri
    return `${veri}<div class="vuoto"><strong>Nessun annuncio.</strong><p>Pubblica il tuo primo incarico: è gratis e ci vogliono pochi minuti.</p>
      <button type="button" class="tasto" data-pubblica>+ Pubblica un incarico</button></div>`
  }
  const mostrati = l.filter((a) => filtroStato === 'tutti' || a.stato === filtroStato)
  return `${veri}
    <div class="pa-testa">
      <div class="filtri__categorie" role="group" aria-label="Filtra per stato">
        ${[['tutti', 'Tutti'], ...Object.entries(STATI)].map(([k, t]) => `<button type="button" data-pa-filtro="${k}" aria-pressed="${filtroStato === k}">${t}</button>`).join('')}
      </div>
      <button type="button" class="tasto" data-pubblica>+ Pubblica un incarico</button>
    </div>
    ${mostrati.length ? `<ul class="candidature">${mostrati.map(rigaAnnuncio).join('')}</ul>` : '<p class="vuoto">Nessun annuncio in questo stato.</p>'}
    <p class="finestra__nota">Versione di prova: gli annunci restano su questo dispositivo. Le candidature ricevute sono di esempio.</p>`
}

function rigaAnnuncio(a) {
  const azioni = {
    bozza: [['modifica', 'Continua'], ['pubblica', 'Pubblica'], ['elimina', 'Elimina']],
    attivo: [['modifica', 'Modifica'], ['chiudi', 'Chiudi'], ['duplica', 'Duplica']],
    programmato: [['pubblica', 'Pubblica adesso'], ['modifica', 'Modifica'], ['annulla', 'Annulla']],
    revisione: [['modifica', 'Modifica']],
    chiuso: [['ripubblica', 'Ripubblica'], ['duplica', 'Duplica'], ['elimina', 'Elimina']],
  }[a.stato]
  const nuove = a.candidati.filter((c) => c.stato === 'nuova').length
  return `
    <li class="candidatura pa-annuncio">
      <div>
        <strong>${esc(a.titolo || 'Senza titolo')}</strong>
        <p>${esc(NOME_CAT[a.cat] || 'Categoria da scegliere')} · ${nomeData(a.data)}, ${hhmm(a.inizio)}–${hhmm(a.fine)} · ${esc(a.citta)}</p>
        <p>${euro.format(a.euroOra)}/ora · circa ${euro.format(a.euroOra * (a.fine - a.inizio))}${a.stato === 'programmato' ? ` · esce ${new Date(a.pubblicaIl).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
      </div>
      <div class="candidatura__lato">
        <span class="stato stato--${a.stato}">${STATI[a.stato]}</span>
        ${a.candidati.length ? `<span class="pa-num">${a.candidati.length} candidature${nuove ? ` · ${nuove} nuove` : ''}</span>` : ''}
      </div>
      <div class="pa-azioni-riga">${azioni.map(([k, t]) => `<button type="button" class="tasto tasto--chiaro" data-pa="${k}" data-pa-id="${a.id}">${t}</button>`).join('')}</div>
      ${a.candidati.length ? `
        <details class="pa-cand" ${nuove ? 'open' : ''}><summary>Candidature ricevute</summary>
          <ul>${a.candidati.map((c, i) => `<li>
            <span class="avatar avatar--piccolo" aria-hidden="true">${esc(c.nome[0])}</span>
            <div><strong>${esc(c.nome)}</strong> <span class="etichetta-esempio">esempio</span><p>${esc(c.info)}</p></div>
            ${c.stato === 'nuova' ? `<div class="pa-azioni-riga"><button type="button" class="tasto" data-pa="seleziona" data-pa-id="${a.id}" data-pa-c="${i}">Seleziona</button><button type="button" class="tasto tasto--chiaro" data-pa="scarta" data-pa-id="${a.id}" data-pa-c="${i}">Non selezionare</button></div>`
              : c.stato === 'selezionato' ? `<span class="stato stato--selezionato">Selezionato</span><button type="button" class="tasto tasto--chiaro" data-pa="completa" data-pa-id="${a.id}" data-pa-c="${i}">Segna come completato</button>`
              : c.stato === 'completato' ? `<span class="stato">Completato</span>${c.recensito ? '' : `<button type="button" class="tasto tasto--chiaro" data-pa="recensisci" data-pa-id="${a.id}" data-pa-c="${i}">Lascia una recensione</button>`}`
              : '<span class="stato stato--scartato">Non selezionato</span>'}
          </li>`).join('')}</ul>
          <p class="finestra__nota">Selezionare qualcuno non è ancora un contratto: prima di iniziare va formalizzato il rapporto.</p>
        </details>` : ''}
    </li>`
}

// Restituisce true se l'area va ridisegnata
export function gestisciPubblicatore(e) {
  const f = e.target.closest('[data-pa-filtro]')
  if (f) { filtroStato = f.dataset.paFiltro; return true }
  const b = e.target.closest('[data-pa]')
  if (!b) return false
  const l = leggi()
  const a = l.find((x) => x.id === b.dataset.paId)
  if (!a) return false
  const k = b.dataset.pa
  if (k === 'modifica') { apriProcedura(a.id); return false }
  if (k === 'elimina') {
    if (b.dataset.conferma !== 'si') { b.dataset.conferma = 'si'; b.textContent = 'Tocca ancora per eliminare'; return false }
    scrivi(l.filter((x) => x !== a))
  }
  if (k === 'pubblica' || k === 'ripubblica') {
    a.stato = DA_VERIFICARE.includes(a.cat) ? 'revisione' : 'attivo'
    if (a.stato === 'attivo' && !a.candidati.length) a.candidati = candidatiProva(a)
    if (k === 'ripubblica' && a.data < oggiIso()) a.data = oggiIso()
  }
  if (k === 'chiudi') a.stato = 'chiuso'
  if (k === 'annulla') a.stato = 'bozza'
  if (k === 'duplica') l.unshift({ ...a, id: `m-${Date.now()}`, stato: 'bozza', candidati: [], titolo: `${a.titolo} (copia)`, data: a.data < oggiIso() ? oggiIso() : a.data })
  if (k === 'seleziona') {
    const c = a.candidati[Number(b.dataset.paC)]
    c.stato = 'selezionato'
    avviaConversazione({ incaricoId: a.id, titolo: a.titolo, con: c.nome, lato: 'pubblico', sistema: `Hai selezionato ${c.nome}. Ora concordate i dettagli e formalizzate il rapporto prima di iniziare.` })
    notifica('selezione', `Hai selezionato ${c.nome} per «${a.titolo}». Trovi la conversazione in Chat.`, { scheda: 'chat' })
  }
  if (k === 'scarta') a.candidati[Number(b.dataset.paC)].stato = 'scartato'
  if (k === 'completa' || k === 'recensisci') {
    const c = a.candidati[Number(b.dataset.paC)]
    if (k === 'completa') c.stato = 'completato'
    const pos = Number(b.dataset.paC)
    scrivi(l)
    apriRecensione({ a: c.nome, incaricoId: a.id, titolo: a.titolo, lato: 'pubblico', dopo: () => { const l2 = leggi(); const x = l2.find((y) => y.id === a.id); if (x) { x.candidati[pos].recensito = true; scrivi(l2) } } })
    return true
  }
  if (k !== 'elimina') scrivi(l)
  aggiornaBacheca()
  return true
}

export function avviaAnnunci(strumenti) {
  s = strumenti
  registraFonte(annunciInBacheca)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-pubblica]')) { e.preventDefault(); apriProcedura() }
  })
}
